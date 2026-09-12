/**
 * 伝票の枚数（管理画面「印刷状況」の設定）
 *
 * 仕様: docs/specs/sold-out-and-receipt-copies.md（2026-09-12、洋輔さんの依頼）
 * DB: stores.receipt_copies（supabase/receipt_copies.sql）
 *
 *   one          … 常に1枚
 *   two          … 常に同じ伝票を2枚（見出し「厨房伝票 1/2」「厨房伝票 2/2」）
 *   two_if_mixed … フードとドリンクが両方あるときだけ2枚（2026-09-04 からの現状。
 *                  見出し「厨房伝票 1/2」「ドリンク伝票 2/2」）
 *
 * 何枚刷るかの本体は lib/receipt.ts の receiptCopies()。ここは値の辞書だけ
 * （Supabase の読み書きは lib/receiptCopiesApi.ts。伝票の組み立て側が DB クライアントを引き込まないため）。
 */
export type ReceiptCopiesMode = "one" | "two" | "two_if_mixed";

const VALUES: readonly ReceiptCopiesMode[] = ["one", "two", "two_if_mixed"];

/** DB の既定値と同じ（列が無い・読めないときもこれ） */
export const RECEIPT_COPIES_DEFAULT: ReceiptCopiesMode = "two_if_mixed";

export interface ReceiptCopiesOption {
  value: ReceiptCopiesMode;
  label: string;
  /** 設定カードの補足（1行） */
  description: string;
}

/** 管理画面の選択肢（並び順も画面のとおり） */
export const RECEIPT_COPIES_OPTIONS: ReceiptCopiesOption[] = [
  { value: "one",          label: "1枚",
    description: "厨房用に1枚だけ印刷します。" },
  { value: "two",          label: "2枚（毎回）",
    description: "同じ伝票を続けて2枚印刷します（厨房伝票 1/2・2/2）。" },
  { value: "two_if_mixed", label: "フードとドリンクが両方あるときだけ2枚",
    description: "片方だけの注文は1枚。両方あるときは「厨房伝票 1/2」「ドリンク伝票 2/2」。" },
];

export const RECEIPT_COPIES_TITLE = "伝票の枚数";

export function normalizeReceiptCopies(v: unknown): ReceiptCopiesMode {
  return typeof v === "string" && (VALUES as readonly string[]).includes(v)
    ? (v as ReceiptCopiesMode)
    : RECEIPT_COPIES_DEFAULT;
}
