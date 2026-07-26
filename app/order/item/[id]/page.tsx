"use client";

/**
 * 商品詳細ページ（Step3-D、Figma: Product Detail 80:894）
 * KV（260px・左上にメニューボタン → /order/menu）→ Intro（タグ/タイトル/説明）→
 * Sub Image（300×300、2枚目の画像がある場合のみ）→ Video 9:16（動画がある場合のみ）→
 * Recommended（同サブカテゴリの関連おすすめ）→ Bottom Detail Bar（× + カートに入れる）
 *
 * Sub Image / 縦動画の専用カラムは menu_items に存在しないため、
 * media（media_order）配列の2枚目画像・動画を「あれば表示、なければ非表示」で扱う。
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import CategoryTag from "@/components/ui/CategoryTag";
import RecommendCard from "@/components/ui/RecommendCard";
import { RecommendCarousel } from "@/components/ui/MenuCarousel";
import { Video9x16 } from "@/components/ui/VideoBlock";
import { AddToCartButton, BackButton } from "@/components/ui/Buttons";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import { computeRelatedItems } from "@/lib/orderHome";
import type { MenuItem } from "@/lib/menu";

/* .page-slide-down（app/globals.css）のアニメ時間と合わせる */
const CLOSE_ANIM_MS = 320;

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const categories    = useMenuDataStore((s) => s.categories);
  const allMenuItems  = useMenuDataStore((s) => s.menuItems);
  const storeLoading  = useMenuDataStore((s) => s.loading);
  const storeLoaded   = useMenuDataStore((s) => s.loadedAt);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime  = useMenuDataStore((s) => s.stopRealtime);

  const addItem = useCartStore((s) => s.addItem);

  const [closing, setClosing] = useState(false);

  // 共有キャッシュを流用（Step3-A の方針どおり、個別フェッチはしない）
  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = storeLoading && !storeLoaded;
  const item = allMenuItems.find((m) => m.id === id) ?? null;

  // 同一サブカテゴリの他アイテムをすべて表示（上限なし）
  const related = useMemo<MenuItem[]>(
    () => (item ? computeRelatedItems(allMenuItems, item, Infinity) : []),
    [allMenuItems, item]
  );

  // ×ボタン: 下へスライドアウトしてからホームへ戻る
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => router.push("/order"), CLOSE_ANIM_MS);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md min-h-screen bg-bg-primary">
        <div className="skeleton w-full" style={{ height: 260, borderRadius: 0 }} />
        <div className="px-[16px] pt-[40px] space-y-[12px]">
          <div className="skeleton h-5 w-1/4 mx-auto" />
          <div className="skeleton h-7 w-1/2 mx-auto" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-[16px] px-[16px]">
        <p className="type-jp-body text-text-secondary">商品が見つかりませんでした</p>
        <button
          type="button"
          onClick={() => router.push("/order")}
          className="type-jp-body-bold text-text-primary underline"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  const label = SUBCATEGORY_LABEL[item.subcategory] ?? item.subcategory;
  const color = resolveTagColor(categories, item.subcategory);
  const subImage = item.images?.[1] ?? null;
  const hasVideo = (item.media ?? []).some((m) => m.type === "video");

  return (
    <div
      className={`mx-auto max-w-md min-h-screen bg-bg-primary relative ${
        closing ? "page-slide-down pointer-events-none" : ""
      }`}
    >
      {/* ── KV: メイン画像 + フローティングのメニューボタン ── */}
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
          icon="menu"
          onClick={() => router.push("/order/menu")}
          className="absolute left-[16px] top-[12px]"
        />
      </div>

      <main className="pb-[104px]">
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
                    onClick={() => router.push(`/order/item/${r.id}`)}
                  />
                ))}
              </RecommendCarousel>
            </div>
          </section>
        )}
      </main>

      {/* ── Bottom Detail Bar（透明追従バー: 戻る + カートに入れる） ── */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 flex gap-[var(--space-12)] items-center pt-[var(--space-8)] px-[var(--space-16)]"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <BackButton icon="close" onClick={handleClose} />
        <AddToCartButton
          label="カートに入れる"
          onClick={() => addItem(item, 1)}
          className="flex-1"
        />
      </div>

    </div>
  );
}
