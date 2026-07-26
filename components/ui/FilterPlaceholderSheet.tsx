"use client";

/**
 * FilterBar タップ時のプレースホルダーシート（絞り込みロジックは別Step）
 * TOPページ・カテゴリ一覧ページ等、FilterBarを置く画面で共通利用する。
 */
import ModalCloseButton from "@/components/ui/ModalCloseButton";

export default function FilterPlaceholderSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-auto bg-surface-white rounded-t-[var(--radius-xl)] px-[20px] pt-[24px] pb-[40px]"
        style={{ boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-jp font-bold text-[22px] leading-[1.4] text-text-primary">
            絞り込み
          </h3>
          <ModalCloseButton onClick={onClose} />
        </div>
        <p className="type-jp-body text-text-secondary mt-[16px]">
          この機能は準備中です（Coming soon）。
        </p>
        <div className="h-2 safe-bottom" />
      </div>
    </div>
  );
}
