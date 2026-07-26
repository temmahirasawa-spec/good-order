"use client";

/**
 * ⑥ 客単価分布（Figma: SP 438:3174 / PC 300:1619）
 * 1,000円刻み8区分のヒストグラム。
 * 集計（lib/salesData.calcSpendDistribution）はそのまま使い、
 * 軸ラベルだけ Figma の短い表記（〜1,000 / 7,000〜）に整形する。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import { CHART } from "@/components/dashboard/dashboardTheme";
import type { SpendBucket } from "@/lib/salesData";

/** "¥0〜999" のような集計側ラベルではなく、Figma表記の短いラベルを作る */
function axisLabel(bucket: SpendBucket, isLast: boolean): string {
  return isLast
    ? `${bucket.min.toLocaleString("ja-JP")}〜`
    : `〜${bucket.max.toLocaleString("ja-JP")}`;
}

export default function SpendHistogramCard({
  id,
  buckets,
  className,
}: {
  id?: string;
  buckets: SpendBucket[];
  className?: string;
}) {
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return (
    <DashboardCard id={id} title="客単価分布" gap={14} className={className}>
      {maxCount === 0 ? (
        <p className="type-jp-caption text-text-tertiary text-center py-[var(--space-32)]">
          データなし
        </p>
      ) : (
        <div className="flex flex-col gap-[6px] w-full">
          <div className="flex items-end justify-between gap-[var(--space-4)] h-[92px] lg:h-[102px] w-full">
            {buckets.map((b) => (
              <div key={b.label} className="flex-1 flex items-end justify-center min-w-0 h-full">
                <span
                  title={`${b.label}  ${b.count}件`}
                  className="w-full max-w-[28px] lg:max-w-[32px] rounded-t-[4px] block"
                  style={{
                    height: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 1.5 : 0)}%`,
                    background: CHART.spend,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-[var(--space-4)] w-full">
            {buckets.map((b, i) => (
              <p
                key={b.label}
                className="flex-1 min-w-0 type-jp-micro-label text-text-secondary text-center whitespace-nowrap"
              >
                {axisLabel(b, i === buckets.length - 1)}
              </p>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
