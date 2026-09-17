"use client";

/**
 * 商品詳細オーバーレイ（Figma: Product Detail 80:894 / Bottom Detail Bar 110:542）
 *
 * `?item=<商品ID>` が付いている間、**一覧の上に重ねて**表示する。
 * 以前は `/order/item/[id]` へのページ遷移だったが、遷移のたびに一覧が
 * アンマウントされるため「戻るとスクロール位置が失われる」「閉じるアニメ中に
 * 一覧が居らず背景色しか出ない」という2つの問題が構造的に避けられなかった。
 * 一覧を出したまま重ねることで、下から出て下へ引っ込む動きの下に
 * ずっと元の画面が見えている状態になる。
 *
 * **ハーフモーダル**（2026-09-16、天真の決定）。以前は右から出る全画面で、
 * ハンバーガーメニュー（AppDrawer）と器がまったく同じだったため、
 * どちらが主でどちらが従か分からなくなっていた。詳細は従なので下から出す。
 * 閉じ方は3つ: 右上の ×／下へスワイプ／グレーの部分をタップ。
 *
 * `app/order/layout.tsx` に置いてあるので、TOP・カテゴリ一覧・テイクアウトの
 * どのページから開いても同じ1つのオーバーレイが使われる。
 *
 * 下部バーは position:fixed ではなく、オーバーレイ内の flex 末尾に置いている。
 * スライドアニメ中は祖先に transform が乗るので、fixed だとビューポート基準で
 * なくなって一瞬ズレるため。
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import CartIconButton from "@/components/ui/CartIconButton";
import CategoryTag from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import RecommendCard from "@/components/ui/RecommendCard";
import { RecommendCarousel } from "@/components/ui/MenuCarousel";
import { Video9x16 } from "@/components/ui/VideoBlock";
import { AddToCartButton } from "@/components/ui/Buttons";
import ViewCartCountButton from "@/components/ui/ViewCartCountButton";
import ServingTimingCards from "@/components/ui/ServingTimingCards";
import MenuOptionPicker from "@/components/ui/OptionRow";
import PerCupRows from "@/components/ui/PerCupRows";
import { type CupDraft, groupCups, perCupHeading, resizeCups, usesPerCup } from "@/lib/perCup";
import { SoldOutBand, SoldOutPill } from "@/components/ui/SoldOut";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import { resolveTagColor, resolveCategoryLabel } from "@/lib/categoryLabels";
import { computeRelatedItems } from "@/lib/orderHome";
import { ITEM_PARAM, openItemDetail, stripItemParam, takeInitialQty, takePushedByApp } from "@/lib/itemOverlay";
import {
  SERVING_TIMING_TITLE,
  canChooseServingTiming,
  defaultServingTiming,
  servingCategoryType,
  servingTimingOptions,
  type ServingTiming,
} from "@/lib/servingTiming";
import {
  OPTIONS_HEADING_DEFAULT,
  defaultSelection,
  hasSelectableOptions,
  normalizeSelectMode,
  optionsTotal,
  toSelected,
  type MenuOption,
} from "@/lib/menuOptions";
import type { MenuItem } from "@/lib/menu";

/* 下から出る 380ms / 下へ引っ込む 220ms。StaffCallSheet と同じ数値にそろえている
   （アプリ内でシートの出方が1種類になるように） */
const OPEN_MS  = 380;
const CLOSE_MS = 220;
/* この距離より下へ引いたら閉じる。速く弾いた場合は距離が足りなくても閉じる */
const CLOSE_DRAG_PX = 120;
const CLOSE_FLICK_V = 0.6;
/* セレクタが毎回新しい配列を返すと再描画が止まらないので、空は共有の定数にする */
const EMPTY_OPTIONS: MenuOption[] = [];

export default function ItemDetailOverlay() {
  return (
    <Suspense fallback={null}>
      <OverlayContent />
    </Suspense>
  );
}

function OverlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get(ITEM_PARAM);

  const categories   = useMenuDataStore((s) => s.categories);
  const allMenuItems = useMenuDataStore((s) => s.menuItems);
  const addItem      = useCartStore((s) => s.addItem);
  const orderType    = useCartStore((s) => s.orderType);
  const totalItems   = useCartStore((s) => s.totalItems());
  const setOverlay   = useUiStore((s) => s.setOverlay);

  /* シートの出入り。visible=false で画面の下（translateY(100%)）に居る */
  const [visible, setVisible]   = useState(false);
  /* 下スワイプ中の移動量(px)。指に追従させるためだけの値 */
  const [dragY, setDragY]       = useState(0);
  const [dragging, setDragging] = useState(false);
  /* おすすめでたどってきた商品の並び。**履歴（history）には積まない**ので、
     戻る矢印はこれを見る。× は常に一覧まで一発で閉じる（2026-09-16） */
  const [trail, setTrail]       = useState<string[]>([]);
  /* 「カートに入れる」を押したあと。下部バーが丸ごと「カートを見る」に切り替わる。
     **シートを閉じるまで戻らない**（天真の決定 2026-09-16）。
     おすすめで別の商品へ移ったときは別の商品なので、下の effect で false に戻す */
  const [added, setAdded]       = useState(false);
  /* 実際に見えている領域（Chrome の下部ツールバーの出入りで変わる）。null なら dvh に任せる */
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);
  const dragYRef   = useRef(0);
  const closingRef = useRef(false);
  const sheetRef   = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  /* ステッパーは「何個入れるか」の下書き。0個追加は意味がないので下限は1 */
  const [draftQty, setDraftQty] = useState(1);
  /* 提供タイミングの下書き。null は「区分の初期値のまま」 */
  const [draftTiming, setDraftTiming] = useState<ServingTiming | null>(null);
  /* オプション（トッピング）の下書き。null は「初期選択のまま」（1つだけの商品は最初の項目、複数選択は空） */
  const [draftOptionIds, setDraftOptionIds] = useState<string[] | null>(null);
  /* 1杯ごとの選択（lib/perCup.ts）。数量2以上で HOT/ICED か提供タイミングを選べる商品のとき、
     杯ごとの下書きをここに持つ。長さは数量に合わせて resizeCups で揃える（2026-09-16、案B） */
  const [cups, setCups] = useState<CupDraft[]>([]);
  const openedByPushRef = useRef(false);

  const item = itemId ? allMenuItems.find((m) => m.id === itemId) ?? null : null;
  const itemOptions = useMenuDataStore((s) => (itemId ? s.menuOptions[itemId] : undefined) ?? EMPTY_OPTIONS);

  const related = useMemo<MenuItem[]>(
    () => (item ? computeRelatedItems(allMenuItems, item, Infinity) : []),
    [allMenuItems, item]
  );

  /* 提供タイミング（docs/specs/serving-timing.md）。対象商品のときだけ選択カードを出す。
     下書きが無ければ区分の初期値（フード=でき次第 / ドリンク=先出し）を選択済みにする */
  const timingSelectable = item ? canChooseServingTiming(categories, item, orderType) : false;
  const timingType = item ? servingCategoryType(categories, item) : "food";
  const selectedTiming: ServingTiming = draftTiming ?? defaultServingTiming(timingType);

  /* オプション（docs/specs/menu-options.md、案A）。対象商品のときだけ一覧を出す */
  const optionsSelectable = item ? hasSelectableOptions(item, itemOptions) : false;
  const optionsMode = normalizeSelectMode(item?.optionsSelectMode);
  const selectedOptionIds =
    draftOptionIds ?? defaultSelection(optionsMode, itemOptions).map((o) => o.optionId);
  const selectedOptions = itemOptions
    .filter((o) => selectedOptionIds.includes(o.id))
    .map(toSelected);
  const unitPriceWithOptions = (item?.price ?? 0) + optionsTotal(selectedOptions);

  /* 1杯ごとの選択。1つ選ぶ型のオプション（HOT/ICED）と提供タイミングだけを杯ごとに分ける。
     複数選べるトッピングは全杯共通のまま */
  const singleSelectable = optionsSelectable && optionsMode === "single";
  const perCup = usesPerCup(draftQty, singleSelectable, timingSelectable);
  const cupDefaults: CupDraft = {
    optionId: singleSelectable ? itemOptions[0]?.id ?? null : null,
    timing: timingSelectable ? defaultServingTiming(timingType) : null,
  };
  const effectiveCups = perCup ? resizeCups(cups, draftQty, cupDefaults) : [];
  const cupUnit = timingType === "drink" ? "杯" : "個";
  const optionOf = (id: string | null) => itemOptions.find((o) => o.id === id);
  /* 杯ごとに選んだ組み合わせの合計。オプションに価格差があっても正しく足す */
  const perCupTotal = effectiveCups.reduce(
    (sum, cup) => sum + (item?.price ?? 0) + (optionOf(cup.optionId)?.price ?? 0), 0
  );
  const cartTotal = perCup ? perCupTotal : unitPriceWithOptions * draftQty;

  /* 開くたびに数量を1へ戻し、この開き方が history.back() で閉じられるかを覚える。
     商品が変わったときも通るので、おすすめから移った直後はここで先頭までスクロールを戻す。
     visible は**次のフレームで**立てる。同じフレームで true にすると
     translateY(100%) → 0 の差分が生まれず、アニメーションが再生されない */
  useEffect(() => {
    if (!itemId) {
      setVisible(false);
      /* 閉じたら「たどってきた並び」も捨てる。次に開いたときは戻る矢印が出ない */
      setTrail((t) => (t.length ? [] : t));
      return;
    }
    setDraftQty(takeInitialQty());
    setDraftTiming(null);
    setDraftOptionIds(null);
    setCups([]);
    setAdded(false);
    setDragY(0);
    dragYRef.current = 0;
    openedByPushRef.current = takePushedByApp() || openedByPushRef.current;
    scrollRef.current?.scrollTo({ top: 0 });
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [itemId]);

  /* 開いている間はカートのFABを隠し、背面の一覧をスクロールさせない */
  useEffect(() => {
    if (!itemId) return;
    setOverlay("modal");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      setOverlay(null);
      document.body.style.overflow = prevOverflow;
    };
  }, [itemId, setOverlay]);

  /* ⚠ **100dvh を信用しない。**
     Chrome(iOS) は下のツールバーが引っ込むと、100dvh が実際に見えている高さと
     ずれる。シートの下に隙間が空いて背面の一覧が覗いた（2026-09-16、洋輔さんが発見。
     ツールバーが出ているときは正常、引っ込むと崩れる、という出方だった）。
     visualViewport の実寸をそのまま使う。無い環境では h-viewport(dvh) が効く。

     scroll は指を動かすたびに飛んでくるので、**値が変わったときだけ** state を更新する
     （毎回更新するとシート全体が再描画されてスクロールが重くなる）。 */
  useEffect(() => {
    if (!itemId) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () =>
      setViewport((prev) =>
        prev && prev.top === vv.offsetTop && prev.height === vv.height
          ? prev
          : { top: vv.offsetTop, height: vv.height }
      );
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [itemId]);

  /* シートを下へ引っ込めてから、実際に閉じる。
     ここは touch のリスナーからも呼ぶので useCallback で安定させている */
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDragging(false);
    setDragY(0);
    dragYRef.current = 0;
    setVisible(false);
    setTimeout(() => {
      /* アプリが積んだ履歴なら戻す（ブラウザの戻るボタンと挙動を揃える）。
         直リンクで開かれた場合は戻り先がアプリ外なので、パラメータだけ落とす。 */
      if (openedByPushRef.current) {
        openedByPushRef.current = false;
        window.history.back();
      } else {
        stripItemParam();
      }
      closingRef.current = false;
    }, CLOSE_MS);
  }, []);

  /* 別の商品へ移る動き。天真の決定（2026-09-16）で、
     **いったん下へ引っ込めてから新しい商品で出し直す**。
     履歴は置き換えなので（lib/itemOverlay.ts）、何回たどっても × 一発で一覧に戻る */
  const transitionTo = useCallback((id: string) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDragging(false);
    setDragY(0);
    dragYRef.current = 0;
    setVisible(false);
    setTimeout(() => {
      openItemDetail(id, { replace: true });
      closingRef.current = false;
    }, CLOSE_MS);
  }, []);

  /* おすすめから先へ。いま見ている商品を「たどってきた並び」に積む */
  const goToItem = useCallback((id: string) => {
    if (closingRef.current || !itemId) return;
    setTrail((t) => [...t, itemId]);
    transitionTo(id);
  }, [itemId, transitionTo]);

  /* 左上の戻る矢印。**history.back() ではない。**
     履歴は1枚のままにしてあるので（× が一発で閉じるため）、
     ひとつ前の商品は自前の並びから取り出す */
  const goBack = useCallback(() => {
    const prev = trail[trail.length - 1];
    if (!prev || closingRef.current) return;
    setTrail((t) => t.slice(0, -1));
    transitionTo(prev);
  }, [trail, transitionTo]);

  /* 下スワイプで閉じる。
     ⚠ **中身が先頭にあるときだけ**ドラッグを始める。そうしないと、
     記事を読み下げている途中の指の動きでシートが閉じてしまう。
     touchmove は preventDefault したいので、React の onTouchMove ではなく
     addEventListener({ passive: false }) で付ける */
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !itemId) return;

    let active = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || closingRef.current) return;
      if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
      active = true;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      velocity = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (dy <= 0) {
        /* 上向きは通常のスクロールに任せる */
        if (dragYRef.current !== 0) { dragYRef.current = 0; setDragY(0); }
        return;
      }
      e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = e.timeStamp;
      dragYRef.current = dy;
      setDragging(true);
      setDragY(dy);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      setDragging(false);
      if (dragYRef.current > CLOSE_DRAG_PX || velocity > CLOSE_FLICK_V) {
        close();
      } else {
        dragYRef.current = 0;
        setDragY(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [itemId, close]);

  if (!itemId) return null;

  const label = item ? resolveCategoryLabel(categories, item.subcategory) : "";
  const color = item ? resolveTagColor(categories, item.subcategory) : "yellow";
  const subImage = item?.images?.[1] ?? null;
  const hasVideo = (item?.media ?? []).some((m) => m.type === "video");
  /* 売り切れ（docs/specs/sold-out-and-receipt-copies.md）。詳細は開ける（何が売り切れたかは見られる）が、
     KV に帯を被せ、下部バーはステッパーと「カートに入れる」の代わりに押せない SOLD OUT にする */
  const soldOut = item?.isSoldOut === true;

  return (
    /* ── ハーフモーダル（2026-09-16、天真の決定）──
       それまでは右から出る**全画面**で、ハンバーガーメニューと見分けが付かなかった。
       詳細はあくまでサブなので、下から出るシートにして主従を分けている。
       器（グレーのオーバーレイ / rounded-t / translateY / 時間）は
       StaffCallSheet・StoreInfoModal と同じ作りにそろえた。

       高さは dvh で取る。モバイルのアドレスバーが引っ込むと表示領域だけが広がるので、
       vh のままだと下部バーの下に隙間が空いて背面の一覧が透けて見えてしまう。
       60px はスタッフ呼び出し等の .bottom-sheet と同じ「上に覗かせる量」。 */
    <div
      className="fixed left-0 right-0 top-0 h-viewport z-50 flex items-end justify-center"
      style={{
        /* visualViewport が取れたら実寸を優先する（上の useEffect のコメント参照） */
        ...(viewport ? { top: viewport.top, height: viewport.height } : null),
        /* 指で引いている間はオーバーレイも一緒に薄くする（閉じる手応えを出すため） */
        background: `rgba(0, 0, 0, ${visible ? Math.max(0, 0.5 * (1 - dragY / 400)) : 0})`,
        transition: dragging ? "none" : `background ${CLOSE_MS}ms linear`,
      }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={item?.name ?? "商品詳細"}
    >
      <div
        ref={sheetRef}
        className="relative bg-bg-primary flex flex-col w-full max-w-md rounded-t-[var(--radius-xl)] overflow-hidden"
        style={{
          height: "calc(100% - 60px)",
          transform: visible ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging
            ? "none"
            : visible
              ? `transform ${OPEN_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
              : `transform ${CLOSE_MS}ms ease-out`,
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {!item ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-16)] px-[var(--space-16)]">
            <p className="type-jp-body text-text-secondary">商品が見つかりませんでした</p>
            <button
              type="button"
              onClick={close}
              className="type-jp-body-bold text-text-primary underline"
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            {/* overscroll-contain: 端まで来たときに背面の一覧へスクロールが伝わらないようにする */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
              {/* ── KV: メイン画像 + 右上の×（全画面共通のルール） ──
                  写真が無い商品（文字メニュー）はグレーの空箱を出さず、×だけの薄い帯にする
                  （docs/specs/menu-text-rows.md 4章）。 */}
              <div
                className={`relative w-full ${item.image ? "bg-bg-tertiary" : ""}`}
                style={{ height: item.image ? 260 : 72 }}
              >
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className={`absolute inset-0 w-full h-full object-cover ${soldOut ? "sold-out-photo" : ""}`}
                  />
                )}
                {soldOut && item.image && <SoldOutBand size="lg" />}

                {/* つまみ。**写真の上に重ねる**（天真の指示 2026-09-16）。
                    以前は写真の上に帯を1本敷いていたが、シート上部に隙間が空いて
                    綺麗でなかった。写真を上まで敷き詰め、つまみは白抜きにする。
                    写真の無い商品（薄い帯だけ）は白だと見えないので、そのときだけ枠線色。 */}
                <span
                  className={`absolute left-1/2 -translate-x-1/2 top-[8px] w-[36px] h-[4px] rounded-full ${
                    item.image ? "bg-surface-white" : "bg-border"
                  }`}
                  style={item.image ? { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)" } : undefined}
                />

                {/* 左上の戻る矢印。おすすめでたどってきたときだけ出す。
                    右上の × と同じ部品・同じ大きさ（48）で左右対称にしている */}
                {trail.length > 0 && (
                  <HeaderIconButton
                    icon="arrow-left"
                    onClick={goBack}
                    label="前に見ていた商品に戻る"
                    className="absolute left-[16px] top-[12px]"
                  />
                )}
                <HeaderIconButton
                  icon="close"
                  onClick={close}
                  label="閉じる"
                  className="absolute right-[16px] top-[12px]"
                />
              </div>

              <main className="pb-[var(--space-40)]">
                {/* ── Intro（Figma 80:896: KVとの間40 / タグ+タイトル gap4 / 本文 gap12） ── */}
                <div className="flex flex-col gap-[var(--space-12)] items-center px-[var(--space-16)] mt-[40px]">
                  <div className="flex flex-col gap-[var(--space-4)] items-center w-full">
                    <div className="flex gap-[var(--space-8)] items-center">
                      <CategoryTag label={label} color={color} />
                      {/* 写真の無い商品は KV の帯が出せないので、タグの横に小さく */}
                      {soldOut && !item.image && <SoldOutPill size="sm" />}
                    </div>
                    <h1 className="type-jp-heading-l text-text-primary text-center w-full">
                      {item.name}
                    </h1>
                  </div>

                  {/* ⚠ **価格。2026-09-16 まで詳細に価格がどこにも出ていなかった。**
                      オプションのある商品だけ「カートに入れる ¥550」の文字に混ざって
                      出ていただけで、オプションの無い商品（ハンバーガー等）は
                      **一度も値段を見ないままカートに入る**状態だった（洋輔さんが発見）。
                      選んだオプション込みの単価を出すので、オプションを変えるとここも変わる。 */}
                  <p className="type-en-price-l text-text-primary">
                    ¥{unitPriceWithOptions.toLocaleString()}
                  </p>
                  {item.description && (
                    <p className="type-jp-body text-text-secondary w-full">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* ── オプション（対象商品のみ。案A: 説明文の下にチェック一覧） ── */}
                {optionsSelectable && !(perCup && singleSelectable) && (
                  <MenuOptionPicker
                    className="px-[var(--space-16)] mt-[var(--space-24)]"
                    heading={item.optionsHeading || OPTIONS_HEADING_DEFAULT}
                    mode={optionsMode}
                    options={itemOptions}
                    selectedIds={selectedOptionIds}
                    /* 選び直したら「カートに入れる」に戻す。戻さないと「カートを見る」のままで
                       入れ直せず、画面では ICED なのに HOT が届く（2026-09-16 の裏取り C3） */
                    onChange={(ids) => { setDraftOptionIds(ids); setAdded(false); }}
                  />
                )}

                {/* ── 提供タイミング（対象商品のみ。案B: 説明つきカード） ── */}
                {/* ── 1杯ごとの選択（数量2以上・案B）。オプション一覧と提供タイミングの代わりに出す ── */}
                {perCup && (
                  <PerCupRows
                    className="px-[var(--space-16)] mt-[var(--space-24)]"
                    heading={perCupHeading(draftQty, cupUnit)}
                    itemName={item.name}
                    cups={effectiveCups}
                    singleOptions={singleSelectable ? itemOptions : []}
                    timingOptions={timingSelectable ? servingTimingOptions(timingType) : []}
                    onChange={(i, next) => {
                      setCups(effectiveCups.map((c, j) => (j === i ? next : c)));
                      setAdded(false);
                    }}
                  />
                )}

                {timingSelectable && !perCup && (
                  <section className="flex flex-col gap-[var(--space-8)] px-[var(--space-16)] mt-[var(--space-24)]">
                    <p className="type-jp-caption-bold text-text-secondary">{SERVING_TIMING_TITLE}</p>
                    <ServingTimingCards
                      options={servingTimingOptions(timingType)}
                      value={selectedTiming}
                      onChange={(t) => { setDraftTiming(t); setAdded(false); }}
                    />
                  </section>
                )}

                {/* ── Sub Image（2枚目の画像がある場合のみ・300×300中央） ── */}
                {subImage && (
                  <div className="flex justify-center mt-[40px]">
                    <div
                      className="relative overflow-hidden bg-bg-tertiary rounded-[var(--radius-sm)]"
                      style={{ width: 300, height: 300 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={subImage}
                        alt={`${item.name} サブ画像`}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* ── 縦動画（動画がある場合のみ・342幅中央） ── */}
                {hasVideo && (
                  <div className="px-[24px] mt-[40px]">
                    <Video9x16 media={item.media ?? []} />
                  </div>
                )}

                {/* ── Recommended（同サブカテゴリの関連おすすめ） ── */}
                {related.length > 0 && (
                  <section className="pt-[40px]">
                    <div className="flex flex-col gap-[6px] items-center">
                      <p className="type-en-display-m text-text-primary">RECOMMENDED</p>
                      <p className="type-jp-caption text-text-secondary">関連のおすすめ</p>
                    </div>
                    <div className="mt-[20px]">
                      <RecommendCarousel>
                        {related.map((r) => (
                          <RecommendCard
                            key={r.id}
                            item={r}
                            /* いったん下へ引っ込めて、新しい商品で出し直す。
                               履歴は積まずに置き換えるので × 一発で一覧に戻る */
                            onClick={() => goToItem(r.id)}
                          />
                        ))}
                      </RecommendCarousel>
                    </div>
                  </section>
                )}
              </main>
            </div>

            {/* ── Bottom Detail Bar（Figma 110:542）──
                左端にカートアイコン（バッジ付き）、右側にステッパーと「カートに入れる」。
                白地＋上辺罫線にしたのは、透明だと本文と地続きに見えて操作対象だと
                気づきにくいため。 */}
            <div
              className="shrink-0 bg-surface-white border-t border-border-divider pt-[var(--space-12)] px-[var(--space-16)]"
              style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
            >
             {/* ── 「カートに入れる」を押すと、この段が丸ごと「カートを見る」に変わる ──
                 2026-09-16、天真の決定。カートアイコンと「カートを見る」は
                 **行き先が同じなので1つのボタンにまとめる**。
                 2枚を重ねて、下の層（カートを見る）を CTA の位置から左いっぱいまで
                 伸ばしながら入れ替える。幅を transform で変えると文字が歪むので、
                 left を動かしている。 */}
             <div className="relative h-[var(--size-control-lg)]">
              <div
                className={`absolute inset-0 flex gap-[var(--space-12)] items-center transition-opacity duration-200 ${
                  added ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
              <CartIconButton count={totalItems} onClick={() => router.push("/cart")} />
              {soldOut ? (
                <SoldOutPill size="lg" className="flex-1" />
              ) : (
              <div className="flex flex-1 gap-[var(--space-8)] items-center justify-end min-w-0">
                <QuantityStepper
                  className="shrink-0"
                  count={draftQty}
                  min={1}
                  onIncrement={() => setDraftQty((q) => q + 1)}
                  onDecrement={() => setDraftQty((q) => Math.max(1, q - 1))}
                />
                {/* 幅は AddToCartButton 側が w-full なのでラッパーで持つ。
                    金額つき（「カートに入れる ¥1,100」）なので少し広げる。

                    ⚠ **固定幅にしない。** 390px 幅では
                      左右padding 32 + カート 48 + gap 12 + ステッパー 124 + gap 8 = 224 しか残らず、
                    190px 固定だと 24px あふれる。この段は justify-end なので、
                    あふれた分は**左へ出てカートアイコンに重なる**（2026-09-16、洋輔さんが発見）。
                    余白いっぱいまで伸ばし、Figma の幅で頭打ちにする。
                    文字自体は「カートに入れる ¥550」で 136px なので 390px でも収まる。 */}
                {/* **オプションの有無にかかわらず金額を出す。**
                    数量をかけた「いま入れる分の合計」なので、押す前に必ず金額が見える */}
                <div className="flex-1 min-w-0 max-w-[190px]">
                  <AddToCartButton
                    label={`カートに入れる ¥${cartTotal.toLocaleString()}`}
                    onClick={() => {
                      if (perCup) {
                        /* 同じ組み合わせごとにまとめてカートの行にする（天真の決定 2026-09-16） */
                        for (const g of groupCups(effectiveCups)) {
                          const single = optionOf(g.optionId);
                          const options = singleSelectable
                            ? (single ? [toSelected(single)] : [])
                            : optionsSelectable ? selectedOptions : [];
                          addItem(item, g.quantity, timingSelectable ? g.timing : null, options);
                        }
                      } else {
                        addItem(
                          item,
                          draftQty,
                          timingSelectable ? selectedTiming : null,
                          optionsSelectable ? selectedOptions : []
                        );
                      }
                      setAdded(true);
                    }}
                  />
                </div>
              </div>
              )}
              </div>

              <div
                className="absolute inset-y-0 right-0 transition-[left,opacity] duration-300 ease-out"
                style={{
                  left: added ? 0 : "58%",
                  opacity: added ? 1 : 0,
                  pointerEvents: added ? "auto" : "none",
                }}
              >
                {/* 一覧の下部バーと同じ数字ピル（2026-09-17、天真の指示。それまではアイコンにバッジの ViewCartButton） */}
                <ViewCartCountButton count={totalItems} onClick={() => router.push("/cart")} />
              </div>
             </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
