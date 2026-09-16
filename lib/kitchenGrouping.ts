/**
 * 厨房画面用：注文をテーブル単位（テイクアウトは個別）にグループ化する
 */
import { normalizeServingTiming, type ServingTiming } from "./servingTiming";

export type CookingStatus = "pending" | "cooking" | "done";

export interface KitchenItem {
  orderItemId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  cookingStatus: CookingStatus;
  isTakeoutItem: boolean;
  /** 提供タイミング（でき次第 / 先出し / 食後）。選択対象外・移行前の注文は null */
  servingTiming: ServingTiming | null;
  /** 選んだオプション（トッピング）の名前。無ければ空 */
  options: string[];
  /** 楽観ロック用。DBから取得した値をそのまま保持し、再フォーマットしないこと */
  updatedAt: string;
}

export interface KitchenOrderRound {
  orderId: string;
  createdAt: string;
  /** 楽観ロック用（orders.updated_at）。DBから取得した値をそのまま保持すること */
  updatedAt: string;
  /** orders.status。会計済み（paid）の注文は「すべて提供済みにする」で status を上書きしない */
  status: string;
  items: KitchenItem[];
}

export interface KitchenTableGroup {
  groupKey: string;             // 'table-{table_id|number}' or 'takeout-{order_id}'
  orderType: "dine_in" | "takeout";
  tableNumber: number | null;
  /** "A1" のような表示ラベル（Step3-O）。移行前の注文は null */
  tableLabel: string | null;
  rounds: KitchenOrderRound[];
  oldestCreatedAt: string;
  hasUnacknowledged: boolean;
  allItemsDone: boolean;
}

export interface OrderWithItems {
  id: string;
  table_number: number | null;
  table_id?: string | null;
  table_label?: string | null;
  order_type: "dine_in" | "takeout";
  status?: string;
  created_at: string;
  updated_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order_items: any[];
}

/**
 * 店内注文を「同じ卓」として束ねるキー。**レジの tableKey と同じ規則**にする。
 *
 * ⚠ table_id が無いときに table_number だけで束ねてはいけない。
 * 席設定を作り直すと卓の行が消え、place_order は table_id を NULL にして注文を通す
 * （supabase/order_stale_table_id.sql）。いまの注文は table_number がどれも 0 なので、
 * `table-0` で束ねると **別のお客様の注文が1枚のカードに合流し、「すべて提供済みにする」が
 * 別卓の注文まで巻き込む**（2026-09-16 の裏取りで実行して確認）。
 * レジ側は PR #105 でラベル優先に直っていたが、厨房側が取り残されていた。
 * 伝票の「追加(N)」の採番（supabase/print_jobs_recovery.sql の print_job_seq_for_order）も同じ順序。
 */
export function dineInTableKey(o: {
  table_id?: string | null;
  table_number: number | null;
  table_label?: string | null;
}): string {
  if (o.table_id) return o.table_id;
  const label = o.table_label?.trim();
  if (label) return `l:${label}`;
  return `n:${o.table_number ?? 0}`;
}

export function groupOrdersByTable(
  orders: OrderWithItems[],
  acknowledgedSet: Set<string> = new Set()
): KitchenTableGroup[] {
  const groups = new Map<string, KitchenTableGroup>();

  for (const order of orders) {
    const key =
      order.order_type === "dine_in"
        ? `table-${dineInTableKey(order)}`
        : `takeout-${order.id}`;

    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        orderType: order.order_type,
        tableNumber: order.table_number ?? null,
        tableLabel: order.table_label ?? null,
        rounds: [],
        oldestCreatedAt: order.created_at,
        hasUnacknowledged: false,
        allItemsDone: false,
      });
    }

    const group = groups.get(key)!;
    group.rounds.push({
      orderId: order.id,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      status: order.status ?? "pending",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (order.order_items ?? []).map((it: any) => ({
        orderItemId: it.id,
        menuItemId: it.menu_item_id,
        name: it.menu_items?.name ?? "(不明な商品)",
        quantity: it.quantity ?? 0,
        cookingStatus: (it.cooking_status ?? "pending") as CookingStatus,
        isTakeoutItem: Boolean(it.menu_items?.is_takeout),
        servingTiming: normalizeServingTiming(it.serving_timing),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options: ((it.order_item_options ?? []) as any[]).map((o) => String(o?.name ?? "")).filter(Boolean),
        updatedAt: it.updated_at,
      })),
    });

    if (order.created_at < group.oldestCreatedAt) {
      group.oldestCreatedAt = order.created_at;
    }
  }

  // 各グループ内のラウンドを古い順にソート + 状態算出
  groups.forEach((g) => {
    g.rounds.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    g.allItemsDone = g.rounds.every((r) =>
      r.items.every((i) => i.cookingStatus === "done")
    );
    g.hasUnacknowledged = g.rounds.some((r) => !acknowledgedSet.has(r.orderId));
  });

  // グループ自体を最古順
  return Array.from(groups.values()).sort((a, b) =>
    a.oldestCreatedAt.localeCompare(b.oldestCreatedAt)
  );
}

/**
 * 経過時間 + 緊急度の判定
 */
export type Urgency = "normal" | "warning" | "urgent";

export function calcElapsed(createdAt: string, now: number): {
  minutes: number;
  label: string;
  urgency: Urgency;
} {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  );
  let urgency: Urgency = "normal";
  if (minutes >= 20) urgency = "urgent";
  else if (minutes >= 10) urgency = "warning";

  let label: string;
  if (minutes < 1) label = "今";
  else if (minutes < 60) label = `${minutes}分経過`;
  else label = `${Math.floor(minutes / 60)}時間${minutes % 60}分経過`;

  return { minutes, label, urgency };
}

