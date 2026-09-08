"use client";

/**
 * 行の右端に置く「＋」（Figma: Components / 04 Tags & Steppers / Plus Button、2026-09-08 追加）
 * 見た目は Quantity Stepper の＋と同じ 36px の丸。
 * ただしタップ領域は 44px 確保する（見た目の丸の外側に透明な余白を持つ）。
 * 押すとカートに入れる／オプション（トッピング）のある商品は商品詳細を開く。
 */
export default function PlusButton({
  onClick,
  label = "カートに入れる",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`btn-icon flex items-center justify-center w-[var(--size-touch-min)] h-[var(--size-touch-min)] shrink-0 rounded-full ${className}`}
    >
      <span className="relative block w-[36px] h-[36px] rounded-full bg-surface-white border border-text-primary">
        <span className="absolute left-[11px] top-[16px] w-[12px] h-[2px] rounded-[1px] bg-text-primary" />
        <span className="absolute left-[16px] top-[11px] w-[2px] h-[12px] rounded-[1px] bg-text-primary" />
      </span>
    </button>
  );
}
