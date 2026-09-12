"use client";

/**
 * 売り切れ（SOLD OUT）の表示部品（docs/specs/sold-out-and-receipt-copies.md 案A「帯」）
 *
 * Figma に対応ノードは無い**新規部品**（2026-09-12。Figma 連携が未認証のため HTML のたたき台で提案）。
 *
 * - SoldOutBand: 写真の上に被せる墨の帯（白抜き「SOLD OUT」）。写真側は opacity で薄くする。
 *   size: sm = 56px のサムネ用（9px）、md = カード用（12px）、lg = 商品詳細の KV 用（20px）
 * - SoldOutPill: 数量ステッパー／「＋」／「カートに入れる」の**代わりに置く**押せないピル。
 *   bg-tertiary 地に text-tertiary の文字で、操作できないことを色で示す。
 *   size: sm = 32（Menu Card M の下段）、md = 36（Quantity Stepper と同じ高さ）、
 *   lg = 52（--size-control-lg。商品詳細の下部バーの CTA と同じ高さ）
 */
import { SOLD_OUT_LABEL } from "@/lib/soldOut";

export function SoldOutBand({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text =
    size === "sm" ? "type-jp-micro-label py-[2px]"
    : size === "lg" ? "type-en-display-s py-[var(--space-8)] tracking-[0.08em]"
    : "type-en-label py-[var(--space-4)]";
  return (
    <div
      aria-label={SOLD_OUT_LABEL}
      role="img"
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}
    >
      <span className={`w-full text-center bg-surface-ink text-text-inverse whitespace-nowrap ${text}`}>
        {SOLD_OUT_LABEL}
      </span>
    </div>
  );
}

export function SoldOutPill({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "sm" ? "h-[32px] px-[var(--space-12)] type-en-label"
    : size === "lg" ? "h-[var(--size-control-lg)] px-[var(--space-24)] type-en-price-s tracking-[0.04em]"
    : "h-[36px] px-[var(--space-16)] type-en-label";
  return (
    <span
      role="status"
      aria-label={SOLD_OUT_LABEL}
      className={`inline-flex items-center justify-center rounded-full bg-bg-tertiary text-text-tertiary whitespace-nowrap select-none ${box} ${className}`}
    >
      {SOLD_OUT_LABEL}
    </span>
  );
}
