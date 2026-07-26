"use client";

/**
 * Nav Sidebar v2 / Nav Drawer で共有するナビ本体（ロゴ以外の中身）。
 * ワードマーク・ナビ項目一覧・下部のスタッフ名+ログアウトはここに集約し、
 * 外枠（幅・高さ・背景・境界線 or 影）だけをそれぞれのラッパーが持つ。
 */
import { usePathname } from "next/navigation";
import NavItem from "@/components/admin/nav/NavItem";
import MenuAccordionNavItem from "@/components/admin/nav/MenuAccordionNavItem";
import { ADMIN_NAV_ITEMS, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/staffRoles";
import type { IconName } from "@/components/Icon";

/* href → アイコン（ADMIN_NAV_ITEMSにアイコンを持たせるとui非依存のlibにIconName依存が
   漏れるため、表示専用のこのマッピングをコンポーネント側に置く） */
const NAV_ICONS: Record<string, IconName> = {
  "/admin/dashboard": "dashboard",
  "/admin/kitchen":   "flame",
  "/admin/register":  "receipt",
  "/admin/pickup":    "check",
  "/admin/takeout":   "bag",
};

export default function NavContent({
  role,
  onNavigate,
  onLogout,
}: {
  role: StaffRole;
  /** ナビ項目タップ後の後処理（ドロワーを閉じる等）。サイドバーでは不要 */
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const items = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {items.map((item) =>
        item.href === "/admin/menu" ? (
          <MenuAccordionNavItem key={item.href} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <NavItem
            key={item.href}
            href={item.href}
            icon={NAV_ICONS[item.href] ?? "list"}
            label={item.label}
            active={pathname.startsWith(item.href)}
            onClick={onNavigate}
          />
        )
      )}

      <div className="flex-1 min-h-px w-full" />

      <div className="border-t border-border-divider flex flex-col gap-[var(--space-2)] pl-[var(--space-12)] pt-[var(--space-12)] w-full">
        <p className="type-jp-chip-label text-text-primary">
          {STAFF_ROLE_LABEL[role]}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="type-jp-caption text-text-secondary text-left w-fit"
        >
          ログアウト
        </button>
      </div>
    </>
  );
}
