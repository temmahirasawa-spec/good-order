import type { Metadata } from "next";

/* ページ本体が client component なので、metadata はこのレイアウトから出す。
   カートは個人の注文内容そのものなので noindex。 */
export const metadata: Metadata = {
  title: "カート",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
