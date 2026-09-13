"use client";

/**
 * 横スクロールカルーセルの進捗バー（2026-09-13、天真の指示でドットから置き換え）
 *
 * 旧 Carousel Dots（Figma 594:7928）の置き換え。ドットは「何枚目か」を表していたが、
 * 一番右まで寄せても最後のドットが点灯しない取りこぼしがあった。
 * バーなら枚数に関係なく「右端＝100%」で必ず埋まりきる。
 *
 * 高さ4・角丸2・上下パディング4（天真の指示 2026-09-13。6px は太かった）。
 * 幅は旧ドット（最大7個 ＋ gap6）とほぼ同じ 120 に固定して、行の重さを変えない。
 *
 * 色は**さりげなく**（天真の指摘、2026-09-13。最初は墨で目立ちすぎた）。
 * 地は bg/tertiary、埋まる側は text/disabled。
 * **この2色は天真が Figma の Carousel Progress（1547:13490）で決めた値。**
 * 変えるときは Figma を先に直すこと。
 */

/** 旧ドットの並びとほぼ同じ幅。行の見た目の重さを変えないための固定値 */
const TRACK_WIDTH = 120;

export default function CarouselProgress({
  /**
   * 0〜1。1 は「右端まで見た」＝バーが満タン。
   * **null はスクロールの余地が無い状態**で、このときだけバーを出さない。
   * （1 で消してしまうと、右端まで寄せた瞬間にバーが消える）
   */
  ratio,
  className = "",
}: {
  ratio: number | null;
  className?: string;
}) {
  if (ratio === null) return null;

  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div
      className={`flex items-center justify-center py-[var(--space-4)] ${className}`}
      role="presentation"
    >
      <span
        className="relative block h-[4px] rounded-[2px] bg-bg-tertiary overflow-hidden"
        style={{ width: TRACK_WIDTH }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-[2px] bg-text-disabled"
          /* 指の動きに遅れないよう、幅の追従は短く。
             スクロール中は毎フレーム更新されるので、長いと遅延に見える */
          style={{ width: `${percent}%`, transition: "width 120ms var(--ease-out)" }}
        />
      </span>
    </div>
  );
}
