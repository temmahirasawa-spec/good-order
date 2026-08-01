import type { Metadata } from "next";

/**
 * 管理画面（ログイン必須）のメタデータだけを担当するレイアウト。
 * 実際の nav chrome と権限ガードは app/admin/(protected)/layout.tsx 側にある。
 *
 * robots.txt でも /admin を Disallow しているが、二重に noindex を出しておく。
 * 万一どこかからリンクされてクロールされても、検索結果に出さないため。
 */
export const metadata: Metadata = {
  title: "スタッフ管理画面",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminMetaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
