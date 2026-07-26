"use client";

/**
 * レジ画面のテーブル選択チップ（Figma: Table Chip 257:267）
 * Default=白地枠線、Selected=accent-subtle地+accent-primary枠。
 * ServedDotは全品提供済みの卓のみ表示。
 */
export default function TableChip({
  category,
  label,
  selected,
  showServedDot,
  onClick,
}: {
  /** カテゴリー名（"カウンター"）。テイクアウトのチップでは省略する */
  category?: string;
  /** 卓の短縮ラベル（"C-1"）。テイクアウトは "🛍 01" のような文字列 */
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
      {/* カテゴリー名は小さくグレー、卓番号は大きく黒（Order Cardのヘッダーと同じ組み方） */}
      {category && <span className="type-jp-caption text-text-secondary">{category}</span>}
      <span className="type-en-price-l text-text-primary">{label}</span>
    </button>
  );
}
