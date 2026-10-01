/**
 * 値段の計算を確かめるための、手元だけで動くデータベース（PGlite = WebAssembly の Postgres）。
 * 本番にはつながない。テストのたびにメモリ上に作って捨てる。
 *
 * スキーマは tests/fixtures/schema.sql（本番の列を写したもの）。
 * 関数は**リポジトリの supabase/*.sql をそのまま流す**。テスト用の写しを持たないので、
 * SQL ファイルを直せばテストもそれを確かめることになる。
 */
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const ROOT = new URL("../../", import.meta.url);

/**
 * 値段の計算に関わる SQL。本番に流した順番のとおりに並べる。
 * place_order は途中のファイルにも古い版が入っているが、最後のファイルが勝つ。
 */
export const PRICING_SQL_FILES = [
  "supabase/set_drink_discount.sql",    // set_drink_discount_for（セットドリンク割引）
  "supabase/tax_mode.sql",              // calc_order_total（内税/外税・軽減税率）
  "supabase/set_drink_table_scope.sql", // 割引を卓の会計前の注文ぜんぶで数える
  "supabase/register_edit.sql",         // recalc_bill_totals（レジで伝票を直したときの作り直し）
  "supabase/order_server_pricing.sql",  // place_order（値段を DB から引く。2026-10-01）
];

export const STORE_ID = "10000000-0000-0000-0000-000000000001";
export const OTHER_STORE_ID = "20000000-0000-0000-0000-000000000002";

/** テストで使うメニュー。本番の YORKYS BRUNCH に似せた値段（2026-10-01 時点） */
export const ID = {
  catPancake: "c0000000-0000-4000-8000-000000000001",
  catDrink:   "c0000000-0000-4000-8000-000000000002",
  catAlcohol: "c0000000-0000-4000-8000-000000000003",
  catSalad:   "c0000000-0000-4000-8000-000000000004",

  pancake:    "a0000000-0000-4000-8000-000000000001", // パンケーキ 1,340（フード）
  pancake2:   "a0000000-0000-4000-8000-000000000002", // パンケーキ フルーツ 1,540（フード）
  salad:      "a0000000-0000-4000-8000-000000000003", // サラダボウル 1,320（フード・トッピング複数）
  americano:  "a0000000-0000-4000-8000-000000000004", // アメリカーノ 550（ドリンク・HOT/ICED）
  latte:      "a0000000-0000-4000-8000-000000000005", // カフェラテ 660（ドリンク・HOT/ICED）
  wine:       "a0000000-0000-4000-8000-000000000006", // グラスワイン 880（アルコール＝ドリンクの子カテゴリー）
  miniDrink:  "a0000000-0000-4000-8000-000000000007", // ミニドリンク 150（割引額 200 より安いドリンク）
  cookie:     "a0000000-0000-4000-8000-000000000008", // テイクアウト専用クッキー 400（カテゴリー無し）
  soldOut:    "a0000000-0000-4000-8000-000000000009", // 売り切れ 800
  otherStore: "a0000000-0000-4000-8000-000000000010", // よその店の商品 300

  optHotA:    "b0000000-0000-4000-8000-000000000001", // アメリカーノ HOT 0
  optIcedA:   "b0000000-0000-4000-8000-000000000002", // アメリカーノ ICED 0
  optHotL:    "b0000000-0000-4000-8000-000000000003", // カフェラテ HOT 0
  optIcedL:   "b0000000-0000-4000-8000-000000000004", // カフェラテ ICED 0
  optAvocado: "b0000000-0000-4000-8000-000000000005", // サラダ アボカド 120
  optEgg:     "b0000000-0000-4000-8000-000000000006", // サラダ ゆで卵 100
  optHidden:  "b0000000-0000-4000-8000-000000000007", // サラダ 非表示のトッピング 180
  optBottle:  "b0000000-0000-4000-8000-000000000008", // ワイン ボトルワイン 4,620

  tableCatA:  "d0000000-0000-4000-8000-000000000001",
  tableA1:    "e0000000-0000-4000-8000-000000000001",
  tableA2:    "e0000000-0000-4000-8000-000000000002",
};

export const TABLE_A1_LABEL = "テーブル席 A-1";
export const TABLE_A2_LABEL = "テーブル席 A-2";

const SEED_SQL = `
INSERT INTO public.stores (id, name, slug) VALUES
  ('${STORE_ID}', 'YORKYS BRUNCH', 'yorkys-shukugawa'),
  ('${OTHER_STORE_ID}', 'よその店', 'other');

-- 本番と同じ設定: セットドリンク割引 ON・1杯 200円・テイクアウトは対象外 ／ 内税・店内10%・持帰8%
UPDATE public.stores
   SET set_drink_enabled = true, set_drink_discount = 200, set_drink_takeout = false,
       tax_mode = 'included', tax_rate_dine_in = 10, tax_rate_takeout = 8
 WHERE id = '${STORE_ID}';

INSERT INTO public.categories (id, store_id, slug, name, display_order, category_type, serving_timing_choice, parent_id) VALUES
  ('${ID.catPancake}', '${STORE_ID}', 'pancake', 'パンケーキ', 1, 'food',  true,  NULL),
  ('${ID.catSalad}',   '${STORE_ID}', 'salad',   'サラダ',     2, 'food',  true,  NULL),
  ('${ID.catDrink}',   '${STORE_ID}', 'drink',   'ドリンク',   3, 'drink', true,  NULL),
  ('${ID.catAlcohol}', '${STORE_ID}', 'alcohol', 'アルコール', 4, 'drink', false, '${ID.catDrink}');

INSERT INTO public.menu_items (id, store_id, category_id, name, price, display_order, is_takeout, options_enabled, options_select_mode, is_sold_out) VALUES
  ('${ID.pancake}',    '${STORE_ID}',       '${ID.catPancake}', 'パンケーキ プレーン',   1340, 1, false, false, 'multiple', false),
  ('${ID.pancake2}',   '${STORE_ID}',       '${ID.catPancake}', 'パンケーキ フルーツ',   1540, 2, false, false, 'multiple', false),
  ('${ID.salad}',      '${STORE_ID}',       '${ID.catSalad}',   'グリーンサラダボウル',  1320, 3, false, true,  'multiple', false),
  ('${ID.americano}',  '${STORE_ID}',       '${ID.catDrink}',   'アメリカーノ',           550, 4, false, true,  'single',   false),
  ('${ID.latte}',      '${STORE_ID}',       '${ID.catDrink}',   'カフェラテ',             660, 5, false, true,  'single',   false),
  ('${ID.wine}',       '${STORE_ID}',       '${ID.catAlcohol}', 'グラスワイン',           880, 6, false, true,  'single',   false),
  ('${ID.miniDrink}',  '${STORE_ID}',       '${ID.catDrink}',   'ミニドリンク',           150, 7, false, false, 'multiple', false),
  ('${ID.cookie}',     '${STORE_ID}',       NULL,               'クッキー（持ち帰り）',   400, 8, true,  false, 'multiple', false),
  ('${ID.soldOut}',    '${STORE_ID}',       '${ID.catPancake}', '売り切れのパンケーキ',   800, 9, false, false, 'multiple', true),
  ('${ID.otherStore}', '${OTHER_STORE_ID}', NULL,               'よその店の商品',         300, 1, false, false, 'multiple', false);

INSERT INTO public.menu_item_options (id, menu_item_id, name, price, display_order, is_available) VALUES
  ('${ID.optHotA}',    '${ID.americano}', 'HOT',            0, 1, true),
  ('${ID.optIcedA}',   '${ID.americano}', 'ICED',           0, 2, true),
  ('${ID.optHotL}',    '${ID.latte}',     'HOT',            0, 1, true),
  ('${ID.optIcedL}',   '${ID.latte}',     'ICED',           0, 2, true),
  ('${ID.optAvocado}', '${ID.salad}',     'アボカド',     120, 1, true),
  ('${ID.optEgg}',     '${ID.salad}',     'ゆで卵',       100, 2, true),
  ('${ID.optHidden}',  '${ID.salad}',     'スモークサーモン', 180, 3, false),
  ('${ID.optBottle}',  '${ID.wine}',      'ボトルワイン', 4620, 1, true);

INSERT INTO public.table_categories (id, store_id, code, name) VALUES
  ('${ID.tableCatA}', '${STORE_ID}', 'A', 'テーブル席');
INSERT INTO public.tables (id, store_id, category_id, number, short_code) VALUES
  ('${ID.tableA1}', '${STORE_ID}', '${ID.tableCatA}', 1, 'aaaaaa'),
  ('${ID.tableA2}', '${STORE_ID}', '${ID.tableCatA}', 2, 'bbbbbb');
`;

/** スキーマ → 関数（リポジトリの SQL）→ テスト用のメニュー の順に作ったデータベースを返す */
export async function createPricingDb() {
  const db = await PGlite.create();
  await db.exec(await readFile(new URL("tests/fixtures/schema.sql", ROOT), "utf8"));
  for (const file of PRICING_SQL_FILES) {
    await db.exec(await readFile(new URL(file, ROOT), "utf8"));
  }
  await db.exec(SEED_SQL);
  return db;
}

/** 1つのテストを取引の中で動かし、最後に必ず元に戻す（テスト同士が影響し合わないように） */
export async function inRollback(db, fn) {
  await db.exec("BEGIN");
  try {
    return await fn();
  } finally {
    await db.exec("ROLLBACK");
  }
}

let seq = 0;
/** テストごとに別の注文ID（UUID の形）を作る */
export function newOrderId() {
  seq += 1;
  return `f0000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/**
 * place_order を、お客様の画面（lib/store.ts の saveOrderToDb）と同じ引数の形で呼ぶ。
 * items: [{ id, quantity, unitPrice, options?: [optionId...], timing? }]
 */
export async function placeOrder(db, {
  orderId = newOrderId(),
  storeId = STORE_ID,
  tableNumber = 0,
  tableId = null,
  tableLabel = null,
  orderType = "dine_in",
  totalAmount = 0,
  items,
}) {
  const pItems = items.map((i) => ({
    menu_item_id: i.id,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    serving_timing: i.timing ?? null,
    options: (i.options ?? []).map((optionId) => ({ option_id: optionId })),
  }));
  const res = await db.query(
    "SELECT public.place_order($1, $2, $3, $4, $5, $6, $7, $8::jsonb) AS created",
    [orderId, storeId, tableNumber, tableId, tableLabel, orderType, totalAmount, JSON.stringify(pItems)]
  );
  return { orderId, created: res.rows[0].created };
}

/**
 * 保存された注文（金額の列）と明細（単価・オプションのスナップショット）を読む。
 * 明細は「単価 → 数量 → 提供タイミング」の順に並べて返す（同じ取引の中で作った行は
 * created_at が同じで id は乱数なので、値で並べないとテストの結果が毎回変わる）。
 */
export async function readOrder(db, orderId) {
  const order = (await db.query(
    `SELECT total_amount, discount_amount, tax_amount, tax_rate, order_type, table_id, table_label
       FROM public.orders WHERE id = $1`,
    [orderId]
  )).rows[0];
  const items = (await db.query(
    `SELECT oi.menu_item_id, oi.quantity, oi.unit_price, oi.serving_timing,
            COALESCE((SELECT json_agg(json_build_object('name', o.name, 'price', o.price)
                                      ORDER BY o.price DESC, o.name)
                        FROM public.order_item_options o WHERE o.order_item_id = oi.id), '[]') AS options
       FROM public.order_items oi WHERE oi.order_id = $1
      ORDER BY oi.unit_price, oi.quantity, oi.serving_timing NULLS FIRST`,
    [orderId]
  )).rows;
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return { ...order, subtotal, items };
}

/**
 * PGlite のエラーを、お客様の画面が受け取る形（supabase-js の PostgrestError: code / message / details / hint）に直す。
 * lib/soldOut.ts の isSoldOutError / isUnavailableError にそのまま渡して、画面側の判定まで確かめるため。
 */
export function asPostgrestError(err) {
  return { code: err.code, message: err.message, details: err.detail ?? null, hint: err.hint ?? null };
}
