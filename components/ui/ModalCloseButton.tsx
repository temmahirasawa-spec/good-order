"use client";

/**
 * モーダル/シート用の閉じるボタン（Figma: Modal Close Button 184:163）
 * 48px円・bg-tertiary 地・枠線/影なし。白背景シート上で使うソフトなグレー円。
 * 円形ボタンは全画面48pxに統一している（管理画面のモーダルでも同じ）。
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
      className={`flex items-center justify-center rounded-full bg-bg-tertiary w-[48px] h-[48px] shrink-0 ${className}`}
    >
      <Icon name="close" className="w-4 h-4 text-text-primary" />
    </button>
  );
}
