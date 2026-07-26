"use client";

/**
 * 個別のスタッフ呼び出しチップ（Figma: Staff Call Chip 222:241）
 * Waiting=赤(未対応)→「対応する」でAcknowledgedへ、Acknowledged=黄(対応中)→「完了にする」
 * でリストから消える。厨房Top BarのCall Stripで使用。
 */
import { Icon } from "@/components/Icon";

export default function StaffCallChip({
  table,
  message,
  elapsed,
  state,
  onAction,
  className = "",
}: {
  table: string;
  message: string;
  elapsed: string;
  state: "waiting" | "acknowledged";
  onAction: () => void;
  className?: string;
}) {
  const isAck = state === "acknowledged";
  return (
    <div
      className={`border shrink-0 flex gap-[var(--space-16)] items-center pl-[var(--space-16)] pr-[var(--space-12)] py-[var(--space-12)] rounded-[var(--radius-md)] ${
        isAck
          ? "bg-status-warning-subtle border-status-warning"
          : "bg-status-urgent-subtle border-status-urgent"
      } ${className}`}
    >
      <Icon name="bell" className="shrink-0 w-4 h-4 text-text-primary" />
      <div className="flex flex-col gap-[var(--space-2)] items-start shrink-0 whitespace-nowrap">
        <p className="type-en-data-s text-text-primary">
          {table}
        </p>
        <p className="type-jp-body-bold text-text-primary">{message}</p>
      </div>
      <p className="type-en-data-s text-text-secondary shrink-0 whitespace-nowrap">
        {elapsed}
      </p>
      <button
        type="button"
        onClick={onAction}
        className={`shrink-0 px-[var(--space-16)] py-[var(--space-8)] rounded-[var(--radius-full)] ${
          isAck ? "bg-status-warning" : "bg-status-urgent"
        }`}
      >
        <span
          className={`type-jp-caption-bold whitespace-nowrap ${
            isAck ? "text-text-primary" : "text-text-inverse"
          }`}
        >
          {isAck ? "完了にする" : "対応する"}
        </span>
      </button>
    </div>
  );
}
