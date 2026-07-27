"use client";

/**
 * 全画面共通のヘッダーボタン（Figma: Header Icon Button 115:161）
 * 円形48・白地・枠線・影。Menu=ハンバーガー、Close=メニュー画面/ドロワー開時用。
 * 48pxなのはiOSの最小推奨44ptを上回らせて押しやすくするため（Back/Modal Closeとも共通）。
 * 配置は親側で行う（Figma基準: 右上 x326 y10）。
 */
import { Icon } from "@/components/Icon";

export default function HeaderIconButton({
  icon,
  onClick,
  label,
  className = "",
}: {
  icon: "menu" | "close";
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (icon === "menu" ? "メニューを開く" : "メニューを閉じる")}
      className={`flex items-center justify-center rounded-full bg-surface-white border border-border w-[48px] h-[48px] shrink-0 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Icon name={icon} className="w-4 h-4 text-text-primary" />
    </button>
  );
}
