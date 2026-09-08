/**
 * 一覧ページのサブカテゴリー見出し（Figma: Components / 03 Navigation / List Sub Heading、2026-09-08 追加）
 * 左に区分名（JP/Heading/S）、右に件数（JP/Caption）。上部の Tab Nav を押すとここへスクロールする。
 */
export default function ListSubHeading({
  title,
  count,
  className = "",
}: {
  title: string;
  /** 省略時は件数を出さない */
  count?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between pt-[var(--space-20)] pb-[var(--space-8)] ${className}`}>
      <h2 className="type-jp-heading-s text-text-primary">{title}</h2>
      {count !== undefined && (
        <span className="type-jp-caption text-text-secondary">{count}品</span>
      )}
    </div>
  );
}
