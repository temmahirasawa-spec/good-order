"use client";

/**
 * ログイン中スタッフのrole/emailを読むだけの軽量フック。
 * アクセスガード（未ログイン時のリダイレクト等）は app/admin/(protected)/layout.tsx
 * 側の責務のまま変更しない。こちらは新デザインの画面（Nav Sidebar v2 / Nav Drawer）が
 * 表示用に role/ログアウト操作を必要とする箇所向けの重複回避用。
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseStaffRole, type StaffRole } from "@/lib/staffRoles";

export function useAdminSession() {
  const [role, setRole] = useState<StaffRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setRole(parseStaffRole(data.session?.user.app_metadata?.role));
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  return { role, email, logout };
}
