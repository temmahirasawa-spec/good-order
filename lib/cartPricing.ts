/**
 * カートの値段を「いまのメニュー」に合わせる（2026-10-01）
 *
 * 注文の値段はサーバー（place_order）が DB のメニューから決める
 * （supabase/order_server_pricing.sql。お客様の端末が送った値段は使わない）。
 * ところがカートは端末（localStorage の orderly-cart）に残り続け、行には
 * 「カートに入れた時点の値段」が入っている。入れたあとで店が値段を変えると、
 * 画面には古い値段が出たまま、会計（レジ）だけが新しい値段になってしまう。
 * そのずれを作らないよう、メニューを読んだらカートの値段を最新に置き換える。
 *
 * - 置き換えるのは**値段だけ**（商品の値段と、選んだオプションの値段）。品名・写真などは触らない
 * - メニューに無い商品・表示中でないオプションは触らない。その行は売り切れと同じ見た目で
 *   赤く出て、注文ボタンが止まる（lib/soldOut.ts）ので、値段を合わせる必要が無い
 * - メニューがまだ読めていない（空）ときは何もしない
 * - 変わった行が無ければ**受け取った配列をそのまま返す**（ストアを書き換えて再描画を起こさない）
 *
 * import は型だけにしている（Supabase を引き込まない）。tests/cart-pricing.test.mjs で単体で確かめる。
 */
import type { MenuItem } from "./menu";
import type { MenuOption, SelectedOption } from "./menuOptions";

/** 値段を合わせるのに必要な、カートの行の最小の形（lib/store.ts の CartItem がこれを満たす） */
export interface PricedCartLine {
  item: Pick<MenuItem, "id" | "price">;
  options?: SelectedOption[];
}

export function withCurrentPrices<T extends PricedCartLine>(
  lines: T[],
  menuItems: ReadonlyArray<Pick<MenuItem, "id" | "price">>,
  /** 商品ID → 表示中のオプション（menuDataStore.menuOptions） */
  menuOptions: Readonly<Record<string, ReadonlyArray<Pick<MenuOption, "id" | "price">>>>
): T[] {
  if (lines.length === 0 || menuItems.length === 0) return lines;
  const priceOf = new Map(menuItems.map((m) => [m.id, m.price]));

  let changed = false;
  const next = lines.map((line) => {
    const latest = priceOf.get(line.item.id);
    const itemChanged = latest !== undefined && latest !== line.item.price;

    const offered = menuOptions[line.item.id] ?? [];
    let optionsChanged = false;
    const options = line.options?.map((o) => {
      const current = offered.find((x) => x.id === o.optionId);
      if (!current || current.price === o.price) return o;
      optionsChanged = true;
      return { ...o, price: current.price };
    });

    if (!itemChanged && !optionsChanged) return line;
    changed = true;
    return {
      ...line,
      item: itemChanged && latest !== undefined ? { ...line.item, price: latest } : line.item,
      options: optionsChanged ? options : line.options,
    } as T;
  });

  return changed ? next : lines;
}
