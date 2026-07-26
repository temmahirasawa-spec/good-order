"use client";

/**
 * ③ 曜日 × 時間帯 ピークタイム（Figma: SP 438:3040 / PC 299:311）
 *
 * PCは8〜22時の15列。SPは小画面で15列が潰れて読めないため、朝/昼/夜/深夜の
 * 4区分に畳む（各セルはその区分に含まれる時間の**平均**売上で塗る）。
 * SPの4区分は24時間を隙間なく覆うので、PCで表示範囲外の時間帯も捨てずに済む。
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import {
  DAY_PARTS,
  PC_HEATMAP_HOURS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  heatColor,
} from "@/components/dashboard/dashboardTheme";
import { formatYen, type HeatmapCell } from "@/lib/salesData";

export default function PeakHeatmapCard({
  id,
  cells,
  className,
}: {
  id?: string;
  cells: HeatmapCell[];
  className?: string;
}) {
  const at = (weekday: number, hour: number) =>
    cells.find((c) => c.weekday === weekday && c.hour === hour)?.revenue ?? 0;

  /* 区分平均（SP）と時間別（PC）で最大値の桁が違うため、色の基準もそれぞれ別に取る。
     共通の最大値を使うと、平均値側が常に薄くなって差が読めなくなる。 */
  const partAverages = WEEKDAY_ORDER.map((w) =>
    DAY_PARTS.map((p) => p.hours.reduce((s, h) => s + at(w, h), 0) / p.hours.length)
  );
  const maxPartAvg = Math.max(0, ...partAverages.flat());
  const maxHourly  = Math.max(
    0,
    ...WEEKDAY_ORDER.flatMap((w) => PC_HEATMAP_HOURS.map((h) => at(w, h)))
  );

  return (
    <DashboardCard id={id} title="曜日 × 時間帯 ピークタイム" gap={12} className={className}>
      {/* ── SP: 朝/昼/夜/深夜の4区分 ── */}
      <div className="lg:hidden flex flex-col gap-[6px] w-full">
        <div className="flex gap-[6px] items-start h-[16px] w-full">
          <span className="w-[20px] shrink-0" />
          {DAY_PARTS.map((p) => (
            <p key={p.label} className="flex-1 min-w-0 type-jp-micro-label text-text-secondary text-center">
              {p.label}
            </p>
          ))}
        </div>
        {WEEKDAY_ORDER.map((w, wi) => (
          <div key={w} className="flex gap-[6px] items-center h-[28px] w-full">
            <span className="w-[20px] shrink-0 flex items-center justify-center type-jp-caption text-text-secondary">
              {WEEKDAY_LABELS[wi]}
            </span>
            {DAY_PARTS.map((p, pi) => (
              <span
                key={p.label}
                title={`${WEEKDAY_LABELS[wi]} ${p.label}  平均 ${formatYen(Math.round(partAverages[wi][pi]))}`}
                className="flex-1 min-w-0 h-[28px] rounded-[6px]"
                style={{ background: heatColor(partAverages[wi][pi], maxPartAvg) }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── PC: 8〜22時の15列 ── */}
      <div className="hidden lg:flex flex-col gap-[var(--space-12)] w-full overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-[3px] items-start min-w-[440px]">
          <span className="w-[20px] shrink-0" />
          {PC_HEATMAP_HOURS.map((h) => (
            <p key={h} className="flex-1 min-w-0 type-jp-micro-label text-text-secondary text-center">
              {h}
            </p>
          ))}
        </div>
        {WEEKDAY_ORDER.map((w, wi) => (
          <div key={w} className="flex gap-[3px] items-center min-w-[440px]">
            <span className="w-[20px] shrink-0 type-jp-caption text-text-secondary">
              {WEEKDAY_LABELS[wi]}
            </span>
            {PC_HEATMAP_HOURS.map((h) => (
              <span
                key={h}
                title={`${WEEKDAY_LABELS[wi]} ${h}:00  ${formatYen(at(w, h))}`}
                className="flex-1 min-w-0 h-[24px] rounded-[4px]"
                style={{ background: heatColor(at(w, h), maxHourly) }}
              />
            ))}
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
