"use client";

/**
 * ④ カテゴリ別売上（Figma: SP 438:3098 / PC 300:1541）
 *
 * PCはドーナツ＋凡例、SPは積み上げ横バー＋凡例。
 * 小さい円グラフはSPだと判読性もタップ性も低いため、SPだけ積み上げバーに置き換えている。
 * 色はPC/SPで**同一パレット**（dashboardTheme.CATEGORY_COLORS）。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import { categoryColor } from "@/components/dashboard/dashboardTheme";
import { formatYen, type CategoryRanking } from "@/lib/salesData";

/** ドーナツのSVG座標系。r=55/線幅30 で Figma の140px枠に収まる */
const R = 55;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function CategoryBreakdownCard({
  id,
  categories,
  totalRevenue,
  className,
}: {
  id?: string;
  categories: CategoryRanking[];
  totalRevenue: number;
  className?: string;
}) {
  const pct = (revenue: number) => (totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0);

  // ドーナツは各弧の開始位置を累積で持つ（stroke-dashoffset は時計回りに負方向）
  let offset = 0;
  const arcs = categories.map((c) => {
    const share = pct(c.revenue) / 100;
    const arc = { share, offset };
    offset += share;
    return arc;
  });

  return (
    <DashboardCard id={id} title="カテゴリ別売上" gap={14} className={className}>
      {categories.length === 0 ? (
        <p className="type-jp-caption text-text-tertiary text-center py-[var(--space-32)]">
          データなし
        </p>
      ) : (
        <>
          {/* ── SP: 積み上げ横バー ── */}
          <div className="lg:hidden flex h-[16px] rounded-[8px] overflow-hidden w-full">
            {categories.map((c, i) => (
              <span
                key={c.name}
                title={`${c.name}  ${formatYen(c.revenue)}`}
                style={{ width: `${pct(c.revenue)}%`, background: categoryColor(i) }}
              />
            ))}
          </div>

          {/* ── PC: ドーナツ（中央に合計） ── */}
          <div className="hidden lg:flex items-center justify-center relative w-[140px] h-[140px] shrink-0">
            <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
              {arcs.map((a, i) => (
                <circle
                  key={categories[i].name}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  strokeWidth={30}
                  stroke={categoryColor(i)}
                  strokeDasharray={`${a.share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-a.offset * CIRCUMFERENCE}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="type-jp-micro-label text-text-secondary">合計</p>
              <p className="type-en-data-s text-text-primary">{formatYen(totalRevenue)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-[var(--space-12)] lg:gap-[var(--space-8)] w-full">
            {categories.map((c, i) => (
              <div key={c.name} className="flex gap-[var(--space-8)] items-center justify-between w-full min-w-0">
                <div className="flex gap-[var(--space-8)] items-center min-w-0">
                  <span
                    className="w-[8px] h-[8px] rounded-full shrink-0"
                    style={{ background: categoryColor(i) }}
                  />
                  <p className="type-jp-body text-text-primary truncate">{c.name}</p>
                </div>
                <p className="type-en-data-xs text-text-secondary shrink-0" title={formatYen(c.revenue)}>
                  {pct(c.revenue).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
