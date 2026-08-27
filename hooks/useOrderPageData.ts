"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { fetchRecentOrderItemCounts, type ApiCategory } from "@/lib/api";
import { fetchBestSellerSetting, type BestSellerSetting } from "@/lib/bestSellers";
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
  /** Best Seller セクション用の商品。店舗が手動指定していればその順、無ければ自動算出 */
  bestSellerItems: MenuItem[];
  /** false のときは Best Seller セクションごと描画しない（見出しも出さない） */
  bestSellerEnabled: boolean;
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

  /* ── ベストセラー設定（店舗が手動で指定した並び）──
     読めなかった場合は null のままにして、従来どおりの自動算出にフォールバックする。
     設定の取得に失敗しただけで枠が消えるのは困るため。 */
  const [bestSellerSetting, setBestSellerSetting] = useState<BestSellerSetting | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchBestSellerSetting();
        if (!cancelled) setBestSellerSetting(s);
      } catch (err) {
        console.error("[BestSeller] setting fetch failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const bestSellerEnabled = bestSellerSetting?.enabled ?? true;

  /* 表示ON かつ 登録あり → 指定された順。
     表示ON かつ 登録0件 → 従来の自動算出にフォールバック
     （設定はしたが中身が空、という状態で枠が消えると分かりにくいため）。
     表示OFF → 呼び出し側がセクションごと描画しない。 */
  const bestSellerItems = useMemo(() => {
    const ids = bestSellerSetting?.itemIds ?? [];
    if (ids.length > 0) {
      const byId = new Map(allItems.map((i) => [i.id, i]));
      // 非公開・削除済みの商品は落とす（指定順は保つ）
      const picked = ids.map((id) => byId.get(id)).filter((i): i is MenuItem => !!i);
      if (picked.length > 0) return picked;
    }
    return computeBestSellerItems(allItems, orderCounts, BEST_SELLER_LIMIT);
  }, [bestSellerSetting, allItems, orderCounts]);

  const foodCats = useMemo(() => pickFoodCategories(categories), [categories]);
  const drinkCats = useMemo(() => pickDrinkCategories(categories), [categories]);

  /* ── 11サブカテゴリ縦並び用：food→drink の順、各グループ内は display_order 順 ── */
  const categorySections = useMemo<CategorySection[]>(() => {
    const orderedCats = [
      ...[...foodCats].sort((a, b) => a.display_order - b.display_order),
      ...[...drinkCats].sort((a, b) => a.display_order - b.display_order),
    ];
    return orderedCats
      .map((category) => ({
        category,
        items: computeTopItemsBySubcategory(allItems, category.slug, orderCounts, SECTION_ITEM_LIMIT),
      }))
      // 出せる商品が1つも無いカテゴリは、見出しごと出さない。
      //   allItems は is_available=true だけなので、全品を販売停止にすれば
      //   そのカテゴリはお客様の画面から消える（＝終売の運用がこれで回る）。
      //   除外しないと、見出しとタブだけが残って中身が空の区画ができる。
      //   タブ・スクロール追従も categorySections から作っているので、
      //   ここで落とせば両方から同時に消える。
      .filter((section) => section.items.length > 0);
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
    bestSellerEnabled,
    categorySections,
    selectedItem,
    setSelectedItem,
    addedId,
    handleAdd,
  };
}
