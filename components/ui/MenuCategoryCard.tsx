"use client";

/**
 * メニュー画面のカテゴリカード（Figma: Menu Category Card 115:557）
 * 背景に category.image_url、上に 25% 黒オーバーレイ、白文字で EN + JP 表記。
 * Menu 画面の実測: Large = 175×80（2カラム可変幅）/ Small = 114×80（3カラム）。
 * Large は親グリッドに合わせて可変幅（h-80 固定）、Small は 114px 固定。
 *
 * **写真が無いカテゴリーでは、黒オーバーレイも白文字も使わない**（2026-09-15）。
 * 写真前提の装飾を写真なしで出すと、灰色の箱に白文字が乗って読みにくいうえ、
 * 「画像が壊れている」ように見える。売り切れの帯で同じ判断をしたのと同じ理由。
 * 写真はカテゴリ管理から設定できる。
 *
 * 英語名は **category.caption**（カテゴリ管理で入力する英語名）を最優先で使う。
 * 以前は固定の対応表と slug からしか作っておらず、管理画面で作ったカテゴリーが
 * 「FRENCHFLIES」のような表示になっていた。
 */
import Link from "next/link";
import type { ApiCategory } from "@/lib/api";
import { SUBCATEGORY_EN_LABEL } from "@/lib/categoryLabels";
import type { Subcategory } from "@/lib/menu";

export default function MenuCategoryCard({
  category,
  size,
  href,
  onClick,
  className = "",
}: {
  category: ApiCategory;
  size: "large" | "small";
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const en =
    category.caption?.trim() ||
    SUBCATEGORY_EN_LABEL[category.slug as Subcategory] ||
    category.slug.toUpperCase();
  const sizeClass = size === "small" ? "w-[114px] shrink-0" : "w-full";
  const hasPhoto = Boolean(category.image_url);
  const body = (
    <span
      className={`menu-card relative flex flex-col h-[80px] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] px-[var(--space-8)] ${
        hasPhoto ? "bg-bg-tertiary" : "bg-surface-white border border-border"
      } ${sizeClass} ${className}`}
    >
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={category.image_url as string}
            alt=""
            className="menu-card__img absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-black/25" />
        </>
      )}
      <span
        className={`relative type-en-display-s whitespace-nowrap ${
          hasPhoto ? "text-text-inverse" : "text-text-primary"
        }`}
      >
        {en}
      </span>
      <span
        className={`relative type-jp-caption whitespace-nowrap ${
          hasPhoto ? "text-text-inverse" : "text-text-secondary"
        }`}
      >
        {category.name}
      </span>
    </span>
  );
  if (href) {
    return (
      /* Link は <a> なので、button 前提の共通プレスが効かない */
      <Link href={href} onClick={onClick} className={`pressable block ${sizeClass}`}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`block text-left ${sizeClass}`}>
      {body}
    </button>
  );
}
