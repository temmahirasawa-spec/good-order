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

/**
 * いまの営業日（JST の暦日、`YYYY-MM-DD`）。
 *
 * DB の `public.orderly_business_date(ts)` と同じ定義（JST の日付。日またぎの
 * 補正はしていない）。**定義を変えるときは両方直すこと。**
 *
 * 厨房とレジはこれで「今日の注文」だけに絞る。2026-09-13 までは絞っておらず、
 * 会計されなかった注文が**何日でも画面に残り続けていた**（9月2日の検証注文が
 * 11日間そのまま出ていた。天真・洋輔さんの指摘で判明）。
 */
export function businessDateToday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
