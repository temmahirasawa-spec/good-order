"use client";

/**
 * ダッシュボード（Step3-N、Figma: PC Template/Dashboard 289:1405 / SP Dashboard — Mobile 390 438:2789）
 *
 * 集計は lib/salesData.ts をそのまま使い、見た目だけ新デザインへ差し替えた画面。
 * 期間フィルター・CSV出力・前期比の計算ロジックは旧 OwnerView から変更していない。
 *
 * SPは9枚のカードを縦1列に並べ、Top Bar直下のTab Nav（アンカーリンク＋scrollspy）で
 * 目的のカードへ飛べるようにする。PCは2〜4カラムのグリッド。
 *
 * 旧実装にあったスタッフ/オーナー切替タブ・日報送信・受付停止トグルは、
 * Figmaの新デザインに存在しないため天真さんの判断でこの画面から落とした
 * （APIとlib側の関数は残してあるので戻せる）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import { Icon } from "@/components/Icon";
import { TabNav } from "@/components/ui/Tab";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import StatCard, { type Delta } from "@/components/dashboard/StatCard";
import HeroKpiCard from "@/components/dashboard/cards/HeroKpiCard";
import SalesChartCard, { type SalesBar } from "@/components/dashboard/cards/SalesChartCard";
import PopularMenuCard, { type MenuTab } from "@/components/dashboard/cards/PopularMenuCard";
import PeakHeatmapCard from "@/components/dashboard/cards/PeakHeatmapCard";
import CategoryBreakdownCard from "@/components/dashboard/cards/CategoryBreakdownCard";
import TableUtilizationCard from "@/components/dashboard/cards/TableUtilizationCard";
import SpendHistogramCard from "@/components/dashboard/cards/SpendHistogramCard";
import DineInTakeoutCard from "@/components/dashboard/cards/DineInTakeoutCard";
import {
  calcAvgTableTurnover,
  calcCategoryRanking,
  calcDaily,
  calcDineInVsTakeout,
  calcHeatmap,
  calcHourly,
  calcMenuRanking,
  calcSpendDistribution,
  calcSummary,
  calcTableStats,
  fetchSalesData,
  formatYen,
  resolvePeriod,
  toCsv,
  type PeriodKey,
  type SalesOrder,
} from "@/lib/salesData";

const SEATS = 40;

/** SPのタブナビ。idは各カードのDOM idと一致させる */
const SECTIONS = [
  { id: "sales",     label: "売上" },
  { id: "trend",     label: "推移" },
  { id: "popular",   label: "人気メニュー" },
  { id: "peak",      label: "ピーク帯" },
  { id: "category",  label: "カテゴリ" },
  { id: "tables",    label: "稼働" },
  { id: "spend",     label: "客単価" },
  { id: "compare",   label: "比較" },
];

/** Tab Nav は main の外（常時表示）なので、アンカーは余白ぶんだけ上に逃がせば足りる */
const SCROLL_OFFSET = 12;

/** ドリンク扱いにするカテゴリ名（旧OwnerViewから変更なし） */
const DRINK_CATEGORIES = new Set(["コーヒー", "紅茶", "ソフトドリンク", "アルコール", "ドリンク"]);

function todayYmd(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** 前期比。prevが0のときは「比較対象なし」としてバッジ自体を出さない */
function delta(curr: number, prev: number, fractionDigits = 0): Delta | null {
  if (prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  const value = Math.abs(pct).toFixed(fractionDigits);
  return { text: `${up ? "+" : "-"}${value}%`, up };
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customStart, setCustomStart] = useState<string>(todayYmd());
  const [customEnd,   setCustomEnd]   = useState<string>(todayYmd());
  const [menuTab, setMenuTab] = useState<MenuTab>("all");
  const [menuExpanded, setMenuExpanded] = useState(false);

  const [currOrders, setCurrOrders] = useState<SalesOrder[] | null>(null);
  const [prevOrders, setPrevOrders] = useState<SalesOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const mainRef = useRef<HTMLElement | null>(null);

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
        console.error("[dashboard] fetch failed:", e);
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resolved]);

  const orders = useMemo(() => currOrders ?? [], [currOrders]);
  const prev   = useMemo(() => prevOrders ?? [], [prevOrders]);

  const summary      = useMemo(() => calcSummary(orders), [orders]);
  const prevSummary  = useMemo(() => calcSummary(prev),   [prev]);
  const turnover     = useMemo(() => calcAvgTableTurnover(orders, SEATS), [orders]);
  const prevTurnover = useMemo(() => calcAvgTableTurnover(prev,   SEATS), [prev]);

  /* 期間の長さに応じて推移グラフの粒度を切り替える（旧実装と同じ判定）。
     時間別は8〜24時の16本になるがSP幅では1本あたり20px前後まで潰れるため、
     売上が0の時間帯を前後から落として実際に営業している帯だけを描く（集計自体は変えない）。 */
  const trendBars: SalesBar[] = useMemo(() => {
    const days = Math.round((resolved.end.getTime() - resolved.start.getTime()) / (24 * 3600 * 1000));
    if (days <= 1) {
      const hourly = calcHourly(orders, 8, 24);
      let from = hourly.findIndex((b) => b.revenue > 0);
      let to   = hourly.length - 1 - [...hourly].reverse().findIndex((b) => b.revenue > 0);
      if (from < 0) { from = 0; to = hourly.length - 1; }
      return hourly.slice(from, to + 1).map((b) => ({
        label: String(b.hour),
        revenue: b.revenue,
        avgSpend: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
      }));
    }
    return calcDaily(orders).map((d) => ({
      label: d.label,
      revenue: d.revenue,
      avgSpend: d.avgSpend,
    }));
  }, [orders, resolved]);

  const menuRanking = useMemo(() => calcMenuRanking(orders), [orders]);
  const filteredMenu = useMemo(() => {
    if (menuTab === "all") return menuRanking;
    return menuRanking.filter((m) => {
      const isDrink = m.category ? DRINK_CATEGORIES.has(m.category) : false;
      return menuTab === "drink" ? isDrink : !isDrink;
    });
  }, [menuRanking, menuTab]);

  const categoryRanking = useMemo(() => calcCategoryRanking(orders), [orders]);
  const tableStats      = useMemo(() => calcTableStats(orders), [orders]);
  const heatmap         = useMemo(() => calcHeatmap(orders), [orders]);
  const spendBuckets    = useMemo(() => calcSpendDistribution(orders), [orders]);
  const dineVsTake      = useMemo(() => calcDineInVsTakeout(orders), [orders]);

  const ratio     = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
  const dineInPct  = ratio(summary.dineInRevenue,  summary.totalRevenue);
  const takeoutPct = ratio(summary.takeoutRevenue, summary.totalRevenue);

  const handleCsvExport = useCallback(() => {
    if (!currOrders || currOrders.length === 0) return;
    const csv = toCsv(currOrders);
    const bom = "\uFEFF"; // Excel 用 BOM（見えない文字なのでエスケープで書く）
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `good_order_sales_${period}_${todayYmd()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currOrders, period]);

  /* ── scrollspy（SPのタブナビ用）──
     お客様側TOPページは IntersectionObserver を使っているが、こちらは
     「main の overflow-y-auto が固定高のスクロールコンテナ」なので同じ手が使えない。
     最後のカードはページ末尾まで送っても判定帯まで上がれず、いつまでも
     手前のカードがアクティブのままになるため。
     代わりに判定線より上に来た最後のセクションを選び、末尾に到達したら
     最終セクションを強制する方式にしている。 */
  const isEmpty = !loading && orders.length === 0;
  useEffect(() => {
    const root = mainRef.current;
    if (loading || isEmpty || !root) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      const line = SCROLL_OFFSET + 8;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - rootTop <= line) current = s.id;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        current = SECTIONS[SECTIONS.length - 1].id;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [loading, isEmpty]);

  const handleTabSelect = (id: string) => {
    const root = mainRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;
    // offsetTop は offsetParent 基準でズレるので、実測の相対位置から求める
    const top = Math.max(
      0,
      root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - SCROLL_OFFSET
    );
    // 末尾のカードは画面上端まで送れないので、押した瞬間にアクティブを確定させる
    setActiveSection(id);
    root.scrollTo({ top, behavior: "smooth" });
    // reduced-motion 設定や自動化ブラウザでは smooth が無視されて動かないことがあるので、
    // 少し待って動いていなければ即時ジャンプにフォールバックする（/order と同じ対策）
    window.setTimeout(() => {
      if (Math.abs(root.scrollTop - top) > 4) root.scrollTo(0, top);
    }, 250);
  };

  const hasData = !!currOrders && currOrders.length > 0;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="ダッシュボード"
            onMenuClick={openDrawer}
            stripPcOnly
            strip={<PeriodSelector period={period} onChange={setPeriod} className="w-full" />}
            action={
              <>
                {/* PC: テキストボタン / SP: 使用頻度が下がるので40pxのアイコンボタンへ格下げ */}
                <button
                  type="button"
                  onClick={handleCsvExport}
                  disabled={!hasData}
                  className="hidden lg:inline-flex items-center bg-bg-secondary rounded-[var(--radius-full)] px-[var(--space-16)] py-[var(--space-8)] text-[12px] leading-[1.4] font-jp font-medium text-text-secondary whitespace-nowrap disabled:opacity-40"
                >
                  CSVで出力
                </button>
                <button
                  type="button"
                  onClick={handleCsvExport}
                  disabled={!hasData}
                  aria-label="CSVで出力"
                  className="lg:hidden flex items-center justify-center bg-bg-tertiary rounded-[var(--radius-full)] w-[40px] h-[40px] shrink-0 disabled:opacity-40"
                >
                  <Icon name="receipt" className="w-4 h-4 text-text-primary" />
                </button>
              </>
            }
          />

          {/* SPのみ: Top Bar直下のアンカーナビ。
              スクロールするのは下の main なので、ここに置けば position:sticky なしで常時見える */}
          <div className="lg:hidden shrink-0">
            <TabNav tabs={SECTIONS} activeId={activeSection} onSelect={handleTabSelect} />
          </div>

          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto bg-bg-tertiary lg:bg-bg-secondary"
          >
            {/* SPのみ: 期間セレクター（PCはTop Barのストリップ行に出している） */}
            <div className="lg:hidden bg-surface-white pt-[var(--space-12)] pb-[var(--space-16)] px-[var(--space-16)]">
              <PeriodSelector period={period} onChange={setPeriod} showLabel />
            </div>

            <div className="flex flex-col gap-[var(--space-16)] px-[var(--space-16)] lg:px-[var(--space-24)] pt-[var(--space-20)] pb-[var(--space-32)]">
              {period === "custom" && (
                <div className="bg-surface-white flex flex-wrap gap-[var(--space-12)] items-center rounded-[var(--radius-lg)] px-[var(--space-20)] py-[var(--space-16)]">
                  <label className="type-jp-caption text-text-secondary">開始</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="type-jp-body text-text-primary border border-border rounded-[var(--radius-sm)] px-[var(--space-8)] py-[var(--space-4)]"
                  />
                  <span className="type-jp-caption text-text-tertiary">〜</span>
                  <label className="type-jp-caption text-text-secondary">終了</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="type-jp-body text-text-primary border border-border rounded-[var(--radius-sm)] px-[var(--space-8)] py-[var(--space-4)]"
                  />
                </div>
              )}

              {error && (
                <div className="bg-status-urgent-subtle rounded-[var(--radius-lg)] px-[var(--space-20)] py-[var(--space-16)] type-jp-body text-status-urgent">
                  データ取得エラー: {error}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-[var(--space-80)]">
                  <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
                </div>
              ) : isEmpty ? (
                <div className="bg-surface-white rounded-[var(--radius-lg)] py-[var(--space-64)] text-center type-jp-body text-text-tertiary">
                  選択期間に会計済み注文はありません
                </div>
              ) : (
                <>
                  {/* ── KPI ──
                      SPは「売上合計」だけHeroに引き上げ、残り5つを2列。
                      PCは6つとも同じStat Cardで4列に並べる（Figma PC）。 */}
                  <HeroKpiCard
                    id="sales"
                    className="lg:hidden"
                    label="売上合計"
                    value={formatYen(summary.totalRevenue)}
                    delta={delta(summary.totalRevenue, prevSummary.totalRevenue)}
                  />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] lg:gap-[var(--space-16)]">
                    <StatCard
                      className="hidden lg:flex"
                      label="売上合計"
                      value={formatYen(summary.totalRevenue)}
                      delta={delta(summary.totalRevenue, prevSummary.totalRevenue)}
                    />
                    <StatCard
                      label="会計組数"
                      value={`${summary.totalOrders}組`}
                      delta={delta(summary.totalOrders, prevSummary.totalOrders)}
                    />
                    <StatCard
                      label="客単価"
                      value={formatYen(summary.avgSpend)}
                      delta={delta(summary.avgSpend, prevSummary.avgSpend)}
                    />
                    <StatCard
                      label={`席回転率（${SEATS}席）`}
                      value={`${turnover.toFixed(1)}回転`}
                      delta={delta(turnover, prevTurnover, 1)}
                    />
                    {/* 比率系は前期比を持たせない（Figmaの指定） */}
                    <StatCard label="店内比率" value={`${dineInPct.toFixed(0)}%`} />
                    <StatCard label="テイクアウト比率" value={`${takeoutPct.toFixed(0)}%`} />
                  </div>

                  <SalesChartCard id="trend" bars={trendBars} />

                  {/* DOM順はSPの縦1列（＝タブナビの並び）に合わせ、PCの2カラム配置は
                      order で入れ替える。カテゴリをDOM上でピーク帯より後ろに置いたまま
                      PCでは人気メニューの右隣に見せるため。 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-16)] items-start">
                    <PopularMenuCard
                      id="popular"
                      className="lg:order-1"
                      items={filteredMenu}
                      tab={menuTab}
                      onTabChange={(t) => { setMenuTab(t); setMenuExpanded(false); }}
                      expanded={menuExpanded}
                      onToggleExpanded={() => setMenuExpanded((v) => !v)}
                    />
                    <PeakHeatmapCard id="peak" className="lg:order-3 lg:col-span-2" cells={heatmap} />
                    <CategoryBreakdownCard
                      id="category"
                      className="lg:order-2"
                      categories={categoryRanking}
                      totalRevenue={summary.totalRevenue}
                    />
                    <TableUtilizationCard id="tables" className="lg:order-4 lg:col-span-2" tables={tableStats} />
                    <SpendHistogramCard id="spend" className="lg:order-5" buckets={spendBuckets} />
                    <DineInTakeoutCard id="compare" className="lg:order-6" data={dineVsTake} />
                  </div>
                </>
              )}
            </div>
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
