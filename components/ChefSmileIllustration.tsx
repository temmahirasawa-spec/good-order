/**
 * シェフのイラスト（Figma: Illustration/Chef Smile 395:445）
 * `components/Icon.tsx`とは別枠の、ブランド固有の静止イラスト。
 * SVGは `public/illustrations/chef-smile.svg`（Figmaからそのままエクスポート、
 * 背景矩形は除去済み）。表示サイズはOrder Confirmed画面実測で96×96。
 *
 * ⚠ **必ず asset() を通すこと。** 本番は接頭辞つきのURL（/yorkys-shukugawa/...）で
 * 動いているので、"/illustrations/..." と直に書くとドメイン直下を見に行って
 * 画像が割れる。2026-09-15 に洋輔さんの指摘で発覚（完了画面のイラストが
 * 「?」の四角になっていた）。/dev/ui のサムネでも同じことをやっている。
 */
import { asset } from "@/lib/siteConfig";

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
      src={asset("/illustrations/chef-smile.svg")}
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
