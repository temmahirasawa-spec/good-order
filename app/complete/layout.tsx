import type { Metadata } from "next";

/* 注文完了画面。受渡番号が出る個別の画面なので noindex。 */
export const metadata: Metadata = {
  title: "ご注文ありがとうございます",
  alternates: { canonical: "/complete" },
  robots: { index: false, follow: false },
};

export default function CompleteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
