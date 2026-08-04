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

/** サイドバー上のまとまり。区切り線の位置と、下端寄せにする項目の決定に使う。
 *  - ops    : 営業中に毎日触る画面（最上部）
 *  - manage : 設定・管理系（区切り線の下）
 *  - review : 締め後・振り返りで開く画面（ログアウトの直上へ下端寄せ） */
export type AdminNavGroup = "ops" | "manage" | "review";

export interface AdminNavItem {
  href: string;
  label: string;
  roles: StaffRole[];
  group: AdminNavGroup;
}

/** admin配下の画面一覧とアクセス可能ロール（ナビ表示・URL直打ちガードの両方で使用）
 *
 * /admin/pickup（テイクアウト）にアクセスできるのは、
 * supabase/staff_role_rls.sql の orders_update_role_scoped で
 * status='picked_up' への更新を許可されている counter / kitchen / manager の3つ。
 *
 * 画面名は Nav Sidebar / Top Bar とも「テイクアウト」で統一している。
 * 元は「テイクアウト受渡」だったが、テイクアウト商品CRUDの /admin/takeout を
 * /admin/menu に統合して区別の必要が無くなったため短縮した（遷移先は /admin/pickup のまま）。
 *
 * **配列の順序がそのままサイドバーの表示順**であり、同時に
 * layout.tsx の権限ガードのフォールバック先（allowed[0]）でもある。
 * 「そのロールが最初に見るべき画面」＝「サイドバー最上段」という対応を保つため
 * 意図的に1つの配列で兼ねている。順序を変えるとマネージャーの着地先も変わる点に注意。 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/kitchen",   label: "厨房",           roles: ["manager", "kitchen"],             group: "ops" },
  { href: "/admin/register",  label: "レジ",           roles: ["manager", "register"],            group: "ops" },
  { href: "/admin/pickup",    label: "テイクアウト",   roles: ["manager", "kitchen", "counter"],  group: "ops" },
  // 新デザインのサイドバーではこの項目は Menu Accordion に置き換わる（ラベルは親行と同じ「メニュー」）
  { href: "/admin/menu",      label: "メニュー",       roles: ["manager"],                        group: "manage" },
  // 「QRコード」は登録商標のため、画面に出す文言は必ず「二次元コード」にする。
  // 220px幅のサイドバーだと1行に収まらず中途半端な位置で折れるので、改行位置を固定する
  { href: "/admin/tables",    label: "テーブル/\n二次元コード", roles: ["manager"],               group: "manage" },
  // 表示設定は manage 群の末尾に足す。**先頭（index 0）には絶対に入れないこと。**
  // 上のコメントのとおり allowed[0] が各ロールの着地先を兼ねているため、
  // 先頭に入れると manager のログイン直後の画面が厨房から設定画面に変わってしまう。
  // 旧「店舗設定」（/admin/settings）から改名・移動した。旧URLは next.config.mjs で
  // /admin/display にリダイレクトしている。
  { href: "/admin/display",   label: "表示設定",       roles: ["manager"],                        group: "manage" },
  { href: "/admin/dashboard", label: "ダッシュボード", roles: ["manager"],                        group: "review" },
];
// /admin/takeout（テイクアウト商品のCRUD）は /admin/menu に統合して廃止した。
// 「テイクアウト対象にする」トグルとフィルター行のテイクアウトチップで代替できる。
// 旧URLは next.config.mjs のリダイレクトで /admin/menu へ送っている。
