"use client";

/**
 * 提供タイミングの選択カード（商品詳細用。docs/specs/serving-timing.md の案B）
 *
 * Figma: Option Card 180:167 を土台に、説明文の行と選択状態（ラジオ）を足したもの。
 * 白地＋枠線＋角丸12・パディング20・先頭要素とラベルの間隔16 は Option Card と同じ。
 * 選択中は枠線を text-primary にして内側にもう1本重ね、2px 相当に見せる
 * （border 幅を変えるとカードの高さが動くため、内側の影で太らせる）。
 */
import { SERVING_TIMING_TITLE, type ServingTiming, type ServingTimingOption } from "@/lib/servingTiming";

export default function ServingTimingCards({
  options,
  value,
  onChange,
  className = "",
}: {
  options: ServingTimingOption[];
  value: ServingTiming;
  onChange: (value: ServingTiming) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={SERVING_TIMING_TITLE}
      className={`flex flex-col gap-[var(--space-8)] ${className}`}
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
            className={`flex gap-[var(--space-16)] items-center p-[var(--space-20)] rounded-[var(--radius-md)] border w-full text-left bg-surface-white ${
              on ? "border-text-primary" : "border-border"
            }`}
            style={on ? { boxShadow: "inset 0 0 0 1px var(--color-text-primary)" } : undefined}
          >
            <span
              aria-hidden
              className={`shrink-0 w-[18px] h-[18px] rounded-full bg-surface-white ${
                on ? "border-[5px] border-text-primary" : "border border-border"
              }`}
            />
            <span className="flex flex-col gap-[2px] min-w-0">
              <span className="type-jp-heading-s text-text-primary">{opt.label}</span>
              <span className="type-jp-caption text-text-secondary">{opt.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
