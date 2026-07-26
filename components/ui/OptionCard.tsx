"use client";

/**
 * 呼び出しオプション行（Figma: Option Card 180:167）
 * 白地 + border-border 枠線 + 角丸12、パディング20、アイコンとラベルの間隔16px。
 * お水 / お会計 / スタッフを呼ぶ 等。タップで即通知を送る想定。
 * disabled / trailing は StaffCallSheet のクールダウン表示用の拡張。
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

export default function OptionCard({
  icon,
  label,
  onClick,
  disabled = false,
  trailing,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex gap-[var(--space-16)] items-center p-[var(--space-20)] rounded-[var(--radius-md)] border w-full text-left ${
        disabled
          ? "bg-bg-secondary border-border-divider"
          : "bg-surface-white border-border active:bg-bg-secondary"
      } ${className}`}
    >
      <Icon
        name={icon}
        className={`w-4 h-4 shrink-0 ${disabled ? "text-text-disabled" : "text-text-primary"}`}
      />
      <span
        className={`flex-1 type-jp-heading-s ${
          disabled ? "text-text-disabled" : "text-text-primary"
        }`}
      >
        {label}
      </span>
      {trailing}
    </button>
  );
}
