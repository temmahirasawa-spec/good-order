/**
 * 提供タイミングの表示（読み取り専用）
 *
 * 「食後」は墨色のチップで目立たせ、「でき次第」「先出し」は薄い文字で添える。
 * 伝票（lib/receipt.ts）の「食後は黒帯、初期値は通常の文字」と同じ強弱にして、
 * 紙と画面で見え方を揃えている。厨房画面（Order Card）・完了画面・注文履歴で共用。
 *
 * showDefault=false のときは「食後」だけ出す（完了画面・履歴の決定: 初期値は再掲しない）。
 */
import { SERVING_TIMING_LABEL, type ServingTiming } from "@/lib/servingTiming";

export default function ServingTimingBadge({
  timing,
  showDefault = true,
  className = "",
}: {
  timing: ServingTiming | null | undefined;
  showDefault?: boolean;
  className?: string;
}) {
  if (!timing) return null;
  if (timing === "after_meal") {
    return (
      <span
        className={`inline-flex items-center rounded-[var(--radius-full)] bg-surface-ink px-[var(--space-8)] py-[2px] type-jp-label !font-bold text-text-inverse whitespace-nowrap ${className}`}
      >
        {SERVING_TIMING_LABEL[timing]}
      </span>
    );
  }
  if (!showDefault) return null;
  return (
    <span className={`type-jp-caption text-text-secondary whitespace-nowrap ${className}`}>
      {SERVING_TIMING_LABEL[timing]}
    </span>
  );
}
