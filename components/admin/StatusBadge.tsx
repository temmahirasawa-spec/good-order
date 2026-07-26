/**
 * 注文/明細のステータス表示（Figma: Status Badge 221:918）
 * 汎用ドット+ラベル。厨房のOrder Item Rowで使用。
 * DBの cooking_status（pending/cooking/done）に加え、served/picked_up も
 * 表現できるよう5状態ぶん用意している。
 */
export type StatusBadgeState = "pending" | "cooking" | "done" | "served" | "pickedUp";

const CONFIG: Record<
  StatusBadgeState,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending:  { label: "未調理",   bg: "bg-bg-tertiary",         text: "text-text-secondary", dot: "bg-text-tertiary" },
  cooking:  { label: "調理中",   bg: "bg-status-warning-subtle", text: "text-text-primary",   dot: "bg-status-warning" },
  done:     { label: "調理完了", bg: "bg-status-success-subtle", text: "text-status-success", dot: "bg-status-success" },
  served:   { label: "提供済み", bg: "bg-bg-tertiary",         text: "text-text-tertiary",  dot: "bg-text-tertiary" },
  pickedUp: { label: "受渡済み", bg: "bg-status-info-subtle",    text: "text-status-info",    dot: "bg-status-info" },
};

export default function StatusBadge({
  state,
  className = "",
}: {
  state: StatusBadgeState;
  className?: string;
}) {
  const c = CONFIG[state];
  return (
    <span
      className={`inline-flex gap-[var(--space-4)] items-center px-[var(--space-8)] py-[var(--space-4)] rounded-[var(--radius-full)] ${c.bg} ${className}`}
    >
      <span className={`shrink-0 w-[6px] h-[6px] rounded-full ${c.dot}`} />
      <span className={`type-jp-caption-bold whitespace-nowrap ${c.text}`}>{c.label}</span>
    </span>
  );
}
