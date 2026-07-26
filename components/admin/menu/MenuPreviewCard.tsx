"use client";

/**
 * 編集パネル（PCのみ）のリアルタイムプレビュー（Figma: Slide Panel — Editing 306:1684
 * 内 Preview Wrap 306:1697）。/order の Menu Card と同じ見た目を、フォーム入力値
 * から静的に組み立てる（カート操作は無いため数量ステッパーは非機能の表示のみ）。
 */
import CategoryTag from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { RibbonBadge } from "@/components/ui/MenuCard";
import type { TagColor } from "@/components/ui/CategoryTag";

export default function MenuPreviewCard({
  name,
  price,
  tag,
  categoryLabel,
  categoryColor,
  imageUrl,
}: {
  name: string;
  price: string;
  tag: string;
  categoryLabel: string;
  categoryColor: TagColor;
  imageUrl: string | null;
}) {
  const priceNum = parseInt(price, 10);

  return (
    <div className="flex flex-col gap-[var(--space-8)] items-start w-[171px]">
      <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 w-[171px] h-[171px]">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {tag && <RibbonBadge label={tag} />}
      </div>
      {categoryLabel && <CategoryTag label={categoryLabel} color={categoryColor} />}
      <p className="type-jp-heading-s text-text-primary w-full line-clamp-2 min-h-[44px]">
        {name || "（商品名未入力）"}
      </p>
      <p className="type-en-price-m text-text-primary whitespace-nowrap">
        ¥{Number.isNaN(priceNum) ? 0 : priceNum.toLocaleString()}
      </p>
      <QuantityStepper count={0} onIncrement={() => {}} onDecrement={() => {}} className="w-full" />
    </div>
  );
}
