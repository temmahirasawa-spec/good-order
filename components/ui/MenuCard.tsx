"use client";

/**
 * メニューカード（Figma: Menu Card 49:21 / Menu Card Wide 52:251 / Menu Card M 594:7910）
 * - MenuCard: 幅171 = (390 − 16×2 − ガター16) ÷ 2。画像は正方形 171×171。グリッド用
 * - MenuCardWide: 横スライド用 幅300。画像は 4:3（300×225）
 * - MenuCardM: カテゴリカルーセル用 幅200。画像は正方形 200×200。
 *   下部が「ステッパー＋カートに入れる」の2要素なので専用の小型部品を使う
 * - バッジ: 燕尾ノッチ型リボン 48×64（accent-deep 地 + 王冠 + item.tag）
 * - 売り切れ（item.isSoldOut、docs/specs/sold-out-and-receipt-copies.md 案A）:
 *   写真を薄くして（.sold-out-photo）墨の帯「SOLD OUT」を重ねる（写真がある商品だけ）。
 *   ステッパー／「カートに入れる」は押せないピルに置き換える。
 *   タップで商品詳細は開ける（何が売り切れたかは見られる）
 */
import type { MenuItem } from "@/lib/menu";
import { Icon } from "@/components/Icon";
import CategoryTag from "@/components/ui/CategoryTag";
import QuantityStepper from "@/components/ui/QuantityStepper";
import QuantityStepperS from "@/components/ui/QuantityStepperS";
import { AddToCartButtonS } from "@/components/ui/Buttons";
import { resolveCategoryLabel, resolveTagColor } from "@/lib/categoryLabels";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { SoldOutBand, SoldOutPill } from "@/components/ui/SoldOut";

export interface MenuCardProps {
  item: MenuItem;
  /** **これから何個入れるか**の下書き（カートの中身ではない）。hooks/useDraftQuantities.ts */
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** 「カートに入れる」。下書きの数ぶんを一度に入れる。
   *  ドリンクでは「詳細を見る」として詳細シートを開く（lib/listAction.ts） */
  onAddToCart: () => void;
  /** ボタンの文言。省略すると「カートに入れる」 */
  addLabel?: string;
  /** ボタンの見た目。詳細を開く副操作は "line"（白地に枠） */
  addVariant?: "fill" | "line";
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
  const soldOut = item.isSoldOut === true;
  return (
    /* menu-card はホバー時の影とズームの起点。カード全体ではなく画像ブロックに
       掛けているのは、カード本体には背景が無く、影だけが浮いて見えてしまうため */
    <div
      className={`menu-card relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 ${imageClassName} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading={imageLoading}
          className={`menu-card__img absolute inset-0 w-full h-full object-cover ${soldOut ? "sold-out-photo" : ""}`}
        />
      )}
      {/* 売り切れは墨の帯。リボン（人気など）は帯と喧嘩するので出さない。
          **写真が無い商品では帯を出さない**。灰色の空箱に帯だけが乗ると
          「画像の読み込みに失敗した」ように見えるため（天真の指摘、2026-09-13）。
          この場合の「売り切れ」は下のピルが伝える。 */}
      {soldOut ? src && <SoldOutBand /> : item.tag && <RibbonBadge label={item.tag} />}
    </div>
  );
}

function CardBody({
  item,
  quantity,
  onIncrement,
  onDecrement,
  onAddToCart,
  addLabel,
  addVariant,
  onClick,
  hideTag,
  nameClassName,
}: MenuCardProps & { nameClassName: string }) {
  const categories = useMenuDataStore((s) => s.categories);
  const label = resolveCategoryLabel(categories, item.subcategory);
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
      {item.isSoldOut ? (
        <SoldOutPill className="w-full" />
      ) : (
        /* **縦に積む**（天真の決定 2026-09-16）。
           「カートに入れる（小）」108 ＋ gap 8 ＋ ステッパー（小）84 = 200 で、
           このカードの幅 171 には横並びで入らない。TOP のカルーセル（幅200）だけが入る。
           ステッパーは**下書きの数量**で、カートに入るのは下のボタンを押したときだけ */
        <div className="flex flex-col gap-[var(--space-8)] w-full">
          <QuantityStepper
            count={quantity}
            min={1}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            className="w-full"
          />
          <AddToCartButtonS onClick={onAddToCart} label={addLabel} variant={addVariant} className="w-full" />
        </div>
      )}
    </>
  );
}

export function MenuCard(props: MenuCardProps) {
  const { item, onClick, imageLoading, className = "" } = props;
  return (
    /* 幅は「171 を上限に、列幅いっぱい」。390px では従来どおり 171 だが、374px 未満の端末
       （Android の 360px、iPhone の表示拡大 320px）では列幅 (vw−32−8)/2 が 171 を下回り、
       固定幅のままだと隣のカードと重なって**隣の商品がカートに入る**（2026-09-16 の裏取り C1） */
    <div className={`flex flex-col gap-[var(--space-8)] items-start w-full max-w-[171px] ${className}`}>
      <CardImage
        item={item}
        onClick={onClick}
        imageClassName="w-full aspect-square"
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
  addLabel,
  addVariant,
  onClick,
  imageLoading,
  className = "",
}: MenuCardProps & {
  /** 「カートに入れる」。押した数量ぶんを一度に入れる */
  onAddToCart: () => void;
}) {
  const categories = useMenuDataStore((s) => s.categories);
  const label = resolveCategoryLabel(categories, item.subcategory);
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
      {item.isSoldOut ? (
        <SoldOutPill size="sm" className="w-full" />
      ) : (
        <div className="flex gap-[var(--space-8)] items-center w-full">
          <QuantityStepperS
            count={quantity}
            min={1}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
          <AddToCartButtonS onClick={onAddToCart} label={addLabel} variant={addVariant} className="flex-1 min-w-0" />
        </div>
      )}
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
