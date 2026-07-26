/**
 * シェフのイラスト（Figma: Illustration/Chef Smile 395:445）
 * `components/Icon.tsx`とは別枠の、ブランド固有の静止イラスト。
 * SVGは `public/illustrations/chef-smile.svg`（Figmaからそのままエクスポート、
 * 背景矩形は除去済み）。表示サイズはOrder Confirmed画面実測で96×96。
 */
export default function ChefSmileIllustration({
  size = 96,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/illustrations/chef-smile.svg"
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
