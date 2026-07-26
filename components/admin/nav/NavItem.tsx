"use client";

/**
 * サイドナビ・ドロワー共通の項目（Figma: Nav Item 314:1817）
 * Active = 背景ink・文字inverse・JP/Heading/S(bold)、Inactive = 背景なし・文字primary・JP/Body(medium)
 */
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

export default function NavItem({
  icon,
  label,
  active,
  href,
  onClick,
  className = "",
}: {
  icon: IconName;
  label: string;
  active: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const base = `flex gap-[var(--space-12)] h-[44px] items-center p-[var(--space-12)] rounded-[var(--radius-sm)] w-full text-left ${
    active ? "bg-surface-ink" : ""
  } ${className}`;
  const content = (
    <>
      <Icon
        name={icon}
        className={`shrink-0 w-4 h-4 ${active ? "text-text-inverse" : "text-text-primary"}`}
      />
      <span
        className={`flex-1 min-w-0 ${
          active ? "type-jp-heading-s text-text-inverse" : "type-jp-body text-text-primary"
        }`}
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={base}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  );
}
