"use client";

/**
 * 縦に並んだ区画（セクション）と、上に貼り付くタブの現在地を合わせる。
 *
 * 2026-09-13 に作った。それまでは各ページが
 *   - `SCROLL_OFFSET = 118`（＝ヘッダー68＋タブ50）の**決め打ち**
 *   - IntersectionObserver の `rootMargin: -118px 0px -50% 0px` で「帯に入っているか」
 * で現在地を出していて、実機で次の3つが起きていた（天真・洋輔さんの指摘）:
 *
 *   1. **タブを押した先がずれる**（パスタを押すとサラダに飛ぶ）
 *      決め打ちの118pxが実際の貼り付き位置と合っていないと、その差だけ行き過ぎる／届かない。
 *   2. **押した区画にいるのにタブが前の区画のまま**（ピザを見ているのにパスタが選択中）
 *      タブを押して止まった位置では、目的の区画の上端が**ちょうど帯の境界線の上**に来る。
 *      境界が重なると `isIntersecting` が false になり、下にはみ出している前の区画が勝つ。
 *   3. **タブが押しにくい**
 *      スクロール中に現在地が次々変わり、そのたびに TabNav が横スクロールで追従するため、
 *      指が狙っているタブが動く。
 *
 * 直し方:
 *   - 貼り付き位置は **DOM から測る**（sticky の `top` ＋ 実際の高さ）。決め打ちをやめる。
 *   - 現在地は「**上端が境界線を越えた最後の区画**」で決める。真偽ではなく位置で決めるので、
 *     境界が重なっても取りこぼさない。
 *   - タブを押したら**すぐその区画を選択状態にし、スクロールが落ち着くまで監視を止める**。
 *     これで横スクロールの追従が1回で済み、タブが動かなくなる。
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** 監視を止めておく時間。smooth スクロールが落ち着くまでの目安 */
const LOCK_MS = 900;
/** 境界線の判定に持たせる余裕（小数の丸め対策） */
const EPSILON = 2;

/**
 * 上に貼り付くバーの「下端」を返す＝本文が始まるべき位置。
 * sticky の `top`（CSS）＋ 自身の高さ。画面のどこにいても同じ値になる。
 */
export function stickyBottom(el: HTMLElement | null, fallback: number): number {
  if (!el) return fallback;
  const top = parseFloat(getComputedStyle(el).top);
  const height = el.offsetHeight;
  if (!Number.isFinite(top) || height === 0) return fallback;
  return Math.round(top + height);
}

export interface SectionSpy {
  /** いま見ている区画の id */
  active: string;
  /** タブを押したときに呼ぶ。その区画の先頭まで送る */
  jumpTo: (id: string) => void;
}

export function useSectionSpy({
  ids,
  navRef,
  enabled = true,
  fallbackOffset,
}: {
  /** 区画の id を**画面に並んでいる順**で渡す。要素は `section-<id>` で引く */
  ids: string[];
  /** 上に貼り付くタブのバー（sticky な外枠） */
  navRef: RefObject<HTMLElement | null>;
  /** 読み込み中などで区画がまだ無いときは false */
  enabled?: boolean;
  /** バーが測れないときに使う値（従来の決め打ち） */
  fallbackOffset: number;
}): SectionSpy {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const lockUntil = useRef(0);
  /* 依存配列に配列そのものを入れると毎回作り直しになるので、中身を文字列で見る */
  const key = ids.join("|");

  const offset = useCallback(
    () => stickyBottom(navRef.current, fallbackOffset),
    [navRef, fallbackOffset]
  );

  const jumpTo = useCallback(
    (id: string) => {
      const el = document.getElementById(`section-${id}`);
      if (!el) return;
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset());
      const startY = window.scrollY;
      /* 押した瞬間に選択を移す。スクロールの途中で他の区画を拾わせない */
      setActive(id);
      lockUntil.current = Date.now() + LOCK_MS;
      window.scrollTo({ top, behavior: "smooth" });
      /* reduced-motion や自動化ブラウザでは smooth が無視されて動かないことがある。
         少し待って開始位置から動いていなければ即時ジャンプに切り替える */
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - top) > 4 && Math.abs(window.scrollY - startY) < 4) {
          window.scrollTo(0, top);
        }
      }, 250);
    },
    [offset]
  );

  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    /* 区画が入れ替わったら、いまの選択が無くなっていないか直す */
    setActive((cur) => (ids.includes(cur) ? cur : ids[0]));

    let frame = 0;
    const measure = () => {
      if (Date.now() < lockUntil.current) return;
      const line = offset() + EPSILON;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(`section-${id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;   // 以降は画面のもっと下。並び順に見ているので打ち切ってよい
      }
      /* 一番下まで来たら最後の区画を選ぶ。最後が短いと上端が線を越えないため */
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    /* 指で動かし始めたら、押した直後の固定はすぐ解く（お客様の操作を優先する） */
    const release = () => { lockUntil.current = 0; };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("wheel", release);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, offset]);

  return { active, jumpTo };
}
