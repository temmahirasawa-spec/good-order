"use client";

/**
 * 「すべてを見る ›」（Figma: Components / 02 Buttons & CTAs / See All Link、2026-09-08 追加）
 * トップの各区画の見出し右に置き、縦一覧の /order/[category] へ送る。
 * 文字は JP/Body Bold の text-secondary、右に Chevron Right。高さ 44 でタップ領域を確保。
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
      className={`pressable flex items-center gap-[var(--space-2)] h-[var(--size-touch-min)] pl-[var(--space-8)] shrink-0 ${className}`}
    >
      <span className="type-jp-body-bold text-text-secondary whitespace-nowrap">{label}</span>
      <Icon name="chevron-right" className="w-4 h-4 text-text-secondary shrink-0" />
    </Link>
  );
}
