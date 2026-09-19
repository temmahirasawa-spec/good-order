/**
 * 一覧（TOP・カテゴリー・テイクアウト）の操作ボタンを、
 * 「カートに入れる」にするか「詳細を見る」にするかの判定。
 *
 * **ドリンクは「詳細を見る」**（2026-09-19、天真の決定）。
 * HOT / ICED のように 1 つ選ぶオプションがあるドリンクを一覧から直接入れると、
 * お客様が HOT か ICED かを選べないまま既定値（1番目＝HOT）で入ってしまう。
 * 一覧からは詳細シートを開いてもらい、そこで HOT / ICED と提供タイミングを選ぶ。
 *
 * フードは今までどおり「カートに入れる」でその場で入る。
 * 「ドリンクだけボタンの文言が違う」見た目の不揃いは承知のうえで、
 * 「押したのに選べていない」ほうが実害が大きいという判断（天真）。
 * 将来は両方のボタンを置くか、すべて「詳細を見る」に統一するかを別途検討する。
 */
import { servingCategoryType, type CategoryForTiming, type ItemForTiming } from "@/lib/servingTiming";

export const ADD_TO_CART_LABEL = "カートに入れる";
export const OPEN_DETAIL_LABEL = "詳細を見る";

/** 一覧のボタンで詳細シートを開く商品か（＝ドリンク） */
export function opensDetailFromList(
  categories: CategoryForTiming[],
  item: ItemForTiming
): boolean {
  return servingCategoryType(categories, item) === "drink";
}

/** 一覧のボタンの文言 */
export function listActionLabel(
  categories: CategoryForTiming[],
  item: ItemForTiming
): string {
  return opensDetailFromList(categories, item) ? OPEN_DETAIL_LABEL : ADD_TO_CART_LABEL;
}

/**
 * 一覧のボタンの見た目。
 * カートに入る主操作は塗り、詳細を開く副操作は白地に枠
 * （Figma: Components / 04 Tags & Steppers / Add to Cart Button S-Line）。
 */
export function listActionVariant(
  categories: CategoryForTiming[],
  item: ItemForTiming
): "fill" | "line" {
  return opensDetailFromList(categories, item) ? "line" : "fill";
}
