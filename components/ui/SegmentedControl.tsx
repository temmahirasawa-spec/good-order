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
 *
 * 動き: 選択の帯（thumb）は選択中のボタンの塗りではなく、後ろに1枚だけ置いた帯で、
 * 選んだ位置まで translateX ですべる（CSS だけ。app/globals.css の .segment__*）。
 * 各セグメントは等幅（flex-1）なので、帯の幅は「内側の幅 ÷ 個数」、
 * 位置は「自分の幅 × 選んだ番号」で決まる。
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
  const count = Math.max(options.length, 1);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative flex p-[var(--space-4)] h-[var(--size-control-md)] rounded-[var(--radius-full)] border border-border bg-surface-white ${className}`}
    >
      {/* 選択の帯。選んだ位置まで横にすべる */}
      <span
        aria-hidden
        className="segment__thumb absolute top-[var(--space-4)] bottom-[var(--space-4)] left-[var(--space-4)] rounded-[var(--radius-full)] bg-accent-primary pointer-events-none"
        style={{
          width: `calc((100% - var(--space-4) * 2) / ${count})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
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
            className={`segment__item relative z-[1] flex-1 min-w-0 flex items-center justify-center rounded-[var(--radius-full)] px-[var(--space-8)] ${
              on ? "type-jp-body-bold text-text-primary" : "type-jp-body text-text-secondary"
            }`}
          >
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
