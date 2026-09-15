/**
 * 売り切れ（SOLD OUT）
 *
 * 仕様: docs/specs/sold-out-and-receipt-copies.md（2026-09-12、洋輔さんの依頼）
 *
 * これまでの「売り切れ」は公開トグル（is_available）を OFF にして商品ごと隠すしかなかった。
 * これからは商品を注文画面に残したまま「SOLD OUT」と出し、カートに入れられなくする。
 *
 * 文言・判定をここ1か所に閉じ込め、一覧のカード・文字の行・商品詳細・カート・
 * 注文の送信（lib/store.ts）・管理画面が同じ辞書を見るようにしている。
 */
import type { MenuItem } from "./menu";

/** お客様側の表記。洋輔さんの依頼どおり英語の「SOLD OUT」で統一（帯・ピル・詳細の下部バー） */
export const SOLD_OUT_LABEL = "SOLD OUT";

/** 店舗側（管理画面）の表記 */
export const SOLD_OUT_ADMIN_LABEL = "売り切れ";

/**
 * 管理画面「メニュー管理」の一覧に出す**商品の状態**（2026-09-13、天真が案Aを選択）。
 *
 * 以前は「売り切れチップ」と「公開トグル」が別々の見た目で並んでいて、
 * トグルが何のスイッチか分からなかった（天真の指摘）。
 * **1列・1つのチップ**にまとめ、状態を文字で出す。
 *
 *   on_sale  … 販売中。押すと売り切れになる
 *   sold_out … 売り切れ。押すと販売中に戻る
 *   hidden   … 非表示（非公開）。押しても切り替わらない。戻すのは編集パネル
 *              （営業中に使う操作ではないので、一覧には置かない）
 */
export type MenuItemState = "on_sale" | "sold_out" | "hidden";

export const MENU_ITEM_STATE_LABEL: Record<MenuItemState, string> = {
  on_sale:  "販売中",
  sold_out: SOLD_OUT_ADMIN_LABEL,
  hidden:   "非表示",
};

/** 公開フラグと売り切れフラグから状態を決める。非公開が優先（そもそも画面に出ない） */
export function menuItemState(available: boolean, soldOut: boolean): MenuItemState {
  if (!available) return "hidden";
  return soldOut ? "sold_out" : "on_sale";
}

/**
 * カート画面: 売り切れの商品が入っているときの案内（注文ボタンの上）。
 * ⚠ お客様の目に触れる文言。天真の確認待ち（docs/specs 9章）
 */
export const SOLD_OUT_CART_NOTICE =
  "売り切れの商品が含まれています。カートから削除すると、ご注文いただけます。";

/**
 * 注文の送信がサーバー側（place_order）で「売り切れ」として弾かれたときの案内。
 * 画面側の判定より先に古い画面から送られた場合に出る。
 * ⚠ お客様の目に触れる文言。天真の確認待ち
 */
export const SOLD_OUT_ORDER_REJECTED =
  "売り切れになった商品が含まれているため、ご注文を送信できませんでした。\n" +
  "カートから削除して、もう一度お試しください。";

/** place_order が売り切れで拒否するときの DETAIL（supabase/sold_out.sql と揃える） */
const SOLD_OUT_ERROR_DETAIL = "sold_out";

export function isSoldOut(item: Pick<MenuItem, "isSoldOut"> | null | undefined): boolean {
  return item?.isSoldOut === true;
}

/**
 * カートの行のうち、いま売り切れになっている商品の ID。
 * 判定は「カートに保存された商品」ではなく **最新のメニュー（menuDataStore）** で行う。
 * カートに入れた後で売り切れになった商品を拾うため。
 * メニューに無い商品（非公開にされた等）は売り切れとは扱わない（従来どおり）。
 */
export function soldOutIdsIn(
  cart: ReadonlyArray<{ item: Pick<MenuItem, "id"> }>,
  menuItems: ReadonlyArray<Pick<MenuItem, "id" | "isSoldOut">>
): Set<string> {
  const soldOut = new Set(menuItems.filter((m) => m.isSoldOut === true).map((m) => m.id));
  const ids = new Set<string>();
  for (const line of cart) {
    if (soldOut.has(line.item.id)) ids.add(line.item.id);
  }
  return ids;
}

/** ⚠ お客様の目に触れる文言 */
export const UNAVAILABLE_CART_NOTICE =
  "お取り扱いが終わった商品が含まれています。削除してからご注文ください。";

/**
 * **いまメニューに無い商品**がカートに残っていないか。
 *
 * 2026-09-15 の障害の原因。カートは端末に残り続けるので、商品が削除されたり
 * 非公開になったりすると、その行を抱えたまま注文ボタンを押すことになる。
 * サーバー側は外部キー違反で弾くが、画面には「通信エラー」としか出ないため、
 * **何度押しても失敗し続けてお客様が詰む**（洋輔さんが遭遇）。
 *
 * ここで先に気づいて、行を消してもらう。
 * `menuItems` は公開中の商品だけなので、一時的に非公開にしたものも含まれる。
 * どちらにせよ注文は通らないので、同じ扱いでよい。
 *
 * ⚠ **メニューがまだ読めていないときは何も返さない。** 読み込み中に
 * 「取り扱いが終わりました」と出すと、正常な商品まで消させてしまう。
 */
export function unavailableIdsIn(
  cart: ReadonlyArray<{ item: Pick<MenuItem, "id"> }>,
  menuItems: ReadonlyArray<Pick<MenuItem, "id">>,
  menuLoaded: boolean
): Set<string> {
  const ids = new Set<string>();
  if (!menuLoaded || menuItems.length === 0) return ids;
  const known = new Set(menuItems.map((m) => m.id));
  for (const line of cart) {
    if (!known.has(line.item.id)) ids.add(line.item.id);
  }
  return ids;
}

/**
 * place_order が「注文の中身が今のメニューと合わない」で弾いたか。
 * 外部キー違反（商品が消えている）と、明細・オプションの検証エラーをまとめて見る。
 * **これは通信エラーではないので、再送しても直らない。**
 */
export function isUnavailableError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "23503") return true;   // foreign_key_violation = 商品が存在しない
  const m = e.message ?? "";
  return (
    m.includes("選べないオプション") ||
    m.includes("明細の数量・単価・商品IDが不正") ||
    m.includes("violates foreign key constraint")
  );
}

/** Supabase のエラーが place_order の「売り切れ」拒否か */
export function isSoldOutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { details?: unknown; message?: unknown };
  if (e.details === SOLD_OUT_ERROR_DETAIL) return true;
  // 念のため message でも拾う（PostgREST のバージョンで details が落ちる場合の保険）
  return typeof e.message === "string" && e.message.includes("売り切れ");
}
