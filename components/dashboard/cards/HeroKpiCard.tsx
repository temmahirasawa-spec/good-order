"use client";

/**
 * Hero KPI Card（Figma: 438:2821）— **SP専用**。
 * PCは6つのKPIを均等な Stat Card で並べるが、SPで6つを均等に置くと全部小さくなって
 * 優先順位が消えるため、最重要の「売上合計」だけを1枚に引き上げている。
 */
import type { Delta } from "@/components/dashboard/StatCard";

export default function HeroKpiCard({
  id,
  label,
  value,
  delta,
  className = "",
}: {
  id?: string;
  label: string;
  value: string;
  delta?: Delta | null;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-surface-white rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-8)] p-[var(--space-20)] w-full ${className}`}
    >
      <p className="type-jp-body text-text-secondary">{label}</p>
      <div className="flex gap-[10px] items-center min-w-0">
        <p className="type-en-data-xl text-text-primary whitespace-nowrap">{value}</p>
        {delta && (
          <span
            className={`px-[var(--space-8)] py-[var(--space-4)] rounded-[var(--radius-full)] shrink-0 ${
              delta.up
                ? "bg-status-success-subtle text-status-success"
                : "bg-status-urgent-subtle text-status-urgent"
            }`}
          >
            <span className="type-jp-caption-bold whitespace-nowrap">{delta.text}</span>
          </span>
        )}
      </div>
    </section>
  );
}
