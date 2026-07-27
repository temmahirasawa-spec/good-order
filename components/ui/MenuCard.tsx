"use client";

/**
 * メニューカード（Figma: Menu Card 49:21 / Menu Card Wide 52:251 / Menu Card M 594:7910）
 * - MenuCard: 幅171 = (390 − 16×2 − ガター16) ÷ 2。画像は正方形 171×171。グリッド用
 * - MenuCardWide: 横スライド用 幅300。画像は 4:3（300×225）
 * - MenuCardM: カテゴリカルーセル用 幅200。画像は正方形 200×200。
 *   下部が「ステッパー＋カートに入れる」の2要素なので専用の小型部品を使う
 * - バッジ: 燕尾ノッチ型リボン 48×64（accent-deep 地 + 王冠 + item.tag）
 */
import type { MenuItem } from "@/lib/menu";
import { Icon } from "@/components/Icon";
import CategoryTag from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import QuantityStepperS from "@/components/ui/QuantityStepperS";
import { AddToCartButtonS } from "@/components/ui/Buttons";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import { useMenuDataStore } from "@/lib/menuDataStore";

export interface MenuCardProps {
  item: MenuItem;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onClick?: () => void;
  /** 画像の読み込み方法。長いページで下部に並ぶカードは "lazy"（デフォルト）を推奨 */
  imageLoading?: "eager" | "lazy";
  /** カテゴリ一覧ページ（Menu Card No Tag）用。カテゴリタグを非表示にする */
  hideTag?: boolean;
  className?: string;
}

/* ── 燕尾ノッチ型リボンバッジ（Figma 実測: 48×64、path M0 0H48V64L24 55L0 64V0Z） ──
 * 管理画面のメニュー編集プレビュー（MenuPreviewCard）でも再利用するため export する */
export function RibbonBadge({ label }: { label: string }) {
  return (
    <div className="absolute left-[12px] top-0 w-[48px] h-[64px] pointer-events-none">
      <svg
        viewBox="0 0 48 64"
        className="absolute inset-0 w-full h-full"
        style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.18))", overflow: "visible" }}
      >
        <path d="M0 0H48V64L24 55L0 64V0Z" fill="var(--color-accent-deep)" />
      </svg>
      <Icon name="crown" className="absolute left-[16px] top-[10px] w-4 h-4 text-text-inverse" />
      {/* 11px以下は基本使わない方針だが、4文字タグが入りうるためここのみ例外で9px */}
      <p className="absolute left-1/2 top-[34px] -translate-x-1/2 type-jp-micro-label text-text-inverse text-center whitespace-nowrap">
        {label}
      </p>
    </div>
  );
}

/* ── 画像（カバー）+ バッジ ── */
function CardImage({
  item,
  onClick,
  imageClassName,
  imageLoading = "lazy",
}: {
  item: MenuItem;
  onClick?: () => void;
  imageClassName: string;
  imageLoading?: "eager" | "lazy";
}) {
  const cover = item.media?.[0];
  const src = (cover?.type === "image" ? cover.url : undefined) ?? item.image;
  return (
    <div
      className={`relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 ${imageClassName} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading={imageLoading}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {item.tag && <RibbonBadge label={item.tag} />}
    </div>
  );
}

function CardBody({
  item,
  quantity,
  onIncrement,
  onDecrement,
  onClick,
  hideTag,
  nameClassName,
}: MenuCardProps & { nameClassName: string }) {
  const categories = useMenuDataStore((s) => s.categories);
  const label = SUBCATEGORY_LABEL[item.subcategory] ?? item.subcategory;
  const color = resolveTagColor(categories, item.subcategory);
  return (
    <>
      {!hideTag && <CategoryTag label={label} color={color} />}
      {/* 商品名は常に2行ぶんの高さで固定し、収まらない場合は…で省略
          （1行/2行の商品名が混在してもグリッドの行高がガタつかないようにする） */}
      <p
        className={`text-text-primary w-full line-clamp-2 ${nameClassName} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        {item.name}
      </p>
      <p className="type-en-price-m text-text-primary whitespace-nowrap">
        ¥{item.price.toLocaleString()}
      </p>
      <QuantityStepper
        count={quantity}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        className="w-full"
      />
    </>
  );
}

export function MenuCard(props: MenuCardProps) {
  const { item, onClick, imageLoading, className = "" } = props;
  return (
    <div className={`flex flex-col gap-[var(--space-8)] items-start w-[171px] ${className}`}>
      <CardImage
        item={item}
        onClick={onClick}
        imageClassName="w-[171px] h-[171px]"
        imageLoading={imageLoading}
      />
      <CardBody
        {...props}
        nameClassName="type-jp-heading-s min-h-[44px]"
      />
    </div>
  );
}

/**
 * カルーセル用（幅200）。
 * 下部は「数量ステッパー＋カートに入れる」の並び。カートのボックスアイコンは入れない
 * （カードごとに置くと画面内で何度も繰り返され、TOPのフローティングカートと役割が重複する）。
 */
export function MenuCardM({
  item,
  quantity,
  onIncrement,
  onDecrement,
  onAddToCart,
  onClick,
  imageLoading,
  className = "",
}: MenuCardProps & {
  /** 「カートに入れる」。押した数量ぶんを一度に入れる */
  onAddToCart: () => void;
}) {
  const categories = useMenuDataStore((s) => s.categories);
  const label = SUBCATEGORY_LABEL[item.subcategory] ?? item.subcategory;
  const color = resolveTagColor(categories, item.subcategory);
  return (
    <div className={`flex flex-col gap-[var(--space-8)] items-start w-[200px] shrink-0 ${className}`}>
      <CardImage
        item={item}
        onClick={onClick}
        imageClassName="w-[200px] h-[200px]"
        imageLoading={imageLoading}
      />
      <CategoryTag label={label} color={color} />
      <p
        className={`type-jp-heading-s text-text-primary w-full line-clamp-2 min-h-[44px] ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        {item.name}
      </p>
      <p className="type-en-price-m text-text-primary whitespace-nowrap">
        ¥{item.price.toLocaleString()}
      </p>
      <div className="flex gap-[var(--space-8)] items-center w-full">
        <QuantityStepperS
          count={quantity}
          min={1}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
        <AddToCartButtonS onClick={onAddToCart} className="flex-1 min-w-0" />
      </div>
    </div>
  );
}

export function MenuCardWide(props: MenuCardProps) {
  const { item, onClick, imageLoading, className = "" } = props;
  return (
    <div className={`flex flex-col gap-[var(--space-8)] items-start w-[300px] ${className}`}>
      <CardImage
        item={item}
        onClick={onClick}
        imageClassName="w-[300px] h-[225px]"
        imageLoading={imageLoading}
      />
      <CardBody
        {...props}
        nameClassName="type-jp-heading-m min-h-[48px]"
      />
    </div>
  );
}
