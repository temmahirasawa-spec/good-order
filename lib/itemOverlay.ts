/**
 * 商品詳細オーバーレイの開閉（URLは `?item=<商品ID>` で表す）。
 *
 * 以前は `/order/item/[id]` への**ページ遷移**だったが、遷移のたびに一覧が
 * アンマウントされるため、
 *   - 戻ったときのスクロール位置が失われる
 *   - 閉じるアニメ中に一覧が存在せず、背景色しか出ない
 * という2つの問題が構造的に避けられなかった。
 * 一覧を出したまま上に重ねるオーバーレイに変え、URLだけクエリで表す形にしている。
 *
 * pushState / replaceState を直接使うのは、同一ルートのクエリ変更で
 * RSCの往復を発生させないため（Next 14.1+ はネイティブHistory APIと
 * usePathname / useSearchParams が同期する）。
 */

export const ITEM_PARAM = "item";

/** 「このオーバーレイはアプリ自身が履歴を積んで開いた」ことを覚えておく。
 *  直リンク（/order/item/xxx からのリダイレクト）で開いた場合は戻り先が
 *  アプリ外なので、閉じるときに history.back() してはいけない。 */
let pushedByApp = false;

export function openItemDetail(id: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(ITEM_PARAM, id);
  pushedByApp = true;
  window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
}

/** 直近の open がアプリ由来だったかを取り出す（1回きり） */
export function takePushedByApp(): boolean {
  const v = pushedByApp;
  pushedByApp = false;
  return v;
}

/** 履歴を戻さずにパラメータだけ落とす（直リンクで開かれたときの閉じ方） */
export function stripItemParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete(ITEM_PARAM);
  const q = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
}
