"use client";

/**
 * ボタン群（Figma: Add to Cart Button 107:138 / Cart Button 107:130 /
 * Back Button 110:139 / Link Button 127:154）
 */
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

/* ── メインCTA（大）。accent/primary 塗り × accent/contrast の文字（黄なら墨、モスなら白）。押下時は accent/pressed ── */
export function AddToCartButton({
  label,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-pill flex gap-[var(--space-8)] h-[var(--size-control-lg)] items-center justify-center rounded-full bg-accent-primary active:bg-accent-pressed disabled:opacity-40 w-full shadow-[var(--shadow-card)] ${className}`}
    >
      {/* 320px のような極端に狭い端末でボタンから文字がはみ出さないようにする。
          390px では収まるので省略記号は出ない（2026-09-16） */}
      <span className="type-jp-body-bold text-accent-contrast whitespace-nowrap overflow-hidden text-ellipsis px-[var(--space-4)]">
        {label}
      </span>
    </button>
  );
}

/* ── カルーセルカード用の小型CTA（Figma: Add to Cart Button S 601:8136）
 *  108×32・角丸full・accent/primary。Menu Card M（幅200）で
 *  Quantity Stepper S（84）と8pxのgapで並べると 84+8+108=200 に収まる ── */
export function AddToCartButtonS({
  label = "カートに入れる",
  onClick,
  className = "",
}: {
  label?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-pill flex h-[32px] items-center justify-center rounded-full bg-accent-primary active:bg-accent-pressed px-[var(--space-12)] ${className}`}
    >
      <span className="type-jp-caption-bold text-accent-contrast whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

/* ── カートを見る（小）。白地 + 枠線 + 影、黄色バッジ +「カート」ラベル ── */
export function CartButton({
  count,
  onClick,
  className = "",
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="カートを見る"
      className={`btn-pill flex gap-[var(--space-8)] h-[var(--size-control-lg)] items-center rounded-full bg-surface-white border border-border pl-[18px] pr-[20px] shadow-[var(--shadow-card)] ${className}`}
    >
      <span className="relative block w-[30px] h-[26px] shrink-0">
        <Icon name="cart" className="absolute left-0 top-[8px] w-4 h-4 text-text-primary" />
        {count > 0 && (
          <span className="absolute left-[11px] top-0 bg-accent-primary rounded-full px-[5px] py-px">
            <span className="font-en font-semibold text-[10px] leading-normal text-accent-contrast whitespace-nowrap tabular-nums">
              {count}
            </span>
          </span>
        )}
      </span>
      <span className="type-jp-body-bold text-text-primary whitespace-nowrap">
        カート
      </span>
    </button>
  );
}

/* ── 「カートを見る」（大）。アクセント地のピルに、カートのアイコン＋個数バッジ＋文字。
 *  商品詳細シートで「カートに入れる」を押したあと、下部バーが丸ごとこれに切り替わる。
 *
 *  ⚠ **カートアイコンと文字を分けない。** 2026-09-16、天真の指示:
 *    「この2つのリンク先は同じなので分離してるとおかしい」
 *    それまで下部バーは「カートアイコン」と「カートに入れる」が別部品で並んでいた。 ── */
export function ViewCartButton({
  count,
  onClick,
  className = "",
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `カートを見る（${count}点）` : "カートを見る"}
      className={`btn-pill flex gap-[var(--space-8)] h-[var(--size-control-lg)] items-center justify-center rounded-full bg-accent-primary active:bg-accent-pressed w-full shadow-[var(--shadow-card)] ${className}`}
    >
      <span className="relative block w-[26px] h-[22px] shrink-0">
        <Icon name="cart" className="absolute left-0 top-[6px] w-4 h-4 text-accent-contrast" />
        {count > 0 && (
          <span className="absolute left-[10px] top-0 bg-surface-white rounded-full px-[5px] py-px">
            <span className="font-en font-semibold text-[10px] leading-normal text-text-primary whitespace-nowrap tabular-nums">
              {count}
            </span>
          </span>
        )}
      </span>
      <span className="type-jp-body-bold text-accent-contrast whitespace-nowrap">
        カートを見る
      </span>
    </button>
  );
}

/* ── 円形の戻る/閉じるボタン（48px）。カート・詳細ページのヘッダー用 ── */
export function BackButton({
  onClick,
  icon = "arrow-left",
  label,
  className = "",
}: {
  onClick: () => void;
  /** アイコン差し替え（詳細ページの「閉じてホームへ」は "close" を使用） */
  icon?: IconName;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (icon === "close" ? "閉じる" : "戻る")}
      className={`btn-icon flex items-center justify-center rounded-full bg-surface-white border border-border w-[48px] h-[48px] shrink-0 shadow-[var(--shadow-card)] ${className}`}
    >
      <Icon name={icon} className="w-4 h-4 text-text-primary" />
    </button>
  );
}

/* ── リンクボタン（1px枠線 text-secondary、角丸 radius-xs、文字・アイコンとも text-secondary）
 *  2カラム均等グリッドで使用（メニュー画面ではカラム間・行間とも 16px） ── */
export function LinkButton({
  icon,
  label,
  href,
  onClick,
  /** 行き先が無いときは押せなくする（例: テイクアウトの商品が1つも無い） */
  disabled = false,
  /** ラベルの後ろに小さく添える補足（例「準備中」）。長い文字で行が詰まらないように分ける */
  note,
  className = "",
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  note?: string;
  className?: string;
}) {
  /* Link は <a> なので、button 前提の共通プレスが効かない。pressable を明示する */
  const tone = disabled ? "border-border text-text-tertiary" : "border-text-secondary";
  /* 左右の余白は px-12 に抑える。p-16 だと「テイクアウト（準備中）」のような
     長いラベルで文字が枠に張り付いて見えた（天真の指摘 2026-09-15） */
  const base = `flex gap-[var(--space-4)] items-center justify-center px-[var(--space-12)] py-[var(--space-16)] rounded-xs border ${tone} ${
    disabled ? "opacity-60 cursor-default" : "pressable"
  } ${className}`;
  const content = (
    <>
      <Icon
        name={icon}
        className={`w-4 h-4 shrink-0 ${disabled ? "text-text-tertiary" : "text-text-secondary"}`}
      />
      <span
        className={`type-jp-body-bold whitespace-nowrap min-w-0 truncate ${
          disabled ? "text-text-tertiary" : "text-text-secondary"
        }`}
      >
        {label}
      </span>
      {/* 補足は一段小さく。ラベルと同じ大きさだと2つの用件が並んで見える */}
      {note && (
        <span className="type-jp-caption text-text-tertiary whitespace-nowrap shrink-0">
          {note}
        </span>
      )}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={base}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} className={base}>
      {content}
    </button>
  );
}
