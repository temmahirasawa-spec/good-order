/**
 * セットドリンク割引（食事と一緒の注文でドリンクを割り引く）
 *
 * 仕様: docs/specs/set-drink-discount.md（2026-09-13、洋輔さんの依頼）
 * DB: stores.set_drink_*（supabase/set_drink_discount.sql）
 *
 *   フード1品につきドリンク1杯まで、1杯あたり既定 200円引き。
 *   例: パンケーキ1 ＋ ドリンク2 → ドリンク1杯ぶんだけ 200円引き。
 *
 * **金額の正は DB 側（place_order）**。ここの計算はお客様の画面に
 * 「いくら引かれるか」を出すためのもので、同じ規則を書き写している。
 * 規則を変えるときは **supabase/set_drink_discount.sql と必ず両方**直すこと。
 */
import { supabase } from "./supabase";
import { STORE_ID } from "./api";
import type { ApiCategory } from "./api";
import type { MenuItem } from "./menu";
import { servingCategoryType } from "./servingTiming";

/** お客様に見せる割引の名前。⚠ お客様の目に触れる文言 */
export const SET_DRINK_LABEL = "セットドリンク割引";

/** 管理画面の見出し */
export const SET_DRINK_TITLE = "セットドリンク";

export interface SetDrinkSetting {
  /** 割引を使うか。既定 OFF */
  enabled: boolean;
  /** 1杯あたりの割引額（円、税抜き） */
  discount: number;
  /** テイクアウトの注文にも適用するか。既定 OFF（店内のみ） */
  takeout: boolean;
}

export const SET_DRINK_DEFAULT: SetDrinkSetting = {
  enabled: false,
  discount: 200,
  takeout: false,
};

/** 1杯あたりの割引額の上限（DB の CHECK と揃える） */
export const SET_DRINK_MAX = 10000;

/** 割引の計算に必要な、カートの行の最小の形 */
export interface DiscountLine {
  item: Pick<MenuItem, "subcategory" | "category" | "isTakeout">;
  quantity: number;
  /** オプション込みの単価（税抜き） */
  unitPrice: number;
}

/**
 * 割引額（税抜き）を返す。割引が付かないときは 0。
 *
 * 規則（supabase/set_drink_discount.sql と同じ）:
 *   1. 対象の杯数 = min(フードの点数, ドリンクの点数)
 *   2. 単価の**安い順**にその杯数ぶん、1杯あたり min(設定額, その杯の単価) を引く
 *      （100円のドリンクに200円引いてマイナスにしないため）
 */
export function calcSetDrinkDiscount(
  lines: DiscountLine[],
  categories: Pick<ApiCategory, "slug" | "category_type" | "serving_timing_choice">[],
  orderType: "dine_in" | "takeout",
  setting: SetDrinkSetting
): number {
  if (!setting.enabled || setting.discount <= 0) return 0;
  if (orderType === "takeout" && !setting.takeout) return 0;

  let foodQty = 0;
  const drinkUnitPrices: number[] = [];
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const isDrink = servingCategoryType(categories, line.item) === "drink";
    if (isDrink) {
      for (let i = 0; i < line.quantity; i++) drinkUnitPrices.push(line.unitPrice);
    } else {
      foodQty += line.quantity;
    }
  }

  const count = Math.min(foodQty, drinkUnitPrices.length);
  if (count <= 0) return 0;

  drinkUnitPrices.sort((a, b) => a - b);
  return drinkUnitPrices
    .slice(0, count)
    .reduce((sum, price) => sum + Math.min(setting.discount, Math.max(0, price)), 0);
}

/* ── 読み書き ─────────────────────────────────────────────── */

function normalize(row: { set_drink_enabled?: unknown; set_drink_discount?: unknown; set_drink_takeout?: unknown } | null): SetDrinkSetting {
  if (!row) return SET_DRINK_DEFAULT;
  const discount = Number(row.set_drink_discount);
  return {
    enabled: row.set_drink_enabled === true,
    discount: Number.isFinite(discount) && discount >= 0 ? Math.floor(discount) : SET_DRINK_DEFAULT.discount,
    takeout: row.set_drink_takeout === true,
  };
}

/**
 * 設定を読む。列がまだ無い（SQL 未適用）ときは既定（OFF）を返す。
 * 割引が出ないだけで、注文そのものは通る。
 */
export async function fetchSetDrinkSetting(): Promise<SetDrinkSetting> {
  const { data, error } = await supabase
    .from("stores")
    .select("set_drink_enabled, set_drink_discount, set_drink_takeout")
    .eq("id", STORE_ID)
    .maybeSingle();
  if (error) {
    // 42703 = undefined_column
    if (error.code === "42703") {
      console.warn("[setDrink] stores.set_drink_* がありません。supabase/set_drink_discount.sql を流してください。");
      return SET_DRINK_DEFAULT;
    }
    throw error;
  }
  return normalize(data as Parameters<typeof normalize>[0]);
}

/** 保存（manager のみ）。RPC 側でロールと値を検証する */
export async function saveSetDrinkSetting(setting: SetDrinkSetting): Promise<void> {
  const { error } = await supabase.rpc("save_set_drink_setting", {
    p_enabled: setting.enabled,
    p_discount: setting.discount,
    p_takeout: setting.takeout,
  });
  if (error) throw error;
}
