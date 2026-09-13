"use client";

/**
 * 横スクロール領域の「どこまで見たか」を 0〜1 で返す。
 *
 * 定義: (スクロール位置 + 見えている幅) ÷ 中身の全幅。
 *   - 左端 … 見えている範囲の割合（例: 4枚中2枚見えていれば 0.5）
 *   - 右端 … ちょうど 1（＝バーが 100% 埋まる）
 *
 * ドットで「何枚目か」を出す方式をやめた理由（2026-09-13、天真の指摘）:
 *   カード幅からの割り算で現在地を出していたため、**一番右まで寄せても最後のドットが
 *   点灯しなかった**（スクロールの最大値は「カード枚数 × 1枚の幅」より小さいので、
 *   最後の1枚ぶんだけ届かない）。スクロール量そのものから比率を出せばこの取りこぼしは
 *   起きず、カードの幅やガターに依存しなくなる。
 *
 * スクロールの余地が無いとき（1枚だけ等）は **null** を返す。呼び出し側はこれを見て
 * インジケーター自体を出さない。
 * ⚠ ここを「1」で返してはいけない。右端まで見たとき（＝1）と区別がつかず、
 * 一番右までスクロールした瞬間にバーが消える。
 */
import { useEffect, useState, type RefObject } from "react";

/** これ以下の差はスクロールできないものとして扱う（小数の丸め対策） */
const SCROLLABLE_MIN_PX = 1;

export function useScrollProgress(ref: RefObject<HTMLElement | null>): number | null {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= SCROLLABLE_MIN_PX) {
        setRatio(null);   // スクロールできない＝インジケーターを出さない
        return;
      }
      const seen = (el.scrollLeft + el.clientWidth) / el.scrollWidth;
      setRatio(Math.min(1, Math.max(0, seen)));
    };

    /* スクロールは毎フレーム飛んでくるので、描画1回にまとめる */
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    /* 枠の幅（画面回転・PC/SPの切り替え）と、中身の幅（商品が増減する）の
       両方を見る。中身だけが変わると枠のサイズは変わらないため、内側も観測する。 */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const content = el.firstElementChild;
    if (content) observer.observe(content);

    measure();
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);

  return ratio;
}
