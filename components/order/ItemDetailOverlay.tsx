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
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import { computeRelatedItems } from "@/lib/orderHome";
import { ITEM_PARAM, openItemDetail, stripItemParam, takePushedByApp } from "@/lib/itemOverlay";
import type { MenuItem } from "@/lib/menu";

/* .page-slide-out-right（app/globals.css）のアニメ時間と合わせる */
const CLOSE_ANIM_MS = 260;

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
  const totalItems   = useCartStore((s) => s.totalItems());
  const setOverlay   = useUiStore((s) => s.setOverlay);

  const [closing, setClosing] = useState(false);
  /* ステッパーは「何個入れるか」の下書き。0個追加は意味がないので下限は1 */
  const [draftQty, setDraftQty] = useState(1);
  const openedByPushRef = useRef(false);

  const item = itemId ? allMenuItems.find((m) => m.id === itemId) ?? null : null;

  const related = useMemo<MenuItem[]>(
    () => (item ? computeRelatedItems(allMenuItems, item, Infinity) : []),
    [allMenuItems, item]
  );

  /* 開くたびに数量を1へ戻し、この開き方が history.back() で閉じられるかを覚える */
  useEffect(() => {
    if (!itemId) return;
    setDraftQty(1);
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
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
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
                {/* 幅は AddToCartButton 側が w-full なのでラッパーで持つ */}
                <div className="w-[154px] shrink-0">
                  <AddToCartButton
                    label="カートに入れる"
                    onClick={() => addItem(item, draftQty)}
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
