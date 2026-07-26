/**
 * スタッフ権限（app_metadata.role）の定義を1箇所に集約する。
 * RLS側（supabase/staff_role_rls.sql）の値と必ず一致させること:
 *   'kitchen' | 'register' | 'counter' | 'manager'
 *
 * counter（カウンター＝受渡担当）は picked_up への更新だけを許可されたロール。
 * 会計（paid）権限は持たない。
 */

export const STAFF_ROLES = ["kitchen", "register", "counter", "manager"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** 未知の値・未設定は null にフォールバックする */
export function parseStaffRole(value: unknown): StaffRole | null {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value)
    ? (value as StaffRole)
    : null;
}

/** Nav Sidebar v2 / Nav Drawer フッターに出すロール表示名 */
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  kitchen:  "厨房スタッフ",
  register: "レジスタッフ",
  counter:  "カウンタースタッフ",
  manager:  "マネージャー",
};

export interface AdminNavItem {
  href: string;
  label: string;
  roles: StaffRole[];
}

/** admin配下の画面一覧とアクセス可能ロール（ナビ表示・URL直打ちガードの両方で使用）
 *
 * /admin/pickup（テイクアウト受渡）にアクセスできるのは、
 * supabase/staff_role_rls.sql の orders_update_role_scoped で
 * status='picked_up' への更新を許可されている counter / kitchen / manager の3つ。
 *
 * 画面名は Nav Sidebar / Top Bar とも「テイクアウト受渡」で統一している
 * （Nav Sidebar v2 は220px幅でActive時に15px boldになるため、
 *   「テイクアウト受け渡し」だと1行に収まらず「し」だけが行落ちする）。 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "ダッシュボード",   roles: ["manager"] },
  { href: "/admin/kitchen",   label: "厨房",             roles: ["manager", "kitchen"] },
  { href: "/admin/register",  label: "レジ",             roles: ["manager", "register"] },
  { href: "/admin/pickup",    label: "テイクアウト受渡", roles: ["manager", "kitchen", "counter"] },
  // 新デザインのサイドバーではこの項目は Menu Accordion に置き換わる（ラベルは親行と同じ「メニュー」）
  { href: "/admin/menu",      label: "メニュー",         roles: ["manager"] },
  { href: "/admin/takeout",   label: "テイクアウト",     roles: ["manager"] },
];
