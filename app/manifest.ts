import type { MetadataRoute } from "next";
import { STORE, SITE_DESCRIPTION, BRAND_BG, basePath } from "@/lib/siteConfig";

/**
 * /manifest.webmanifest を生成する。
 *
 * お客様向けというより、厨房やレジで iPad の「ホーム画面に追加」をしたときに
 * 名前とアイコンがきちんと出るようにするためのもの。
 * standalone にしておくとブラウザのURLバーが消えて、業務中の誤操作が減る。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${STORE.name} モバイルオーダー`,
    short_name: "YORKYS",
    description: SITE_DESCRIPTION,
    lang: "ja",
    // manifest の中身は Next.js が basePath を付けてくれないので手で足す。
    // 抜けると「ホーム画面に追加」したアイコンから起動したときだけ 404 になる。
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: BRAND_BG,
    theme_color: BRAND_BG,
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
