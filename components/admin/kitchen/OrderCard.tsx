"use client";

/**
 * テーブル単位の注文カード（Figma: Order Card 222:967）
 * Urgency=Normal(通常)/Warning(10-19分)/Urgent(20分超) — 既存のcalcElapsed()の
 * 閾値とそのまま一致しているため、そのロジックをそのまま使う。
 *
 * Figmaの構成に対する差分（機能維持のための最小限の追加）:
 * - 複数ラウンド（同じ卓への追加注文）はitemsを1つのリストにフラット化して表示
 *   （Figma自体がラウンド単位の区切りを持たない、テーブル単位のカードのため）
 * - 未確認の新規注文があるテーブルには、卓番の隣に小さな赤ドットを表示し、
 *   カードヘッダーのタップで確認済みにできる（Figmaにバナー要素は無いため、
 *   最小限のインジケータで既存の「新規注文アラート」機能を維持している）
 * - フッターの完了ボタンはFigma通り常時表示するが、未調理の品が残っている間は
 *   誤操作防止のため無効化する
 */
import { Icon } from "@/components/Icon";
import StatusBadge, { type StatusBadgeState } from "@/components/admin/StatusBadge";
import type { CookingStatus } from "@/lib/kitchenGrouping";

export interface OrderCardItem {
  orderItemId: string;
  name: string;
  quantity: number;
  cookingStatus: CookingStatus;
  isTakeoutItem: boolean;
}

const STATUS_MAP: Record<CookingStatus, StatusBadgeState> = {
  pending: "pending",
  cooking: "cooking",
  done: "done",
};

export default function OrderCard({
  tableCategory,
  table,
  elapsed,
  isTakeout,
  urgency,
  items,
  allDone,
  hasUnacknowledged,
  onAcknowledge,
  onItemClick,
  onComplete,
  className = "",
}: {
  /** カテゴリー名（"カウンター"）。テイクアウトや移行前の注文では空 */
  tableCategory?: string;
  /** 卓の短縮ラベル（"C-1"）。テイクアウトは "TAKEOUT" */
  table: string;
  elapsed: string;
  isTakeout: boolean;
  urgency: "normal" | "warning" | "urgent";
  items: OrderCardItem[];
  allDone: boolean;
  hasUnacknowledged: boolean;
  onAcknowledge: () => void;
  onItemClick: (item: OrderCardItem) => void;
  onComplete: () => void;
  className?: string;
}) {
  const isUrgent = urgency === "urgent";
  const isWarning = urgency === "warning";
  const doneCount = items.filter((i) => i.cookingStatus === "done").length;

  return (
    <div
      className={`bg-surface-white flex flex-col items-start overflow-hidden rounded-[var(--radius-md)] w-full ${
        isUrgent
          ? "border-2 border-status-urgent"
          : isWarning
            ? "border-2 border-status-warning"
            : "border border-border"
      } ${className}`}
    >
      {/* ── ヘッダー ── */}
      <button
        type="button"
        onClick={hasUnacknowledged ? onAcknowledge : undefined}
        className={`flex items-center justify-between px-[var(--space-16)] py-[var(--space-12)] w-full text-left ${
          isUrgent ? "bg-status-urgent-subtle" : isWarning ? "bg-status-warning-subtle" : "bg-surface-white"
        }`}
      >
        {/* カテゴリー名は小さくグレー、卓番号は大きく黒。
            「どの席か」は番号で読み、「どのエリアか」は名前で補う並びにしている */}
        <span className="flex gap-[var(--space-8)] items-center min-w-0">
          {isTakeout && <Icon name="bag" className="shrink-0 w-4 h-4 text-text-primary" />}
          {tableCategory && (
            <span className="type-jp-heading-s text-text-secondary truncate">
              {tableCategory}
            </span>
          )}
          <span className="type-en-data-l text-text-primary shrink-0">
            {table}
          </span>
          {hasUnacknowledged && (
            <span
              className="shrink-0 w-[8px] h-[8px] rounded-full bg-status-urgent animate-pulse"
              aria-label="新しい注文"
            />
          )}
        </span>
        <span
          className={`type-en-data-m whitespace-nowrap ${
            isUrgent ? "text-status-urgent" : isWarning ? "text-status-warning" : "text-text-secondary"
          }`}
        >
          {elapsed}
        </span>
      </button>

      {/* ── 品目 ── */}
      <div className="flex flex-col items-start w-full">
        {items.map((item, idx) => (
          <div key={item.orderItemId} className="w-full">
            <button
              type="button"
              onClick={() => onItemClick(item)}
              className="flex h-[52px] items-center justify-between px-[var(--space-16)] w-full text-left"
            >
              <span className="flex gap-[var(--space-8)] items-center whitespace-nowrap">
                {item.isTakeoutItem && !isTakeout && (
                  <Icon name="bag" className="shrink-0 w-3.5 h-3.5 text-text-secondary" />
                )}
                <span className="type-jp-heading-s text-text-primary">{item.name}</span>
                <span className="font-en font-semibold text-text-secondary">×{item.quantity}</span>
              </span>
              <StatusBadge state={STATUS_MAP[item.cookingStatus]} />
            </button>
            {idx < items.length - 1 && <div className="bg-border-divider h-px w-full" />}
          </div>
        ))}
      </div>

      {/* ── フッター ── */}
      <div className="flex items-center justify-between px-[var(--space-16)] py-[var(--space-12)] w-full">
        <p className="type-jp-caption text-text-secondary">
          調理中：{doneCount} / {items.length} 品
        </p>
        <button
          type="button"
          onClick={onComplete}
          disabled={!allDone}
          className="bg-surface-ink disabled:opacity-30 px-[var(--space-16)] py-[var(--space-8)] rounded-[var(--radius-full)] shrink-0"
        >
          <span className="type-jp-caption-bold text-text-inverse whitespace-nowrap">
            すべて提供済みにする
          </span>
        </button>
      </div>
    </div>
  );
}
