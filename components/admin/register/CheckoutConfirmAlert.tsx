"use client";

/**
 * 会計確定の最終確認ポップアップ（Figma: Checkout Confirm Alert 258:261）
 * 中央配置＋スクリム。PC=400px幅、SP=342px幅（構成は同じ、幅だけ異なる）。
 */
export default function CheckoutConfirmAlert({
  open,
  table,
  amount,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  table: string;
  amount: number;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-[var(--space-16)]" onClick={onCancel}>
      <div
        className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
        style={{ boxShadow: "var(--shadow-float)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
          <p className="type-jp-heading-m text-text-primary w-full">会計を確定しますか？</p>
          <p className="type-jp-body-small text-text-secondary w-full">
            この操作は取り消せません。
            <br />
            内容をご確認ください。
          </p>
        </div>

        <div className="bg-bg-secondary flex items-center justify-between px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] w-full">
          <span className="type-en-wordmark text-text-primary">
            {table}
          </span>
          <span className="type-en-data-l text-text-primary">
            ¥{amount.toLocaleString()}
          </span>
        </div>

        <div className="flex gap-[var(--space-12)] items-start w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-border py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-secondary"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 bg-surface-ink disabled:opacity-50 py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
          >
            {confirming ? "処理中…" : "会計を確定"}
          </button>
        </div>
      </div>
    </div>
  );
}
