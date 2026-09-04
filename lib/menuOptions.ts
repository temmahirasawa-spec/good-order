/**
 * メニューのオプション（トッピングなど、商品に追加で選べるもの）
 *
 * 仕様: docs/specs/menu-options.md（2026-09-04 に天真が決定）
 * - 対象商品は menu_items.options_enabled が ON で、表示中のオプションが1つ以上ある商品
 * - 選び方は商品ごとに設定: multiple（チェック、任意、上限なし）/ single（ラジオ、必ず1つ）
 * - 無料（0円）は「0円」と表示する
 * - 行の単価はオプション込み。内訳は注文時点のスナップショット（名前・価格）で残す
 */
import type { MenuItem } from "./menu";

export type OptionSelectMode = "multiple" | "single";

/** 商品に設定されたオプション（DB の menu_item_options の表示中の行） */
export interface MenuOption {
  id: string;
  name: string;
  price: number;
}

/** お客様が選んだオプション（カート・注文・履歴に持ち回るスナップショット） */
export interface SelectedOption {
  optionId: string;
  name: string;
  price: number;
}

export const OPTIONS_HEADING_DEFAULT = "トッピング";
export const OPTIONS_ADD_LABEL = "＋ オプションを追加";

export function normalizeSelectMode(v: unknown): OptionSelectMode {
  return v === "single" ? "single" : "multiple";
}

export function optionsTotal(options?: SelectedOption[] | null): number {
  return (options ?? []).reduce((s, o) => s + (o.price || 0), 0);
}

/** 「+¥120」。無料は「0円」（天真の決定） */
export function formatOptionPrice(price: number): string {
  return price > 0 ? `+¥${price.toLocaleString()}` : "0円";
}

/** 「＋アボカド ＋ゆで卵」。カート・完了画面・厨房画面で共通 */
export function formatSelectedOptions(options?: SelectedOption[] | null): string {
  return (options ?? []).map((o) => `＋${o.name}`).join(" ");
}

/** カートの行の同一性に使う。順序に依存しないよう ID を並べ替えて結合する */
export function optionsKey(options?: SelectedOption[] | null): string {
  return (options ?? [])
    .map((o) => o.optionId)
    .sort()
    .join(",");
}

export function selectModeHint(mode: OptionSelectMode): string {
  return mode === "single" ? "1つ選べます" : "複数選べます";
}

/** この商品でオプションを選べるか（ON かつ表示中のオプションが1つ以上） */
export function hasSelectableOptions(
  item: Pick<MenuItem, "optionsEnabled">,
  options: MenuOption[]
): boolean {
  return Boolean(item.optionsEnabled) && options.length > 0;
}

export function toSelected(o: MenuOption): SelectedOption {
  return { optionId: o.id, name: o.name, price: o.price };
}

/** 開いたときの初期選択。1つだけ（ラジオ）は最初の項目、複数選択は空 */
export function defaultSelection(mode: OptionSelectMode, options: MenuOption[]): SelectedOption[] {
  if (mode === "single" && options.length > 0) return [toSelected(options[0])];
  return [];
}
