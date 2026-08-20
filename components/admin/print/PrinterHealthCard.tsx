/**
 * プリンタの生存表示（管理画面「印刷状況」の最上部）
 *
 * 営業中にプリンタが止まったことに気づけないのが一番怖いので、
 * この画面で最初に目に入る位置に置く。色は状態トークンのみを使う。
 */
import type { PrinterHealthView } from "@/lib/printStatus";

const TONE: Record<
  PrinterHealthView["health"],
  { bg: string; dot: string; text: string; label: string }
> = {
  ok:      { bg: "bg-status-success-subtle", dot: "bg-status-success", text: "text-status-success", label: "正常" },
  warning: { bg: "bg-status-warning-subtle", dot: "bg-status-warning", text: "text-status-warning", label: "要対応" },
  offline: { bg: "bg-status-urgent-subtle",  dot: "bg-status-urgent",  text: "text-status-urgent",  label: "停止" },
  unknown: { bg: "bg-bg-tertiary",           dot: "bg-text-tertiary",  text: "text-text-tertiary",  label: "未接続" },
};

export default function PrinterHealthCard({ view }: { view: PrinterHealthView }) {
  const tone = TONE[view.health];
  return (
    <section
      className={`rounded-[var(--radius-md)] border border-border ${tone.bg} px-[var(--space-20)] py-[var(--space-16)]`}
      aria-label="プリンタの状態"
    >
      <div className="flex items-center gap-[var(--space-8)]">
        <span className={`shrink-0 w-[8px] h-[8px] rounded-full ${tone.dot}`} />
        <span className={`type-jp-caption-bold ${tone.text}`}>{tone.label}</span>
        <span className="type-jp-caption text-text-tertiary">厨房プリンタ</span>
      </div>
      <p className="type-jp-body-bold text-text-primary mt-[var(--space-8)]">{view.headline}</p>
      <p className="type-jp-caption text-text-secondary mt-[var(--space-4)]">{view.detail}</p>
    </section>
  );
}
