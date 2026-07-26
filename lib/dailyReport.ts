/**
 * 営業日報の集計とフォーマット（サーバーサイド専用）
 * SUPABASE_SERVICE_ROLE_KEY を使用するため、絶対にクライアントから import しない
 */

import { createClient } from "@supabase/supabase-js";

export type DailyReport = {
  date: string;
  totalRevenue: number;
  totalTables: number;
  avgSpend: number;
  dineInCount: number;
  takeoutCount: number;
  topMenus: { name: string; quantity: number; revenue: number }[];
  hourlyPeak: string;
  comparedToYesterday: {
    revenue: number;
    tables: number;
  };
  hasData: boolean;
};

/* ── サーバー専用の Supabase クライアント ── */
function getServerClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_URL が未設定です");
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ── JST の 1 日の範囲（UTC ISO 文字列として返す） ── */
function jstDayRange(d: Date) {
  // JST = UTC+9
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jst = new Date(d.getTime() + jstOffsetMs);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const day = jst.getUTCDate();
  const startUtcMs = Date.UTC(y, m, day) - jstOffsetMs;
  const endUtcMs   = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso:   new Date(endUtcMs).toISOString(),
    jstY: y, jstM: m + 1, jstD: day,
  };
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/* ── 昨日（JST）の同範囲の総計だけ取得する軽量関数 ── */
async function fetchPaidSummary(startIso: string, endIso: string) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("status", "paid")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (error) throw error;
  const rows = data ?? [];
  const revenue = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  return { revenue, tables: rows.length };
}

export async function generateDailyReport(targetDate: Date): Promise<DailyReport> {
  const supabase = getServerClient();

  // 対象日（JST）の範囲
  const { startIso, endIso, jstY, jstM, jstD } = jstDayRange(targetDate);

  // 昨日（JST）
  const yest = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
  const yestRange = jstDayRange(yest);

  // 対象日の paid orders + order_items + menu_items を JOIN
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(`
      id, table_number, total_amount, order_type, created_at,
      order_items (
        quantity, unit_price,
        menu_items ( name )
      )
    `)
    .eq("status", "paid")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (ordersErr) throw ordersErr;

  const yesterday = await fetchPaidSummary(yestRange.startIso, yestRange.endIso);

  const dateJp = `${jstY}年${jstM}月${jstD}日（${WEEKDAYS_JA[new Date(Date.UTC(jstY, jstM - 1, jstD)).getUTCDay()]}）`;

  const rows = orders ?? [];

  if (rows.length === 0) {
    return {
      date: dateJp,
      totalRevenue: 0,
      totalTables: 0,
      avgSpend: 0,
      dineInCount: 0,
      takeoutCount: 0,
      topMenus: [],
      hourlyPeak: "—",
      comparedToYesterday: {
        revenue: 0 - yesterday.revenue,
        tables: 0 - yesterday.tables,
      },
      hasData: false,
    };
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const totalTables  = rows.length;
  const avgSpend     = totalTables > 0 ? Math.floor(totalRevenue / totalTables) : 0;
  const dineInCount  = rows.filter((r) => (r.order_type ?? "dine_in") === "dine_in").length;
  const takeoutCount = rows.filter((r) => r.order_type === "takeout").length;

  // メニュー別に集計
  const menuMap = new Map<string, { quantity: number; revenue: number }>();
  for (const o of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of (o.order_items ?? []) as any[]) {
      const name = it.menu_items?.name ?? "(不明な商品)";
      const q    = it.quantity ?? 0;
      const rev  = (it.unit_price ?? 0) * q;
      const prev = menuMap.get(name) ?? { quantity: 0, revenue: 0 };
      menuMap.set(name, { quantity: prev.quantity + q, revenue: prev.revenue + rev });
    }
  }
  const topMenus = Array.from(menuMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);

  // 時間帯ピーク（1 時間単位・税込合計）
  const hourBuckets = new Array(24).fill(0) as number[];
  for (const o of rows) {
    if (!o.created_at) continue;
    // JST 表示用に +9h
    const hour = new Date(new Date(o.created_at).getTime() + 9 * 3600 * 1000).getUTCHours();
    hourBuckets[hour] += o.total_amount ?? 0;
  }
  let peakHour = 0;
  let peakMax  = 0;
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > peakMax) {
      peakMax = hourBuckets[h];
      peakHour = h;
    }
  }
  const hourlyPeak = peakMax > 0
    ? `${String(peakHour).padStart(2, "0")}:00〜${String((peakHour + 1) % 24).padStart(2, "0")}:00`
    : "—";

  return {
    date: dateJp,
    totalRevenue,
    totalTables,
    avgSpend,
    dineInCount,
    takeoutCount,
    topMenus,
    hourlyPeak,
    comparedToYesterday: {
      revenue: totalRevenue - yesterday.revenue,
      tables: totalTables  - yesterday.tables,
    },
    hasData: true,
  };
}

/* ── 送信用テキスト整形 ── */
export function formatReportText(r: DailyReport): string {
  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  const signedYen = (n: number) =>
    `${n >= 0 ? "+" : "-"}${yen(Math.abs(n))}`;
  const revArrow = r.comparedToYesterday.revenue >= 0 ? "📈" : "📉";
  const tblArrow = r.comparedToYesterday.tables  >= 0 ? "📈" : "📉";

  if (!r.hasData) {
    return [
      "📊 YORKYS BRUNCH 営業日報",
      r.date,
      "",
      "━━━━━━━━━━━━━━━━",
      "本日の会計済み注文はありません（データなし）",
      "",
      `昨日との比較： ${revArrow} ${signedYen(r.comparedToYesterday.revenue)} ・ ${tblArrow} ${r.comparedToYesterday.tables >= 0 ? "+" : ""}${r.comparedToYesterday.tables}組`,
    ].join("\n");
  }

  const medals = ["🥇", "🥈", "🥉"];
  const topLines = r.topMenus.length > 0
    ? r.topMenus.map((m, i) => `  ${medals[i] ?? "・"} ${m.name}（${m.quantity}件 ・ ${yen(m.revenue)}）`)
    : ["  （データなし）"];

  return [
    "📊 YORKYS BRUNCH 営業日報",
    r.date,
    "",
    "━━━━━━━━━━━━━━━━",
    `💰 売上合計：${yen(r.totalRevenue)}`,
    `　　昨日比：${revArrow} ${signedYen(r.comparedToYesterday.revenue)}`,
    "",
    `🪑 会計組数：${r.totalTables}組`,
    `　　店内 ${r.dineInCount}組 ・ テイクアウト ${r.takeoutCount}組`,
    "",
    `📈 客単価：${yen(r.avgSpend)}`,
    `⏰ ピーク：${r.hourlyPeak}`,
    "",
    "━━━━━━━━━━━━━━━━",
    "🏆 人気メニュー Top 3",
    ...topLines,
  ].join("\n");
}
