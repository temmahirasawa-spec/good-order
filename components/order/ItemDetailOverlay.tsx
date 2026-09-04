"use client";

/**
 * 商品詳細オーバーレイ（Figma: Product Detail 80:894 / Bottom Detail Bar 110:542）
 *
 * `?item=<商品ID>` が付いている間、**一覧の上に重ねて**表示する。
 * 以前は `/order/item/[id]` へのページ遷移だったが、遷移のたびに一覧が
 * アンマウントされるため「戻るとスクロール位置が失われる」「閉じるアニメ中に
 * 一覧が居らず背景色しか出ない」という2つの問題が構造的に避けられなかった。
 * 一覧を出したまま重ねることで、右から出て右へ引っ込む動きの下に
 * ずっと元の画面が見えている状態になる。
 *
 * `app/order/layout.tsx` に置いてあるので、TOP・カテゴリ一覧・テイクアウトの
 * どのページから開いても同じ1つのオーバーレイが使われる。
 *
 * 下部バーは position:fixed ではなく、オーバーレイ内の flex 末尾に置いている。
 * スライドアニメ中は祖先に transform が乗るので、fixed だとビューポート基準で
 * なくなって一瞬ズレるため。
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import CartIconButton from "@/components/ui/CartIconButton";
import CategoryTag from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import RecommendCard from "@/components/ui/RecommendCard";
import { RecommendCarousel } from "@/components/ui/MenuCarousel";
import { Video9x16 } from "@/components/ui/VideoBlock";
import { AddToCartButton } from "@/components/ui/Buttons";
import ServingTimingCards from "@/components/ui/ServingTimingCards";
import MenuOptionPicker from "@/components/ui/OptionRow";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import { computeRelatedItems } from "@/lib/orderHome";
import { ITEM_PARAM, openItemDetail, stripItemParam, takePushedByApp } from "@/lib/itemOverlay";
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

/* .page-slide-out-right（app/globals.css）のアニメ時間と合わせる */
const CLOSE_ANIM_MS = 260;
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

  const [closing, setClosing] = useState(false);
  /* ステッパーは「何個入れるか」の下書き。0個追加は意味がないので下限は1 */
  const [draftQty, setDraftQty] = useState(1);
  /* 提供タイミングの下書き。null は「区分の初期値のまま」 */
  const [draftTiming, setDraftTiming] = useState<ServingTiming | null>(null);
  /* オプション（トッピング）の下書き。null は「初期選択のまま」（1つだけの商品は最初の項目、複数選択は空） */
  const [draftOptionIds, setDraftOptionIds] = useState<string[] | null>(null);
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

  /* 開くたびに数量を1へ戻し、この開き方が history.back() で閉じられるかを覚える */
  useEffect(() => {
    if (!itemId) return;
    setDraftQty(1);
    setDraftTiming(null);
    setDraftOptionIds(null);
    setClosing(false);
    openedByPushRef.current = takePushedByApp() || openedByPushRef.current;
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

  if (!itemId) return null;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      /* アプリが積んだ履歴なら戻す（ブラウザの戻るボタンと挙動を揃える）。
         直リンクで開かれた場合は戻り先がアプリ外なので、パラメータだけ落とす。 */
      if (openedByPushRef.current) {
        openedByPushRef.current = false;
        window.history.back();
      } else {
        stripItemParam();
        setClosing(false);
      }
    }, CLOSE_ANIM_MS);
  };

  const label = item ? SUBCATEGORY_LABEL[item.subcategory] ?? item.subcategory : "";
  const color = item ? resolveTagColor(categories, item.subcategory) : "yellow";
  const subImage = item?.images?.[1] ?? null;
  const hasVideo = (item?.media ?? []).some((m) => m.type === "video");

  return (
    /* 高さは inset-0（＝レイアウトビューポート）ではなく h-viewport（dvh）で取る。
       モバイルのアドレスバーが引っ込むと表示領域だけが広がるので、inset-0 のままだと
       下部バーの下に隙間が空いて背面の一覧が透けて見えてしまう。 */
    <div
      className={`fixed left-0 right-0 top-0 h-viewport z-50 flex justify-center ${
        closing ? "page-slide-out-right pointer-events-none" : "page-slide-in-right"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={item?.name ?? "商品詳細"}
    >
      <div className="bg-bg-primary flex flex-col w-full max-w-md h-full">
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
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* ── KV: メイン画像 + 右上の×（全画面共通のルール） ── */}
              <div className="relative w-full bg-bg-tertiary" style={{ height: 260 }}>
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover"
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
                    <CategoryTag label={label} color={color} />
                    <h1 className="type-jp-heading-l text-text-primary text-center w-full">
                      {item.name}
                    </h1>
                  </div>
                  {item.description && (
                    <p className="type-jp-body text-text-secondary w-full">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* ── オプション（対象商品のみ。案A: 説明文の下にチェック一覧） ── */}
                {optionsSelectable && (
                  <MenuOptionPicker
                    className="px-[var(--space-16)] mt-[var(--space-24)]"
                    heading={item.optionsHeading || OPTIONS_HEADING_DEFAULT}
                    mode={optionsMode}
                    options={itemOptions}
                    selectedIds={selectedOptionIds}
                    onChange={setDraftOptionIds}
                  />
                )}

                {/* ── 提供タイミング（対象商品のみ。案B: 説明つきカード） ── */}
                {timingSelectable && (
                  <section className="flex flex-col gap-[var(--space-8)] px-[var(--space-16)] mt-[var(--space-24)]">
                    <p className="type-jp-caption-bold text-text-secondary">{SERVING_TIMING_TITLE}</p>
                    <ServingTimingCards
                      options={servingTimingOptions(timingType)}
                      value={selectedTiming}
                      onChange={setDraftTiming}
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
                            /* 別商品へは履歴を積んで切り替える（閉じると元の商品に戻る） */
                            onClick={() => openItemDetail(r.id)}
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
              className="shrink-0 flex gap-[var(--space-12)] items-center bg-surface-white border-t border-border-divider pt-[var(--space-12)] px-[var(--space-16)]"
              style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
            >
              <CartIconButton count={totalItems} onClick={() => router.push("/cart")} />
              <div className="flex flex-1 gap-[var(--space-8)] items-center justify-end min-w-0">
                <QuantityStepper
                  count={draftQty}
                  min={1}
                  onIncrement={() => setDraftQty((q) => q + 1)}
                  onDecrement={() => setDraftQty((q) => Math.max(1, q - 1))}
                />
                {/* 幅は AddToCartButton 側が w-full なのでラッパーで持つ。
                    オプションのある商品は金額つき（「カートに入れる ¥1,100」）なので少し広げる */}
                <div className={`shrink-0 ${optionsSelectable ? "w-[190px]" : "w-[154px]"}`}>
                  <AddToCartButton
                    label={
                      optionsSelectable
                        ? `カートに入れる ¥${(unitPriceWithOptions * draftQty).toLocaleString()}`
                        : "カートに入れる"
                    }
                    onClick={() =>
                      addItem(
                        item,
                        draftQty,
                        timingSelectable ? selectedTiming : null,
                        optionsSelectable ? selectedOptions : []
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
