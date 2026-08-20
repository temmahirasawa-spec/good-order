/** ISO日時文字列をJST（UTC+9）のHH:MMに整形する。厨房・レジ両方で使用する共通ユーティリティ。 */
export function formatJstHm(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * ISO日時文字列をJST（UTC+9）の MM/DD HH:MM に整形する。
 * 厨房伝票の「受付」時刻に使う。日付を含むのは、日を跨いで残った伝票が
 * 手元にあったときに取り違えないようにするため。
 */
export function formatJstMdHm(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd} ${formatJstHm(iso)}`;
}
