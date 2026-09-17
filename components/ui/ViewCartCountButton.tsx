"use client";

/**
 * 「カートを見る」＋右端の数字ピル（Figma: Components / 02 Buttons & CTAs / View Cart Button (Count)）
 *
 * 一覧ページの下部バーで使う。数字は**カートが空でも 0 で出す**（天真の要望 2026-09-17）。
 * 3案（アイコンにバッジ／右端に数字ピル／左に丸ボタンを独立）のうち、数字がいちばん大きい案B。
 *
 * 寸法は Figma どおり: ピル 52px、数字の丸 40px（右 6 / 上 6 の絶対配置）、
 * 数字は EN 22px SemiBold。丸の**下側だけ 2px の余白**があるのは、Barlow の数字が
 * 行の箱の中で下寄りに描かれるのを持ち上げるため（Figma 側と同じ調整）。
 *
 * 動き: 増えたときは数字が下から上へロール（RollingNumber）＋丸が 1.3 倍にはねる（badge-pop）。
 * 減ったとき（削除）はロールだけで、はねない。
 */
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import RollingNumber from "@/components/ui/RollingNumber";

/** 3桁以上は幅が破綻するので丸める */
function formatCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}

export default function ViewCartCountButton({
  count,
  onClick,
  className = "",
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current) {
      const pill = pillRef.current;
      if (pill) {
        pill.classList.remove("badge-pop");
        void pill.offsetWidth; // アニメーションを再生し直すためのリフロー
        pill.classList.add("badge-pop");
      }
    }
    prevCountRef.current = count;
  }, [count]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `カートを見る（${count}点）` : "カートを見る（0点）"}
      className={`btn-pill relative flex gap-[var(--space-8)] h-[var(--size-control-lg)] items-center justify-center rounded-full bg-accent-primary active:bg-accent-pressed w-full shadow-[var(--shadow-card)] ${className}`}
    >
      <Icon name="cart" className="w-[20px] h-[20px] text-accent-contrast" />
      <span className="type-jp-body-bold text-accent-contrast whitespace-nowrap">カートを見る</span>
      <span
        ref={pillRef}
        aria-hidden="true"
        className="absolute right-[6px] top-[6px] flex items-center justify-center w-[40px] h-[40px] pb-[2px] rounded-full bg-surface-white"
      >
        <RollingNumber
          value={formatCount(count)}
          width={count > 99 ? 34 : count > 9 ? 26 : 14}
          height={26}
          className="font-en font-semibold text-[22px] leading-[26px] text-text-primary text-center"
        />
      </span>
    </button>
  );
}
