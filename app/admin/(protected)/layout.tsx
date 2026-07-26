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
 * ここでの制御は「ナビゲーション表示のフィルタ」と「URL直打ちアクセス時の
 * リダイレクト」の2つ。DBレベルの実効的な制限（売上データ・UPDATE権限）は
 * supabase/staff_role_rls.sql 側のRLSポリシーで別途行っている。
 *
 * 新デザイン（Nav Sidebar v2 / Nav Drawer）へ移行済みのページは、このレイアウトの
 * 旧トップバー枠を被せず children をそのまま返す（ページ自身が新しいnav chromeを
 * 内包しているため）。移行が進むごとに REDESIGNED_PREFIXES を増やし、
 * 全ページ移行完了後は旧chrome自体を削除する想定。
 */
const REDESIGNED_PREFIXES = ["/admin/kitchen", "/admin/register", "/admin/menu", "/admin/pickup"];

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,  setReady]  = useState(false);
  const [email,  setEmail]  = useState<string | null>(null);
  const [role,   setRole]   = useState<StaffRole | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setEmail(data.session.user.email ?? null);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-warm-300 border-t-warm-700 animate-spin" />
      </div>
    );
  }

  // role未設定・未知の値の場合は安全側に倒して何も表示しない
  const navItems = role ? ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role)) : [];

  // 新デザイン移行済みページ: 旧chromeを被せず、権限ガードのみ行ってそのまま返す
  if (REDESIGNED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return role === null ? (
      <div className="min-h-screen flex items-center justify-center text-center text-sm text-gray-500 px-6">
        このアカウントには権限（role）が設定されていないため、画面を表示できません。
        <br />
        管理者にお問い合わせください。
      </div>
    ) : (
      <>{children}</>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── トップナビ ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* ロゴ */}
          <span
            className="text-base font-bold text-warm-700 tracking-wider shrink-0"
            style={{ fontFamily: "HalisR, sans-serif" }}
          >
            YORKYS Admin
          </span>

          {/* ナビタブ */}
          <nav className="flex gap-1 flex-1">
            {navItems.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <a
                  key={href}
                  href={href}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-warm-100 text-warm-700"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </a>
              );
            })}
            {role === null && (
              <span className="text-xs text-red-500 self-center">
                権限が設定されていません。管理者にお問い合わせください。
              </span>
            )}
          </nav>

          {/* ユーザー情報 + ログアウト */}
          <div className="flex items-center gap-3 shrink-0">
            {email && (
              <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[160px]">
                {email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* ── コンテンツ ──
          roleが無い場合はどのページの中身も表示しない（安全側のデフォルト） */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {role === null ? (
          <div className="text-center py-20 text-sm text-gray-500">
            このアカウントには権限（role）が設定されていないため、画面を表示できません。
            <br />
            管理者にお問い合わせください。
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
