"use client";

/**
 * 写真なしの商品を並べる行（Figma: Components / 05 Cards / Menu List Row、2026-09-08 追加）
 * docs/specs/menu-text-rows.md 案A「行リスト」。紙のメニューのような一覧。
 *
 * - 左: 商品名（JP/Heading/S）・説明（JP/Caption 1行省略）・価格（EN/Price/M）
 * - 右: カートに入っていなければ「＋」（Plus Button）、入っていれば数量ステッパー
 * - Thumb: 写真がある商品が混ざるときだけ 56px のサムネを左に付ける（showThumb）
 * - 高さ 88、下に境界線
 *
 * 行のタップ（名前・説明）で商品詳細を開く。＋はカートに入れる
 * （オプションのある商品は呼び出し側が商品詳細を開く）。
 */
import type { MenuItem } from "@/lib/menu";
import PlusButton from "@/components/ui/PlusButton";
import QuantityStepper from "@/components/ui/QuantityStepper";

export default function MenuListRow({
  item,
  quantity,
  description,
  showThumb = false,
  onAdd,
  onIncrement,
  onDecrement,
  onClick,
  className = "",
}: {
  item: MenuItem;
  /** カート内の数量。0 なら「＋」、1 以上ならステッパー */
  quantity: number;
  /** 2行目の文言。省略時は商品の説明文。トップではサブカテゴリー名を渡す */
  description?: string | null;
  /** 写真つき商品が混ざる一覧で、行を揃えるために左にサムネ枠を出す */
  showThumb?: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onClick?: () => void;
  className?: string;
}) {
  const cover = item.media?.[0];
  const src = (cover?.type === "image" ? cover.url : undefined) ?? item.image;
  const desc = description === undefined ? item.description : description;
  return (
    <div
      className={`flex gap-[var(--space-12)] items-center py-[var(--space-12)] border-b border-border-divider w-full ${className}`}
    >
      {showThumb && (
        <div
          className={`relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 w-[56px] h-[56px] ${onClick ? "cursor-pointer" : ""}`}
          onClick={onClick}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>
      )}

      <div
        className={`flex flex-1 flex-col gap-[var(--space-2)] min-w-0 ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        <p className="type-jp-heading-s text-text-primary line-clamp-2">{item.name}</p>
        {desc && (
          <p className="type-jp-caption text-text-secondary truncate">{desc}</p>
        )}
        <p className="type-en-price-m text-text-primary whitespace-nowrap">
          ¥{item.price.toLocaleString()}
        </p>
      </div>

      {quantity > 0 ? (
        <QuantityStepper count={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
      ) : (
        <PlusButton onClick={onAdd} label={`${item.name}をカートに入れる`} />
      )}
    </div>
  );
}
