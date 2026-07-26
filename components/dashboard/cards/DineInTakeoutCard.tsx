"use client";

/**
 * ⑦ 店内 vs テイクアウト（Figma: SP 438:3201 / PC 300:1646）
 * 凡例 → 売上/件数/客単価の比較3行 → 日別の積み上げ棒。
 *
 * 店内=accent/deep・テイクアウト=status/info はPCテンプレートと旧実装に合わせている
 * （SPテンプレートは逆に塗られていたが、2枚のうち多数派かつ既存挙動と同じ方を採用）。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import { CHART } from "@/components/dashboard/dashboardTheme";
import { formatYen, type DineInVsTakeout } from "@/lib/salesData";

export default function DineInTakeoutCard({
  id,
  data,
  className,
}: {
  id?: string;
  data: DineInVsTakeout;
  className?: string;
}) {
  const maxDaily = data.daily.reduce((m, d) => Math.max(m, d.dineIn + d.takeout), 0);

  return (
    <DashboardCard id={id} title="店内 vs テイクアウト" gap={16} className={className}>
      <div className="flex gap-[var(--space-16)] items-center">
        <LegendItem color={CHART.dineIn} label="店内" />
        <LegendItem color={CHART.takeout} label="テイクアウト" />
      </div>

      <CompareRow
        label="売上"
        dineIn={formatYen(data.dineIn.revenue)}
        takeout={formatYen(data.takeout.revenue)}
      />
      <CompareRow
        label="件数"
        dineIn={`${data.dineIn.orders}件`}
        takeout={`${data.takeout.orders}件`}
      />
      <CompareRow
        label="客単価"
        dineIn={formatYen(data.dineIn.avgSpend)}
        takeout={formatYen(data.takeout.avgSpend)}
      />

      {data.daily.length > 0 && maxDaily > 0 && (
        <>
          <p className="type-jp-caption text-text-secondary">日別推移</p>
          <div className="flex flex-col gap-[6px] w-full">
            <div className="flex items-end justify-between gap-[var(--space-4)] h-[92px] w-full">
              {data.daily.map((d) => {
                const total = d.dineIn + d.takeout;
                return (
                  <div key={d.date} className="flex-1 flex items-end justify-center min-w-0 h-full">
                    <span
                      title={`${d.label}  店内 ${formatYen(d.dineIn)} / テイクアウト ${formatYen(d.takeout)}`}
                      className="w-full max-w-[24px] flex flex-col justify-end"
                      style={{ height: `${Math.max((total / maxDaily) * 100, total > 0 ? 1.5 : 0)}%` }}
                    >
                      <span
                        className="w-full rounded-t-[3px] block"
                        style={{
                          height: `${total > 0 ? (d.takeout / total) * 100 : 0}%`,
                          background: CHART.takeout,
                        }}
                      />
                      <span
                        className="w-full block"
                        style={{
                          height: `${total > 0 ? (d.dineIn / total) * 100 : 0}%`,
                          background: CHART.dineIn,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-[var(--space-4)] w-full">
              {data.daily.map((d) => (
                <p
                  key={d.date}
                  className="flex-1 min-w-0 type-jp-micro-label text-text-secondary text-center truncate"
                >
                  {d.label}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardCard>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex gap-[6px] items-center">
      <span className="w-[8px] h-[8px] rounded-full" style={{ background: color }} />
      <span className="type-jp-micro-label text-text-secondary whitespace-nowrap">{label}</span>
    </span>
  );
}

/** SPは値を左詰めで並べ、PCは幅があるので左右に振って中央に "vs" を置く */
function CompareRow({ label, dineIn, takeout }: { label: string; dineIn: string; takeout: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)] w-full min-w-0">
      <p className="type-jp-caption text-text-secondary">{label}</p>
      <div className="flex gap-[var(--space-8)] items-center lg:justify-between w-full min-w-0">
        <p className="type-en-data-s whitespace-nowrap" style={{ color: CHART.dineIn }}>
          {dineIn}
        </p>
        <p className="type-jp-micro-label text-text-secondary shrink-0">vs</p>
        <p className="type-en-data-s whitespace-nowrap" style={{ color: CHART.takeout }}>
          {takeout}
        </p>
      </div>
    </div>
  );
}
