"use client";

/**
 * レジ画面のテーブル選択チップ（Figma: Table Chip 257:267）
 * Default=白地枠線、Selected=accent-subtle地+accent-primary枠。
 * ServedDotは全品提供済みの卓のみ表示。
 */
export default function TableChip({
  label,
  selected,
  showServedDot,
  onClick,
}: {
  label: string;
  selected: boolean;
  showServedDot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border shrink-0 flex gap-[var(--space-8)] items-center px-[var(--space-16)] py-[var(--space-8)] rounded-[var(--radius-full)] whitespace-nowrap ${
        selected
          ? "bg-accent-subtle border-accent-primary"
          : "bg-surface-white border-border"
      }`}
    >
      {showServedDot && <span className="shrink-0 w-[6px] h-[6px] rounded-full bg-status-success" />}
      <span className="font-en font-semibold text-[14px] leading-[1.2] text-text-primary">
        {label}
      </span>
    </button>
  );
}
