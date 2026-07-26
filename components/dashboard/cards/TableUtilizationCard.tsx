"use client";

/**
 * ⑤ テーブル稼働（Figma: SP 438:3131 / PC 300:1575）
 * 卓ごとの利用回数を縦棒で並べ、稼働が低い卓（最大の30%未満）だけ赤で強調する。
 * SPは卓数が増えると入り切らないので横スクロールにする。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import { CHART, LOW_UTILIZATION_RATIO } from "@/components/dashboard/dashboardTheme";
import { formatYen, type TableStat } from "@/lib/salesData";

export default function TableUtilizationCard({
  id,
  tables,
  className,
}: {
  id?: string;
  tables: TableStat[];
  className?: string;
}) {
  const maxUses = tables.reduce((m, t) => Math.max(m, t.uses), 0);

  return (
    <DashboardCard
      id={id}
      title="テーブル稼働"
      gap={12}
      className={className}
      headerRight={
        <span className="flex gap-[var(--space-4)] items-center shrink-0">
          <span className="w-[8px] h-[8px] rounded-full" style={{ background: CHART.low }} />
          <span className="type-jp-micro-label text-text-secondary whitespace-nowrap">稼働低め</span>
        </span>
      }
    >
      {tables.length === 0 || maxUses === 0 ? (
        <p className="type-jp-caption text-text-tertiary text-center py-[var(--space-32)]">
          データなし
        </p>
      ) : (
        <div className="overflow-x-auto w-full" style={{ scrollbarWidth: "none" }}>
          <div className="flex flex-col gap-[var(--space-4)] w-max min-w-full">
            <div className="flex gap-[10px] lg:gap-[12px] items-end h-[70px] lg:h-[86px]">
              {tables.map((t) => {
                const ratio = t.uses / maxUses;
                return (
                  <span
                    key={t.key}
                    title={`${t.label}  ${t.uses}回 / ${formatYen(t.revenue)}`}
                    className="w-[28px] lg:w-[32px] shrink-0 rounded-t-[3px] block self-end"
                    style={{
                      height: `${Math.max(ratio * 100, 2)}%`,
                      background: ratio < LOW_UTILIZATION_RATIO ? CHART.low : CHART.bar,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex gap-[10px] lg:gap-[12px]">
              {tables.map((t) => (
                <p
                  key={t.key}
                  className="w-[28px] lg:w-[32px] shrink-0 type-jp-micro-label text-text-secondary text-center truncate"
                >
                  {t.shortLabel}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
