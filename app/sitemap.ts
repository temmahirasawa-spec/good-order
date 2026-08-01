import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteConfig";

/**
 * /sitemap.xml を生成する。
 *
 * 載せるのは検索に出したいURLだけ、という原則どおり TOP の1件のみ。
 * 注文フローは noindex なので、ここに書くと Search Console で
 * 「送信されたURLに noindex タグが追加されています」エラーになる。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
