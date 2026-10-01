/**
 * カートの値段を「いまのメニュー」に合わせる（lib/cartPricing.ts）のテスト（2026-10-01）
 *
 * 会計はサーバーが DB の値段で計算する（supabase/order_server_pricing.sql）。
 * カートに入れたあとで店が値段を変えても、画面に出す値段が会計とずれないことを確かめる。
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { importLib } from "./support/load-ts.mjs";

let withCurrentPrices;

before(async () => {
  ({ withCurrentPrices } = await importLib("lib/cartPricing.ts"));
});

const line = (id, price, options = [], extra = {}) => ({
  item: { id, price, name: `商品${id}` },
  quantity: 1,
  options,
  lineId: `line-${id}`,
  ...extra,
});
const opt = (optionId, price, name = optionId) => ({ optionId, name, price });

describe("withCurrentPrices", () => {
  test("値段が変わった商品だけ、最新の値段に置き換える（ほかの項目はそのまま）", () => {
    const cart = [line("a", 1650, [], { quantity: 2, servingTiming: "asap" }), line("b", 550)];
    const next = withCurrentPrices(cart, [{ id: "a", price: 1340 }, { id: "b", price: 550 }], {});
    assert.notEqual(next, cart);
    assert.equal(next[0].item.price, 1340);
    assert.equal(next[0].item.name, "商品a");
    assert.equal(next[0].quantity, 2);
    assert.equal(next[0].servingTiming, "asap");
    assert.equal(next[0].lineId, "line-a");
    assert.equal(next[1], cart[1]); // 変わらない行は同じもの
    assert.equal(cart[0].item.price, 1650); // 元のカートは書き換えない
  });

  test("選んだオプションの値段も最新に合わせる", () => {
    const cart = [line("salad", 1320, [opt("avocado", 100, "アボカド"), opt("egg", 100, "ゆで卵")])];
    const next = withCurrentPrices(cart, [{ id: "salad", price: 1320 }], {
      salad: [{ id: "avocado", price: 120 }, { id: "egg", price: 100 }],
    });
    assert.deepEqual(next[0].options, [opt("avocado", 120, "アボカド"), opt("egg", 100, "ゆで卵")]);
    assert.equal(next[0].item, cart[0].item); // 商品の値段は変わっていないので同じもの
  });

  test("何も変わらなければ、受け取った配列をそのまま返す（ストアを書き換えない）", () => {
    const cart = [line("a", 1340, [opt("hot", 0)])];
    const same = withCurrentPrices(cart, [{ id: "a", price: 1340 }], { a: [{ id: "hot", price: 0 }] });
    assert.equal(same, cart);
  });

  test("メニューがまだ読めていない（空）ときは何もしない", () => {
    const cart = [line("a", 1650)];
    assert.equal(withCurrentPrices(cart, [], {}), cart);
  });

  test("メニューに無い商品・表示していないオプションは触らない（その行は赤く出て注文できない）", () => {
    const cart = [line("gone", 900), line("a", 1340, [opt("hidden", 180)])];
    const next = withCurrentPrices(cart, [{ id: "a", price: 1340 }], { a: [] });
    assert.equal(next, cart);
  });

  test("空のカートはそのまま", () => {
    const cart = [];
    assert.equal(withCurrentPrices(cart, [{ id: "a", price: 1 }], {}), cart);
  });
});
