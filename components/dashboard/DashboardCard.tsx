"use client";

/**
 * ダッシュボードの白カード共通枠（Figma: SP 438:2897 ほか / PC 290:290 ほか）
 * 角丸16・白背景・パディングSP20/PC24。見出しは JP/Heading/S。
 * カード内の縦gapはカードごとにFigmaで違う（12/14/16）ので props で受ける。
 */
export default function DashboardCard({
  id,
  title,
  headerRight,
  gap = 16,
  className = "",
  children,
}: {
  /** SPのタブナビからアンカースクロールするためのid */
  id?: string;
  title: string;
  /** 見出し行の右端に置く要素（凡例など） */
  headerRight?: React.ReactNode;
  gap?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`bg-surface-white rounded-[var(--radius-lg)] flex flex-col min-w-0 p-[var(--space-20)] lg:px-[var(--space-24)] ${className}`}
      style={{ gap: `${gap}px` }}
    >
      <div className="flex gap-[var(--space-8)] items-start justify-between w-full">
        <h2 className="type-jp-heading-s text-text-primary">{title}</h2>
        {headerRight}
      </div>
      {children}
    </section>
  );
}
