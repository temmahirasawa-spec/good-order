/**
 * 厨房画面の「新着注文を確認した」ステートを LocalStorage に永続化する
 */

const KEY = "orderly_kitchen_ack";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function getAcknowledged(): string[] {
  return read();
}

export function isAcknowledged(orderId: string): boolean {
  return read().includes(orderId);
}

export function acknowledge(orderIds: string[]): void {
  if (orderIds.length === 0) return;
  const set = new Set(read());
  orderIds.forEach((id) => set.add(id));
  write(Array.from(set));
}

/**
 * 表示中の order_id 集合に基づいて、消えた注文の確認情報を片付ける。
 * 起動時 + 適度なタイミングで呼ぶ想定。
 */
export function cleanupOldAcks(activeOrderIds: string[]): void {
  const active = new Set(activeOrderIds);
  const filtered = read().filter((id) => active.has(id));
  write(filtered);
}
