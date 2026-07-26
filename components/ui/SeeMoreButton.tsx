"use client";

/**
 * 「もっと見る」ボタン（Figma: See More Button 68:114）
 * イエロー 1.5px アウトライン × 透明背景・角丸 full・高さ 52px。
 * ラベルは「{カテゴリ名}をもっと見る」、遷移先は /order/{subcategory-slug}。
 * 外部URL（https://〜）を渡した場合は <a target="_blank"> で開く。
 */
import Link from "next/link";

export default function SeeMoreButton({
  label,
  href,
  className = "",
}: {
  label: string;
  href: string;
  className?: string;
}) {
  const base =
    "flex h-[var(--size-control-lg)] items-center justify-center rounded-full border-[1.5px] border-accent-primary bg-transparent w-full";
  const text = (
    <span className="type-jp-body-bold text-text-primary whitespace-nowrap">
      {label}
    </span>
  );
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`${base} ${className}`}>
        {text}
      </a>
    );
  }
  return (
    <Link href={href} className={`${base} ${className}`}>
      {text}
    </Link>
  );
}
