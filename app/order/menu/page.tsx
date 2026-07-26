"use client";

/**
 * Menuページ（Step3-E、Figma: Menu 118:524）
 * ハンバーガー（≡）の遷移先。全カテゴリへの導線 + クイックリンク。
 *
 * Figma 実測:
 * - 背景 #FFFCF7（accent-subtle）、ヘッダーは白（Header/Close 相当）
 * - ヘッダー下 16 / セクション見出し（EN=en-display-m + JP=jp-caption、baseline揃え gap10）
 * - 見出し→カード行 8 / カード行間 8 / セクション間 24
 * - フード: Large(2列)×2行 + Small(114px 3列)×1行 / ドリンク: Large 2列×2行
 * - リンク: LinkButton 2列×2行（gap16）/ 下部に Bottom View Cart Bar
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import MenuCategoryCard from "@/components/ui/MenuCategoryCard";
import { LinkButton } from "@/components/ui/Buttons";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import StaffCallSheet from "@/components/StaffCallSheet";
import StoreInfoModal from "@/components/StoreInfoModal";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import type { ApiCategory } from "@/lib/api";

/* フード7 → ドリンク4（TOPページ・DB display_order と同じ並び） */
const FOOD_ORDER  = ["pancake", "french_toast", "eggs_benedict", "sandwich", "fritter", "burger", "lunch"];
const DRINK_ORDER = ["coffee", "tea", "soft", "alcohol"];

function SectionHeader({ en, jp }: { en: string; jp: string }) {
  return (
    <div className="flex gap-[10px] items-baseline whitespace-nowrap">
      <p className="type-en-display-m text-text-primary">{en}</p>
      <p className="type-jp-caption text-text-secondary">{jp}</p>
    </div>
  );
}

export default function OrderMenuPage() {
  const router = useRouter();
  const categories    = useMenuDataStore((s) => s.categories);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);

  const [staffCallOpen, setStaffCallOpen] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catBySlug = (slug: string): ApiCategory | undefined =>
    categories.find((c) => c.slug === slug);

  const goTakeout = () => {
    setTakeoutMode(true);
    router.push("/order/takeout");
  };

  const foodLarge  = FOOD_ORDER.slice(0, 4).map(catBySlug);
  const foodSmall  = FOOD_ORDER.slice(4).map(catBySlug);
  const drinkLarge = DRINK_ORDER.map(catBySlug);

  return (
    <div className="mx-auto max-w-md min-h-screen bg-accent-subtle">
      <OrderHeader variant="close" />

      <main className="px-[var(--space-16)] pt-[16px] pb-[110px] flex flex-col gap-[24px]">
        {/* ── フードカテゴリ ── */}
        <section>
          <SectionHeader en="FOOD CATEGORY" jp="フード" />
          <div className="grid grid-cols-2 gap-[8px] mt-[8px]">
            {foodLarge.map(
              (cat) =>
                cat && (
                  <MenuCategoryCard
                    key={cat.id}
                    category={cat}
                    size="large"
                    href={`/order/${cat.slug}`}
                  />
                )
            )}
          </div>
          <div className="flex justify-between mt-[8px]">
            {foodSmall.map(
              (cat) =>
                cat && (
                  <MenuCategoryCard
                    key={cat.id}
                    category={cat}
                    size="small"
                    href={`/order/${cat.slug}`}
                  />
                )
            )}
          </div>
        </section>

        {/* ── ドリンクカテゴリ ── */}
        <section>
          <SectionHeader en="DRINK CATEGORY" jp="ドリンク" />
          <div className="grid grid-cols-2 gap-[8px] mt-[8px]">
            {drinkLarge.map(
              (cat) =>
                cat && (
                  <MenuCategoryCard
                    key={cat.id}
                    category={cat}
                    size="large"
                    href={`/order/${cat.slug}`}
                  />
                )
            )}
          </div>
        </section>

        {/* ── クイックリンク ── */}
        <div className="grid grid-cols-2 gap-[16px]">
          <LinkButton icon="return"  label="トップへ戻る"   href="/order" />
          <LinkButton icon="bell"    label="スタッフを呼ぶ" onClick={() => setStaffCallOpen(true)} />
          <LinkButton icon="bag"     label="テイクアウト"   onClick={goTakeout} />
          <LinkButton icon="map-pin" label="店舗情報"       onClick={() => setStoreInfoOpen(true)} />
        </div>
      </main>

      {/* ── カートを見る（下部固定） ── */}
      <BottomViewCartBar />

      {/* ── シート/モーダル ── */}
      <StaffCallSheet open={staffCallOpen} onClose={() => setStaffCallOpen(false)} />
      <StoreInfoModal open={storeInfoOpen} onClose={() => setStoreInfoOpen(false)} />
    </div>
  );
}
