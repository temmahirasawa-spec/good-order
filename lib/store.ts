import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as Sentry from "@sentry/nextjs";
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
 * 注文を DB に保存する。
 *
 * 生テーブルへの INSERT ではなく SECURITY DEFINER の RPC `place_order` を呼ぶ
 * （`supabase/order_insert_rpc.sql`）。理由:
 *
 *   PostgREST の upsert は ON CONFLICT DO NOTHING であっても UPDATE 権限を要求する。
 *   orders の UPDATE は staff_role_rls.sql でスタッフのロール限定になっており
 *   anon には UPDATE ポリシーが無いため、以前ここで使っていた
 *   upsert(..., { ignoreDuplicates: true }) は RLS に弾かれて
 *   **注文がまったく保存されていなかった**（2026-08-20 発覚）。
 *
 * RPC 側で以下が担保される:
 *   - 注文と明細が1トランザクションで入る（明細の無い注文が残らない）
 *   - 同じ orderId の再送は「何もしない」＝受渡番号が振り直されない
 *   - status は必ず 'pending'（クライアントには決めさせない）
 *   - テイクアウトの卓の正規化（table_* を落とす）もサーバー側で行う
 *
 * 受渡番号（orders.pickup_no）は BEFORE INSERT トリガーが採番するので
 * ここからは一切渡さない（`supabase/pickup_no.sql`）。
 *
 * @returns 保存できたか。再送で「既にある」場合も true（失敗ではない）
 */
async function saveOrderToDb(
  orderId: string,
  items: { item: MenuItem; quantity: number }[],
  tableNumber: number | null,
  tableId: string | null,
  tableLabel: string | null,
  orderType: "dine_in" | "takeout",
  totalAmount: number
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("place_order", {
      p_order_id:     orderId,
      p_store_id:     STORE_ID,
      p_table_number: tableNumber,
      // table_id は集計・絞り込み用、table_label は注文時点のラベルのスナップショット。
      // 卓を消したりカテゴリーのコードを変えても、過去の伝票の卓名は変わらない
      p_table_id:     tableId,
      p_table_label:  tableLabel,
      p_order_type:   orderType,
      p_total_amount: totalAmount,
      p_items: items.map((ci) => ({
        menu_item_id: ci.item.id,
        quantity:     ci.quantity,
        unit_price:   ci.item.price,
      })),
    });

    if (error) throw error;
    return true;
  } catch (err) {
    // placeOrder はここを待たない（fire-and-forget）ため、失敗しても
    // お客様の画面は完了に進む。黙って消えると厨房に注文が届かないまま
    // 誰も気づけないので、コンソールと Sentry の両方に必ず残す。
    console.error("[saveOrderToDb] failed:", err);
    Sentry.captureException(err, {
      tags: { feature: "order-submit" },
      extra: { orderId, orderType, itemCount: items.length, totalAmount },
    });
    return false;
  }
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  // "failed" … DB への保存に失敗した。カートは残す（お客様がやり直せるように）。
  //   以前はここを fire-and-forget にしていたため、保存に失敗しても
  //   画面は「ご注文を承りました」に進み、厨房には何も届かないまま
  //   誰も気づけなかった（2026-08-26 の監査で判明）。
  | { ok: false; reason: "empty" | "closed" | "failed" };

interface CartStore {
  items: CartItem[];
  tableNumber: number | null;
  /** tables.id。移行前の ?table=N で入ってきて解決できなかった場合は null */
  tableId: string | null;
  /** "A1" のような表示ラベル。注文時にスナップショットとして orders に書く */
  tableLabel: string | null;
  orderType: "dine_in" | "takeout";
  isTakeoutMode: boolean;
  orderHistory: CartItem[][];
  hasOrdered: boolean;
  /** 直近に確定した注文のID（/complete が受渡番号を引くのに使う） */
  lastOrderId: string | null;

  setTable: (n: number) => void;
  setTableRef: (id: string | null, label: string | null) => void;
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
      tableId: null,
      tableLabel: null,
      orderType: "dine_in",
      isTakeoutMode: false,
      orderHistory: [],
      hasOrdered: false,
      lastOrderId: null,

      setTable: (n) => set({ tableNumber: n }),
      setTableRef: (id, label) => set({ tableId: id, tableLabel: label }),
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
        const tableId     = get().tableId;
        const tableLabel  = get().tableLabel;
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
          tableLabel:  orderType === "takeout" ? null : tableLabel,
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

        // DB への保存は**必ず待つ**。
        // ここを fire-and-forget にしていると、Wi-Fi の瞬断や一時的な
        // エラーで保存に失敗しても画面は完了に進み、厨房には何も届かない。
        // お客様は料理を待ち続け、店は注文が来ていることすら知らない、
        // という最悪の壊れ方をする。
        //
        // リトライしても安全な理由: place_order は同じ p_order_id なら
        // ON CONFLICT DO NOTHING で何もしない（supabase/order_insert_rpc.sql）。
        // orderId は上で1回だけ採番しているので、何度呼んでも二重登録にならない。
        let saved = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          saved = await saveOrderToDb(
            orderId, current, tableNumber, tableId, tableLabel, orderType, totalAmount
          );
          if (saved) break;
          // 1回目の失敗は瞬断のことが多い。少し待って作り直す
          if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
        }

        if (!saved) {
          // カートを空にしない。お客様が「もう一度」を押せる状態で止める。
          // 履歴（localStorage）には既に積んであるが、DB に無い注文なので
          // ステータス照会にも出てこない。ここで止めるのが唯一の正解。
          return { ok: false, reason: "failed" };
        }

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
        tableId: state.tableId,
        tableLabel: state.tableLabel,
        orderType: state.orderType,
        isTakeoutMode: state.isTakeoutMode,
        orderHistory: state.orderHistory,
        hasOrdered: state.hasOrdered,
        lastOrderId: state.lastOrderId,
      }),
    }
  )
);
