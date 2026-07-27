"use client";

/**
 * SP向けの並び替えボタン（Figma: Reorder Buttons 616:8183）
 *
 * スマホではドラッグ&ドロップが実用に耐えないため（長押しでブラウザの
 * コンテキストメニューが出る／ハンドルが小さすぎて掴めない）、
 * SPだけこのボタン式に差し替える。**PCはドラッグのまま**。
 *
 * 丸ではなく長方形（34×26を2つ、全体34×54）なのはタップ領域を稼ぐため。
 * 上下端だけ角丸8・内側2で、ひとつながりの操作単位に見せている。
 *
 * 長押しメニューはドラッグをやめれば出なくなるが、リストの上で指を滑らせたときに
 * テキスト選択が始まるのは別問題なので select-none / touch-manipulation を付けている。
 */
import { Icon } from "@/components/Icon";

export default function ReorderButtons({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
  label,
  className = "",
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** 先頭行 */
  disableUp: boolean;
  /** 最終行 */
  disableDown: boolean;
  /** スクリーンリーダー用に「何を」動かすのか分かるようにする */
  label: string;
  className?: string;
}) {
  const base =
    "flex items-center justify-center w-[34px] h-[26px] bg-bg-tertiary border border-border touch-manipulation select-none";
  return (
    <div className={`flex flex-col gap-[2px] shrink-0 select-none ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
        disabled={disableUp}
        aria-label={`${label} を上へ移動`}
        className={`${base} rounded-t-[8px] rounded-b-[2px] ${disableUp ? "opacity-40" : ""}`}
      >
        <Icon
          name="chevron-up"
          className={`w-3.5 h-3.5 ${disableUp ? "text-text-secondary" : "text-text-primary"}`}
        />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
        disabled={disableDown}
        aria-label={`${label} を下へ移動`}
        className={`${base} rounded-t-[2px] rounded-b-[8px] ${disableDown ? "opacity-40" : ""}`}
      >
        <Icon
          name="chevron-down"
          className={`w-3.5 h-3.5 ${disableDown ? "text-text-secondary" : "text-text-primary"}`}
        />
      </button>
    </div>
  );
}
