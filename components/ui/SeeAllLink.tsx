"use client";

/**
 * 「すべてを見る ›」ボタン（Figma: Components / 02 Buttons & CTAs / See All Link、2026-09-08）
 * トップの各区画の見出し右に置き、縦一覧の /order/[category] へ送る。
 *
 * 白の塗り・1.5px のアクセント線・文字とアイコンもアクセント色。角丸 full、高さ 32。
 * 文字のリンクだと目立たなすぎる、という天真の指摘（2026-09-08）でボタンにした。
 * 見た目は 32px だが、タップ領域は上下に 6px ずつ足して 44px を確保する。
 */
import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function SeeAllLink({
  href,
  label = "すべてを見る",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`pressable flex items-center py-[6px] shrink-0 ${className}`}
    >
      <span className="flex items-center gap-[var(--space-2)] h-[32px] pl-[var(--space-12)] pr-[var(--space-8)] rounded-full bg-surface-white border-[1.5px] border-accent-primary">
        <span className="type-jp-caption-bold text-accent-primary whitespace-nowrap">{label}</span>
        <Icon name="chevron-right" className="w-4 h-4 text-accent-primary shrink-0" />
      </span>
    </Link>
  );
}
