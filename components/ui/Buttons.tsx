"use client";

/**
 * ボタン群（Figma: Add to Cart Button 107:138 / Cart Button 107:130 /
 * Back Button 110:139 / Link Button 127:154）
 */
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

/* ── メインCTA（大）。accent/primary 塗り × 黒文字。押下時は accent/pressed ── */
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
      <span className="type-jp-body-bold text-text-primary whitespace-nowrap">
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
      <span className="type-jp-caption-bold text-text-primary whitespace-nowrap">
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
            <span className="font-en font-semibold text-[10px] leading-normal text-text-primary whitespace-nowrap tabular-nums">
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
  className = "",
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  /* Link は <a> なので、button 前提の共通プレスが効かない。pressable を明示する */
  const base = `pressable flex gap-[var(--space-4)] items-center justify-center p-[var(--space-16)] rounded-xs border border-text-secondary ${className}`;
  const content = (
    <>
      <Icon name={icon} className="w-4 h-4 text-text-secondary shrink-0" />
      <span className="type-jp-body-bold text-text-secondary whitespace-nowrap">
        {label}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={base}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  );
}
