"use client";

/**
 * 取り消せない操作の最終確認（CheckoutConfirmAlert と同じ見た目・同じ大きさ）。
 * レジの伝票編集（明細を消す／伝票ごと消す）で使う。
 * 会計の確認と見た目をそろえているのは、「この形の窓が出たら戻せない」と覚えてもらうため。
 */
export default function DangerConfirmAlert({
  open,
  title,
  body,
  detailLeft,
  detailRight,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  /** 確認の枠の左（卓名・品名など） */
  detailLeft: string;
  /** 確認の枠の右（金額・点数など） */
  detailRight: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-[var(--space-16)]"
      onClick={onCancel}
    >
      <div
        className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
        style={{ boxShadow: "var(--shadow-float)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
          <p className="type-jp-heading-m text-text-primary w-full">{title}</p>
          <p className="type-jp-body-small text-text-secondary w-full">
            この操作は取り消せません。
            <br />
            {body}
          </p>
        </div>

        <div className="bg-bg-secondary flex items-center justify-between gap-[var(--space-12)] px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] w-full">
          <span className="type-jp-body-bold text-text-primary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {detailLeft}
          </span>
          <span className="type-en-data-l text-text-primary shrink-0">{detailRight}</span>
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
            disabled={busy}
            className="flex-1 bg-status-urgent disabled:opacity-50 py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
          >
            {busy ? "処理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
