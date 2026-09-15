/**
 * 使う機能のON/OFF（厨房画面・スタッフ呼び出し）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「厨房にiPadを置かないことになったので、厨房の画面を一旦使わないようにできますか？
 *     タイミング見て機能確認のためにやっていきます」
 *   「それに伴い『スタッフを呼ぶ』も一旦なくしてもらって」
 *
 * DB: stores.kitchen_enabled / staff_call_enabled（supabase/feature_toggles.sql）
 * 設定画面: 管理画面「表示設定」＞「使う機能」
 *
 * **消すのではなく切る。** あとから戻せることが依頼の前提。
 *
 * ⚠ 厨房画面を OFF にしても **厨房伝票の印刷は止めない**（天真の決定）。
 * 伝票で注文を受け取る運用になるため。印刷まで止めると注文が誰にも届かない。
 */
import { supabase } from "./supabase";
import { STORE_ID } from "./api";

export interface FeatureToggles {
  /** 厨房画面（/admin/kitchen）を使うか */
  kitchen: boolean;
  /** お客様の「スタッフを呼ぶ」を使うか */
  staffCall: boolean;
}

/** 既定はどちらも ON。設定が読めないときに機能が消えないようにする */
export const FEATURES_DEFAULT: FeatureToggles = { kitchen: true, staffCall: true };

export async function fetchFeatureToggles(): Promise<FeatureToggles> {
  const { data, error } = await supabase
    .from("stores")
    .select("kitchen_enabled, staff_call_enabled")
    .eq("id", STORE_ID)
    .maybeSingle();
  if (error) {
    // 42703 = undefined_column（SQL 未適用）
    if (error.code === "42703") {
      console.warn("[features] stores.kitchen_enabled がありません。supabase/feature_toggles.sql を流してください。");
      return FEATURES_DEFAULT;
    }
    throw error;
  }
  const row = (data ?? {}) as { kitchen_enabled?: unknown; staff_call_enabled?: unknown };
  return {
    kitchen:   row.kitchen_enabled !== false,
    staffCall: row.staff_call_enabled !== false,
  };
}

/** 保存（manager のみ）。RPC 側でロールを検証する */
export async function saveFeatureToggles(f: FeatureToggles): Promise<void> {
  const { error } = await supabase.rpc("save_feature_toggles", {
    p_kitchen: f.kitchen,
    p_staff_call: f.staffCall,
  });
  if (error) throw error;
}
