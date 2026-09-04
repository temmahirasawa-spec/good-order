"use client";

/**
 * セグメント切替（2〜3択を1つの枠の中で切り替える）
 *
 * Figma の Components ページに対応ノードが無い**新規部品**（2026-09-04、
 * docs/specs/serving-timing.md の案A）。管理画面「表示設定」の背景タイプ選択に
 * ある Segment の考え方を、お客様側の部品にしたもの。
 *
 * 高さ 44（--size-control-md、SP のタップ領域の下限）。内側の余白は space/4 で、
 * 中のセグメントは 36（Filter Chip と同じ control-sm）になる。
 * 選択中は accent-primary 塗り＋Bold で、Filter Chip の選択状態と揃えている。
 * Figma: Components / 04 Tags & Steppers / Segmented Control（2026-09-04 追加）。
 * カート行の提供タイミング切替に使う。
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex p-[var(--space-4)] h-[var(--size-control-md)] rounded-[var(--radius-full)] border border-border bg-surface-white ${className}`}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (!on) onChange(opt.value);
            }}
            className={`flex-1 min-w-0 flex items-center justify-center rounded-[var(--radius-full)] px-[var(--space-8)] ${
              on
                ? "bg-accent-primary type-jp-body-bold text-text-primary"
                : "type-jp-body text-text-secondary"
            }`}
          >
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
