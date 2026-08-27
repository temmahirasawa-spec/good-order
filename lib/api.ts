/**
 * Supabase データ取得レイヤー
 * UI コンポーネントから直接 supabase を呼ばず、ここを経由する
 */
import { supabase } from "./supabase";
import type { MenuItem } from "./menu";
import type { TagColor } from "@/components/ui/CategoryTag";

export const DRINK_SLUGS = ["coffee", "tea", "soft", "alcohol"] as const;

export const STORE_ID = "10000000-0000-0000-0000-000000000001";

/* ── menu_items 取得時の共通カラム定義 ── */
export const MENU_ITEM_COLUMNS =
  "id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_takeout, is_available, display_order";

/* ── buildCatMap のモジュールキャッシュ（TTL 30秒） ── */
const CAT_CACHE_TTL_MS = 30_000;
type CatMap = Record<string, string>;
let catMapFullCache: { data: CatMap; at: number } | null = null;

/** categories.slug マッピングのキャッシュを明示的に無効化する */
export function invalidateCategoriesCache(): void {
  catMapFullCache = null;
}

/** カテゴリー見出しの文字サイズ。既存のデザイントークンに対応する */
export type HeadingSize = "large" | "medium" | "small";

export interface ApiCategory {
  id: string;
  slug: string;
  /** カテゴリー名（日本語）例: パンケーキ */
  name: string;
  /** カテゴリー名（英語）例: PANCAKE */
  caption: string | null;
  /** 説明文（40文字以内）例: これがYORKYSの原点！看板メニュー */
  description: string | null;
  /** 英語名の文字サイズ（既定 large） */
  en_size: HeadingSize;
  /** 日本語名の文字サイズ（既定 small） */
  jp_size: HeadingSize;
  /** 'food' | 'drink'。お客様側の並び（フード→ドリンク）に使う */
  category_type: "food" | "drink";
  image_url: string | null;
  display_order: number;
  tag_color: TagColor;
}

export type ApiMediaItem = { type: "image" | "video"; url: string };

export interface ApiMenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  additional_images: string[] | null;
  video_url: string | null;
  media_order: ApiMediaItem[] | null;
  tag: string | null;
  calories: number | null;
  serving_time_min: number | null;
  is_available: boolean;
  is_takeout: boolean;
  display_order: number;
}

/* ── カテゴリー一覧（display_order 順） ── */
export async function fetchCategories(): Promise<ApiCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, caption, description, en_size, jp_size, category_type, image_url, display_order, tag_color")
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as ApiCategory[];
}

/* ── slug → category_id マップを構築（全件は 30秒キャッシュ） ── */
async function buildCatMap(slugs?: string[]): Promise<CatMap> {
  const now = Date.now();
  // 全件取得はキャッシュを優先
  if (!slugs?.length && catMapFullCache && now - catMapFullCache.at < CAT_CACHE_TTL_MS) {
    return catMapFullCache.data;
  }
  const { data, error } = slugs?.length
    ? await supabase.from("categories").select("id, slug").in("slug", slugs)
    : await supabase.from("categories").select("id, slug");
  if (error) throw error;
  const map: CatMap = {};
  (data ?? []).forEach((c) => {
    map[c.id] = c.slug;
  });
  if (!slugs?.length) {
    catMapFullCache = { data: map, at: now };
  }
  return map;
}

/** カテゴリ一覧(全件)から catMap を作って cache に書き込む（fetch をスキップできる） */
export function primeCategoriesCache(cats: Array<{ id: string; slug: string }>): void {
  const map: CatMap = {};
  cats.forEach((c) => { map[c.id] = c.slug; });
  catMapFullCache = { data: map, at: Date.now() };
}

/** Supabase の menu_items 行を MenuItem に変換（外部キャッシュ利用可） */
export function rowToMenuItem(
  row: ApiMenuItem,
  catMap: CatMap
): MenuItem {
  return toMenuItem(row, catMap);
}

/* ── DB 行 → MenuItem 変換 ── */
function toMenuItem(
  row: {
    id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    additional_images?: string[] | null;
    video_url?: string | null;
    media_order?: ApiMediaItem[] | null;
    tag: string | null;
    calories?: number | null;
    serving_time_min?: number | null;
    is_takeout?: boolean | null;
  },
  catMap: Record<string, string>
): MenuItem {
  const slug = row.category_id ? (catMap[row.category_id] ?? "") : "";

  // media_order を優先、未設定（legacy 行）なら image_url + additional_images + video_url から構築
  let media: ApiMediaItem[] = (row.media_order ?? []).filter(
    (m) => m && typeof m.url === "string" && m.url.length > 0
  );
  if (media.length === 0) {
    const extras = (row.additional_images ?? []).filter(Boolean);
    const imgUrls = [row.image_url, ...extras].filter(
      (s): s is string => typeof s === "string" && s.length > 0
    );
    media = imgUrls.map((url) => ({ type: "image" as const, url }));
    if (row.video_url) media.push({ type: "video" as const, url: row.video_url });
  }

  const images = media.filter((m) => m.type === "image").map((m) => m.url);
  const firstImage = images[0] ?? row.image_url ?? "";

  return {
    id: row.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category: (DRINK_SLUGS as readonly string[]).includes(slug) ? "drink" : "food",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subcategory: slug as any,
    name: row.name,
    nameEn: "",
    description: row.description ?? "",
    price: row.price,
    image: firstImage,
    images,
    video: row.video_url ?? null,
    media,
    tag: row.tag ?? undefined,
    calories: row.calories ?? null,
    servingTimeMin: row.serving_time_min ?? null,
    isTakeout: row.is_takeout ?? false,
  };
}

/* ── カテゴリースラッグでメニュー取得
 *   drink の場合は drinkSubSlug で絞り込み、省略時は全サブ取得 ── */
export async function fetchMenuItemsBySlug(
  categorySlug: string,
  drinkSubSlug?: string
): Promise<MenuItem[]> {
  const isDrink = categorySlug === "drink";
  const targetSlugs: string[] = isDrink
    ? drinkSubSlug
      ? [drinkSubSlug]
      : [...DRINK_SLUGS]
    : [categorySlug];

  const catMap = await buildCatMap(targetSlugs);
  const catIds = Object.keys(catMap);
  if (!catIds.length) return [];

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_takeout")
    .in("category_id", catIds)
    .eq("is_available", true)
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((row) => toMenuItem(row, catMap));
}

/* ── 店内向けの全アイテム取得（ホームの人気・おすすめ用） ── */
export async function fetchAllMenuItems(): Promise<MenuItem[]> {
  const catMap = await buildCatMap();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_takeout")
    .eq("is_available", true)
    .eq("is_takeout", false)
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((row) => toMenuItem(row, catMap));
}

/* ── テイクアウトメニュー取得 ── */
export async function fetchTakeoutMenuItems(): Promise<MenuItem[]> {
  const catMap = await buildCatMap();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_takeout")
    .eq("is_available", true)
    .eq("is_takeout", true)
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((row) => toMenuItem(row, catMap));
}

/* ── 直近 N 日間の menu_item_id ごとの注文数（店内ホームの人気 Top3 用） ──
 * DB側の集計RPC（get_recent_item_counts, supabase/orders_anon_lockdown.sql）を
 * 経由する。order_items/orders への直接SELECTはanonに開放していないため、
 * 店舗全体の集計値のみを返すこの関数を使う。 */
export async function fetchRecentOrderItemCounts(
  sinceDays: number
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("get_recent_item_counts", {
    days: sinceDays,
  });
  if (error) throw error;

  const counts = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data ?? []).forEach((row: any) => {
    if (!row.menu_item_id) return;
    counts.set(row.menu_item_id, Number(row.total_quantity ?? 0));
  });
  return counts;
}

/* ════════════════════════════════════════════════════════════
 * スタッフ側 機能基盤（supabase/staff_foundation.sql と対）
 * ════════════════════════════════════════════════════════════ */

export type OrderStatus = "pending" | "preparing" | "served" | "picked_up" | "paid";
export type CookingStatus = "pending" | "cooking" | "done";

export interface ConditionalUpdateResult {
  ok: boolean;
  /** true の場合、他端末が先に更新済み（0件更新）だったことを示す */
  conflict: boolean;
  /** 更新後の updated_at。**次に同じ行を更新するときはこの値を渡すこと。**
   * 呼び出し側が保持している古い値のまま2回目を投げると、必ず自分自身と
   * 競合してしまう（同一端末での連続操作が通らなくなる）。conflict時は undefined。 */
  updatedAt?: string;
}

/* ── 1. 同時操作の競合検知 ──
 * 取得時の updated_at を WHERE 条件に含めて更新する。
 * 0件更新（他端末が先に更新済み）の場合は conflict:true を返す。
 * updated_at は DB から取得した値をそのまま（再フォーマットせず）渡すこと。
 * new Date(...).toISOString() 等を経由するとミリ秒未満が丸められ、
 * 常に不一致（誤検知）になるため注意。 */
export async function updateOrderItemCookingStatusIfUnchanged(
  id: string,
  newStatus: CookingStatus,
  expectedUpdatedAt: string
): Promise<ConditionalUpdateResult> {
  const { data, error } = await supabase
    .from("order_items")
    .update({ cooking_status: newStatus })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id, updated_at");
  if (error) throw error;
  const ok = (data?.length ?? 0) > 0;
  return { ok, conflict: !ok, updatedAt: data?.[0]?.updated_at };
}

export async function updateOrderStatusIfUnchanged(
  id: string,
  newStatus: OrderStatus,
  expectedUpdatedAt: string
): Promise<ConditionalUpdateResult> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id, updated_at");
  if (error) throw error;
  const ok = (data?.length ?? 0) > 0;
  return { ok, conflict: !ok, updatedAt: data?.[0]?.updated_at };
}

/* ── お客様側から自分の注文の状態・受渡番号を引く ──
 * orders への直接SELECTは authenticated 限定のため、anon にも実行可能な
 * SECURITY DEFINER 関数 get_order_statuses 経由で取得する
 * （supabase/orders_anon_lockdown.sql + supabase/pickup_no.sql）。
 * 返るのは status と pickup_no のみで、金額・テーブル番号・明細は返らない。 */
export interface OrderStatusRow {
  id: string;
  status: OrderStatus;
  pickup_no: number | null;
}

export async function fetchOrderStatuses(orderIds: string[]): Promise<OrderStatusRow[]> {
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_order_statuses", {
    order_ids: orderIds,
  });
  if (error) throw error;
  return (data ?? []) as OrderStatusRow[];
}

/* ── 4. テイクアウトの受け渡し状態 ──
 * served（調理完了）→ picked_up（受け渡し済み）。
 * 呼び出し元で order_type === "takeout" であることを確認してから呼ぶ想定
 * （このAPI自体はorder_typeをチェックしない）。 */
export async function markOrderPickedUp(
  orderId: string,
  expectedUpdatedAt: string
): Promise<ConditionalUpdateResult> {
  return updateOrderStatusIfUnchanged(orderId, "picked_up", expectedUpdatedAt);
}

/* ── 2. スタッフ呼び出しの個別対応 ── */
export type StaffCallStatus = "waiting" | "acknowledged" | "done";

/** 呼び出し1件を「対応中」にする（waiting → acknowledged） */
export async function acknowledgeStaffCall(id: string): Promise<void> {
  const { error } = await supabase
    .from("staff_calls")
    .update({ status: "acknowledged" })
    .eq("id", id);
  if (error) throw error;
}

/** 呼び出し1件を完了にする（waiting/acknowledged いずれからも done へ） */
export async function completeStaffCall(id: string): Promise<void> {
  const { error } = await supabase
    .from("staff_calls")
    .update({ status: "done" })
    .eq("id", id);
  if (error) throw error;
}

/** 未対応（waiting・acknowledged）の呼び出しを一括で完了にする（既存の「すべて対応済みにする」用） */
export async function completeAllPendingStaffCalls(): Promise<void> {
  const { error } = await supabase
    .from("staff_calls")
    .update({ status: "done" })
    .in("status", ["waiting", "acknowledged"]);
  if (error) throw error;
}

/* ── 3. 店舗の受付停止・営業状態 ── */
export async function isAcceptingOrders(): Promise<boolean> {
  const { data, error } = await supabase
    .from("stores")
    .select("is_accepting_orders")
    .eq("id", STORE_ID)
    .single();
  if (error) throw error;
  return data?.is_accepting_orders ?? true;
}

export async function setAcceptingOrders(accepting: boolean): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({ is_accepting_orders: accepting })
    .eq("id", STORE_ID);
  if (error) throw error;
}

/* ── 管理画面用：全メニューアイテム（未公開含む） ── */
export async function fetchAllMenuItemsAdmin(): Promise<
  (ApiMenuItem & { category_slug: string })[]
> {
  const catMap = await buildCatMap();

  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_takeout, is_available, display_order"
    )
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    category_slug: row.category_id ? (catMap[row.category_id] ?? "") : "",
  }));
}
