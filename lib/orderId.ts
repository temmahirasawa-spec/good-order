/**
 * 注文 ID（uuid）の採番。
 *
 * お客様のカート（lib/store.ts）と、レジからの追加（管理画面）の両方で使う。
 * 同じ ID で place_order を呼び直しても二重にならない（ON CONFLICT DO NOTHING）ので、
 * **送信のたびに作り直さず、1回の注文につき1つ**にすること。
 */
export function newOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // フォールバック（古い環境用）
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
