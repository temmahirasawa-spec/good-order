/**
 * カテゴリタグ（Figma: Category Tag 85:114）
 * 背景は tag/○○ の10色から。カード内タグと同仕様。
 */

export type TagColor =
  | "yellow" | "orange" | "pink" | "red" | "green"
  | "teal" | "blue" | "purple" | "brown" | "gray";

export const ALL_TAG_COLORS: TagColor[] = [
  "yellow", "orange", "pink", "red", "green",
  "teal", "blue", "purple", "brown", "gray",
];

/* Tailwind JIT に静的クラス名を検出させるためのマップ（動的組み立て禁止）
 * 管理画面の色スウォッチ選択（app/admin/(protected)/menu/categories/page.tsx）
 * でも再利用するため export する */
export const TAG_BG: Record<TagColor, string> = {
  yellow: "bg-tag-yellow",
  orange: "bg-tag-orange",
  pink:   "bg-tag-pink",
  red:    "bg-tag-red",
  green:  "bg-tag-green",
  teal:   "bg-tag-teal",
  blue:   "bg-tag-blue",
  purple: "bg-tag-purple",
  brown:  "bg-tag-brown",
  gray:   "bg-tag-gray",
};

interface Props {
  label: string;
  color?: TagColor;
  className?: string;
}

export default function CategoryTag({ label, color = "yellow", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-start px-[10px] py-[4px] rounded-full ${TAG_BG[color]} ${className}`}
    >
      <span className="type-jp-label text-text-primary whitespace-nowrap">
        {label}
      </span>
    </span>
  );
}
