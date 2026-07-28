"use client";

/**
 * 横スクロールカルーセル（Figma: Menu Carousel 59:380 / Wide 59:447 / Recommend 86:543）
 * 外側 = overflow-x-auto + クリップ、内側 Content = padding 0 16px + gap 16px の
 * 二層構造（スクロール終端にも 16px の余白が残る）。
 * MenuCardWide の場合、マージン16＋ガター16で 2枚目が 58px はみ出すのが正しい状態。
 *
 * RecommendCarousel のみ、ゆっくり自動横スクロール（左→右、端で反転して往復）する。
 * スクロールできる余地が無い場合（画像1枚等）は自動で無効。
 * ユーザーが触っている間は止まり、指を離してしばらくすると再開する。
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import CarouselDots from "@/components/ui/CarouselDots";

/* かなりゆっくり: 1秒あたり30px（300px幅カード1枚分に約10秒） */
const AUTO_SCROLL_SPEED_PX_PER_SEC = 30;
/* 操作をやめてから自動スクロールが再開するまでの待ち時間 */
const AUTO_SCROLL_RESUME_MS = 2000;

function ScrollRow({
  children,
  className = "",
  autoScroll = false,
}: {
  children: ReactNode;
  className?: string;
  autoScroll?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;

    let direction: 1 | -1 = 1;
    let stopped = false;
    let lastTime: number | null = null;
    let rafId = 0;
    /* 現在位置は自前で持つ。el.scrollLeft を読み戻して足し込むと、
       1フレームあたりの移動量（30px/秒 ≒ 0.5px）がブラウザ側の丸めに
       飲まれてしまい、位置が永久に進まないことがある（iOS Safari は整数丸め）。 */
    let pos = el.scrollLeft;
    /* 触っている間は止める。恒久停止にすると、詳細を縦スクロールしようとした指が
       たまたまカルーセルに乗っただけで二度と動かなくなるので、離してから再開する。 */
    let resumeAt = 0;

    const pause = () => {
      resumeAt = performance.now() + AUTO_SCROLL_RESUME_MS;
    };
    const PAUSE_EVENTS = [
      "pointerdown",
      "pointerup",
      "wheel",
      "touchstart",
      "touchmove",
      "touchend",
    ] as const;
    PAUSE_EVENTS.forEach((t) => el.addEventListener(t, pause, { passive: true }));

    const tick = (time: number) => {
      if (stopped) return;
      if (lastTime === null) lastTime = time;
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      // スクロールできる余地が無ければ何もしない（画像1枚のみ等で自動的に無効化）
      const max = el.scrollWidth - el.clientWidth;
      if (max > 1) {
        if (time < resumeAt) {
          // 停止中はユーザーが動かした位置に追従しておく（再開時に飛ばないように）
          pos = el.scrollLeft;
        } else {
          pos += direction * AUTO_SCROLL_SPEED_PX_PER_SEC * deltaSec;
          if (pos >= max) {
            pos = max;
            direction = -1;
          } else if (pos <= 0) {
            pos = 0;
            direction = 1;
          }
          el.scrollLeft = pos;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      PAUSE_EVENTS.forEach((t) => el.removeEventListener(t, pause));
    };
  }, [autoScroll]);

  return (
    <div
      ref={scrollRef}
      className={`overflow-x-auto overflow-y-hidden ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      <div
        className="flex w-max"
        style={{ padding: "0 var(--space-16)", gap: "var(--space-16)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function MenuCarousel(props: { children: ReactNode; className?: string }) {
  return <ScrollRow {...props} />;
}

export function MenuCarouselWide(props: { children: ReactNode; className?: string }) {
  return <ScrollRow {...props} />;
}

export function RecommendCarousel(props: { children: ReactNode; className?: string }) {
  return <ScrollRow {...props} autoScroll />;
}

/* Menu Card M（200）＋ カード間12。1枚目 x=16、2枚目 x=228 なので
   画面幅390に対して2枚目の右が38pxはみ出す。この「見切れ」が
   スライドできることの手がかりなので、scroll-snap 等で潰さないこと。 */
const CARD_M_WIDTH = 200;
const CARD_M_GAP = 12;

/**
 * カテゴリごとの横スワイプカルーセル（Menu Card M 用）＋ ドットページネーション。
 * ドットはスクロール量から現在地を割り出す（IntersectionObserverだとカードが
 * 常に2枚見えている状態で「どちらがアクティブか」を決めきれないため）。
 */
export function MenuCarouselM({
  count,
  children,
  className = "",
}: {
  /** ドットの数＝カード枚数 */
  count: number;
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = CARD_M_WIDTH + CARD_M_GAP;
    const max = Math.max(0, count - 1);
    setActive(Math.min(max, Math.max(0, Math.round(el.scrollLeft / step))));
  }, [count]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [update]);

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex w-max"
          style={{ padding: "0 var(--space-16)", gap: `${CARD_M_GAP}px` }}
        >
          {children}
        </div>
      </div>
      <CarouselDots total={count} active={active} className="mt-[var(--space-12)]" />
    </div>
  );
}
