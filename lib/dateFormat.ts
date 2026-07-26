/** ISO日時文字列をJST（UTC+9）のHH:MMに整形する。厨房・レジ両方で使用する共通ユーティリティ。 */
export function formatJstHm(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
