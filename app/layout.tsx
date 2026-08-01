import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Urbanist } from "next/font/google";
import PageTransition from "@/components/PageTransition";
import { notoSansJP, barlow } from "@/lib/fonts";
import { siteUrl, STORE, SITE_DESCRIPTION, BRAND_BG } from "@/lib/siteConfig";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-urbanist",
  display: "swap",
});

/**
 * サイト共通のメタデータ。
 *
 * 検索に載せるのは TOP（`/`）だけで、注文フロー・カート・履歴・管理画面は
 * 各セグメントの layout で noindex にしている。理由は、
 *   - 注文フローはカート状態に依存する画面で、検索から直接来ても意味を成さない
 *   - `/` はテイクアウト注文の入口として単体で完結している（卓パラメータ無し＝テイクアウト）
 * ため。将来メニュー一覧をSEOに使いたくなったら `app/order/layout.tsx` の robots を外す。
 *
 * favicon / apple-touch-icon / OGP画像 は app/ 直下のファイル規約
 * （icon.png, apple-icon.png, favicon.ico, opengraph-image.jpg）で自動的に付く。
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${STORE.name}｜モバイルオーダー`,
    template: `%s｜${STORE.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: `${STORE.name} モバイルオーダー`,
  keywords: [
    "YORKYS BRUNCH",
    "ヨーキーズブランチ",
    "夙川",
    "西宮",
    "パンケーキ",
    "ブランチ",
    "カフェ",
    "モバイルオーダー",
    "テイクアウト",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: STORE.name,
    url: siteUrl,
    title: `${STORE.name}｜モバイルオーダー`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${STORE.name}｜モバイルオーダー`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: "YORKYS",
    statusBarStyle: "default",
  },
  /* Search Console の「HTMLタグ」方式で所有権を確認するときだけ設定する。
     未設定ならタグ自体が出ない（DNS/ファイル方式なら設定不要）。 */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: BRAND_BG,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${noto.variable} ${urbanist.variable} ${notoSansJP.variable} ${barlow.variable}`}>
      <body className="min-h-screen bg-brand-bg">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
