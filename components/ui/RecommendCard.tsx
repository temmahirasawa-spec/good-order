"use client";

/**
 * 関連おすすめカード（Figma: Recommend Card 86:538）
 * 黒1px外線・白地・角丸なし・幅300・画像4:3（300×225）。
 * カテゴリタグ + タイトル + 短い説明文。アレルギー/kcal 表記は無し。
 */
import type { MenuItem } from "@/lib/menu";
import CategoryTag from "@/components/ui/CategoryTag";
import { resolveCategoryLabel, resolveTagColor } from "@/lib/categoryLabels";
import { useMenuDataStore } from "@/lib/menuDataStore";

export default function RecommendCard({
  item,
  onClick,
  className = "",
}: {
  item: MenuItem;
  onClick?: () => void;
  className?: string;
}) {
  const categories = useMenuDataStore((s) => s.categories);
  const cover = item.media?.[0];
  const src = (cover?.type === "image" ? cover.url : undefined) ?? item.image;
  const label = resolveCategoryLabel(categories, item.subcategory);
  const color = resolveTagColor(categories, item.subcategory);
  return (
    <div
      className={`menu-card ${onClick ? "pressable cursor-pointer" : ""} bg-surface-white border border-text-primary flex flex-col items-start overflow-hidden w-[300px] shrink-0 ${className}`}
      onClick={onClick}
    >
      <div className="relative bg-bg-tertiary w-[300px] h-[225px] shrink-0">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.name}
            className="menu-card__img absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-[6px] items-start pt-[14px] pb-[var(--space-16)] px-[var(--space-16)] w-full">
        <CategoryTag label={label} color={color} />
        <p className="type-jp-heading-s text-text-primary w-full">
          {item.name}
        </p>
        <p className="type-jp-caption text-text-secondary w-full">
          {item.description}
        </p>
      </div>
    </div>
  );
}
