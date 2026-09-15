/**
 * 消費税の扱い（内税 / 外税、店内10% / テイクアウト8%）
 *
 * 2026-09-15、洋輔さんの指摘で追加。
 * それまでは「価格は税抜」と決め打ちで、どこでも `× 1.1` していた。
 * ところが店舗はメニューの価格を**税込**で登録していたため、**二重に課税**していた
 * （3,430円のご注文に 3,773円を請求していた）。プレオープン前で実害は無かった。
 *
 * DB: stores.tax_*（supabase/tax_mode.sql）
 *
 * ⚠ **計算の規則は supabase/tax_mode.sql の calc_order_total() と同じ。**
 * 金額の正は DB 側（place_order）で、ここは画面に出すための写し。
 * 変えるときは必ず両方直すこと。
 */
import { supabase } from "./supabase";
import { STORE_ID } from "./api";

/** 価格に消費税が含まれているか */
export type TaxMode = "included" | "excluded";

export interface TaxSetting {
  mode: TaxMode;
  /** 店内飲食の税率（%） */
  rateDineIn: number;
  /** テイクアウトの税率（%）。軽減税率 */
  rateTakeout: number;
}

/**
 * 既定は **内税**。いまの登録データが税込で入っているため、
 * 設定が読めないときも二重課税に戻らないようにする。
 */
export const TAX_DEFAULT: TaxSetting = {
  mode: "included",
  rateDineIn: 10,
  rateTakeout: 8,
};

/** ⚠ お客様の目に触れる文言 */
export const TAX_INCLUDED_LABEL = "内税（価格に消費税を含む）";
export const TAX_EXCLUDED_LABEL = "外税（価格に消費税を加算）";

/** その注文に使う税率（%）。テイクアウトは軽減税率 */
export function taxRateFor(
  orderType: "dine_in" | "takeout",
  setting: TaxSetting
): number {
  return orderType === "takeout" ? setting.rateTakeout : setting.rateDineIn;
}

export interface OrderTotals {
  /** 明細の合計（登録された価格のまま。内税なら税込、外税なら税抜） */
  subtotal: number;
  /** 割引額 */
  discount: number;
  /** 消費税額。内税なら「合計に含まれている分」、外税なら「加算した分」 */
  tax: number;
  /** お客様が支払う額 */
  total: number;
  /** 適用した税率（%） */
  rate: number;
  /** 内税かどうか。表示の出し分けに使う */
  included: boolean;
}

/**
 * 小計と割引から、消費税と合計を出す。
 *
 *   内税: 合計 = 小計 − 割引 ／ 消費税 = floor(合計 × 税率 ÷ (100 + 税率))
 *   外税: 消費税 = floor((小計 − 割引) × 税率 ÷ 100) ／ 合計 = 小計 − 割引 + 消費税
 *
 * 割引は**どちらの場合も小計からそのまま引く**。内税なら「税込で200円安くなる」、
 * 外税なら「税抜で200円安くなる」。お客様から見た値引きの意味を揃えるため。
 */
export function calcOrderTotals({
  subtotal,
  discount = 0,
  orderType,
  setting,
}: {
  subtotal: number;
  discount?: number;
  orderType: "dine_in" | "takeout";
  setting: TaxSetting;
}): OrderTotals {
  const rate = taxRateFor(orderType, setting);
  const base = Math.max(0, subtotal - discount);
  const included = setting.mode === "included";

  const tax = included
    ? Math.floor((base * rate) / (100 + rate))
    : Math.floor((base * rate) / 100);
  const total = included ? base : base + tax;

  return { subtotal, discount, tax, total, rate, included };
}

/* ── 読み書き ─────────────────────────────────────────────── */

function normalize(row: {
  tax_mode?: unknown;
  tax_rate_dine_in?: unknown;
  tax_rate_takeout?: unknown;
} | null): TaxSetting {
  if (!row) return TAX_DEFAULT;
  const rate = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : fallback;
  };
  return {
    mode: row.tax_mode === "excluded" ? "excluded" : "included",
    rateDineIn: rate(row.tax_rate_dine_in, TAX_DEFAULT.rateDineIn),
    rateTakeout: rate(row.tax_rate_takeout, TAX_DEFAULT.rateTakeout),
  };
}

/**
 * 設定を読む。列がまだ無い（SQL 未適用）ときは既定（内税）を返す。
 */
export async function fetchTaxSetting(): Promise<TaxSetting> {
  const { data, error } = await supabase
    .from("stores")
    .select("tax_mode, tax_rate_dine_in, tax_rate_takeout")
    .eq("id", STORE_ID)
    .maybeSingle();
  if (error) {
    // 42703 = undefined_column
    if (error.code === "42703") {
      console.warn("[tax] stores.tax_* がありません。supabase/tax_mode.sql を流してください。");
      return TAX_DEFAULT;
    }
    throw error;
  }
  return normalize(data as Parameters<typeof normalize>[0]);
}

/** 保存（manager のみ）。RPC 側でロールと値を検証する */
export async function saveTaxSetting(setting: TaxSetting): Promise<void> {
  const { error } = await supabase.rpc("save_tax_setting", {
    p_mode: setting.mode,
    p_rate_dine_in: setting.rateDineIn,
    p_rate_takeout: setting.rateTakeout,
  });
  if (error) throw error;
}
