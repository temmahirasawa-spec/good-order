import type { Metadata } from "next";

/* 注文履歴。端末に紐づく個人の履歴なので noindex。 */
export const metadata: Metadata = {
  title: "注文履歴",
  alternates: { canonical: "/history" },
  robots: { index: false, follow: false },
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
