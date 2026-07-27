/**
 * ベストセラー設定（トップページ最上部の「Best Seller」枠）のデータアクセス層。
 *
 * 表示ON/OFFは stores.best_seller_enabled、中身は best_sellers テーブル。
 * 詳細は supabase/best_sellers.sql の設計メモを参照。
 */

import { supabase } from "./supabase";
import { STORE_ID } from "./api";

/** Figmaの文言どおり最大20件。上限に達したら追加フォームごと隠す */
export const BEST_SELLER_MAX = 20;

export interface BestSellerSetting {
  enabled: boolean;
  /** display_order 昇順の menu_item_id */
  itemIds: string[];
}

export async function fetchBestSellerSetting(): Promise<BestSellerSetting> {
  const [{ data: store, error: storeErr }, { data: rows, error: rowsErr }] = await Promise.all([
    supabase.from("stores").select("best_seller_enabled").eq("id", STORE_ID).single(),
    supabase
      .from("best_sellers")
      .select("menu_item_id, display_order")
      .order("display_order", { ascending: true }),
  ]);
  if (storeErr) throw storeErr;
  if (rowsErr) throw rowsErr;

  return {
    enabled: store?.best_seller_enabled ?? true,
    itemIds: (rows ?? []).map((r) => r.menu_item_id as string),
  };
}

/**
 * トグルと一覧をまとめて保存する。
 * 一覧に無い行はサーバー側で削除される（個別のINSERT/DELETEを並べると
 * 途中で失敗したときに半分だけ反映された状態が残るため1関数にまとめている）。
 */
export async function saveBestSellerSetting(setting: BestSellerSetting): Promise<void> {
  const { error } = await supabase.rpc("save_best_sellers", {
    p_enabled: setting.enabled,
    p_items: setting.itemIds.map((id, i) => ({ menu_item_id: id, display_order: i + 1 })),
  });
  if (error) throw error;
}
