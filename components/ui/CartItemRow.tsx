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
 *
 * soldOut（カートに入れた後で売り切れになった行）: 画像を薄くして墨の帯、
 * ステッパーの代わりに押せない SOLD OUT のピル。提供タイミングの切替も出さない。
 * 行の削除はできる（カート画面はこの行があるうちは注文ボタンを止める）。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import CategoryTag, { type TagColor } from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import SegmentedControl, { type SegmentedOption } from "@/components/ui/SegmentedControl";
import { SoldOutBand, SoldOutPill } from "@/components/ui/SoldOut";
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
  soldOut = false,
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
  /** カートに入れた後で売り切れになった行（docs/specs/sold-out-and-receipt-copies.md） */
  soldOut?: boolean;
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
          className={`flex gap-[var(--space-12)] ${servingTiming && !soldOut ? "items-start" : "items-center"}`}
        >
          <div className="relative shrink-0 w-[80px] h-[80px] rounded-[var(--radius-md)] overflow-hidden bg-bg-tertiary">
            {image && (
              <Image
                src={image}
                alt={name}
                fill
                className={`object-cover ${soldOut ? "opacity-40" : ""}`}
                sizes="80px"
                unoptimized
              />
            )}
            {soldOut && <SoldOutBand />}
          </div>

          <div className="flex-1 min-w-0 flex flex-col items-start gap-[2px]">
            <CategoryTag label={categoryLabel} color={categoryColor} className="!py-[2px]" />
            <p className="w-full type-jp-heading-s text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
              {name}
            </p>
            {optionsLabel && (
              /* 2行まで見せて、それ以上は末尾を省略（天真の決定 2026-09-04。1行省略だと3つ目から読めない） */
              <p className="w-full type-jp-caption text-text-secondary line-clamp-2 break-all">
                {optionsLabel}
              </p>
            )}
            <div className="w-full flex items-center justify-between h-[36px]">
              <span className="type-en-price-m text-text-primary tabular-nums">
                ¥{price.toLocaleString()}
              </span>
              {soldOut ? (
                <SoldOutPill />
              ) : (
                <QuantityStepper count={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
              )}
            </div>
          </div>
        </div>

        {/* Figma の Timing Wrap: 行の内側いっぱいの幅。売り切れの行では出さない（注文できないため） */}
        {servingTiming && !soldOut && (
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
