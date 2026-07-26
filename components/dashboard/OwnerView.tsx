"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
  PieChart, Pie, Cell,
  BarChart,
  LabelList,
} from "recharts";
import {
  fetchSalesData,
  calcSummary,
  calcHourly,
  calcDaily,
  calcMenuRanking,
  calcCategoryRanking,
  calcTableStats,
  calcHeatmap,
  calcSpendDistribution,
  calcDineInVsTakeout,
  calcAvgTableTurnover,
  resolvePeriod,
  formatYen,
  toCsv,
  type SalesOrder,
  type PeriodKey,
} from "@/lib/salesData";

const SEATS = 40;
const AMBER   = "#FAC03D";
const AMBER_HL = "#E0A820";
const BLUE    = "#3B82F6";

const PIE_COLORS = ["#FAC03D", "#E0A820", "#E0B84D", "#F0CE75", "#CA9A04", "#9C7A00", "#3B82F6", "#60A5FA"];

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "today",          label: "今日" },
  { key: "yesterday",      label: "昨日" },
  { key: "this_week",      label: "今週" },
  { key: "last_week",      label: "先週" },
  { key: "this_month",     label: "今月" },
  { key: "last_month",     label: "先月" },
  { key: "past_3_months",  label: "過去3ヶ月" },
  { key: "custom",         label: "カスタム" },
];

function pctChange(curr: number, prev: number): { value: number; up: boolean } {
  if (prev === 0) return { value: curr > 0 ? 100 : 0, up: curr >= 0 };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { value: Math.abs(pct), up: pct >= 0 };
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) {
    return <span className="text-[11px] text-gray-400">— 前期間比</span>;
  }
  const { value, up } = pctChange(current, prev);
  const color = up ? "text-emerald-600" : "text-red-500";
  return (
    <span className={`text-[11px] font-semibold ${color}`}>
      {up ? "▲" : "▼"} {up ? "+" : "-"}{value}%
    </span>
  );
}

function todayYmd(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function OwnerView() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customStart, setCustomStart] = useState<string>(todayYmd());
  const [customEnd,   setCustomEnd]   = useState<string>(todayYmd());
  const [menuTab, setMenuTab] = useState<"all" | "food" | "drink">("all");

  const [currOrders, setCurrOrders] = useState<SalesOrder[] | null>(null);
  const [prevOrders, setPrevOrders] = useState<SalesOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolved = useMemo(() => {
    if (period === "custom") {
      const s = new Date(customStart + "T00:00:00+09:00");
      const e = new Date(customEnd   + "T00:00:00+09:00");
      return resolvePeriod("custom", new Date(), { start: s, end: e });
    }
    return resolvePeriod(period);
  }, [period, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, p] = await Promise.all([
          fetchSalesData(resolved.start, resolved.end),
          fetchSalesData(resolved.prevStart, resolved.prevEnd),
        ]);
        if (!cancelled) {
          setCurrOrders(c);
          setPrevOrders(p);
        }
      } catch (e) {
        console.error("[OwnerView] fetch failed:", e);
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resolved]);

  const orders = currOrders ?? [];
  const prev   = prevOrders ?? [];

  const summary     = useMemo(() => calcSummary(orders), [orders]);
  const prevSummary = useMemo(() => calcSummary(prev),   [prev]);
  const turnover     = useMemo(() => calcAvgTableTurnover(orders, SEATS), [orders]);
  const prevTurnover = useMemo(() => calcAvgTableTurnover(prev,   SEATS), [prev]);

  // 期間の長さに応じて推移グラフの粒度を切り替え
  const trendData = useMemo(() => {
    const ms = resolved.end.getTime() - resolved.start.getTime();
    const days = Math.round(ms / (24 * 3600 * 1000));
    if (days <= 1) {
      return calcHourly(orders, 8, 24).map((b) => ({
        label: b.label,
        revenue: b.revenue,
        orders: b.orders,
        avgSpend: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
      }));
    }
    return calcDaily(orders).map((d) => ({
      label: d.label,
      revenue: d.revenue,
      orders: d.orders,
      avgSpend: d.avgSpend,
    }));
  }, [orders, resolved]);

  const menuRanking = useMemo(() => calcMenuRanking(orders), [orders]);
  const filteredMenu = useMemo(() => {
    if (menuTab === "all") return menuRanking;
    const drinkCats = new Set(["コーヒー", "紅茶", "ソフトドリンク", "アルコール", "ドリンク"]);
    return menuRanking.filter((m) => {
      const isDrink = m.category ? drinkCats.has(m.category) : false;
      return menuTab === "drink" ? isDrink : !isDrink;
    });
  }, [menuRanking, menuTab]);

  const categoryRanking = useMemo(() => calcCategoryRanking(orders), [orders]);
  const tableStats      = useMemo(() => calcTableStats(orders), [orders]);
  const heatmap         = useMemo(() => calcHeatmap(orders),    [orders]);
  const spendBuckets    = useMemo(() => calcSpendDistribution(orders), [orders]);
  const dineVsTake      = useMemo(() => calcDineInVsTakeout(orders), [orders]);

  const dineInRatio  = summary.totalRevenue > 0 ? (summary.dineInRevenue  / summary.totalRevenue) * 100 : 0;
  const takeoutRatio = summary.totalRevenue > 0 ? (summary.takeoutRevenue / summary.totalRevenue) * 100 : 0;
  const prevDineInRatio  = prevSummary.totalRevenue > 0 ? (prevSummary.dineInRevenue  / prevSummary.totalRevenue) * 100 : 0;
  const prevTakeoutRatio = prevSummary.totalRevenue > 0 ? (prevSummary.takeoutRevenue / prevSummary.totalRevenue) * 100 : 0;

  const handleCsvExport = () => {
    if (!currOrders) return;
    const csv = toCsv(currOrders);
    const bom = "\uFEFF"; // Excel 用 BOM
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `good_order_sales_${period}_${todayYmd()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isEmpty = !loading && orders.length === 0;

  return (
    <div className="space-y-6">
      {/* ── 期間フィルター + エクスポート ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === key
                  ? "bg-warm-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCsvExport}
          disabled={!currOrders || currOrders.length === 0}
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          📄 CSV で出力
        </button>
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
          <label className="text-xs text-gray-600">開始</label>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-gray-200"
          />
          <span className="text-xs text-gray-400">〜</span>
          <label className="text-xs text-gray-600">終了</label>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-gray-200"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          データ取得エラー: {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-warm-300 border-t-warm-700 animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400 text-sm">
          選択期間に会計済み注文はありません
        </div>
      ) : (
        <>
          {/* ── KPI 6 枚 ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="売上合計" value={formatYen(summary.totalRevenue)} curr={summary.totalRevenue} prev={prevSummary.totalRevenue} />
            <Kpi label="会計組数" value={`${summary.totalOrders}組`}       curr={summary.totalOrders} prev={prevSummary.totalOrders} />
            <Kpi label="客単価"   value={formatYen(summary.avgSpend)}       curr={summary.avgSpend}    prev={prevSummary.avgSpend} />
            <Kpi label={`席回転率 (${SEATS}席)`} value={`${turnover.toFixed(1)}回転`} curr={turnover} prev={prevTurnover} />
            <Kpi label="店内比率"   value={`${dineInRatio.toFixed(0)}%`}   curr={dineInRatio}   prev={prevDineInRatio} />
            <Kpi label="テイクアウト比率" value={`${takeoutRatio.toFixed(0)}%`} curr={takeoutRatio} prev={prevTakeoutRatio} />
          </div>

          {/* ── 中段：売上推移 + ヒートマップ ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 売上推移 */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">売上推移</h3>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any, n: any) => [formatYen(v), n === "revenue" ? "売上" : n === "avgSpend" ? "客単価" : "組数"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="revenue" name="売上" fill={AMBER} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" dataKey="avgSpend" name="客単価" type="monotone" stroke={BLUE} strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 曜日×時間帯ヒートマップ */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">曜日×時間帯ヒートマップ</h3>
              <Heatmap cells={heatmap} />
            </section>
          </div>

          {/* ── 下段：メニュー / カテゴリ / テーブル ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 人気メニューランキング */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">人気メニュー Top 10</h3>
                <div className="flex gap-1 text-[10px]">
                  {(["all", "food", "drink"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMenuTab(t)}
                      className={`px-2 py-0.5 rounded-full ${
                        menuTab === t ? "bg-warm-700 text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t === "all" ? "全て" : t === "food" ? "フード" : "ドリンク"}
                    </button>
                  ))}
                </div>
              </div>
              {filteredMenu.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">データなし</p>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredMenu.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} width={100} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any, n: any) => n === "quantity" ? [`${v} 件`, "注文数"] : [formatYen(v), "売上"]}
                      />
                      <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                        {filteredMenu.slice(0, 10).map((m, i) => (
                          <Cell key={m.name} fill={i < 3 ? AMBER_HL : AMBER} />
                        ))}
                        <LabelList
                          dataKey="quantity"
                          position="right"
                          style={{ fontSize: 10, fill: "#6B7280" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* カテゴリ別 */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">カテゴリ別売上</h3>
              {categoryRanking.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">データなし</p>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative" style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryRanking}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={85}
                          paddingAngle={2}
                        >
                          {categoryRanking.map((c, i) => (
                            <Cell key={c.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v: any) => formatYen(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[10px] text-gray-400">合計</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatYen(summary.totalRevenue)}
                      </p>
                    </div>
                  </div>
                  <ul className="w-full mt-3 space-y-1.5">
                    {categoryRanking.map((c, i) => {
                      const pct = summary.totalRevenue > 0 ? (c.revenue / summary.totalRevenue) * 100 : 0;
                      return (
                        <li key={c.name} className="flex items-center gap-2 text-[11px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-gray-700">{c.name}</span>
                          <span className="text-gray-500">{formatYen(c.revenue)}</span>
                          <span className="text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* テーブル稼働 */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">テーブル稼働</h3>
              {tableStats.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">データなし</p>
              ) : (() => {
                const maxUses = Math.max(...tableStats.map((t) => t.uses));
                return (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tableStats} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="table_number" tick={{ fontSize: 10, fill: "#6B7280" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v: any, n: any) => n === "uses" ? [`${v} 回`, "利用回数"] : [formatYen(v), "売上"]}
                          labelFormatter={(l) => `テーブル ${l}`}
                        />
                        <Bar dataKey="uses" name="利用回数" radius={[4, 4, 0, 0]}>
                          {tableStats.map((t) => {
                            // 回転率が低いテーブルを赤寄りに
                            const ratio = maxUses > 0 ? t.uses / maxUses : 0;
                            const color = ratio < 0.3 ? "#F87171" : AMBER;
                            return <Cell key={t.table_number} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </section>
          </div>

          {/* ── 客単価分布 + 店内 vs テイクアウト ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ヒストグラム */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">客単価分布</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6B7280" }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => `${v} 件`} />
                    <Bar dataKey="count" fill={AMBER} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "#6B7280" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 店内 vs テイクアウト */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">店内 vs テイクアウト</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <ComparisonCell label="売上" dineIn={dineVsTake.dineIn.revenue} takeout={dineVsTake.takeout.revenue} fmt={formatYen} />
                <ComparisonCell label="組数" dineIn={dineVsTake.dineIn.orders}  takeout={dineVsTake.takeout.orders}  fmt={(v) => `${v}組`} />
                <ComparisonCell label="客単価" dineIn={dineVsTake.dineIn.avgSpend} takeout={dineVsTake.takeout.avgSpend} fmt={formatYen} />
              </div>
              {dineVsTake.daily.length > 0 && (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dineVsTake.daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any, n: any) => [formatYen(v), n === "dineIn" ? "店内" : "テイクアウト"]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="dineIn"  name="店内"       stackId="s" fill={AMBER} />
                      <Bar dataKey="takeout" name="テイクアウト" stackId="s" fill={BLUE} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label, value, curr, prev,
}: { label: string; value: string; curr: number; prev: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3.5 flex flex-col gap-1">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      <DeltaBadge current={curr} prev={prev} />
    </div>
  );
}

function ComparisonCell({
  label, dineIn, takeout, fmt,
}: {
  label: string;
  dineIn: number;
  takeout: number;
  fmt: (v: number) => string;
}) {
  const total = dineIn + takeout;
  const inPct  = total > 0 ? (dineIn  / total) * 100 : 0;
  const outPct = total > 0 ? (takeout / total) * 100 : 0;
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 mb-2">{label}</p>
      <div className="flex gap-2 text-xs font-medium">
        <div className="flex-1">
          <p className="text-warm-800">店内 {fmt(dineIn)}</p>
          <p className="text-[10px] text-gray-400">{inPct.toFixed(0)}%</p>
        </div>
        <div className="flex-1">
          <p className="text-blue-600">テイクアウト {fmt(takeout)}</p>
          <p className="text-[10px] text-gray-400">{outPct.toFixed(0)}%</p>
        </div>
      </div>
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mt-2">
          <div style={{ width: `${inPct}%`,  background: AMBER }} />
          <div style={{ width: `${outPct}%`, background: BLUE }} />
        </div>
      )}
    </div>
  );
}

/* ── カスタム SVG ヒートマップ（月〜日 × 8-23 時） ── */
function Heatmap({ cells }: { cells: { weekday: number; hour: number; revenue: number }[] }) {
  const hoursRange: number[] = [];
  for (let h = 8; h <= 22; h++) hoursRange.push(h);
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]; // 月〜日
  const wdLabels = ["月", "火", "水", "木", "金", "土", "日"];

  // 対象範囲内の max を計算して色グラデーションの基準にする
  const maxRev = cells.reduce((m, c) => {
    if (c.hour < 8 || c.hour > 22) return m;
    return Math.max(m, c.revenue);
  }, 0);
  const getColor = (rev: number) => {
    if (rev <= 0) return "#F9FAFB";
    const ratio = maxRev > 0 ? rev / maxRev : 0;
    // amber のグラデーション: #FFF7E0 → #FAC03D
    const alpha = 0.1 + ratio * 0.9;
    return `rgba(250, 192, 61, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-8"></th>
            {weekdayOrder.map((w, i) => (
              <th key={w} className="text-[10px] text-gray-500 font-normal">
                {wdLabels[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hoursRange.map((h) => (
            <tr key={h}>
              <td className="text-[9px] text-gray-400 text-right pr-1 align-middle">{h}時</td>
              {weekdayOrder.map((w) => {
                const c = cells.find((cc) => cc.weekday === w && cc.hour === h);
                const rev = c?.revenue ?? 0;
                return (
                  <td
                    key={`${w}-${h}`}
                    title={`${wdLabels[weekdayOrder.indexOf(w)]} ${h}:00  ¥${rev.toLocaleString()}`}
                    style={{
                      background: getColor(rev),
                      height: 16,
                      borderRadius: 3,
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRev === 0 && (
        <p className="text-center text-gray-400 text-xs mt-2">データなし</p>
      )}
    </div>
  );
}
