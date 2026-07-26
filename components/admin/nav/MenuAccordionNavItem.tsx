"use client";

/**
 * メニュー関連のアコーディオンナビ項目（Figma: Menu Accordion 320:2118）
 * /admin/menu 配下にいる間は自動で開く。それ以外では手動で開閉できる。
 *
 * 親行（「メニュー」）は常にプレーン表示で、Activeのink反転は**サブ項目側**に付ける
 * （Figmaのテンプレート 309:279 でも、カテゴリ管理を開いている状態で親行は白のまま、
 *   サブ項目「カテゴリ管理」だけがinkになっている）。
 *
 * サブ項目のアイコンはプラス（アイコン枠は他のナビ項目と同じ16px、プラス自体が12px）。
 * ラベルは JP/Body Small（13px）。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

const SUB_ITEMS = [
  { href: "/admin/menu", label: "メニュー管理" },
  { href: "/admin/menu/categories", label: "カテゴリ管理" },
] as const;

export default function MenuAccordionNavItem({
  pathname,
  onNavigate,
}: {
  pathname: string;
  /** ナビ項目タップ後の後処理（ドロワーを閉じる等）。サイドバーでは不要 */
  onNavigate?: () => void;
}) {
  const isMenuArea = pathname.startsWith("/admin/menu");
  const [open, setOpen] = useState(isMenuArea);

  useEffect(() => {
    if (isMenuArea) setOpen(true);
  }, [isMenuArea]);

  /* "/admin/menu" は完全一致で判定する（"/admin/menu/categories" と衝突させない） */
  const isActive = (href: string) =>
    href === "/admin/menu" ? pathname === "/admin/menu" : pathname.startsWith(href);

  return (
    <div className="flex flex-col gap-[var(--space-2)] w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[44px] items-center justify-between p-[var(--space-12)] rounded-[var(--radius-sm)] w-full"
      >
        <span className="flex gap-[var(--space-12)] items-center">
          <Icon name="list" className="shrink-0 w-4 h-4 text-text-primary" />
          <span className="type-jp-body text-text-primary">メニュー</span>
        </span>
        <Icon
          name="chevron-down"
          className={`shrink-0 w-3.5 h-3.5 text-text-primary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-[var(--space-2)] pl-[28px] w-full">
          {SUB_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex gap-[var(--space-12)] h-[44px] items-center p-[var(--space-12)] rounded-[var(--radius-sm)] w-full ${
                  active ? "bg-surface-ink" : ""
                }`}
              >
                <Icon
                  name="plus"
                  className={`shrink-0 w-4 h-4 ${active ? "text-text-inverse" : "text-text-primary"}`}
                />
                <span
                  className={`font-jp font-medium text-[13px] leading-[1.5] tracking-[0.01em] ${
                    active ? "text-text-inverse" : "text-text-primary"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
