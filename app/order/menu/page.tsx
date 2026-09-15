"use client";

/**
 * Menuページ（Step3-E、Figma: Menu 118:524）
 * ハンバーガー（≡）の遷移先。全カテゴリへの導線 + クイックリンク。
 *
 * Figma 実測:
 * - 背景 #FFFCF7（accent-subtle）、ヘッダーは白（Header/Close 相当）
 * - ヘッダー下 16 / セクション見出し（EN=en-display-m + JP=jp-caption、baseline揃え gap10）
 * - 見出し→カード行 8 / カード行間 8 / セクション間 24
 * - リンク: LinkButton 2列×2行（gap16）/ 下部に Bottom View Cart Bar
 *
 * ⚠ **カテゴリーは DB から作る。固定リストで絞らない。**（2026-09-15）
 *   以前はこのページだけ FOOD_ORDER / DRINK_ORDER という slug の固定リストを持っており、
 *   そこに載っている slug のカテゴリーしか出していなかった。実際の店舗のカテゴリー14件のうち
 *   一致したのは pancake と alcohol だけで、**ハンバーガーメニューにその2つしか出ていなかった**
 *   （洋輔さんの指摘で発覚）。
 *   同じ不具合はトップページで 2026-08-26 に直っていて（lib/orderHome.ts の
 *   pickFoodCategories のコメント参照）、**このページだけ直し漏れていた**。
 *   分類は `category_type`、並びは `display_order`。トップページと同じ関数を使う。
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import MenuCategoryCard from "@/components/ui/MenuCategoryCard";
import { LinkButton } from "@/components/ui/Buttons";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import StaffCallSheet from "@/components/StaffCallSheet";
import StoreInfoModal from "@/components/StoreInfoModal";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { useCartStore } from "@/lib/store";
import {
  orderHomeCategories,
  childCategories,
  itemsOfCategory,
} from "@/lib/orderHome";

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
  const categories     = useMenuDataStore((s) => s.categories);
  const menuItems      = useMenuDataStore((s) => s.menuItems);
  const fetchAll       = useMenuDataStore((s) => s.fetchAll);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);

  const [staffCallOpen, setStaffCallOpen] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 親カテゴリーを表示順に並べ、フード／ドリンクに分ける。
     **商品が1つも無いカテゴリーは出さない。** 押しても空の一覧に着くだけで、
     行き止まりになるため（トップページと同じ基準）。
     ⚠ これは AI の判断。カテゴリ管理で作ったものを常に全部出したい場合は
     この filter を外す。 */
  const { foods, drinks } = useMemo(() => {
    const withItems = orderHomeCategories(categories).filter(
      (c) => itemsOfCategory(menuItems, c, childCategories(categories, c.id)).length > 0
    );
    return {
      foods:  withItems.filter((c) => c.category_type !== "drink"),
      drinks: withItems.filter((c) => c.category_type === "drink"),
    };
  }, [categories, menuItems]);

  /* テイクアウト対象の商品が1つも無いときは、導線を出しても行き止まりになる */
  const hasTakeoutItems = useMemo(
    () => menuItems.some((i) => i.isTakeout),
    [menuItems]
  );

  const goTakeout = () => {
    setTakeoutMode(true);
    router.push("/order/takeout");
  };

  return (
    <div className="mx-auto max-w-md min-h-screen bg-accent-subtle">
      <OrderHeader variant="close" />

      <main className="px-[var(--space-16)] pt-[16px] pb-[110px] flex flex-col gap-[24px]">
        {([
          ["FOOD CATEGORY", "フード", foods],
          ["DRINK CATEGORY", "ドリンク", drinks],
        ] as const).map(([en, jp, list]) =>
          list.length === 0 ? null : (
            <section key={en}>
              <SectionHeader en={en} jp={jp} />
              <div className="grid grid-cols-2 gap-[8px] mt-[8px]">
                {list.map((cat) => (
                  <MenuCategoryCard
                    key={cat.id}
                    category={cat}
                    size="large"
                    href={`/order/${cat.slug}`}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {/* ── クイックリンク ── */}
        <div className="grid grid-cols-2 gap-[16px]">
          <LinkButton icon="return"  label="トップへ戻る"   href="/order" />
          <LinkButton icon="bell"    label="スタッフを呼ぶ" onClick={() => setStaffCallOpen(true)} />
          {/* テイクアウトの商品が無いときは押せなくする。
              「押したら『ありません』と言われる」を無くすため（洋輔さんの指摘、2026-09-15） */}
          <LinkButton
            icon="bag"
            label={hasTakeoutItems ? "テイクアウト" : "テイクアウト（準備中）"}
            onClick={hasTakeoutItems ? goTakeout : undefined}
            disabled={!hasTakeoutItems}
          />
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
