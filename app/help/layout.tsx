import type { Metadata } from "next";
import Link from "next/link";
import { HELP_PARTS } from "@/lib/help/content";

/**
 * 使い方マニュアル（/help）の外枠。認証なし・課金なしで誰でも読める公開ページ。
 * 検索エンジンには今は載せない（製品版で整理してから載せる。2026-09-18）。
 */
export const metadata: Metadata = {
  title: { default: "使い方", template: "%s | GOOD ORDER 使い方" },
  robots: { index: false, follow: false },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-30 bg-surface-white border-b border-border-divider">
        <div className="mx-auto max-w-[1040px] px-[var(--space-16)] h-[56px] flex items-center justify-between">
          <Link href="/help" className="type-en-label text-text-primary tracking-wide">GOOD ORDER / 使い方</Link>
          <nav className="hidden md:flex gap-[var(--space-16)]">
            {HELP_PARTS.map((p) => (
              <Link key={p.slug} href={`/help/${p.slug}`} className="type-jp-caption-bold text-text-secondary hover:text-text-primary">
                第{p.no}部 {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1040px] px-[var(--space-16)] py-[var(--space-24)]">{children}</div>
    </div>
  );
}
