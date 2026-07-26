/**
 * 受渡番号（orders.pickup_no）の表示ユーティリティ。
 *
 * 採番はサーバー側の BEFORE INSERT トリガー（supabase/pickup_no.sql）が行う。
 * 営業日（Asia/Tokyo）ごとにリセットされ 01〜99 を循環するため、
 * 表示は常に2桁ゼロ埋めにする。
 *
 * レジ画面の「# + 注文ID先頭6桁」は"内部照合用ID"であって受渡番号ではない。
 * 両者を同じ見た目にしないこと。
 */

/** どの画面でも同じ文言を使う（お客様に口頭で伝える番号のラベル） */
export const PICKUP_NO_LABEL = "受渡番号";

/** 1〜99 を "#01" / "#12" 形式に。未採番（null）は "—" */
export function formatPickupNo(no: number | null | undefined): string {
  if (no === null || no === undefined) return "—";
  return `#${String(no).padStart(2, "0")}`;
}

/** レジ画面などで併記する内部照合用ID（注文IDの先頭6桁） */
export function internalOrderRef(orderId: string): string {
  return orderId.slice(0, 6);
}
