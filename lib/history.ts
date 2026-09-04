/**
 * 注文履歴のクライアント側永続化（LocalStorage）
 *
 * Supabase の RLS によって anon の SELECT が制限されている想定。
 * 履歴表示は DB に依存せず、注文確定時にスナップショットを
 * そのまま LocalStorage に保存する方針を取る
 */

import type { ServingTiming } from "./servingTiming";
import type { SelectedOption } from "./menuOptions";

const KEY = "yorkys_order_history";
const MAX = 30;

export interface HistoryItemSnapshot {
  menuItemId: string;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  /** 提供タイミング（でき次第 / 先出し / 食後）。選択対象外は null。移行前の履歴には無い */
  servingTiming?: ServingTiming | null;
  /** 選んだオプション（名前・価格のスナップショット）。unitPrice はオプション込み */
  options?: SelectedOption[];
}

export interface HistoryEntry {
  orderId: string;
  orderedAt: string;              // ISO
  tableNumber: number;
  /** "A1" のような卓ラベル（Step3-O）。移行前に保存された履歴には無いので optional */
  tableLabel?: string | null;
  orderType: "dine_in" | "takeout";
  totalAmount: number;            // 税込
  status: "pending" | "preparing" | "served" | "picked_up" | "paid";
  items: HistoryItemSnapshot[];
  /** 受渡番号（サーバー採番）。注文直後は未取得なので null のことがある */
  pickupNo?: number | null;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 旧フォーマット（orderId + orderedAt のみ）を無視してフィルタ
    return parsed.filter(
      (e): e is HistoryEntry =>
        e &&
        typeof e.orderId === "string" &&
        typeof e.orderedAt === "string" &&
        Array.isArray(e.items)
    );
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadHistory();
    list.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch (err) {
    console.warn("[history] append failed:", err);
  }
}

export function updateHistoryStatus(
  orderId: string,
  status: HistoryEntry["status"]
): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadHistory();
    const next = list.map((e) => (e.orderId === orderId ? { ...e, status } : e));
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[history] updateStatus failed:", err);
  }
}

/** サーバー採番された受渡番号を LocalStorage の履歴にも反映する */
export function updateHistoryPickupNo(orderId: string, pickupNo: number | null): void {
  if (typeof window === "undefined" || pickupNo === null) return;
  try {
    const list = loadHistory();
    const next = list.map((e) => (e.orderId === orderId ? { ...e, pickupNo } : e));
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[history] updatePickupNo failed:", err);
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
