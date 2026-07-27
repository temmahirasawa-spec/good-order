/**
 * 共通ラインアイコン（Figma: Component Set「Icon」52:36 の24 variantに対応）
 * すべて currentColor 準拠・16×16 viewBox。
 * 例: <Icon name="cart" className="w-4 h-4 text-text-primary" />
 */

export type IconName =
  | "crown" | "sliders" | "chevron-down" | "chevron-up" | "cart" | "arrow-left"
  | "menu" | "close" | "return" | "bell" | "bag" | "map-pin"
  | "clock" | "phone" | "water-drop" | "card" | "trash"
  | "dashboard" | "flame" | "receipt" | "list" | "bowl"
  | "grip" | "edit" | "check" | "plus"
  | "qr" | "copy" | "download" | "more";

const paths: Record<IconName, JSX.Element> = {
  crown: (
    <path d="M2 12.5L2 4.5L5.8 7.5L8 3L10.2 7.5L14 4.5L14 12.5L2 12.5Z" fill="currentColor" />
  ),
  sliders: (
    <>
      <rect x="1" y="4.25" width="14" height="1.5" rx="1" fill="currentColor" />
      <rect x="1" y="10.25" width="14" height="1.5" rx="1" fill="currentColor" />
      <circle cx="12" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="white" />
      <circle cx="5" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" fill="white" />
    </>
  ),
  "chevron-up": (
    <path d="M3 11L8 5L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  "chevron-down": (
    <path d="M3 5L8 11L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  cart: (
    <>
      <rect x="2.5" y="5.5" width="11" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5.5 5.5L5.5 4.5C5.5 3.1 6.6 2 8 2C9.4 2 10.5 3.1 10.5 4.5L10.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  "arrow-left": (
    <path d="M14 8L2 8M2 8L6 3M2 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  menu: (
    <>
      <rect x="1" y="5" width="14" height="1.5" rx="1" fill="currentColor" />
      <rect x="1" y="9.5" width="14" height="1.5" rx="1" fill="currentColor" />
    </>
  ),
  close: (
    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  ),
  return: (
    <>
      <path d="M6.75 4.5L2.75 8.5L6.75 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M13.25 13L13.25 11.5C13.25 9.6 11.65 8.5 9.75 8.5L3.35 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  bell: (
    <>
      <path d="M3 11.2C4.3 10.2 4.6 8.3 4.6 6.6C4.6 4.1 6 2.4 8 2.4C10 2.4 11.4 4.1 11.4 6.6C11.4 8.3 11.7 10.2 13 11.2L3 11.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M6.7 13.2C7 13.8 7.45 14.1 8 14.1C8.55 14.1 9 13.8 9.3 13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  bag: (
    <>
      <path d="M2.5 4.25L4.5 1.5L11.5 1.5L13.5 4.25M2.5 4.25L2.5 13C2.5 13.85 3.15 14.5 4 14.5L12 14.5C12.85 14.5 13.5 13.85 13.5 13L13.5 4.25M2.5 4.25L13.5 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10.5 7C10.5 8.4 9.4 9.5 8 9.5C6.6 9.5 5.5 8.4 5.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M13.5 6.75C13.5 10.9 8 14.75 8 14.75C8 14.75 2.5 10.9 2.5 6.75C2.5 3.7 4.96 1.25 8 1.25C11.04 1.25 13.5 3.7 13.5 6.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="8" cy="6.75" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M8 3.2L8 6.4L10.4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  phone: (
    <path d="M2.5 4C2.5 3.2 3.2 2.5 4 2.5L5.6 2.5C6 2.5 6.3 2.8 6.4 3.1L7 5C7.1 5.4 7 5.8 6.7 6L5.4 7C6.1 8.6 7.4 9.9 9 10.6L10 9.3C10.2 9 10.6 8.9 11 9L12.9 9.6C13.2 9.7 13.5 10 13.5 10.4L13.5 12C13.5 12.8 12.8 13.5 12 13.5C6.7 13.5 2.5 9.3 2.5 4Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  "water-drop": (
    <path d="M8 0.75C8 0.75 3 6.95 3 10.25C3 13.25 5.5 15.25 8 15.25C10.5 15.25 13 13.25 13 10.25C13 6.95 8 0.75 8 0.75Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  card: (
    <>
      <rect x="1.5" y="3.25" width="13" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <rect x="1.5" y="5.5" width="13" height="2.2" fill="currentColor" />
    </>
  ),
  trash: (
    <>
      <rect x="5.75" y="2.2" width="4.5" height="2" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="2.5" y="4.3" width="11" height="1.4" rx="0.7" fill="currentColor" />
      <path d="M3.25 6L3.9 13.2C3.95 13.9 4.5 14.5 5.2 14.5L10.8 14.5C11.5 14.5 12.05 13.9 12.1 13.2L12.75 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="6.2" y1="7.4" x2="6.2" y2="12.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="8.7" y1="7.4" x2="8.7" y2="12.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  /* ── スタッフ管理画面（Nav Sidebar v2 / Nav Drawer）用アイコン ── */
  dashboard: (
    <>
      <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" />
    </>
  ),
  flame: (
    <path d="M8 0.5C8 0.5 3 6.5 3 10.3C3 13.2 5.24 15.5 8 15.5C10.76 15.5 13 13.2 13 10.3C13 8.1 11.8 6.7 11.2 5.1C11.2 6.9 10.2 7.8 9.6 7.4C10 5.3 9 2.7 8 0.5Z" fill="currentColor" />
  ),
  receipt: (
    <>
      <path d="M2 1H14V13L12.5 14.5L11 13L9.5 14.5L8 13L6.5 14.5L5 13L3.5 14.5L2 13V1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <rect x="4" y="4.5" width="8" height="1.3" rx="0.5" fill="currentColor" />
      <rect x="4" y="7.5" width="8" height="1.3" rx="0.5" fill="currentColor" />
      <rect x="4" y="10.2" width="5" height="1.3" rx="0.5" fill="currentColor" />
    </>
  ),
  list: (
    <>
      <circle cx="2" cy="4" r="1" fill="currentColor" />
      <rect x="5" y="3.3" width="10" height="1.3" rx="0.65" fill="currentColor" />
      <circle cx="2" cy="8" r="1" fill="currentColor" />
      <rect x="5" y="7.3" width="10" height="1.3" rx="0.65" fill="currentColor" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
      <rect x="5" y="11.3" width="10" height="1.3" rx="0.65" fill="currentColor" />
    </>
  ),
  /* ── 管理画面メニュー一覧（Admin Menu Row）用: ドラッグハンドル・編集ペン ── */
  grip: (
    <>
      <circle cx="6" cy="4" r="1" fill="currentColor" />
      <circle cx="10" cy="4" r="1" fill="currentColor" />
      <circle cx="6" cy="8" r="1" fill="currentColor" />
      <circle cx="10" cy="8" r="1" fill="currentColor" />
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="10" cy="12" r="1" fill="currentColor" />
    </>
  ),
  edit: (
    <path d="M11.3 2.3L13.7 4.7L5.9 12.5L2.5 13.5L3.5 10.1L11.3 2.3Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  /* ── テイクアウト受渡（Nav Item）用: チェック（Figma: Icon Name=Check 388:445） ── */
  check: (
    <path d="M1.657 9.221L5.407 12.971L12.397 2.369" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  /* ── メニューアコーディオンのサブ項目用: プラス（Figma: Icon Name=Plus 500:482）
     16pxのアイコン枠の中で、プラス自体が**12px**（丸端込みで 2〜14）になる寸法。
     Figma側は同寸の角丸長方形2本で組んである。 */
  plus: (
    <path d="M8 2.8V13.2M2.8 8H13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  ),
  /* ── テーブル・二次元コード管理（Step3-O）用 ──
     UI表記は「二次元コード」で統一するが、アイコン名などコード内部の識別子は qr のまま。 */
  qr: (
    <>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="3.4" y="3.4" width="1.2" height="1.2" fill="currentColor" />
      <rect x="11.4" y="3.4" width="1.2" height="1.2" fill="currentColor" />
      <rect x="3.4" y="11.4" width="1.2" height="1.2" fill="currentColor" />
      <rect x="9.5" y="9.5" width="2.2" height="2.2" fill="currentColor" />
      <rect x="12.8" y="9.5" width="1.7" height="1.7" fill="currentColor" />
      <rect x="9.5" y="12.8" width="1.7" height="1.7" fill="currentColor" />
      <rect x="12.8" y="12.8" width="1.7" height="1.7" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="2.2" y="2.2" width="8.6" height="8.6" rx="1.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  download: (
    <>
      <path d="M8 2V10.2M8 10.2L4.8 7M8 10.2L11.2 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2.5 13.2H13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </>
  ),
  more: (
    <>
      <circle cx="3.1" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.9" cy="8" r="1.3" fill="currentColor" />
    </>
  ),
  /* ── レジ画面（Order Group Header）用: 店内アイコン（お椀+湯気） ── */
  bowl: (
    <>
      <path d="M2 8V11C2 12.66 3.34 14 5 14H11C12.66 14 14 12.66 14 11V8" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <rect x="2" y="7.3" width="12" height="1.4" rx="0.7" fill="currentColor" />
      <line x1="5.2" y1="0.5" x2="5.2" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.7" y1="0.5" x2="9.7" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {paths[name]}
    </svg>
  );
}
