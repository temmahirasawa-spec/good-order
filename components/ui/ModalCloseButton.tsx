"use client";

/**
 * モーダル/シート用の閉じるボタン（Figma: Modal Close Button 184:163）
 * 36px円・bg-tertiary 地・枠線/影なし。白背景シート上で使うソフトなグレー円。
 */
import { Icon } from "@/components/Icon";

export default function ModalCloseButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="閉じる"
      className={`flex items-center justify-center rounded-full bg-bg-tertiary w-[var(--size-control-sm)] h-[var(--size-control-sm)] shrink-0 ${className}`}
    >
      <Icon name="close" className="w-4 h-4 text-text-primary" />
    </button>
  );
}
