"use client";

/**
 * 写真なしの商品を並べる行（Figma: Components / 05 Cards / Menu List Row、2026-09-08 追加）
 * docs/specs/menu-text-rows.md 案A「行リスト」。紙のメニューのような一覧。
 *
 * - 左: 商品名（JP/Heading/S）・説明（JP/Caption 1行省略）・価格（EN/Price/M）
 * - 右: 数量ステッパー（小）の下に「カートに入れる」（小）を縦に積む。
 *   ⚠ **ステッパーは「これから何個入れるか」の下書き。**押してもカートには入らない
 *   （2026-09-16、天真の指示。それまで「＋」が即カート投入だった）
 * - Thumb: 写真がある商品が混ざるときだけ 56px のサムネを左に付ける（showThumb）
 * - 高さ 88、下に境界線
 *
 * 行のタップ（名前・説明）で商品詳細を開く
 * （オプションのある商品は「カートに入れる」でも商品詳細を開く。呼び出し側の判断）。
 * 売り切れ（item.isSoldOut）は操作の代わりに押せない SOLD OUT のピル。サムネがあれば帯も被せる。
 */
import type { MenuItem } from "@/lib/menu";
import QuantityStepperS from "@/components/ui/QuantityStepperS";
import { AddToCartButtonS } from "@/components/ui/Buttons";
import { ADD_TO_CART_LABEL } from "@/lib/listAction";
import { SoldOutBand, SoldOutPill } from "@/components/ui/SoldOut";

export default function MenuListRow({
  item,
  quantity,
  description,
  showThumb = false,
  onAdd,
  addLabel,
  addVariant,
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
  /** 「カートに入れる」。ドリンクでは「詳細を見る」として詳細シートを開く（lib/listAction.ts） */
  onAdd: () => void;
  /** ボタンの文言。省略すると「カートに入れる」 */
  addLabel?: string;
  /** ボタンの見た目。詳細を開く副操作は "line"（白地に枠） */
  addVariant?: "fill" | "line";
  onIncrement: () => void;
  onDecrement: () => void;
  onClick?: () => void;
  className?: string;
}) {
  const cover = item.media?.[0];
  const src = (cover?.type === "image" ? cover.url : undefined) ?? item.image;
  const desc = description === undefined ? item.description : description;
  const soldOut = item.isSoldOut === true;
  return (
    <div
      className={`flex gap-[var(--space-12)] items-center py-[var(--space-12)] border-b border-border-divider w-full ${className}`}
    >
      {/* 写真が無い商品は枠ごと出さない（グレーの空箱が「準備中」に見える。2026-09-17、天真の指摘）。
          その分、品名と価格が左に詰まる */}
      {showThumb && src && (
        <div
          className={`relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 w-[56px] h-[56px] ${onClick ? "cursor-pointer" : ""}`}
          onClick={onClick}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover ${soldOut ? "sold-out-photo" : ""}`}
            />
          )}
          {/* 写真がある商品だけ帯を出す（空箱に帯だけだと「画像なし」に見える） */}
          {soldOut && src && <SoldOutBand size="sm" />}
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

      {soldOut ? (
        <SoldOutPill />
      ) : (
        /* 右側は 108px の列に縦2段。横に並べると 84+8+108=200 必要で、
           サムネ付きの行では商品名の幅が残らない（2026-09-16） */
        <div className="flex flex-col gap-[var(--space-8)] items-end shrink-0 w-[108px]">
          <QuantityStepperS
            count={quantity}
            min={1}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
          <AddToCartButtonS
            onClick={onAdd}
            label={addLabel ?? ADD_TO_CART_LABEL}
            variant={addVariant}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
