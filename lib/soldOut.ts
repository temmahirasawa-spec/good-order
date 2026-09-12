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

/** Supabase のエラーが place_order の「売り切れ」拒否か */
export function isSoldOutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { details?: unknown; message?: unknown };
  if (e.details === SOLD_OUT_ERROR_DETAIL) return true;
  // 念のため message でも拾う（PostgREST のバージョンで details が落ちる場合の保険）
  return typeof e.message === "string" && e.message.includes("売り切れ");
}
