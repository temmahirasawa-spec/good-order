import type { Metadata } from "next";

/* 開発用のコンポーネントギャラリー。robots.txt でも弾いているが二重に noindex。 */
export const metadata: Metadata = {
  title: "UI ギャラリー（開発用）",
  robots: { index: false, follow: false, nocache: true },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
