"use client";

/**
 * ① 時間帯別 売上推移（Figma: SP 438:2897 / PC 290:290）
 *
 * SPは棒グラフのみ。PCは同じ棒に客単価の折れ線を重ね、ピーク以外の棒を
 * bg/tertiary に落として線を読みやすくする（Figma PCの指定どおり）。
 * 棒の色分けは inline style ではなく Tailwind クラスで行う。inline style は
 * `lg:` バリアントに勝ってしまい、SP/PCで塗り分けられなくなるため。
 *
 * 期間が2日以上のときは呼び出し側が日別データを渡すので棒の本数は可変。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import { CHART } from "@/components/dashboard/dashboardTheme";
import { formatYen } from "@/lib/salesData";

export interface SalesBar {
  label: string;
  revenue: number;
  avgSpend: number;
}

export default function SalesChartCard({ id, bars }: { id?: string; bars: SalesBar[] }) {
  const maxRevenue = bars.reduce((m, b) => Math.max(m, b.revenue), 0);
  const maxAvg     = bars.reduce((m, b) => Math.max(m, b.avgSpend), 0);
  const peakIndex  = maxRevenue > 0 ? bars.findIndex((b) => b.revenue === maxRevenue) : -1;

  /* 折れ線は0〜100の座標系に載せ preserveAspectRatio="none" で引き伸ばす。
     線幅は vector-effect で潰れないようにし、点はdivで置いて歪みを避ける。
     xは棒の中心（i+0.5列目）に合わせる。0〜100で等分すると両端の点が
     カードの内側の縁に来て半分切れてしまうため。 */
  const linePoints = bars.map((b, i) => ({
    x: ((i + 0.5) / bars.length) * 100,
    y: maxAvg > 0 ? 100 - (b.avgSpend / maxAvg) * 100 : 100,
  }));

  return (
    <DashboardCard id={id} title="時間帯別 売上推移" gap={16}>
      {/* PCのみ凡例（SPは棒だけなので凡例が不要） */}
      <div className="hidden lg:flex gap-[var(--space-16)] items-center">
        <span className="flex gap-[var(--space-8)] items-center">
          <span className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary" />
          <span className="type-jp-caption text-text-secondary">売上</span>
        </span>
        <span className="flex gap-[var(--space-8)] items-center">
          <span className="w-[10px] h-[10px] rounded-full" style={{ background: CHART.avgSpendLine }} />
          <span className="type-jp-caption text-text-secondary">客単価</span>
        </span>
      </div>

      {bars.length === 0 || maxRevenue === 0 ? (
        <p className="type-jp-caption text-text-tertiary text-center py-[var(--space-32)]">
          データなし
        </p>
      ) : (
        <div className="flex flex-col gap-[6px] w-full">
          {/* 棒の描画領域。高さを固定しないと棒の height:% が解決できない */}
          <div className="relative flex items-end justify-between gap-[var(--space-4)] h-[132px] lg:h-[118px] w-full">
            {bars.map((b, i) => (
              <div key={b.label} className="flex-1 flex items-end justify-center min-w-0 h-full">
                <span
                  title={`${b.label}  売上 ${formatYen(b.revenue)} / 客単価 ${formatYen(b.avgSpend)}`}
                  className={`w-full max-w-[24px] lg:max-w-[28px] rounded-t-[4px] block ${
                    i === peakIndex ? "bg-accent-primary" : "bg-accent-primary lg:bg-bg-tertiary"
                  }`}
                  style={{ height: `${Math.max((b.revenue / maxRevenue) * 100, b.revenue > 0 ? 1.5 : 0)}%` }}
                />
              </div>
            ))}

            {/* PCのみ: 客単価の折れ線を棒の上に重ねる */}
            {maxAvg > 0 && (
              <div className="hidden lg:block absolute inset-0 pointer-events-none">
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <polyline
                    points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={CHART.avgSpendLine}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {linePoints.map((p, i) => (
                  <span
                    key={bars[i].label}
                    className="absolute w-[6px] h-[6px] rounded-full -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, background: CHART.avgSpendLine }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between gap-[var(--space-4)] w-full">
            {bars.map((b) => (
              <p
                key={b.label}
                className="flex-1 min-w-0 type-jp-micro-label text-text-secondary text-center truncate"
              >
                {b.label}
              </p>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
