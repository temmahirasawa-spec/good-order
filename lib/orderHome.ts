/**
 * 店内向けホーム画面（app/order/page.tsx）の純粋な導出ロジック
 * fetch は行わない。store/API から取得済みのデータを整形するだけ。
 */
import { DRINK_SLUGS, type ApiCategory } from "./api";
import type { MenuItem } from "./menu";

export const FOOD_CATEGORY_SLUGS = [
  "pancake",
  "eggs_benedict",
  "french_toast",
  "sandwich",
  "fritter",
  "burger",
  "lunch",
] as const;

/* ── フードカテゴリーを表示順で抽出 ── */
export function pickFoodCategories(categories: ApiCategory[]): ApiCategory[] {
  return FOOD_CATEGORY_SLUGS
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is ApiCategory => Boolean(c));
}

/* ── ドリンクカテゴリーを抽出。サブカテゴリーが無ければ 'drink' 親カテゴリーで代替 ── */
export function pickDrinkCategories(categories: ApiCategory[]): ApiCategory[] {
  const subCats = DRINK_SLUGS
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is ApiCategory => Boolean(c));
  if (subCats.length > 0) return subCats;
  const umbrella = categories.find((c) => c.slug === "drink");
  return umbrella ? [umbrella] : [];
}

/* ── ヒーロー対象：'注目' or '本日のおすすめ'、足りない場合は 'おすすめ' / '限定' で補完 ── */
export function computeHeroItems(items: MenuItem[]): MenuItem[] {
  const primary = items.filter((i) => i.tag === "注目" || i.tag === "本日のおすすめ");
  if (primary.length >= 3) return primary.slice(0, 5);
  const fallback = items.filter(
    (i) => (i.tag === "おすすめ" || i.tag === "限定") && !primary.find((p) => p.id === i.id)
  );
  return [...primary, ...fallback].slice(0, 5);
}

/* ── 注文数順ランキングの共通ロジック ──
 * 優先順: ①直近注文数の多い順 → ②tag='人気' → ③残りのアイテム（引数の並び順
 * = display_order）。注文実績が少ない期間でも limit 件まで埋まるようにする。 */
function rankByOrderCount(
  items: MenuItem[],
  orderCounts: Map<string, number> | null,
  limit: number
): MenuItem[] {
  if (items.length === 0) return [];
  const byId = new Map(items.map((m) => [m.id, m]));
  let topByOrder: MenuItem[] = [];
  if (orderCounts && orderCounts.size > 0) {
    topByOrder = Array.from(orderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((x): x is MenuItem => Boolean(x));
  }
  const picked = new Set(topByOrder.map((i) => i.id));
  const popular = items.filter((i) => i.tag === "人気" && !picked.has(i.id));
  popular.forEach((i) => picked.add(i.id));
  const rest = items.filter((i) => !picked.has(i.id));
  return [...topByOrder, ...popular, ...rest].slice(0, limit);
}

/* ── 人気メニュー Top3：直近の注文数順、足りなければ tag='人気' で補完 ── */
export function computeTopItems(
  items: MenuItem[],
  orderCounts: Map<string, number> | null
): MenuItem[] {
  return rankByOrderCount(items, orderCounts, 3);
}

/* ── Best Seller（新TOPページ）：computeTopItems と同ロジックの件数可変版。
 *   サブカテゴリ絞り込みなしの全体ランキング上位 limit 件 ── */
export function computeBestSellerItems(
  items: MenuItem[],
  orderCounts: Map<string, number> | null,
  limit = 8
): MenuItem[] {
  return rankByOrderCount(items, orderCounts, limit);
}

/* ── 商品詳細ページの「関連のおすすめ」：同一サブカテゴリの他アイテムを
 *   自分自身を除外して display_order 順（= items の並び順）に最大 limit 件 ── */
export function computeRelatedItems(
  items: MenuItem[],
  currentItem: MenuItem,
  limit = 6
): MenuItem[] {
  return items
    .filter(
      (i) => i.subcategory === currentItem.subcategory && i.id !== currentItem.id
    )
    .slice(0, limit);
}

/* ── サブカテゴリ別の人気アイテム（新TOPページ：11サブカテゴリを縦に並べる用） ── */
export function computeTopItemsBySubcategory(
  items: MenuItem[],
  subcategory: string,
  orderCounts: Map<string, number> | null,
  limit = 4
): MenuItem[] {
  return rankByOrderCount(
    items.filter((i) => i.subcategory === subcategory),
    orderCounts,
    limit
  );
}
