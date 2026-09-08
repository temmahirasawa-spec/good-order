/**
 * 店内向けホーム画面（app/order/page.tsx）の純粋な導出ロジック
 * fetch は行わない。store/API から取得済みのデータを整形するだけ。
 *
 * 2026-09-08（docs/specs/home-layout.md / menu-text-rows.md）:
 *   - カテゴリーは2階層（parent_id）。トップの区画とタブは親だけ。
 *   - トップの区画の並びは管理画面の並び順（display_order）そのまま。区分では並べ替えない。
 *   - 各区画は上位 top_limit 件（既定5、0=全件）＋「すべてを見る」。
 *   - 一覧の見せ方（list_style）は写真の有無から自動判定できる。
 */
import type { ApiCategory } from "./api";
import type { MenuItem } from "./menu";

const byDisplayOrder = (a: ApiCategory, b: ApiCategory) => a.display_order - b.display_order;

/* ── フードカテゴリーを表示順で抽出 ── */
export function pickFoodCategories(categories: ApiCategory[]): ApiCategory[] {
  // **固定リストとの一致で絞らない。**
  //   以前は FOOD_CATEGORY_SLUGS に載っている slug のカテゴリーしか返さなかったため、
  //   管理画面で新しいカテゴリーを作っても、slug がそのリストに無ければ
  //   お客様の画面に一切出なかった（2026-08-26 に実機で確認）。
  //   分類は DB の category_type 列で行う。
  return categories.filter((c) => c.category_type !== "drink");
}

/* ── ドリンクカテゴリーを抽出（同じく category_type で判定する） ── */
export function pickDrinkCategories(categories: ApiCategory[]): ApiCategory[] {
  return categories.filter((c) => c.category_type === "drink");
}

/* ── 親カテゴリー（parent_id が無いもの）。トップの区画・タブになる ── */
export function topLevelCategories(categories: ApiCategory[]): ApiCategory[] {
  return categories.filter((c) => !c.parent_id);
}

/* ── ある親のサブカテゴリー（display_order 順） ── */
export function childCategories(categories: ApiCategory[], parentId: string): ApiCategory[] {
  return categories.filter((c) => c.parent_id === parentId).sort(byDisplayOrder);
}

/* ── トップの区画の並び: 親カテゴリーを display_order 順に ──
 *   区分（フード／ドリンク）では並べ替えない。ドリンクを上に出したければ、
 *   管理画面「カテゴリ管理」で並び替える（2026-09-08 夜、天真の決定。
 *   同日昼の「ドリンクを最上部に固定」は、管理画面で自由に動かせる方がよいので取り下げ）。 */
export function orderHomeCategories(categories: ApiCategory[]): ApiCategory[] {
  return topLevelCategories(categories).sort(byDisplayOrder);
}

/* ── 親カテゴリー（＋そのサブカテゴリー）に属する商品。並びは items の並び（display_order）のまま ── */
export function itemsOfCategory(
  items: MenuItem[],
  category: ApiCategory,
  children: ApiCategory[]
): MenuItem[] {
  const slugs = new Set([category.slug, ...children.map((c) => c.slug)]);
  return items.filter((i) => slugs.has(i.subcategory));
}

/* ── トップに出す件数で切る。0 = 全件 ── */
export function applyTopLimit<T>(items: T[], limit: number): T[] {
  return limit > 0 ? items.slice(0, limit) : items;
}

/* ── 商品に写真があるか（media_order の image、または image_url） ── */
export function hasImage(item: MenuItem): boolean {
  if (item.media?.some((m) => m.type === "image")) return true;
  return typeof item.image === "string" && item.image.length > 0;
}

/* ── 一覧の見せ方を確定する（docs/specs/menu-text-rows.md 2章）
 *   auto: そのカテゴリーの商品に写真が1枚も無ければ 'list'、1枚でもあれば 'photo' ── */
export function resolveListStyle(
  category: Pick<ApiCategory, "list_style">,
  items: MenuItem[]
): "photo" | "list" {
  if (category.list_style === "photo" || category.list_style === "list") return category.list_style;
  return items.some(hasImage) ? "photo" : "list";
}

/* ── 絞り込みチップに出すサブカテゴリー（商品が1つも無い区分は出さない） ── */
export function subcategoryChips(
  children: ApiCategory[],
  items: MenuItem[]
): { id: string; label: string }[] {
  const present = new Set(items.map((i) => i.subcategory as string));
  return children
    .filter((c) => present.has(c.slug))
    .map((c) => ({ id: c.slug, label: c.name }));
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
