/**
 * 提供タイミング（でき次第 / 先出し / 食後）
 *
 * 仕様: docs/specs/serving-timing.md（2026-09-04 に天真が決定）
 *
 * - 対象カテゴリーは DB の categories.serving_timing_choice（管理画面のトグル）で決まる
 * - 選択肢の文言は区分（categories.category_type）で決まる
 *     food  → でき次第（asap） / 食後（after_meal）
 *     drink → 先出し（first）  / 食後（after_meal）
 * - 初期値は food=でき次第、drink=先出し
 * - テイクアウト注文と持ち帰り商品では「食後」が成り立たないので選べない（null）
 *
 * 文言・初期値・対象判定をここ1か所に閉じ込め、商品詳細・カート・完了画面・
 * 履歴・厨房画面・伝票（lib/receipt.ts）が同じ辞書を見るようにしている。
 */
import type { ApiCategory } from "./api";
import type { MenuItem } from "./menu";

export type ServingTiming = "asap" | "first" | "after_meal";
export type ServingCategoryType = "food" | "drink";

const VALUES: readonly ServingTiming[] = ["asap", "first", "after_meal"];

/** お客様向けの見出し */
export const SERVING_TIMING_TITLE = "提供タイミング";

/** 表示名。伝票・厨房画面・お客様画面で共通 */
export const SERVING_TIMING_LABEL: Record<ServingTiming, string> = {
  asap:       "でき次第",
  first:      "先出し",
  after_meal: "食後",
};

export interface ServingTimingOption {
  value: ServingTiming;
  label: string;
  /** 商品詳細の選択カードに出す補足（1行） */
  description: string;
}

/* 天真の決定（2026-09-04）: フードは「お料理と一緒に」ではなく「調理でき次第」。
   お料理を頼まずパンケーキだけ頼む人もいるため。 */
const FOOD_OPTIONS: ServingTimingOption[] = [
  { value: "asap",       label: SERVING_TIMING_LABEL.asap,       description: "調理でき次第お持ちします" },
  { value: "after_meal", label: SERVING_TIMING_LABEL.after_meal, description: "お食事のあとにお持ちします" },
];

/* ドリンクの「先出し」の補足文は AI が決めた（2026-09-04）。気に入らなければここを変えるだけ */
const DRINK_OPTIONS: ServingTimingOption[] = [
  { value: "first",      label: SERVING_TIMING_LABEL.first,      description: "お食事より先にお持ちします" },
  { value: "after_meal", label: SERVING_TIMING_LABEL.after_meal, description: "お食事のあとにお持ちします" },
];

/** 区分ごとの選択肢（並び順も画面のとおり） */
export function servingTimingOptions(type: ServingCategoryType): ServingTimingOption[] {
  return type === "drink" ? DRINK_OPTIONS : FOOD_OPTIONS;
}

/** 区分ごとの初期値 */
export function defaultServingTiming(type: ServingCategoryType): ServingTiming {
  return type === "drink" ? "first" : "asap";
}

export function isServingTiming(v: unknown): v is ServingTiming {
  return typeof v === "string" && (VALUES as readonly string[]).includes(v);
}

/** DB や LocalStorage から読んだ値を安全に3値 or null に落とす */
export function normalizeServingTiming(v: unknown): ServingTiming | null {
  return isServingTiming(v) ? v : null;
}

type CategoryForTiming = Pick<ApiCategory, "slug" | "category_type" | "serving_timing_choice">;
type ItemForTiming = Pick<MenuItem, "subcategory" | "category" | "isTakeout">;
type OrderTypeForTiming = "dine_in" | "takeout";

/**
 * 商品の区分。DB の category_type を優先する。
 * MenuItem.category は slug の固定リスト（lib/api.ts の DRINK_SLUGS）から推定した値で、
 * 本番の 'drink' のような slug を拾えないため、カテゴリーが引けたときはそちらを信じる。
 */
export function servingCategoryType(
  categories: CategoryForTiming[],
  item: ItemForTiming
): ServingCategoryType {
  const cat = categories.find((c) => c.slug === item.subcategory);
  if (cat) return cat.category_type === "drink" ? "drink" : "food";
  return item.category === "drink" ? "drink" : "food";
}

/** この商品で提供タイミングを選べるか */
export function canChooseServingTiming(
  categories: CategoryForTiming[],
  item: ItemForTiming,
  orderType: OrderTypeForTiming
): boolean {
  // 持ち帰るものに「食後」は無い
  if (orderType === "takeout" || item.isTakeout) return false;
  const cat = categories.find((c) => c.slug === item.subcategory);
  return cat?.serving_timing_choice === true;
}

/** カートに入れるときの初期値。選べない商品は null */
export function defaultServingTimingFor(
  categories: CategoryForTiming[],
  item: ItemForTiming,
  orderType: OrderTypeForTiming
): ServingTiming | null {
  if (!canChooseServingTiming(categories, item, orderType)) return null;
  return defaultServingTiming(servingCategoryType(categories, item));
}

/**
 * カートの行を識別するキー。
 * 同じ商品でも提供タイミングが違えば別の行（仕様 3-3）。
 * null と undefined（移行前に保存されたカート）は同じ行として扱う。
 */
export function cartLineKey(itemId: string, timing?: ServingTiming | null): string {
  return `${itemId}::${timing ?? ""}`;
}
