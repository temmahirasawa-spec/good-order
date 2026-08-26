import type { MetadataRoute } from "next";
import { siteUrl, basePath } from "@/lib/siteConfig";

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
 *
 * disallow のパスに basePath を足しているのは、robots.txt の記法が
 * 「ドメインの先頭からの絶対パス」だから。店舗の接頭辞が付いた本番では
 * `/admin` と書いてもドメイン直下の /admin を指してしまい、実際の
 * /yorkys-shukugawa/admin には効かない。
 *
 * ⚠ 既知の制約: basePath を使うと、この robots.txt 自体も
 * `/yorkys-shukugawa/robots.txt` に出る。検索エンジンはドメイン直下の
 * `/robots.txt` しか読まないため、本番では事実上「robots.txt なし」の扱いになる。
 * /admin と /dev は各ページの noindex メタで除外済みなので実害は無いが、
 * 将来 app.good-order.jp のルートに振り分け役のプロジェクトを置いたら、
 * そちらに全店舗ぶんの robots.txt を出すこと。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [`${basePath}/admin`, `${basePath}/api/`, `${basePath}/dev/`],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
