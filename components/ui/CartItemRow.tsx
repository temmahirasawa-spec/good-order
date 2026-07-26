"use client";

/**
 * カート画面の1商品行（Step3-F、Figma: Cart Item Row 364:2243）
 * 画像80×80 + カテゴリタグ/商品名(1行省略)/価格+数量ステッパー、右上に削除アイコン。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import CategoryTag, { type TagColor } from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";

export default function CartItemRow({
  image,
  categoryLabel,
  categoryColor,
  name,
  price,
  quantity,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  image: string;
  categoryLabel: string;
  categoryColor: TagColor;
  name: string;
  price: number;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="relative flex gap-[var(--space-12)] items-center p-[var(--space-16)] w-full bg-surface-white rounded-[var(--radius-lg)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative shrink-0 w-[80px] h-[80px] rounded-[var(--radius-md)] overflow-hidden bg-bg-tertiary">
        {image && (
          <Image src={image} alt={name} fill className="object-cover" sizes="80px" unoptimized />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col items-start gap-[2px]">
        <CategoryTag label={categoryLabel} color={categoryColor} className="!py-[2px]" />
        <p className="w-full type-jp-heading-s text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
          {name}
        </p>
        <div className="w-full flex items-center justify-between h-[36px]">
          <span className="type-en-price-m text-text-primary tabular-nums">
            ¥{price.toLocaleString()}
          </span>
          <QuantityStepper count={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="カートから削除"
        className="absolute top-[16px] right-[16px] w-4 h-4 flex items-center justify-center text-text-tertiary"
      >
        <Icon name="trash" className="w-4 h-4" />
      </button>
    </div>
  );
}
