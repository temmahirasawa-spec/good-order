"use client";

/**
 * トップの区画見出し（Figma: Components / 03 Navigation / Menu Section Header、2026-09-08 追加）
 * 説明文（JP/Label）→ 英語名（EN/Display）→ 日本語名の行。
 * 日本語名の行の右に「すべてを見る ›」（seeAllHref を渡したときだけ）。
 * 英語タイトルの右に置くと EGG BENEDICT のような長い名前が2行に折れるため、
 * 日本語名と同じ行に置いている（docs/specs/home-layout.md 8-1）。
 *
 * 文言もサイズも DB（categories）から来る。説明文・英語名は未入力なら行ごと出さない。
 */
import type { HeadingSize } from "@/lib/api";
import SeeAllLink from "@/components/ui/SeeAllLink";

const EN_SIZE_CLASS: Record<HeadingSize, string> = {
  large:  "type-en-display-xl",
  medium: "type-en-display-l",
  small:  "type-en-display-m",
};
const JP_SIZE_CLASS: Record<HeadingSize, string> = {
  large:  "type-jp-heading-m",
  medium: "type-jp-body-bold",
  small:  "type-jp-caption-bold",
};

export default function MenuSectionHeader({
  eyebrow,
  en,
  jp,
  enSize = "large",
  jpSize = "small",
  seeAllHref,
  className = "",
}: {
  eyebrow: string | null;
  en: string | null;
  jp: string;
  enSize?: HeadingSize;
  jpSize?: HeadingSize;
  /** 渡すと日本語名の右に「すべてを見る ›」を出す */
  seeAllHref?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-[var(--space-12)] px-[var(--space-16)] ${className}`}>
      <div className="flex flex-1 flex-col gap-[var(--space-4)] min-w-0">
        {eyebrow && <p className="type-jp-label text-text-secondary">{eyebrow}</p>}
        {en && <p className={`${EN_SIZE_CLASS[enSize]} text-text-primary`}>{en}</p>}
        <p className={`${JP_SIZE_CLASS[jpSize]} text-text-secondary`}>{jp}</p>
      </div>
      {/* タップ領域の上下 6px ぶんだけ下に食い込ませ、見た目の 32px の下端を日本語名の下端に揃える */}
      {seeAllHref && <SeeAllLink href={seeAllHref} className="-mb-[6px]" />}
    </div>
  );
}
