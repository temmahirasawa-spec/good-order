"use client";

/**
 * 値が変わったときに数字を入れ替えて見せる表示（スタイルは globals.css の `.count`）。
 *
 * 今の数字が下へ抜けると同時に、次の数字が上から入る。2つが**同じ向き**に動くので、
 * 切り替わりの瞬間にすれ違って重なることがない。
 *
 * 実装メモ: 退場と入場を**別々のDOM要素**として描き分けている。
 * 同じ要素に `is-entering` と `is-leaving` を付け替える作りにすると、
 * 2つの animation が競合してCSSの後勝ちで入場が再生され、
 * 「最初の1回だけ正常で、2回目以降は前の数字が残る」という症状になる。
 * seq をキーに含めて毎回作り直すことで、この競合自体を起こさない。
 *
 * 連打されたときは、退場中の数字が残ったまま次が積み重なると三重に見えるので、
 * seq が進んだ時点で古い退場要素は（キーが変わるので）即座に外れる。
 */
import { useEffect, useState } from "react";

export default function RollingNumber({
  value,
  width,
  height,
  className = "",
}: {
  value: number | string;
  /** 桁が増えても隣がズレないよう、幅は呼び出し側で固定する */
  width: number;
  /** 抜けていく数字を隠すため overflow:hidden を効かせる箱の高さ */
  height: number;
  className?: string;
}) {
  const [state, setState] = useState<{
    current: number | string;
    leaving: number | string | null;
    seq: number;
  }>({ current: value, leaving: null, seq: 0 });

  useEffect(() => {
    setState((s) =>
      value === s.current ? s : { current: value, leaving: s.current, seq: s.seq + 1 }
    );
  }, [value]);

  const { current, leaving, seq } = state;

  return (
    <span className={`count ${className}`} style={{ width, height }}>
      {leaving !== null && (
        <span
          key={`out-${seq}`}
          className="is-leaving"
          aria-hidden="true"
          /* 削除は setTimeout ではなく animationend で行う。
             速度トークンを変えたとき固定値だと消えるタイミングがずれるため */
          onAnimationEnd={() =>
            setState((s) => (s.seq === seq ? { ...s, leaving: null } : s))
          }
        >
          {leaving}
        </span>
      )}
      {/* seq をキーに含めることで毎回作り直され、入場アニメが確実に再生される */}
      <span key={`in-${seq}`} className={seq === 0 ? undefined : "is-entering"}>
        {current}
      </span>
    </span>
  );
}
