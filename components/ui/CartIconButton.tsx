"use client";

/**
 * カートボタン（Figma: Cart Icon Button 592:7864）
 * 48px円・白地・枠線・軽い影。右上に数量バッジ（24×24）が重なる。
 *
 * バッジが24pxと大きめなのは、これが「カートに入った」ことを伝える主要な
 * フィードバックだから。数字が増えたときに短くポップさせる。
 *
 * TOPページでは右下のフローティング、商品詳細では下部バーの左端に置く。
 * どちらもタップでカート画面へ遷移する。
 */
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { useHydrated } from "@/hooks/useHydrated";

/** 3桁以上は幅が破綻するので丸める（99個も1卓で頼むことはまず無い） */
function formatCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}

export default function CartIconButton({
  count,
  onClick,
  className = "",
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  const hydrated = useHydrated();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCountRef = useRef(count);

  /* 増えたときだけポップさせる。減ったとき（削除）は静かに変える */
  useEffect(() => {
    if (count > prevCountRef.current) {
      const badge = badgeRef.current;
      if (badge) {
        badge.classList.remove("badge-pop");
        void badge.offsetWidth; // アニメーションを再生し直すためのリフロー
        badge.classList.add("badge-pop");
      }
    }
    prevCountRef.current = count;
  }, [count]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hydrated && count > 0 ? `カートを見る（${count}点）` : "カートを見る"}
      /* プレス・ホバーは共通の土台（globals.css の button / .btn-icon）に任せる */
      className={`btn-icon relative flex items-center justify-center rounded-full bg-surface-white border border-border w-[48px] h-[48px] shrink-0 shadow-[var(--shadow-card)] ${className}`}
    >
      <Icon name="cart" className="w-[22px] h-[22px] text-text-primary" />
      {/* localStorage 由来の個数なので、ハイドレーション完了までバッジを出さない
          （サーバー描画と食い違うとこの境界ごとクライアント再描画になり操作不能になる） */}
      {hydrated && count > 0 && (
        <span
          ref={badgeRef}
          /* ボタンの白背景から浮かせるため2.5pxの白フチ。1桁なら正円、2桁以上は横に伸びる */
          className="absolute -top-[7px] -right-[7px] flex items-center justify-center bg-accent-primary rounded-full min-w-[24px] h-[24px] px-[6px] border-[2.5px] border-surface-white"
        >
          <span className="type-en-data-s text-text-primary leading-none">
            {formatCount(count)}
          </span>
        </span>
      )}
    </button>
  );
}
