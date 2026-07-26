"use client";

/**
 * 横スクロールカルーセル（Figma: Menu Carousel 59:380 / Wide 59:447 / Recommend 86:543）
 * 外側 = overflow-x-auto + クリップ、内側 Content = padding 0 16px + gap 16px の
 * 二層構造（スクロール終端にも 16px の余白が残る）。
 * MenuCardWide の場合、マージン16＋ガター16で 2枚目が 58px はみ出すのが正しい状態。
 *
 * RecommendCarousel のみ、ゆっくり自動横スクロール（左→右、端で反転して往復）する。
 * スクロールできる余地が無い場合（画像1枚等）は自動で無効。
 * ユーザーがタップ/ドラッグ/ホイール操作した時点で自動スクロールは恒久的に停止する。
 */
import { type ReactNode, useEffect, useRef } from "react";

/* かなりゆっくり: 1秒あたり30px（300px幅カード1枚分に約10秒） */
const AUTO_SCROLL_SPEED_PX_PER_SEC = 30;

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

    const stop = () => {
      stopped = true;
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
    };
    el.addEventListener("pointerdown", stop, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });

    const tick = (time: number) => {
      if (stopped) return;
      if (lastTime === null) lastTime = time;
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      // スクロールできる余地が無ければ何もしない（画像1枚のみ等で自動的に無効化）
      const max = el.scrollWidth - el.clientWidth;
      if (max > 1) {
        let next = el.scrollLeft + direction * AUTO_SCROLL_SPEED_PX_PER_SEC * deltaSec;
        if (next >= max) {
          next = max;
          direction = -1;
        } else if (next <= 0) {
          next = 0;
          direction = 1;
        }
        el.scrollLeft = next;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
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
