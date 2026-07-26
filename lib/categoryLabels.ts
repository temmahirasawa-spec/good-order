/**
 * サブカテゴリ（= categories.slug）の表示名辞書。
 * 一覧ページ・カード内カテゴリタグ・メニュー画面カテゴリカードで共通利用する。
 */
import type { Subcategory } from "./menu";
import type { ApiCategory } from "./api";
import type { TagColor } from "@/components/ui/CategoryTag";

/* ── slug → 日本語ラベル ── */
export const SUBCATEGORY_LABEL: Record<string, string> = {
  pancake:       "パンケーキ",
  eggs_benedict: "エッグベネディクト",
  burger:        "バーガー",
  french_toast:  "フレンチトースト",
  sandwich:      "サンドイッチ",
  fritter:       "フリッター",
  lunch:         "ランチ",
  coffee:        "コーヒー",
  tea:           "紅茶",
  soft:          "ソフトドリンク",
  alcohol:       "アルコール",
};

/* ── slug → 英語ラベル（Menu Category Card の EN 表記）
 *  eggs_benedict は Step3-C の確定コピー（TOPセクション見出し）に合わせて
 *  "EGG BENEDICT"（単数形）で統一 ── */
export const SUBCATEGORY_EN_LABEL: Record<Subcategory, string> = {
  pancake: "PANCAKE",
  french_toast: "FRENCH TOAST",
  eggs_benedict: "EGG BENEDICT",
  sandwich: "SANDWICH",
  fritter: "FRITTER",
  burger: "BURGER",
  lunch: "LUNCH",
  coffee: "COFFEE",
  tea: "TEA",
  soft: "SOFT DRINK",
  alcohol: "ALCOHOL",
};

/* ── slug → Category Tag の背景色 ──
 * 現在はDB（categories.tag_color、supabase/category_tag_color.sql）が正。
 * この定数は「該当カテゴリがDBから引けなかった場合」のフォールバック用に
 * 残してある（完全削除ではなく保険として）。値自体は移行時点のDB初期値と
 * 同じにしてあるが、DB側を管理画面で変更した場合はこことは値がズレる。 */
export const SUBCATEGORY_TAG_COLOR: Record<string, TagColor> = {
  pancake:       "yellow",
  eggs_benedict: "pink",
  french_toast:  "orange",
  sandwich:      "green",
  fritter:       "teal",
  burger:        "red",
  lunch:         "brown",
  coffee:        "blue",
  tea:           "green",
  soft:          "purple",
  alcohol:       "gray",
};

/* ── カテゴリタグ色の解決: DB（categories.tag_color）優先、
 *   見つからなければ SUBCATEGORY_TAG_COLOR にフォールバック ── */
export function resolveTagColor(
  categories: Pick<ApiCategory, "slug" | "tag_color">[],
  subcategorySlug: string
): TagColor {
  const cat = categories.find((c) => c.slug === subcategorySlug);
  if (cat?.tag_color) return cat.tag_color;
  return SUBCATEGORY_TAG_COLOR[subcategorySlug] ?? "yellow";
}
