"use client";

/**
 * 新デザイン管理画面共通の外枠。Nav Sidebar v2（PC）/ Nav Drawer（SP）を内包し、
 * 各ページはコンテンツ列（TopBar+本文）だけを実装すればよい形にする。
 * Kitchen・Register（今後）で共通利用する。
 */
import { useState } from "react";
import NavSidebar from "@/components/admin/nav/NavSidebar";
import NavDrawer from "@/components/admin/nav/NavDrawer";
import { useAdminSession } from "@/lib/useAdminSession";

export default function AdminPageShell({
  children,
}: {
  children: (ctx: { openDrawer: () => void }) => React.ReactNode;
}) {
  const { role, logout } = useAdminSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // レイアウト側の権限ガードで既に弾かれているはずだが、role取得前の一瞬はブランクにする
  if (!role) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-secondary">
      <div className="hidden lg:block">
        <NavSidebar role={role} onLogout={logout} />
      </div>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={role}
        onLogout={logout}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children({ openDrawer: () => setDrawerOpen(true) })}
      </div>
    </div>
  );
}
