"use client";

/**
 * カテゴリ一覧ページ（Step3-H、Figma: Category Listing 173:612）
 * TOPページ「もっと見る」・Menuページのカテゴリカードの遷移先。
 * ヘッダーは Header / Close（×右上）→ Filter Bar →
 * カテゴリタイトル（EN/JP） → 商品グリッド（全件・display_order順） → Bottom View Cart Bar。
 * 既存コンポーネントの組み合わせで構成する。
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import FilterPlaceholderSheet from "@/components/ui/FilterPlaceholderSheet";
import { MenuCard } from "@/components/ui/MenuCard";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { useCartStore } from "@/lib/store";
import { openItemDetail } from "@/lib/itemOverlay";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { SUBCATEGORY_LABEL, SUBCATEGORY_EN_LABEL } from "@/lib/categoryLabels";
import type { MenuItem, Subcategory } from "@/lib/menu";

const FILTER_CHIPS = [
  { id: "allergy", label: "アレルギー" },
  { id: "dislike", label: "ニガテな食材" },
  { id: "pickup",  label: "受け取り方法" },
];

/* ── ローディングスケルトン（2カラム4セル） ── */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[171px]">
          <div className="skeleton w-[171px] h-[171px]" style={{ borderRadius: 8 }} />
          <div className="skeleton h-4 w-3/4 mt-2" />
          <div className="skeleton h-4 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function CategoryListingPage() {
  const { category } = useParams<{ category: string }>();

  const allMenuItems  = useMenuDataStore((s) => s.menuItems);
  const storeLoading  = useMenuDataStore((s) => s.loading);
  const loadedAt      = useMenuDataStore((s) => s.loadedAt);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime  = useMenuDataStore((s) => s.stopRealtime);

  const cartItems      = useCartStore((s) => s.items);
  const addItem        = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = storeLoading && !loadedAt;

  // useMenuDataStore の menuItems は取得クエリの時点で display_order 順のため、
  // ここでは絞り込むだけで並び順はそのまま維持される
  const items = useMemo<MenuItem[]>(
    () => allMenuItems.filter((m) => m.subcategory === category),
    [allMenuItems, category]
  );

  const enLabel = SUBCATEGORY_EN_LABEL[category as Subcategory] ?? category?.toUpperCase() ?? "";
  const jpLabel = SUBCATEGORY_LABEL[category] ?? category;

  const qtyOf = (id: string) => cartItems.find((ci) => ci.item.id === id)?.quantity ?? 0;
  const cardHandlers = (item: MenuItem) => ({
    quantity: qtyOf(item.id),
    onIncrement: () => addItem(item, 1),
    onDecrement: () => updateQuantity(item.id, qtyOf(item.id) - 1),
    onClick: () => openItemDetail(item.id),
  });

  return (
    <div className="mx-auto max-w-md min-h-screen bg-accent-subtle flex flex-col gap-[var(--space-20)]">
      <div className="flex flex-col">
        <OrderHeader variant="close" />
        <FilterBar
          chips={FILTER_CHIPS}
          selectedIds={[]}
          onToggle={() => setFilterOpen(true)}
          onCustomize={() => setFilterOpen(true)}
        />
      </div>

      {/* ── カテゴリタイトル ── */}
      <div className="flex flex-col gap-[var(--space-4)] pt-[4px] px-[var(--space-24)]">
        <p className="type-en-display-l text-text-primary">{enLabel}</p>
        <p className="type-jp-body-small text-text-primary">
          {jpLabel}
        </p>
      </div>

      {/* ── グリッド（全件・display_order順） ── */}
      <main className="pb-[96px]">
        {loading ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <p className="type-jp-body text-text-secondary text-center py-[64px]">
            このカテゴリーにはメニューがありません
          </p>
        ) : (
          <div className="grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)]">
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                {...cardHandlers(item)}
                imageLoading="lazy"
                hideTag
              />
            ))}
          </div>
        )}
      </main>

      <FilterPlaceholderSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      <BottomViewCartBar />
    </div>
  );
}
