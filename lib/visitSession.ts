"use client";

/**
 * ご来店の区切り（会計が済んだら注文を終える）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「うちを利用してもらった後に、お客さんのスマホにオーダー画面が残ってて、
 *     退店してからオーダーがもしできるとなるとややこしいなーと思うのですが」
 *
 * **それまで期限はまったく無かった。** 卓の情報とカートは localStorage に
 * 無期限で残るので、退店どころか翌日でも注文できてしまう状態だった。
 *
 * 締め方（天真の決定 2026-09-15）:
 *   **レジで「会計済みにする」が押されたら、その端末の注文を終える。**
 *   時間での自動終了は今回入れない。
 *
 * ⚠ **会計を押し忘れると、その端末はいつまでも注文できる。**
 * 時間での締めを入れていないため。必要になったら `lib/visitSession.ts` に
 * 「最後の注文から N 時間」を足す（設計は済んでいる）。
 *
 * どう判定するか:
 *   この端末が出した注文の状態を `get_order_statuses`（anon で呼べる RPC）で引き、
 *   **1件以上あって、その全部が `paid` なら来店は終わり**とみなす。
 *   注文が1件も無いお客様（まだ何も頼んでいない）は当然ふつうに注文できる。
 *
 *   卓の付け替え（会計後に別のお客様が同じ席に座る）は、QR を読み直せば
 *   新しい来店として始まる。ここで履歴を消すので前のお客様の注文は残らない。
 */
import { loadHistory, clearHistory } from "./history";
import { fetchOrderStatuses } from "./api";

/** 来店が終わったことを覚えておくキー。QR を読み直すと消える */
const CLOSED_KEY = "orderly_visit_closed";

export function isVisitClosed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setClosed(closed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (closed) window.localStorage.setItem(CLOSED_KEY, "1");
    else window.localStorage.removeItem(CLOSED_KEY);
  } catch {
    /* プライベートブラウズ等で書けないことがある。締められないだけで害はない */
  }
}

/**
 * QR を読み直したときに呼ぶ。**新しいご来店として開き直す。**
 * 前のお客様の履歴が残っていると金額が混ざるので、ここで消す。
 */
export function beginVisit(): void {
  if (isVisitClosed()) {
    clearHistory();
    setClosed(false);
  }
}

/**
 * この端末の注文が全部会計済みになっていないか確かめる。
 * 終わっていれば true を返し、以後 `isVisitClosed()` が true になる。
 *
 * 通信に失敗したときは **締めない**（false）。
 * 電波が悪いだけで注文できなくなるほうが困るため。
 */
export async function refreshVisitClosed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isVisitClosed()) return true;

  const entries = loadHistory();
  if (entries.length === 0) return false;

  try {
    const rows = await fetchOrderStatuses(entries.map((e) => e.orderId));
    /* 返ってこなかった注文（消された等）は判断材料にしない */
    if (rows.length === 0) return false;
    const allPaid = rows.every((r) => r.status === "paid");
    if (allPaid) {
      setClosed(true);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[visitSession] refreshVisitClosed failed:", err);
    return false;
  }
}
