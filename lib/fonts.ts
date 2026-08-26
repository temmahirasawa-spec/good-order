import { Noto_Sans_JP, Barlow } from "next/font/google";

// Weights used across the Figma text styles:
// JP:  500 (Medium, body/caption/label) / 700 (Bold, headings)
// EN:  500 (Medium, labels/display) / 600 (SemiBold, prices) / 700 (Bold, stepper counts)
export const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jp",
  display: "swap",
});

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-en",
  display: "swap",
});

// In app/layout.tsx:
//   <html lang="ja" className={`${notoSansJP.variable} ${barlow.variable}`}>
//
// Price displays should additionally get:
//   className="tabular-nums"
// so digits don't shift width during quantity/price updates.

// ─── HalisR（ブランドフォント）──────────────────────────────
//
// もともと app/globals.css の @font-face に url("/fonts/...") と直書きしていたが、
// **CSS の url() には basePath（店舗ごとのURL接頭辞）が付かない**ため、
// 接頭辞を導入した 2026-08-26 に本番で全ファイルが404になった。
// next/font/local に移すと Next.js が接頭辞込みの正しいURLを生成する。
//
// 参照側（style={{ fontFamily: "HalisR, sans-serif" }} が12箇所）は変えずに済むよう、
// CSS変数 --font-halis を app/globals.css の @font-face 側で受けている。
import localFont from "next/font/local";

export const halisR = localFont({
  src: [
    { path: "../public/fonts/Ahmet Altun - HalisR-Light.otf",   weight: "300", style: "normal" },
    { path: "../public/fonts/Ahmet Altun - HalisR-Book.otf",    weight: "400", style: "normal" },
    { path: "../public/fonts/Ahmet Altun - HalisR-Medium.otf",  weight: "500", style: "normal" },
    { path: "../public/fonts/Ahmet Altun - HalisR-Bold.otf",    weight: "700", style: "normal" },
    { path: "../public/fonts/Ahmet Altun - HalisR-Black.otf",   weight: "900", style: "normal" },
  ],
  variable: "--font-halis",
  display: "swap",
});
