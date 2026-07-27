"use client";

/**
 * 数量ステッパー（Figma: Quantity Stepper 48:40）
 * Empty = 数量0でマイナス非活性（border-default / text-disabled）、
 * Active = 1以上で黒枠に自動切り替え。ボタン径 36px、要素間 gap 16px。
 * カート画面でも共用する前提。
 */

export default function QuantityStepper({
  count,
  min = 0,
  onIncrement,
  onDecrement,
  className = "",
}: {
  count: number;
  /** これ以下にはできない下限。「カートに入れる」と組で使う場合は1（0個追加は意味がないため） */
  min?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  className?: string;
}) {
  const empty = count <= min;
  return (
    <div className={`flex gap-[var(--space-16)] items-center justify-center ${className}`}>
      {/* − */}
      <button
        type="button"
        aria-label="数量を減らす"
        disabled={empty}
        onClick={onDecrement}
        className={`relative bg-surface-white border rounded-full shrink-0 w-[36px] h-[36px] ${
          empty ? "border-border" : "border-text-primary"
        }`}
      >
        <span
          className={`absolute left-[11px] top-[16px] w-[12px] h-[2px] rounded-[1px] ${
            empty ? "bg-text-disabled" : "bg-text-primary"
          }`}
        />
      </button>

      <span className="font-en font-bold text-[16px] text-text-primary text-center w-[20px] tabular-nums">
        {count}
      </span>

      {/* ＋ */}
      <button
        type="button"
        aria-label="数量を増やす"
        onClick={onIncrement}
        className="relative bg-surface-white border border-text-primary rounded-full shrink-0 w-[36px] h-[36px]"
      >
        <span className="absolute left-[11px] top-[16px] w-[12px] h-[2px] rounded-[1px] bg-text-primary" />
        <span className="absolute left-[16px] top-[11px] w-[2px] h-[12px] rounded-[1px] bg-text-primary" />
      </button>
    </div>
  );
}
