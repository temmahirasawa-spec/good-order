/**
 * 売上ダッシュボードのデータ取得・集計レイヤー
 * 時間は JST 基準で扱う
 */

import { supabase } from "./supabase";

/* ────────────── 型 ────────────── */

export interface SalesOrderItem {
  quantity: number;
  unit_price: number;
  menu_item_name: string;
  category_id: string | null;
  category_name: string | null;
}

export interface SalesOrder {
  id: string;
  table_number: number;
  total_amount: number;      // 税込み合計
  order_type: "dine_in" | "takeout";
  created_at: string;        // ISO (UTC)
  items: SalesOrderItem[];
}

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  avgSpend: number;
  dineInRevenue: number;
  takeoutRevenue: number;
  dineInCount: number;
  takeoutCount: number;
}

export interface HourlyBucket {
  hour: number;     // 0-23 (JST)
  label: string;    // "08:00"
  revenue: number;
  orders: number;
}

export interface DailyBucket {
  date: string;     // "2026-04-18"
  label: string;    // "04/18"
  revenue: number;
  orders: number;
  avgSpend: number;
  dineInRevenue: number;
  takeoutRevenue: number;
}

export interface WeekdayBucket {
  weekday: number;   // 0=日, 1=月, ... 6=土
  label: string;     // "月" etc
  revenue: number;
  orders: number;
}

export interface MenuRanking {
  name: string;
  category: string | null;
  quantity: number;
  revenue: number;
}

export interface CategoryRanking {
  name: string;
  revenue: number;
  orders: number;
}

export interface TableStat {
  table_number: number;
  uses: number;
  revenue: number;
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  revenue: number;
}

export interface SpendBucket {
  label: string;       // "¥0〜999"
  min: number;
  max: number;         // exclusive
  count: number;
}

export interface DineInVsTakeout {
  dineIn: { revenue: number; orders: number; avgSpend: number };
  takeout: { revenue: number; orders: number; avgSpend: number };
  daily: { date: string; label: string; dineIn: number; takeout: number }[];
}

/* ────────────── JST 日付ヘルパー ────────────── */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDate(iso: string): Date {
  // UTC → JST に見える Date（ただし UTC メソッドで読む前提）
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS);
}
export function jstHour(iso: string): number {
  return jstDate(iso).getUTCHours();
}
export function jstWeekday(iso: string): number {
  return jstDate(iso).getUTCDay();
}
export function jstYmd(iso: string): string {
  const d = jstDate(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ────────────── データ取得 ────────────── */

/**
 * DB側のRPC（get_sales_orders, supabase/staff_role_rls.sql）を経由する。
 * 関数内で role='manager' を強制しているため、kitchen/register roleでは
 * 例外(insufficient_privilege)になる。orders/order_itemsの生テーブルは
 * kitchen/registerも自分の業務で直接読む必要があるためRLS自体は
 * authenticatedのまま変更していない。
 */
export async function fetchSalesData(
  startDate: Date,
  endDate: Date
): Promise<SalesOrder[]> {
  const { data, error } = await supabase.rpc("get_sales_orders", {
    start_ts: startDate.toISOString(),
    end_ts: endDate.toISOString(),
  });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((o) => ({
    id: o.id,
    table_number: o.table_number ?? 0,
    total_amount: o.total_amount ?? 0,
    order_type: (o.order_type ?? "dine_in") as "dine_in" | "takeout",
    created_at: o.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (o.order_items ?? []).map((it: any) => ({
      quantity:      it.quantity ?? 0,
      unit_price:    it.unit_price ?? 0,
      menu_item_name: it.menu_items?.name ?? "(不明な商品)",
      category_id:   it.menu_items?.category_id ?? null,
      category_name: it.menu_items?.categories?.name ?? null,
    })),
  }));
}

/* ────────────── 集計関数 ────────────── */

export function calcSummary(orders: SalesOrder[]): SalesSummary {
  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalOrders  = orders.length;
  const avgSpend     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const dineIn  = orders.filter((o) => o.order_type === "dine_in");
  const takeout = orders.filter((o) => o.order_type === "takeout");
  return {
    totalRevenue,
    totalOrders,
    avgSpend,
    dineInRevenue:  dineIn.reduce((s, o) => s + o.total_amount, 0),
    takeoutRevenue: takeout.reduce((s, o) => s + o.total_amount, 0),
    dineInCount:  dineIn.length,
    takeoutCount: takeout.length,
  };
}

export function calcHourly(orders: SalesOrder[], startHour = 0, endHour = 24): HourlyBucket[] {
  const buckets: HourlyBucket[] = [];
  for (let h = startHour; h < endHour; h++) {
    buckets.push({ hour: h, label: `${String(h).padStart(2, "0")}:00`, revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    const h = jstHour(o.created_at);
    if (h < startHour || h >= endHour) continue;
    const b = buckets[h - startHour];
    b.revenue += o.total_amount;
    b.orders  += 1;
  }
  return buckets;
}

export function calcDaily(orders: SalesOrder[]): DailyBucket[] {
  const map = new Map<string, DailyBucket>();
  for (const o of orders) {
    const ymd = jstYmd(o.created_at);
    const prev = map.get(ymd);
    if (prev) {
      prev.revenue += o.total_amount;
      prev.orders  += 1;
      if (o.order_type === "dine_in") prev.dineInRevenue  += o.total_amount;
      else                             prev.takeoutRevenue += o.total_amount;
    } else {
      map.set(ymd, {
        date: ymd,
        label: ymd.slice(5).replace("-", "/"),
        revenue: o.total_amount,
        orders: 1,
        avgSpend: 0,
        dineInRevenue:  o.order_type === "dine_in"  ? o.total_amount : 0,
        takeoutRevenue: o.order_type === "takeout" ? o.total_amount : 0,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, avgSpend: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0 }));
}

const WD_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function calcWeekday(orders: SalesOrder[]): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = [1, 2, 3, 4, 5, 6, 0].map((w) => ({
    weekday: w,
    label: WD_LABELS[w],
    revenue: 0,
    orders: 0,
  }));
  for (const o of orders) {
    const w = jstWeekday(o.created_at);
    const b = buckets.find((b) => b.weekday === w);
    if (b) {
      b.revenue += o.total_amount;
      b.orders  += 1;
    }
  }
  return buckets;
}

export function calcMenuRanking(orders: SalesOrder[]): MenuRanking[] {
  const map = new Map<string, MenuRanking>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.menu_item_name;
      const prev = map.get(key);
      const rev  = it.unit_price * it.quantity;
      if (prev) {
        prev.quantity += it.quantity;
        prev.revenue  += rev;
      } else {
        map.set(key, {
          name: it.menu_item_name,
          category: it.category_name,
          quantity: it.quantity,
          revenue: rev,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
}

export function calcCategoryRanking(orders: SalesOrder[]): CategoryRanking[] {
  const map = new Map<string, CategoryRanking>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.category_name ?? "その他";
      const prev = map.get(key);
      const rev  = it.unit_price * it.quantity;
      if (prev) {
        prev.revenue += rev;
        prev.orders  += it.quantity;
      } else {
        map.set(key, { name: key, revenue: rev, orders: it.quantity });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function calcTableStats(orders: SalesOrder[]): TableStat[] {
  const map = new Map<number, TableStat>();
  for (const o of orders) {
    if (o.order_type === "takeout") continue; // テイクアウトは含めない
    const t = o.table_number;
    const prev = map.get(t);
    if (prev) {
      prev.uses    += 1;
      prev.revenue += o.total_amount;
    } else {
      map.set(t, { table_number: t, uses: 1, revenue: o.total_amount });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.table_number - b.table_number);
}

export function calcPeakHour(orders: SalesOrder[]): string {
  if (orders.length === 0) return "—";
  const hourly = calcHourly(orders);
  let peak = hourly[0];
  for (const b of hourly) if (b.revenue > peak.revenue) peak = b;
  if (peak.revenue === 0) return "—";
  const next = String((peak.hour + 1) % 24).padStart(2, "0");
  return `${peak.label}〜${next}:00`;
}

export function calcAvgTableTurnover(orders: SalesOrder[], seats: number): number {
  if (seats <= 0) return 0;
  const dineInCount = orders.filter((o) => o.order_type === "dine_in").length;
  return dineInCount / seats;
}

/* ── 曜日×時間帯ヒートマップ ── */
export function calcHeatmap(orders: SalesOrder[]): HeatmapCell[] {
  const grid: HeatmapCell[] = [];
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      grid.push({ weekday: w, hour: h, revenue: 0 });
    }
  }
  for (const o of orders) {
    const w = jstWeekday(o.created_at);
    const h = jstHour(o.created_at);
    const idx = w * 24 + h;
    grid[idx].revenue += o.total_amount;
  }
  return grid;
}

/* ── 客単価ヒストグラム ── */
export function calcSpendDistribution(orders: SalesOrder[]): SpendBucket[] {
  const step = 1000;
  const buckets: SpendBucket[] = [];
  for (let i = 0; i < 8; i++) {
    const min = i * step;
    const max = (i + 1) * step;
    buckets.push({
      label: i === 7 ? `¥${min.toLocaleString()}〜` : `¥${min.toLocaleString()}〜${(max - 1).toLocaleString()}`,
      min, max: i === 7 ? Infinity : max,
      count: 0,
    });
  }
  for (const o of orders) {
    const t = o.total_amount;
    const idx = Math.min(7, Math.floor(t / step));
    if (idx >= 0) buckets[idx].count += 1;
  }
  return buckets;
}

/* ── 店内 vs テイクアウト ── */
export function calcDineInVsTakeout(orders: SalesOrder[]): DineInVsTakeout {
  const dineIn = orders.filter((o) => o.order_type === "dine_in");
  const takeout = orders.filter((o) => o.order_type === "takeout");
  const sum = (arr: SalesOrder[]) => arr.reduce((s, o) => s + o.total_amount, 0);

  // 日別
  const map = new Map<string, { date: string; label: string; dineIn: number; takeout: number }>();
  for (const o of orders) {
    const ymd = jstYmd(o.created_at);
    const prev = map.get(ymd);
    if (prev) {
      if (o.order_type === "dine_in") prev.dineIn  += o.total_amount;
      else                             prev.takeout += o.total_amount;
    } else {
      map.set(ymd, {
        date: ymd,
        label: ymd.slice(5).replace("-", "/"),
        dineIn:  o.order_type === "dine_in"  ? o.total_amount : 0,
        takeout: o.order_type === "takeout" ? o.total_amount : 0,
      });
    }
  }

  return {
    dineIn: {
      revenue: sum(dineIn),
      orders: dineIn.length,
      avgSpend: dineIn.length > 0 ? Math.round(sum(dineIn) / dineIn.length) : 0,
    },
    takeout: {
      revenue: sum(takeout),
      orders: takeout.length,
      avgSpend: takeout.length > 0 ? Math.round(sum(takeout) / takeout.length) : 0,
    },
    daily: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ── CSV 出力 ── */
export function toCsv(orders: SalesOrder[]): string {
  const header = ["id", "date_jst", "time_jst", "table_number", "order_type", "total_amount"];
  const rows = orders.map((o) => {
    const d = jstDate(o.created_at);
    const date = jstYmd(o.created_at);
    const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    return [o.id, date, time, o.table_number, o.order_type, o.total_amount];
  });
  return [header, ...rows].map((r) => r.join(",")).join("\n");
}

/* ── 期間ユーティリティ ── */
export function jstStartOfDay(d: Date): Date {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const day = jst.getUTCDate();
  return new Date(Date.UTC(y, m, day) - JST_OFFSET_MS);
}

export function jstEndOfDay(d: Date): Date {
  return new Date(jstStartOfDay(d).getTime() + 24 * 60 * 60 * 1000);
}

/* ── 期間ラベル → 開始/終了 ── */
export type PeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "past_3_months"
  | "custom";

export function resolvePeriod(
  key: PeriodKey,
  now: Date = new Date(),
  custom?: { start: Date; end: Date }
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const todayStart = jstStartOfDay(now);

  const daySpan = (days: number) => 24 * 60 * 60 * 1000 * days;

  if (key === "today") {
    const start = todayStart;
    const end   = new Date(start.getTime() + daySpan(1));
    return { start, end, prevStart: new Date(start.getTime() - daySpan(1)), prevEnd: start };
  }
  if (key === "yesterday") {
    const end   = todayStart;
    const start = new Date(end.getTime() - daySpan(1));
    return { start, end, prevStart: new Date(start.getTime() - daySpan(1)), prevEnd: start };
  }
  if (key === "this_week") {
    // 月曜始まり。JST の weekday で計算する
    const jst = new Date(todayStart.getTime() + JST_OFFSET_MS);
    const dow = jst.getUTCDay(); // 0=日
    const offset = dow === 0 ? 6 : dow - 1;
    const start = new Date(todayStart.getTime() - daySpan(offset));
    const end   = new Date(start.getTime() + daySpan(7));
    return { start, end, prevStart: new Date(start.getTime() - daySpan(7)), prevEnd: start };
  }
  if (key === "last_week") {
    const thisWeek = resolvePeriod("this_week", now);
    const start = new Date(thisWeek.start.getTime() - daySpan(7));
    const end   = thisWeek.start;
    return { start, end, prevStart: new Date(start.getTime() - daySpan(7)), prevEnd: start };
  }
  if (key === "this_month") {
    const jst = new Date(todayStart.getTime() + JST_OFFSET_MS);
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1) - JST_OFFSET_MS);
    const end   = new Date(Date.UTC(y, m + 1, 1) - JST_OFFSET_MS);
    const prevStart = new Date(Date.UTC(y, m - 1, 1) - JST_OFFSET_MS);
    return { start, end, prevStart, prevEnd: start };
  }
  if (key === "last_month") {
    const jst = new Date(todayStart.getTime() + JST_OFFSET_MS);
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth();
    const start = new Date(Date.UTC(y, m - 1, 1) - JST_OFFSET_MS);
    const end   = new Date(Date.UTC(y, m, 1) - JST_OFFSET_MS);
    const prevStart = new Date(Date.UTC(y, m - 2, 1) - JST_OFFSET_MS);
    return { start, end, prevStart, prevEnd: start };
  }
  if (key === "past_3_months") {
    const jst = new Date(todayStart.getTime() + JST_OFFSET_MS);
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth();
    const start = new Date(Date.UTC(y, m - 2, 1) - JST_OFFSET_MS);
    const end   = new Date(Date.UTC(y, m + 1, 1) - JST_OFFSET_MS);
    const prevStart = new Date(Date.UTC(y, m - 5, 1) - JST_OFFSET_MS);
    return { start, end, prevStart, prevEnd: start };
  }
  // custom
  if (custom) {
    const start = jstStartOfDay(custom.start);
    const end   = jstEndOfDay(custom.end);
    const len = end.getTime() - start.getTime();
    return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start };
  }
  // fallback → today
  return resolvePeriod("today", now);
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
