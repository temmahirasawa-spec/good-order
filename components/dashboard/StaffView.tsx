"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  fetchSalesData,
  calcSummary,
  calcHourly,
  calcMenuRanking,
  calcPeakHour,
  calcAvgTableTurnover,
  resolvePeriod,
  formatYen,
  type SalesOrder,
} from "@/lib/salesData";

const SEATS = 40;
const AMBER = "#FAC03D";
const AMBER_HL = "#E0A820";

function pctChange(curr: number, prev: number): { value: number; up: boolean } {
  if (prev === 0) return { value: curr > 0 ? 100 : 0, up: curr >= 0 };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { value: Math.abs(pct), up: pct >= 0 };
}

function DeltaArrow({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) {
    return <span className="text-xs text-gray-400 font-medium">— 前日比</span>;
  }
  const { value, up } = pctChange(current, prev);
  const color = up ? "text-emerald-600" : "text-red-500";
  const arrow = up ? "▲" : "▼";
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {arrow} 前日比 {up ? "+" : "-"}
      {value}%
    </span>
  );
}

export default function StaffView() {
  const [todayOrders, setTodayOrders] = useState<SalesOrder[] | null>(null);
  const [yestOrders,  setYestOrders]  = useState<SalesOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const today  = resolvePeriod("today");
        const yest   = resolvePeriod("yesterday");
        const [t, y] = await Promise.all([
          fetchSalesData(today.start, today.end),
          fetchSalesData(yest.start,  yest.end),
        ]);
        if (!cancelled) {
          setTodayOrders(t);
          setYestOrders(y);
        }
      } catch (e) {
        console.error("[StaffView] fetch failed:", e);
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = useMemo(() => {
    const orders = todayOrders ?? [];
    return {
      summary:  calcSummary(orders),
      hourly:   calcHourly(orders, 8, 21),
      topMenus: calcMenuRanking(orders).slice(0, 5),
      peak:     calcPeakHour(orders),
      turnover: calcAvgTableTurnover(orders, SEATS),
    };
  }, [todayOrders]);

  const yest = useMemo(() => {
    const orders = yestOrders ?? [];
    return {
      summary: calcSummary(orders),
      turnover: calcAvgTableTurnover(orders, SEATS),
    };
  }, [yestOrders]);

  const comment = useMemo(() => {
    if (!todayOrders || todayOrders.length === 0) {
      return "今日はまだ会計済みの注文がありません。";
    }
    const revDiff = today.summary.totalRevenue - yest.summary.totalRevenue;
    const parts: string[] = [];
    if (revDiff > 0) {
      parts.push(`昨日より売上が好調でした！（+${formatYen(revDiff)}）`);
    } else if (revDiff < 0) {
      parts.push(`昨日より売上は少し控えめでした（${formatYen(revDiff)}）。`);
    } else {
      parts.push("昨日と同水準の売上でした。");
    }
    if (today.peak !== "—") parts.push(`ピークは ${today.peak} でした。`);
    if (today.summary.takeoutCount > 0) {
      parts.push(`テイクアウトは ${today.summary.takeoutCount} 件。`);
    }
    return parts.join(" ");
  }, [todayOrders, today, yest]);

  const dateStr = useMemo(() => {
    const d = new Date();
    const jst = new Date(d.getTime() + 9 * 3600 * 1000);
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth() + 1;
    const day = jst.getUTCDate();
    const wdLabels = ["日", "月", "火", "水", "木", "金", "土"];
    return `${y}年${m}月${day}日（${wdLabels[jst.getUTCDay()]}）`;
  }, []);

  // ピーク時間を色強調するため
  const peakHour = useMemo(() => {
    if (today.hourly.length === 0) return -1;
    const max = today.hourly.reduce((m, b) => (b.revenue > m.revenue ? b : m), today.hourly[0]);
    return max.revenue > 0 ? max.hour : -1;
  }, [today.hourly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-warm-300 border-t-warm-700 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        データ取得エラー: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 日付 + 挨拶 */}
      <div>
        <p className="text-[11px] text-gray-400 tracking-widest">TODAY</p>
        <h2 className="text-lg font-bold text-gray-900 mt-0.5">{dateStr}</h2>
        <p className="text-sm text-warm-700 mt-1">おつかれさまです 🌿</p>
      </div>

      {/* KPI 4 枚 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="今日の売上"
          value={formatYen(today.summary.totalRevenue)}
          prev={yest.summary.totalRevenue}
          curr={today.summary.totalRevenue}
        />
        <KpiCard
          label="会計組数"
          value={`${today.summary.totalOrders}組`}
          prev={yest.summary.totalOrders}
          curr={today.summary.totalOrders}
        />
        <KpiCard
          label="客単価"
          value={formatYen(today.summary.avgSpend)}
          prev={yest.summary.avgSpend}
          curr={today.summary.avgSpend}
        />
        <KpiCard
          label={`席回転率 (${SEATS}席)`}
          value={`${today.turnover.toFixed(1)}回転`}
          prev={yest.turnover}
          curr={today.turnover}
        />
      </div>

      {/* 時間帯別売上 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">本日の時間帯別売上</h3>
        <p className="text-xs text-gray-400 mb-4">
          ピーク：<span className="font-semibold text-warm-700">{today.peak}</span>
        </p>
        {today.summary.totalRevenue === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">本日のデータはまだありません</p>
        ) : (
          <div className="w-full" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={today.hourly} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => formatYen(Number(v))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {today.hourly.map((b) => (
                    <Cell key={b.hour} fill={b.hour === peakHour ? AMBER_HL : AMBER} />
                  ))}
                  <LabelList
                    dataKey="revenue"
                    position="top"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => (Number(v) > 0 ? `¥${Math.round(Number(v) / 1000)}k` : "")}
                    style={{ fontSize: 10, fill: "#6B7280" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 人気メニュー Top 5 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">本日の人気メニュー Top 5</h3>
        {today.topMenus.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">データなし</p>
        ) : (
          <ol className="space-y-2">
            {today.topMenus.map((m, i) => {
              const medal = ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
              return (
                <li
                  key={m.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50"
                >
                  <span className="text-lg w-7 text-center">{medal}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{m.name}</span>
                  <span className="text-xs text-gray-500 shrink-0">{m.quantity} 件</span>
                  <span className="text-sm font-semibold text-warm-700 shrink-0 w-20 text-right">
                    {formatYen(m.revenue)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ひとこと分析 */}
      <section className="bg-warm-50 border border-warm-200 rounded-2xl p-5">
        <p className="text-[11px] text-warm-700 font-semibold tracking-widest mb-1">今日のひとこと</p>
        <p className="text-base text-gray-800 leading-relaxed">{comment}</p>
      </section>
    </div>
  );
}

function KpiCard({
  label, value, prev, curr,
}: {
  label: string;
  value: string;
  prev: number;
  curr: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <DeltaArrow current={curr} prev={prev} />
    </div>
  );
}
