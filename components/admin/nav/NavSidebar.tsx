"use client";

/**
 * Nav Sidebar v2（Figma 319:369）PC専用・220px幅・画面高さ一杯・常時表示。
 * Kitchen/Registerなど新デザインの管理画面ページ共通で使う。
 */
import NavContent from "@/components/admin/nav/NavContent";
import type { StaffRole } from "@/lib/staffRoles";

export default function NavSidebar({
  role,
  onLogout,
}: {
  role: StaffRole;
  onLogout: () => void;
}) {
  return (
    <div className="bg-surface-white border-r border-border-divider flex flex-col gap-[var(--space-4)] h-screen items-start px-[var(--space-12)] py-[var(--space-24)] shrink-0 sticky top-0 w-[220px]">
      <div className="flex items-start pb-[var(--space-16)] pl-[var(--space-12)]">
        <p className="type-en-wordmark text-text-primary">
          GOOD ORDER
        </p>
      </div>
      <NavContent role={role} onLogout={onLogout} />
    </div>
  );
}
