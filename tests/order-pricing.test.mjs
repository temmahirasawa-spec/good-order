/**
 * 注文の値段の回帰テスト（2026-10-01、docs/preopen-verify-2026-09-16.md の O3 を直したときに追加）
 *
 * place_order（supabase/order_server_pricing.sql）を手元の Postgres（PGlite）で動かして確かめる:
 *   1. お客様の端末が送った値段・合計は使わず、DB のメニューの値段で保存する
 *   2. 既存の値段のルールを壊していない（オプション・セットドリンク割引・税・1杯ごとの選択・テイクアウト）
 *   3. 弾くときのエラーを、お客様の画面（lib/soldOut.ts）が今までどおりに読み分けられる
 *   4. お客様の画面の計算（lib/tax.ts・lib/setDrink.ts）がサーバーと同じ金額を出す
 *
 * 本番にはつながない。テストごとに取引を張って、最後に必ず元に戻す。
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { importLib } from "./support/load-ts.mjs";
import {
  ID,
  OTHER_STORE_ID,
  STORE_ID,
  TABLE_A1_LABEL,
  TABLE_A2_LABEL,
  asPostgrestError,
  createPricingDb,
  inRollback,
  newOrderId,
  placeOrder,
  readOrder,
} from "./support/db.mjs";

let db;
let soldOut;   // lib/soldOut.ts（画面側のエラーの読み分け）

before(async () => {
  db = await createPricingDb();
  soldOut = await importLib("lib/soldOut.ts");
});

after(async () => {
  await db?.close();
});

/** place_order が失敗することを確かめ、画面が受け取る形のエラーを返す */
async function expectRejected(args) {
  try {
    await placeOrder(db, args);
  } catch (err) {
    return asPostgrestError(err);
  }
  assert.fail("place_order が通ってしまった（弾かれるはずの注文）");
}

describe("端末が送った値段を使わない（O3）", () => {
  test("単価を1円に書き換えても、DB の値段（1,340円）で保存される", () =>
    inRollback(db, async () => {
      const { orderId, created } = await placeOrder(db, {
        totalAmount: 1,
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 1 }],
      });
      assert.equal(created, true);
      const o = await readOrder(db, orderId);
      assert.equal(o.items[0].unit_price, 1340);
      assert.equal(o.total_amount, 1340);
      assert.equal(o.tax_amount, Math.floor((1340 * 10) / 110)); // 内税10%
    }));

  test("数量があるときも、DB の値段 × 数量で合計する", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 3, unitPrice: 1 },
          { id: ID.pancake2, quantity: 2, unitPrice: 0 },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.deepEqual(o.items.map((i) => i.unit_price), [1340, 1540]);
      assert.equal(o.subtotal, 1340 * 3 + 1540 * 2);
      assert.equal(o.total_amount, 1340 * 3 + 1540 * 2);
    }));

  test("高く書き換えても DB の値段になる（端末の値段は上にも下にも効かない）", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 99999 }],
      });
      assert.equal((await readOrder(db, orderId)).total_amount, 1340);
    }));

  test("合計（p_total_amount）を書き換えても使わない（従来どおり）", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        totalAmount: 99999,
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }],
      });
      assert.equal((await readOrder(db, orderId)).total_amount, 1340);
    }));

  test("DB の値段が負なら注文を弾く（端末の値段で弾いていた線を DB の値段で守る）", () =>
    inRollback(db, async () => {
      await db.query("UPDATE public.menu_items SET price = -100 WHERE id = $1", [ID.pancake]);
      const err = await expectRejected({ items: [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }] });
      assert.equal(err.code, "22023");
    }));
});

describe("オプション（HOT/ICED・トッピング）", () => {
  test("トッピングの値段は DB から足す。名前と値段のスナップショットが残る", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [{ id: ID.salad, quantity: 2, unitPrice: 0, options: [ID.optAvocado, ID.optEgg] }],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.items[0].unit_price, 1320 + 120 + 100); // 行の単価はオプション込み
      assert.deepEqual(o.items[0].options, [
        { name: "アボカド", price: 120 },
        { name: "ゆで卵", price: 100 },
      ]);
      assert.equal(o.total_amount, (1320 + 220) * 2);
    }));

  test("HOT/ICED（0円）は値段を変えない。値段の高いオプション（ボトルワイン）も DB から足す", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.americano, quantity: 1, unitPrice: 1, options: [ID.optIcedA] },
          { id: ID.wine, quantity: 1, unitPrice: 1, options: [ID.optBottle] },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.deepEqual(o.items.map((i) => i.unit_price), [550, 880 + 4620]);
    }));

  test("表示していないオプションは今までどおり弾く（画面は「お取り扱いが終わった商品」）", () =>
    inRollback(db, async () => {
      const err = await expectRejected({
        items: [{ id: ID.salad, quantity: 1, unitPrice: 1320, options: [ID.optHidden] }],
      });
      assert.match(err.message, /選べないオプション/);
      assert.equal(soldOut.isUnavailableError(err), true);
    }));
});

describe("セットドリンク割引（docs/specs/set-drink-discount.md）", () => {
  test("フード1・ドリンク2 → 安いドリンク1杯ぶん、ドリンクの値段を超えない（150円のドリンクなら150円引き）", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: ID.americano, quantity: 1, unitPrice: 550, options: [ID.optHotA] },
          { id: ID.miniDrink, quantity: 1, unitPrice: 150 },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.discount_amount, 150);
      assert.equal(o.total_amount, 1340 + 550 + 150 - 150);
    }));

  test("割引の元になるドリンクの値段も DB から（ドリンクを1円に書き換えても 200円引き・550円で会計）", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: ID.americano, quantity: 1, unitPrice: 1, options: [ID.optHotA] },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.discount_amount, 200);
      assert.equal(o.total_amount, 1340 + 550 - 200);
    }));

  test("アルコール（ドリンクの子カテゴリー）も対象（9/16 の点検 A2 の仕様どおり）", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: ID.wine, quantity: 1, unitPrice: 880 },
        ],
      });
      assert.equal((await readOrder(db, orderId)).discount_amount, 200);
    }));

  test("同じ卓の会計前の注文と合わせて数える（フードを先に、ドリンクをあとから別の注文で）", () =>
    inRollback(db, async () => {
      const first = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }],
      });
      const second = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.latte, quantity: 1, unitPrice: 1, options: [ID.optIcedL] }],
      });
      assert.equal((await readOrder(db, first.orderId)).discount_amount, 0);
      const o2 = await readOrder(db, second.orderId);
      assert.equal(o2.discount_amount, 200);
      assert.equal(o2.total_amount, 660 - 200);
    }));

  test("別の卓の注文とは混ぜない", () =>
    inRollback(db, async () => {
      await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }],
      });
      const other = await placeOrder(db, {
        tableId: ID.tableA2, tableLabel: TABLE_A2_LABEL,
        items: [{ id: ID.latte, quantity: 1, unitPrice: 660, options: [ID.optHotL] }],
      });
      assert.equal((await readOrder(db, other.orderId)).discount_amount, 0);
    }));

  test("会計済みの注文は数えない（次のお客様は白紙から）", () =>
    inRollback(db, async () => {
      const first = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }],
      });
      await db.query("UPDATE public.orders SET status = 'paid' WHERE id = $1", [first.orderId]);
      const next = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.latte, quantity: 1, unitPrice: 660, options: [ID.optHotL] }],
      });
      assert.equal((await readOrder(db, next.orderId)).discount_amount, 0);
    }));

  test("設定が OFF なら割引しない", () =>
    inRollback(db, async () => {
      await db.query("UPDATE public.stores SET set_drink_enabled = false WHERE id = $1", [STORE_ID]);
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: ID.americano, quantity: 1, unitPrice: 550, options: [ID.optHotA] },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.discount_amount, 0);
      assert.equal(o.total_amount, 1340 + 550);
    }));
});

describe("1杯ごとの選択（docs/specs/menu-options.md の 11）", () => {
  test("同じドリンクを HOT×3・ICED×1 の2行で送る → 行ごとに保存、割引はフードの数（2杯）まで", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        tableId: ID.tableA2, tableLabel: TABLE_A2_LABEL,
        items: [
          { id: ID.pancake, quantity: 2, unitPrice: 1340, timing: "asap" },
          { id: ID.americano, quantity: 3, unitPrice: 1, options: [ID.optHotA], timing: "first" },
          { id: ID.americano, quantity: 1, unitPrice: 1, options: [ID.optIcedA], timing: "after_meal" },
        ],
      });
      const o = await readOrder(db, orderId);
      // readOrder は 単価 → 数量 の順に並べて返す
      assert.deepEqual(
        o.items.map((i) => [i.quantity, i.unit_price, i.serving_timing, i.options.map((x) => x.name).join()]),
        [
          [1, 550, "after_meal", "ICED"],
          [3, 550, "first", "HOT"],
          [2, 1340, "asap", ""],
        ]
      );
      assert.equal(o.subtotal, 1340 * 2 + 550 * 4);
      assert.equal(o.discount_amount, 200 * 2);
      assert.equal(o.total_amount, 1340 * 2 + 550 * 4 - 400);
    }));
});

describe("税（docs/specs/tax-mode.md）とテイクアウト", () => {
  test("テイクアウトは軽減税率8%。割引は設定どおり付かない。卓は付けない", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        orderType: "takeout",
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL, tableNumber: 5,
        items: [
          { id: ID.cookie, quantity: 2, unitPrice: 1 },
          { id: ID.americano, quantity: 1, unitPrice: 550, options: [ID.optHotA] },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.order_type, "takeout");
      assert.equal(o.table_id, null);
      assert.equal(o.table_label, null);
      assert.equal(o.discount_amount, 0);
      assert.equal(o.tax_rate, 8);
      assert.equal(o.total_amount, 400 * 2 + 550);
      assert.equal(o.tax_amount, Math.floor(((400 * 2 + 550) * 8) / 108));
    }));

  test("テイクアウトも割引の対象にする設定なら、テイクアウトでも割引する", () =>
    inRollback(db, async () => {
      await db.query("UPDATE public.stores SET set_drink_takeout = true WHERE id = $1", [STORE_ID]);
      const { orderId } = await placeOrder(db, {
        orderType: "takeout",
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: ID.americano, quantity: 1, unitPrice: 550, options: [ID.optIcedA] },
        ],
      });
      const o = await readOrder(db, orderId);
      assert.equal(o.discount_amount, 200);
      assert.equal(o.total_amount, 1340 + 550 - 200);
      assert.equal(o.tax_amount, Math.floor(((1340 + 550 - 200) * 8) / 108));
    }));

  test("外税なら（小計 − 割引）に税を足す", () =>
    inRollback(db, async () => {
      await db.query("UPDATE public.stores SET tax_mode = 'excluded' WHERE id = $1", [STORE_ID]);
      const { orderId } = await placeOrder(db, {
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1 },
          { id: ID.americano, quantity: 1, unitPrice: 1, options: [ID.optHotA] },
        ],
      });
      const o = await readOrder(db, orderId);
      const base = 1340 + 550 - 200;
      assert.equal(o.tax_amount, Math.floor((base * 10) / 100));
      assert.equal(o.total_amount, base + Math.floor((base * 10) / 100));
    }));
});

describe("弾くとき・再送のとき（画面の読み分けを含めて、今までどおり）", () => {
  test("メニューに無い商品は 23503 で弾き、画面は「お取り扱いが終わった商品」と読む", () =>
    inRollback(db, async () => {
      const err = await expectRejected({
        items: [
          { id: ID.pancake, quantity: 1, unitPrice: 1340 },
          { id: "99999999-9999-4999-8999-999999999999", quantity: 1, unitPrice: 1 },
        ],
      });
      assert.equal(err.code, "23503");
      assert.match(err.message, /menu_item_id/);
      assert.equal(soldOut.isUnavailableError(err), true);
      assert.equal(soldOut.isSoldOutError(err), false);
    }));

  test("よその店の商品は同じく弾く（その店のメニューの値段しか使わない）", () =>
    inRollback(db, async () => {
      const err = await expectRejected({
        items: [{ id: ID.otherStore, quantity: 1, unitPrice: 300 }],
      });
      assert.equal(err.code, "23503");
      assert.equal(soldOut.isUnavailableError(err), true);
    }));

  test("よその店の注文としてなら、その店の値段で通る", () =>
    inRollback(db, async () => {
      const { orderId } = await placeOrder(db, {
        storeId: OTHER_STORE_ID,
        items: [{ id: ID.otherStore, quantity: 1, unitPrice: 1 }],
      });
      assert.equal((await readOrder(db, orderId)).total_amount, 300);
    }));

  test("売り切れは今までどおり sold_out で弾く", () =>
    inRollback(db, async () => {
      const err = await expectRejected({ items: [{ id: ID.soldOut, quantity: 1, unitPrice: 800 }] });
      assert.equal(err.details, "sold_out");
      assert.equal(soldOut.isSoldOutError(err), true);
    }));

  test("単価が無い・負の明細は今までどおり弾く（古い画面との互換の確認は残す）", () =>
    inRollback(db, async () => {
      const err = await expectRejected({ items: [{ id: ID.pancake, quantity: 1, unitPrice: -1 }] });
      assert.equal(err.code, "22023");
    }));

  test("同じ注文IDの再送は何もしない（false を返し、金額も明細も変わらない）", () =>
    inRollback(db, async () => {
      const orderId = newOrderId();
      const items = [{ id: ID.pancake, quantity: 1, unitPrice: 1340 }];
      assert.equal((await placeOrder(db, { orderId, items })).created, true);
      const again = await placeOrder(db, {
        orderId,
        items: [{ id: ID.pancake2, quantity: 5, unitPrice: 1 }],
      });
      assert.equal(again.created, false);
      const o = await readOrder(db, orderId);
      assert.equal(o.total_amount, 1340);
      assert.equal(o.items.length, 1);
    }));
});

describe("レジで伝票を直したとき（recalc_bill_totals）も同じ金額になる", () => {
  test("place_order が保存した金額を、レジの作り直しがそのまま再現する", () =>
    inRollback(db, async () => {
      const first = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [{ id: ID.pancake, quantity: 2, unitPrice: 1 }],
      });
      const second = await placeOrder(db, {
        tableId: ID.tableA1, tableLabel: TABLE_A1_LABEL,
        items: [
          { id: ID.americano, quantity: 1, unitPrice: 1, options: [ID.optHotA] },
          { id: ID.salad, quantity: 1, unitPrice: 1, options: [ID.optAvocado] },
        ],
      });
      const before1 = await readOrder(db, first.orderId);
      const before2 = await readOrder(db, second.orderId);
      await db.query("SELECT public.recalc_bill_totals($1)", [first.orderId]);
      const pick = (o) => [o.total_amount, o.discount_amount, o.tax_amount, o.tax_rate];
      assert.deepEqual(pick(await readOrder(db, first.orderId)), pick(before1));
      assert.deepEqual(pick(await readOrder(db, second.orderId)), pick(before2));
      assert.equal(before2.discount_amount, 200);
    }));
});

describe("お客様の画面の計算（lib/tax.ts・lib/setDrink.ts）がサーバーと同じ金額を出す", () => {
  /**
   * 画面（カート・完了画面）は「金額の正は DB 側」としつつ、同じ規則を写して表示している。
   * 写しがずれると、画面とレジで金額が食い違う（2026-09-15 に2回起きた）。ここで両方を突き合わせる。
   */
  let tax;
  let setDrink;
  let api;
  let menuOptions;

  before(async () => {
    tax = await importLib("lib/tax.ts");
    setDrink = await importLib("lib/setDrink.ts");
    api = await importLib("lib/api.ts");
    menuOptions = await importLib("lib/menuOptions.ts");
  });

  /** DB の行から、お客様の画面と同じ形のメニュー・カテゴリー・設定を作る */
  async function loadClientMenu() {
    const categories = (await db.query(
      "SELECT id, slug, category_type, serving_timing_choice FROM public.categories WHERE store_id = $1",
      [STORE_ID]
    )).rows;
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.slug]));
    const rows = (await db.query(
      `SELECT id, category_id, name, NULL AS description, price, NULL AS image_url, NULL AS tag,
              is_takeout, options_enabled, options_heading, options_select_mode, is_sold_out
         FROM public.menu_items WHERE store_id = $1`,
      [STORE_ID]
    )).rows;
    const items = Object.fromEntries(rows.map((r) => [r.id, api.rowToMenuItem(r, catMap)]));
    const options = Object.fromEntries(
      (await db.query("SELECT id, name, price FROM public.menu_item_options")).rows.map((o) => [o.id, o])
    );
    const store = (await db.query(
      `SELECT set_drink_enabled, set_drink_discount, set_drink_takeout, tax_mode, tax_rate_dine_in, tax_rate_takeout
         FROM public.stores WHERE id = $1`,
      [STORE_ID]
    )).rows[0];
    return {
      categories,
      items,
      options,
      setDrinkSetting: {
        enabled: store.set_drink_enabled,
        discount: store.set_drink_discount,
        takeout: store.set_drink_takeout,
      },
      taxSetting: {
        mode: store.tax_mode,
        rateDineIn: store.tax_rate_dine_in,
        rateTakeout: store.tax_rate_takeout,
      },
    };
  }

  /** lib/store.ts の placeOrder と同じ手順で、画面に出す割引・税・合計を計算する */
  async function clientTotals(cart, { orderType, tableId = null, tableLabel = null }) {
    const menu = await loadClientMenu();
    const lines = cart.map((c) => {
      const selected = (c.options ?? []).map((id) => menuOptions.toSelected(menu.options[id]));
      const item = menu.items[c.id];
      return { item, quantity: c.quantity, unitPrice: item.price + menuOptions.optionsTotal(selected) };
    });
    let context = null;
    if (orderType === "dine_in" && (tableId || tableLabel)) {
      // lib/setDrink.ts の fetchSetDrinkTableContext と同じ RPC を、同じ形に直して使う
      const row = (await db.query(
        "SELECT public.get_set_drink_table_context($1, $2, $3) AS c",
        [STORE_ID, tableId, tableLabel]
      )).rows[0].c;
      context = {
        foodQty: Number(row.food_qty) || 0,
        drinkPrices: (row.drink_prices ?? []).map((p) => Number(p) || 0),
        applied: Number(row.applied) || 0,
      };
    }
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const discount = setDrink.calcSetDrinkDiscount(
      lines, menu.categories, orderType, menu.setDrinkSetting, context
    );
    const totals = tax.calcOrderTotals({ subtotal, discount, orderType, setting: menu.taxSetting });
    return { subtotal, discount, tax: totals.tax, total: totals.total, rate: totals.rate };
  }

  /** 画面で計算 → 注文 → DB に保存された金額と突き合わせる（端末の単価はわざと1円で送る） */
  async function assertSameAsServer(cart, opts = {}) {
    const orderType = opts.orderType ?? "dine_in";
    const expected = await clientTotals(cart, { ...opts, orderType });
    const { orderId } = await placeOrder(db, {
      ...opts,
      orderType,
      items: cart.map((c) => ({ ...c, unitPrice: 1 })),
    });
    const o = await readOrder(db, orderId);
    assert.deepEqual(
      { subtotal: o.subtotal, discount: o.discount_amount, tax: o.tax_amount, total: o.total_amount, rate: o.tax_rate },
      expected
    );
  }

  const PANCAKE = { id: ID.pancake, quantity: 1 };
  const AMERICANO_HOT = { id: ID.americano, quantity: 1, options: [ID.optHotA] };

  test("割引なし・内税・店内", () =>
    inRollback(db, () => assertSameAsServer([{ id: ID.pancake2, quantity: 2 }])));

  test("トッピングつき・割引あり・安いドリンクから", () =>
    inRollback(db, () =>
      assertSameAsServer([
        { id: ID.salad, quantity: 1, options: [ID.optAvocado, ID.optEgg] },
        PANCAKE,
        AMERICANO_HOT,
        { id: ID.miniDrink, quantity: 2 },
        { id: ID.wine, quantity: 1, options: [ID.optBottle] },
      ])
    ));

  test("1杯ごとの選択（同じドリンクが2行）", () =>
    inRollback(db, () =>
      assertSameAsServer([
        { id: ID.pancake, quantity: 2 },
        { id: ID.latte, quantity: 3, options: [ID.optHotL], timing: "first" },
        { id: ID.latte, quantity: 1, options: [ID.optIcedL], timing: "after_meal" },
      ])
    ));

  test("同じ卓のこれまでの注文と合わせた割引", () =>
    inRollback(db, async () => {
      const table = { tableId: ID.tableA2, tableLabel: TABLE_A2_LABEL };
      await assertSameAsServer([{ id: ID.pancake, quantity: 2 }], table);
      await assertSameAsServer([AMERICANO_HOT], table);
      await assertSameAsServer([{ id: ID.latte, quantity: 2, options: [ID.optIcedL] }], table);
    }));

  test("テイクアウト（8%・割引の設定 OFF / ON）", () =>
    inRollback(db, async () => {
      await assertSameAsServer([{ id: ID.cookie, quantity: 3 }, AMERICANO_HOT, PANCAKE], { orderType: "takeout" });
      await db.query("UPDATE public.stores SET set_drink_takeout = true WHERE id = $1", [STORE_ID]);
      await assertSameAsServer([AMERICANO_HOT, PANCAKE], { orderType: "takeout" });
    }));

  test("外税", () =>
    inRollback(db, async () => {
      await db.query("UPDATE public.stores SET tax_mode = 'excluded' WHERE id = $1", [STORE_ID]);
      await assertSameAsServer([PANCAKE, AMERICANO_HOT, { id: ID.salad, quantity: 1, options: [ID.optEgg] }]);
      await assertSameAsServer([PANCAKE, AMERICANO_HOT], { orderType: "takeout" });
    }));
});
