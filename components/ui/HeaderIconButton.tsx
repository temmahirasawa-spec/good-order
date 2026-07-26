"use client";

/**
 * 全画面共通の左上ヘッダーボタン（Figma: Header Icon Button 115:161）
 * 円形44・白地・枠線・影。Menu=ハンバーガー、Close=メニュー画面/ドロワー開時用。
 * 配置は親側で行う（Figma基準: x16 y12）。
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
      className={`flex items-center justify-center rounded-full bg-surface-white border border-border w-[var(--size-control-md)] h-[var(--size-control-md)] shrink-0 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Icon name={icon} className="w-4 h-4 text-text-primary" />
    </button>
  );
}
