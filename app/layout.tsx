import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Urbanist } from "next/font/google";
import PageTransition from "@/components/PageTransition";
import { notoSansJP, barlow } from "@/lib/fonts";
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

export const metadata: Metadata = {
  title: "YORKYS BRUNCH | モバイルオーダー",
  description: "YORKYS BRUNCHのモバイルオーダーシステム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FDF8F2",
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
