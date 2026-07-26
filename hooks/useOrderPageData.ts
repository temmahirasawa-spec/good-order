"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { fetchRecentOrderItemCounts, type ApiCategory } from "@/lib/api";
import {
  pickFoodCategories,
  pickDrinkCategories,
  computeHeroItems,
  computeTopItems,
  computeTopItemsBySubcategory,
  computeBestSellerItems,
} from "@/lib/orderHome";
import type { MenuItem } from "@/lib/menu";

const ORDER_COUNT_WINDOW_DAYS = 14;
const SECTION_ITEM_LIMIT = 4;
const BEST_SELLER_LIMIT = 8;

export interface CategorySection {
  category: ApiCategory;
  items: MenuItem[];
}

export interface UseOrderPageDataResult {
  loading: boolean;
  foodCats: ApiCategory[];
  drinkCats: ApiCategory[];
  heroItems: MenuItem[];
  topItems: MenuItem[];
  /** Best Seller セクション用：カテゴリ横断の全体ランキング上位8件 */
  bestSellerItems: MenuItem[];
  /** フード7・ドリンク4の全11サブカテゴリを display_order 順（food→drink）に並べた人気アイテム */
  categorySections: CategorySection[];
  selectedItem: MenuItem | null;
  setSelectedItem: (item: MenuItem | null) => void;
  addedId: string | null;
  handleAdd: (item: MenuItem) => void;
}

/**
 * app/order/page.tsx（店内ホーム）のデータ取得・Realtime購読・カート操作・
 * ローディング状態をまとめたフック。純粋な導出計算は lib/orderHome.ts に委譲する。
 */
export function useOrderPageData(): UseOrderPageDataResult {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table");

  const setTable = useCartStore((s) => s.setTable);
  const addItem = useCartStore((s) => s.addItem);

  if (tableParam) setTable(parseInt(tableParam, 10));

  /* ── 共有ストアから取得（categories + menuItems を 1 回 fetch で共有） ── */
  const categories = useMenuDataStore((s) => s.categories);
  const allMenuItems = useMenuDataStore((s) => s.menuItems);
  const storeLoading = useMenuDataStore((s) => s.loading);
  const storeLoaded = useMenuDataStore((s) => s.loadedAt);
  const fetchAll = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime = useMenuDataStore((s) => s.stopRealtime);

  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 店内画面は takeout 除外、takeout 画面は takeout のみ（ここは店内）
  const allItems = useMemo(
    () => allMenuItems.filter((m) => !m.isTakeout),
    [allMenuItems]
  );

  const loading = storeLoading && !storeLoaded;

  const [orderCounts, setOrderCounts] = useState<Map<string, number> | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  /* ── order_items 集計は初回のみ 1 回 ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const counts = await fetchRecentOrderItemCounts(ORDER_COUNT_WINDOW_DAYS);
        if (!cancelled) setOrderCounts(counts);
      } catch (err) {
        console.error("[Top3] order_items fetch failed:", err);
        if (!cancelled) setOrderCounts(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Top 3 を allItems + orderCounts から導出（再 fetch なし） ── */
  const topItems = useMemo(
    () => computeTopItems(allItems, orderCounts),
    [allItems, orderCounts]
  );

  const heroItems = useMemo(() => computeHeroItems(allItems), [allItems]);

  const bestSellerItems = useMemo(
    () => computeBestSellerItems(allItems, orderCounts, BEST_SELLER_LIMIT),
    [allItems, orderCounts]
  );

  const foodCats = useMemo(() => pickFoodCategories(categories), [categories]);
  const drinkCats = useMemo(() => pickDrinkCategories(categories), [categories]);

  /* ── 11サブカテゴリ縦並び用：food→drink の順、各グループ内は display_order 順 ── */
  const categorySections = useMemo<CategorySection[]>(() => {
    const orderedCats = [
      ...[...foodCats].sort((a, b) => a.display_order - b.display_order),
      ...[...drinkCats].sort((a, b) => a.display_order - b.display_order),
    ];
    return orderedCats.map((category) => ({
      category,
      items: computeTopItemsBySubcategory(allItems, category.slug, orderCounts, SECTION_ITEM_LIMIT),
    }));
  }, [foodCats, drinkCats, allItems, orderCounts]);

  const handleAdd = useCallback(
    (item: MenuItem) => {
      addItem(item);
      setAddedId(item.id);
      setTimeout(() => setAddedId(null), 700);
    },
    [addItem]
  );

  return {
    loading,
    foodCats,
    drinkCats,
    heroItems,
    topItems,
    bestSellerItems,
    categorySections,
    selectedItem,
    setSelectedItem,
    addedId,
    handleAdd,
  };
}
