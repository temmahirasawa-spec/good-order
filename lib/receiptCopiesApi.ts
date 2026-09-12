/**
 * 伝票の枚数（stores.receipt_copies）の読み書き。辞書と型は lib/receiptCopies.ts。
 */
import { supabase } from "./supabase";
import { STORE_ID } from "./api";
import { RECEIPT_COPIES_DEFAULT, normalizeReceiptCopies, type ReceiptCopiesMode } from "./receiptCopies";

/** 現在の設定を読む。列がまだ無い（SQL 未適用）ときは既定値 */
export async function fetchReceiptCopies(): Promise<ReceiptCopiesMode> {
  const { data, error } = await supabase
    .from("stores")
    .select("receipt_copies")
    .eq("id", STORE_ID)
    .maybeSingle();
  if (error) {
    // 42703 = undefined_column。SQL を流す前でも画面は開けるようにする
    if (error.code === "42703") {
      console.warn("[receiptCopies] stores.receipt_copies がありません。supabase/receipt_copies.sql を流してください。");
      return RECEIPT_COPIES_DEFAULT;
    }
    throw error;
  }
  return normalizeReceiptCopies((data as { receipt_copies?: unknown } | null)?.receipt_copies);
}

/** 保存（manager / kitchen / counter）。RPC 側でロールと値を検証する */
export async function saveReceiptCopies(mode: ReceiptCopiesMode): Promise<void> {
  const { error } = await supabase.rpc("save_receipt_copies", { p_mode: mode });
  if (error) throw error;
}
