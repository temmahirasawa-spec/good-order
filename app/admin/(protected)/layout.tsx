"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_NAV_ITEMS, parseStaffRole, type StaffRole } from "@/lib/staffRoles";

/**
 * スタッフ権限分離（方式(a): Supabase Auth の app_metadata.role）
 * 理由: role変更がSQL一発（auth.usersのUPDATE）で完結し、追加テーブル・
 * 追加クエリなしでログイン時のsessionに乗ってくる。既存パターン
 * （supabase.auth.getSession()）にそのまま乗せられるため。
 *
 * ここでの制御は「URL直打ちアクセス時のリダイレクト」と「role未設定のときの
 * 表示停止」の2つ。DBレベルの実効的な制限（売上データ・UPDATE権限）は
 * supabase/staff_role_rls.sql 側のRLSポリシーで別途行っている。
 *
 * 画面の枠（Nav Sidebar v2 / Nav Drawer）は各ページが AdminPageShell で持つ。
 * 以前はここに旧トップバーがあり、「新デザインに移行済みのパス一覧」に載っていない
 * ページだけ旧トップバーを被せていた。全ページが移行済みなのに /admin/print だけ
 * 一覧に載っておらず、印刷状況の画面に旧トップバーが二重に出ていた（2026-09-08 に天真が指摘）。
 * 同じ事故を繰り返さないよう、一覧ごと旧トップバーを削除した。
 */
export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,  setReady]  = useState(false);
  const [role,   setRole]   = useState<StaffRole | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setRole(parseStaffRole(data.session.user.app_metadata?.role));
        setReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/admin/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  // URL直打ち等でロール的にアクセス権の無いページを開こうとした場合は
  // 自分がアクセス可能な最初のページへリダイレクトする
  useEffect(() => {
    if (!ready || role === null) return;
    const allowed = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
    const isAllowed = allowed.some((item) => pathname.startsWith(item.href));
    if (!isAllowed && allowed.length > 0) {
      router.replace(allowed[0].href);
    }
  }, [ready, role, pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
      </div>
    );
  }

  // role未設定・未知の値の場合は安全側に倒して何も表示しない
  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center type-jp-body text-text-secondary px-[var(--space-24)]">
        このアカウントには権限（role）が設定されていないため、画面を表示できません。
        <br />
        管理者にお問い合わせください。
      </div>
    );
  }

  return <>{children}</>;
}
