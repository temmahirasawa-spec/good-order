"use client";

/**
 * カート画面の1商品行（Step3-F、Figma: Cart Item Row 364:2243）
 * 画像80×80 + カテゴリタグ/商品名(1行省略)/価格+数量ステッパー、右上に削除アイコン。
 *
 * 提供タイミングを選べる商品では、画像＋情報のブロックの**下**に、行の内側いっぱいの幅で
 * セグメント切替（案A）を1本足す。上のブロックとの間隔は 16（space/16）。
 * Figma: Components / 05 Cards / Cart Item Row (Timing)（2026-09-04 に天真が構造を確定。
 * 当初は情報の列の中に置いていたが、行の内側いっぱいの幅に置く形に差し替えた）。
 * そのときだけ画像を上揃えにする（Figma の Frame 4 が上揃え）。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import CategoryTag, { type TagColor } from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import SegmentedControl, { type SegmentedOption } from "@/components/ui/SegmentedControl";
import { SERVING_TIMING_TITLE, type ServingTiming } from "@/lib/servingTiming";

export interface CartRowServingTiming {
  value: ServingTiming;
  options: SegmentedOption<ServingTiming>[];
  onChange: (value: ServingTiming) => void;
}

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
  servingTiming,
  optionsLabel,
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
  /** 提供タイミングを選べる商品のときだけ渡す。無ければ従来どおりの行 */
  servingTiming?: CartRowServingTiming;
  /** 選んだオプション（「＋アボカド ＋ゆで卵」）。無ければ出さない。価格はオプション込みで渡す */
  optionsLabel?: string;
}) {
  return (
    <div
      className="relative flex p-[var(--space-16)] w-full bg-surface-white rounded-[var(--radius-lg)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Figma の Frame 5: 上のブロックとセグメントを縦に積む（間隔 16） */}
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-16)]">
        {/* Figma の Frame 4: 画像＋情報 */}
        <div
          className={`flex gap-[var(--space-12)] ${servingTiming ? "items-start" : "items-center"}`}
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
            {optionsLabel && (
              <p className="w-full type-jp-caption text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
                {optionsLabel}
              </p>
            )}
            <div className="w-full flex items-center justify-between h-[36px]">
              <span className="type-en-price-m text-text-primary tabular-nums">
                ¥{price.toLocaleString()}
              </span>
              <QuantityStepper count={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
            </div>
          </div>
        </div>

        {/* Figma の Timing Wrap: 行の内側いっぱいの幅 */}
        {servingTiming && (
          <SegmentedControl
            className="w-full"
            ariaLabel={`${name}の${SERVING_TIMING_TITLE}`}
            options={servingTiming.options}
            value={servingTiming.value}
            onChange={servingTiming.onChange}
          />
        )}
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
