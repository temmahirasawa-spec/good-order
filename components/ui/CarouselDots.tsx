"use client";

/**
 * カルーセルのドットページネーション（Figma: Carousel Dots 594:7928）
 * 非アクティブ 6×6 / アクティブ 18×6（横長）、角丸3、gap6、上下パディング4。
 *
 * 件数が多いカテゴリだとドットが横に伸びて逆に読みづらいので、
 * **最大7個までに間引く**（先頭・末尾は必ず残し、現在地の前後を優先して見せる）。
 * 位置の把握が目的でジャンプ操作は想定していないため、間引いても機能は損なわない。
 */

const MAX_DOTS = 7;

/** 表示するインデックスの集合を作る。total <= MAX_DOTS ならそのまま全部 */
function visibleIndexes(total: number, active: number): number[] {
  if (total <= MAX_DOTS) return Array.from({ length: total }, (_, i) => i);
  const half = Math.floor((MAX_DOTS - 2) / 2);
  const start = Math.max(1, Math.min(active - half, total - MAX_DOTS + 1));
  const middle = Array.from({ length: MAX_DOTS - 2 }, (_, i) => start + i);
  return [0, ...middle.filter((i) => i > 0 && i < total - 1), total - 1];
}

export default function CarouselDots({
  total,
  active,
  className = "",
}: {
  total: number;
  active: number;
  className?: string;
}) {
  if (total <= 1) return null;
  const indexes = visibleIndexes(total, active);
  return (
    <div
      className={`flex gap-[6px] items-center justify-center py-[var(--space-4)] ${className}`}
      role="presentation"
    >
      {indexes.map((i) => (
        <span
          key={i}
          className={`h-[6px] rounded-[3px] transition-all duration-200 ${
            i === active ? "w-[18px] bg-surface-ink" : "w-[6px] bg-border"
          }`}
        />
      ))}
    </div>
  );
}
