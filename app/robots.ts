import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteConfig";

/**
 * /robots.txt を生成する。
 *
 * クロール自体を止めるのは「見せる理由が無い」ものだけ:
 *   /admin … スタッフ用（ログイン必須）
 *   /api  … JSONを返すだけのエンドポイント
 *   /dev  … コンポーネントギャラリー（認証なし・本番導線からリンクなし）
 *
 * 注文フロー（/order, /cart, /complete, /history）はここでは止めない。
 * robots.txt で弾くとページ内の noindex を読んでもらえず、逆に
 * 「URLだけ」インデックスされることがあるため、クロールは許可して
 * <meta name="robots" content="noindex"> で除外する。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/dev/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
