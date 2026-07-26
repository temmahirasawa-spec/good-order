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
