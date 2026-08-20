/**
 * 伝票1枚ぶんの行（管理画面「印刷状況」）
 *
 * 印刷済みは基本的に見る必要がないので、目立つのは
 * 「まだ出ていない」「失敗した」の2つ。刷り直しボタンもそこにだけ出す。
 */
import { jobIdentity, jobSeqLabel, formatSince, type PrintJobRow } from "@/lib/printStatus";

const STATUS_TONE: Record<
  PrintJobRow["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  pending:  { label: "未印刷",   bg: "bg-status-warning-subtle", text: "text-status-warning", dot: "bg-status-warning" },
  printing: { label: "送信中",   bg: "bg-status-info-subtle",    text: "text-status-info",    dot: "bg-status-info" },
  done:     { label: "印刷済み", bg: "bg-bg-tertiary",           text: "text-text-tertiary",  dot: "bg-text-tertiary" },
  failed:   { label: "失敗",     bg: "bg-status-urgent-subtle",  text: "text-status-urgent",  dot: "bg-status-urgent" },
};

export default function PrintJobRowCard({
  job,
  now,
  requeueing,
  onRequeue,
}: {
  job: PrintJobRow;
  now: number;
  requeueing: boolean;
  onRequeue: () => void;
}) {
  const tone = STATUS_TONE[job.status];
  // 印刷済み以外は、店舗が手を打てる相手なので刷り直しを出す
  const canRequeue = job.status !== "done";

  return (
    <li className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] py-[var(--space-12)] flex items-center gap-[var(--space-12)]">
      <span
        className={`inline-flex gap-[var(--space-4)] items-center shrink-0 px-[var(--space-8)] py-[var(--space-4)] rounded-[var(--radius-full)] ${tone.bg}`}
      >
        <span className={`shrink-0 w-[6px] h-[6px] rounded-full ${tone.dot}`} />
        <span className={`type-jp-caption-bold whitespace-nowrap ${tone.text}`}>{tone.label}</span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="type-jp-body-bold text-text-primary truncate">
          {jobIdentity(job)}
          <span className="type-jp-caption text-text-secondary ml-[var(--space-8)]">
            {jobSeqLabel(job.seq)}
          </span>
        </p>
        <p className="type-jp-caption text-text-tertiary mt-[var(--space-2)]">
          {formatSince(job.createdAt, now)}
          {job.attempts > 1 && `・${job.attempts}回試行`}
          {job.lastError && (
            <span className="text-status-urgent">・{job.lastError}</span>
          )}
        </p>
      </div>

      {canRequeue && (
        <button
          type="button"
          onClick={onRequeue}
          disabled={requeueing}
          className="shrink-0 px-[var(--space-12)] py-[var(--space-8)] rounded-[var(--radius-sm)] border border-border bg-surface-white type-jp-caption-bold text-text-primary hover:bg-bg-secondary disabled:opacity-50 transition-colors"
        >
          {requeueing ? "…" : "刷り直す"}
        </button>
      )}
    </li>
  );
}
