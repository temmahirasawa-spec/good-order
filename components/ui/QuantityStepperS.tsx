"use client";

/**
 * 小型の数量ステッパー（Figma: Quantity Stepper S 601:8129）
 * 84×32。±は32px円、数字は EN/Data/M。
 *
 * カルーセル用の Menu Card M（幅200）に「ステッパー＋カートに入れる」を
 * 並べるための専用サイズ。通常の Quantity Stepper（124×36）だと2要素が入らない。
 */
import RollingNumber from "@/components/ui/RollingNumber";

export default function QuantityStepperS({
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
    <div className={`flex items-center justify-between w-[84px] shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="数量を減らす"
        disabled={empty}
        onClick={onDecrement}
        className={`relative bg-surface-white border rounded-full shrink-0 w-[32px] h-[32px] ${
          empty ? "border-border" : "border-text-primary"
        }`}
      >
        <span
          className={`absolute left-[11px] top-[15px] w-[10px] h-[2px] rounded-[1px] ${
            empty ? "bg-text-disabled" : "bg-text-primary"
          }`}
        />
      </button>

      <RollingNumber
        value={count}
        width={16}
        height={18}
        className="type-en-data-m text-text-primary"
      />

      <button
        type="button"
        aria-label="数量を増やす"
        onClick={onIncrement}
        className="relative bg-surface-white border border-text-primary rounded-full shrink-0 w-[32px] h-[32px]"
      >
        <span className="absolute left-[11px] top-[15px] w-[10px] h-[2px] rounded-[1px] bg-text-primary" />
        <span className="absolute left-[15px] top-[11px] w-[2px] h-[10px] rounded-[1px] bg-text-primary" />
      </button>
    </div>
  );
}
