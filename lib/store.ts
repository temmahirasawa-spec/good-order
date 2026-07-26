import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem } from "./menu";
import { supabase } from "./supabase";
import { appendHistory, type HistoryEntry } from "./history";
import { isAcceptingOrders } from "./api";

const STORE_ID = "10000000-0000-0000-0000-000000000001";

function generateUuid(): string {
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

/**
 * orderId から order_items 用の決定的なUUIDを作る。
 * 同じ注文を再送しても同じ id になるので、ON CONFLICT DO NOTHING で
 * 明細が二重登録されない（UUIDの書式は保ったまま末尾のnode部をindexで置換）。
 */
function derivedItemId(orderId: string, index: number): string {
  // "xxxxxxxx-xxxx-4xxx-yxxx-" までの24文字を残し、残り12文字をindexで埋める
  return orderId.slice(0, 24) + String(index).padStart(12, "0");
}

// RLS で anon の SELECT が制限されているため、id はクライアント側で生成して
// .select() を使わずに INSERT する。
//
// 受渡番号（orders.pickup_no）はサーバー側の BEFORE INSERT トリガーが採番するため
// ここでは一切渡さない（supabase/pickup_no.sql）。
// 同じ orderId が再送された場合に受渡番号が振り直されないよう、
// orders / order_items とも upsert + ignoreDuplicates（= ON CONFLICT DO NOTHING）
// にしている。再送時は既存行が一切書き換わらないので pickup_no も変わらない。
async function saveOrderToDb(
  orderId: string,
  items: { item: MenuItem; quantity: number }[],
  tableNumber: number | null,
  orderType: "dine_in" | "takeout",
  totalAmount: number
): Promise<boolean> {
  try {
    const { error: orderError } = await supabase
      .from("orders")
      .upsert(
        {
          id: orderId,
          store_id: STORE_ID,
          table_number: orderType === "takeout" ? 0 : (tableNumber ?? 0),
          status: "pending",
          order_type: orderType,
          total_amount: totalAmount,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

    if (orderError) throw orderError;

    const orderItems = items.map((ci, idx) => ({
      id: derivedItemId(orderId, idx),
      order_id: orderId,
      menu_item_id: ci.item.id,
      quantity: ci.quantity,
      unit_price: ci.item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .upsert(orderItems, { onConflict: "id", ignoreDuplicates: true });

    if (itemsError) throw itemsError;

    return true;
  } catch (err) {
    console.error("[saveOrderToDb] failed:", err);
    return false;
  }
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "empty" | "closed" };

interface CartStore {
  items: CartItem[];
  tableNumber: number | null;
  orderType: "dine_in" | "takeout";
  isTakeoutMode: boolean;
  orderHistory: CartItem[][];
  hasOrdered: boolean;
  /** 直近に確定した注文のID（/complete が受渡番号を引くのに使う） */
  lastOrderId: string | null;

  setTable: (n: number) => void;
  setOrderType: (type: "dine_in" | "takeout") => void;
  setTakeoutMode: (flag: boolean) => void;
  addItem: (item: MenuItem, qty?: number) => void;
  addItems: (entries: CartItem[]) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  placeOrder: () => Promise<PlaceOrderResult>;

  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: null,
      orderType: "dine_in",
      isTakeoutMode: false,
      orderHistory: [],
      hasOrdered: false,
      lastOrderId: null,

      setTable: (n) => set({ tableNumber: n }),
      setOrderType: (type) => set({ orderType: type }),
      setTakeoutMode: (flag) => set({ isTakeoutMode: flag }),

      addItem: (item, qty = 1) => {
        const existing = get().items.find((i) => i.item.id === item.id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.item.id === item.id
                ? { ...i, quantity: i.quantity + qty }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, { item, quantity: qty }] });
        }
      },

      addItems: (entries) => {
        const curr = get().items.slice();
        for (const e of entries) {
          const existing = curr.find((i) => i.item.id === e.item.id);
          if (existing) existing.quantity += e.quantity;
          else curr.push({ item: e.item, quantity: e.quantity });
        }
        set({ items: curr });
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.item.id !== id) });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.item.id === id ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      placeOrder: async () => {
        const current = get().items;
        if (current.length === 0) return { ok: false, reason: "empty" };

        // 店舗が受付停止中なら新規注文をブロックする（fail-open: 取得失敗時は許可する）
        let accepting = true;
        try {
          accepting = await isAcceptingOrders();
        } catch (err) {
          console.warn("[placeOrder] isAcceptingOrders check failed, allowing order:", err);
        }
        if (!accepting) return { ok: false, reason: "closed" };

        const tableNumber = get().tableNumber;
        const orderType   = get().orderType;

        const subtotal = current.reduce((s, i) => s + i.item.price * i.quantity, 0);
        const totalAmount = Math.floor(subtotal * 1.1);
        const orderId = generateUuid();

        // DB 書き込みの前に LocalStorage にスナップショットを先行保存
        // （RLS で select 出来ないので DB に頼らない）
        const entry: HistoryEntry = {
          orderId,
          orderedAt: new Date().toISOString(),
          tableNumber: orderType === "takeout" ? 0 : (tableNumber ?? 0),
          orderType,
          totalAmount,
          status: "pending",
          items: current.map((ci) => ({
            menuItemId: ci.item.id,
            name: ci.item.name,
            image: ci.item.image || null,
            quantity: ci.quantity,
            unitPrice: ci.item.price,
          })),
        };
        appendHistory(entry);

        // DB は fire-and-forget 的に呼ぶ（失敗しても履歴は残る）
        void saveOrderToDb(orderId, current, tableNumber, orderType, totalAmount);

        set({
          orderHistory: [...get().orderHistory, current],
          items: [],
          hasOrdered: true,
          isTakeoutMode: false,
          lastOrderId: orderId,
        });
        return { ok: true, orderId };
      },

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.item.price * i.quantity, 0),
    }),
    {
      name: "orderly-cart",
      partialize: (state) => ({
        items: state.items,
        tableNumber: state.tableNumber,
        orderType: state.orderType,
        isTakeoutMode: state.isTakeoutMode,
        orderHistory: state.orderHistory,
        hasOrdered: state.hasOrdered,
        lastOrderId: state.lastOrderId,
      }),
    }
  )
);
