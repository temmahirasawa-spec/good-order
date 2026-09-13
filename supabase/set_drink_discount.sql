-- ============================================================
-- セットドリンク割引（食事と一緒の注文でドリンクを割り引く）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / categories_type.sql / order_insert_rpc.sql /
--       serving_timing.sql / menu_item_options.sql / sold_out.sql 実行済み。
--
-- 仕様: docs/specs/set-drink-discount.md（2026-09-13、洋輔さんの依頼）
--
--   「食事とドリンクをご注文でドリンク200円引き。フードの数分だけドリンクの金額 -200円」
--   例: パンケーキ1 ＋ ドリンク2 → ドリンク1杯ぶんだけ 200円引き
--
-- 設計の要点:
--   - **金額はサーバー側で計算し直す。** これまで total_amount はお客様の画面が
--     計算した値をそのまま保存していた。割引が絡むと、古い画面や改ざんで金額がずれる
--     余地ができるため、明細と設定から**この関数の中で計算する**。
--     引数 p_total_amount は互換のため残すが、**保存には使わない**。
--   - 割引は**税抜きの小計から引く**（この店の price は税抜き）。
--   - 1杯あたりの割引額はその**ドリンクの単価を超えない**（安い順に引く）。
--     100円のドリンクに200円引いてマイナスの会計を作らないため。
--   - 既定は OFF。この SQL を流しただけでは金額は1円も変わらない。
--   - RLS は触らない。設定の保存は manager 限定の RPC 経由。


-- ────────────────────────────────────────────────────────────
-- 1. 設定（店舗ごと）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS set_drink_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS set_drink_discount integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS set_drink_takeout  boolean NOT NULL DEFAULT false;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_set_drink_discount_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_set_drink_discount_chk
  CHECK (set_drink_discount >= 0 AND set_drink_discount <= 10000);


-- ────────────────────────────────────────────────────────────
-- 2. 注文に「実際に引いた額」を残す
-- ────────────────────────────────────────────────────────────
-- 税抜きの割引額。0 なら割引なし。レジ・履歴・集計がここを見る。
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;


-- ────────────────────────────────────────────────────────────
-- 3. 割引額を計算する（1か所にまとめる）
-- ────────────────────────────────────────────────────────────
-- p_items は place_order が受け取るものと同じ形。
-- 返すのは**税抜きの割引額**。設定が OFF・対象外の注文・フードかドリンクが
-- 片方しか無い注文では 0。
--
-- STABLE: 同じ入力なら同じ結果（設定とメニューを読むだけ。書き換えない）。
CREATE OR REPLACE FUNCTION public.set_drink_discount_for(
  p_store_id   uuid,
  p_order_type text,
  p_items      jsonb
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_enabled  boolean;
  v_per      integer;
  v_takeout  boolean;
  v_food     integer;
  v_drink    integer;
  v_n        integer;
  v_discount integer;
BEGIN
  SELECT set_drink_enabled, set_drink_discount, set_drink_takeout
    INTO v_enabled, v_per, v_takeout
    FROM public.stores WHERE id = p_store_id;

  IF NOT COALESCE(v_enabled, false) OR COALESCE(v_per, 0) <= 0 THEN
    RETURN 0;
  END IF;
  -- 既定は店内のみ。設定でテイクアウトにも広げられる
  IF p_order_type = 'takeout' AND NOT COALESCE(v_takeout, false) THEN
    RETURN 0;
  END IF;

  -- 明細を「区分つき・オプション込みの単価」に開く
  CREATE TEMP TABLE IF NOT EXISTS tmp_set_drink_items (
    quantity   integer,
    unit_price integer,
    ctype      text
  ) ON COMMIT DROP;
  DELETE FROM tmp_set_drink_items;

  INSERT INTO tmp_set_drink_items (quantity, unit_price, ctype)
  SELECT (e->>'quantity')::integer,
         (e->>'unit_price')::integer + COALESCE((
           SELECT SUM(mo.price)
             FROM public.menu_item_options mo
            WHERE mo.id IN (
              SELECT (o->>'option_id')::uuid
                FROM jsonb_array_elements(COALESCE(e->'options', '[]'::jsonb)) AS o
            )
         ), 0),
         COALESCE(c.category_type, 'food')
    FROM jsonb_array_elements(p_items) AS e
    JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
    LEFT JOIN public.categories c ON c.id = m.category_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_food  FROM tmp_set_drink_items WHERE ctype <> 'drink';
  SELECT COALESCE(SUM(quantity), 0) INTO v_drink FROM tmp_set_drink_items WHERE ctype =  'drink';

  v_n := LEAST(v_food, v_drink);
  IF v_n <= 0 THEN
    RETURN 0;
  END IF;

  -- 安い順に v_n 杯。1杯あたり「割引額」と「その杯の単価」の小さいほう
  SELECT COALESCE(SUM(LEAST(v_per, unit_price)), 0)
    INTO v_discount
    FROM (
      SELECT t.unit_price
        FROM tmp_set_drink_items t, generate_series(1, t.quantity)
       WHERE t.ctype = 'drink'
       ORDER BY t.unit_price
       LIMIT v_n
    ) AS cheapest;

  RETURN GREATEST(0, COALESCE(v_discount, 0));
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. 注文の登録（place_order）で割引を適用する
-- ────────────────────────────────────────────────────────────
-- sold_out.sql の place_order と同じ引数・同じ検証。違いは2つだけ:
--   - 割引を計算して orders.discount_amount に残す
--   - total_amount を**明細から計算し直す**（(小計 − 割引) × 1.1 を切り捨て）
CREATE OR REPLACE FUNCTION public.place_order(
  p_order_id     uuid,
  p_store_id     uuid,
  p_table_number integer,
  p_table_id     uuid,
  p_table_label  text,
  p_order_type   text,
  p_total_amount integer,
  p_items        jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows      integer;
  v_item      jsonb;
  v_opt       jsonb;
  v_item_id   uuid;
  v_menu_id   uuid;
  v_opt_ids   uuid[];
  v_extra     integer;
  v_subtotal  integer;
  v_discount  integer;
  v_total     integer;
BEGIN
  -- ── 入力の検証（sold_out.sql と同じ） ──
  IF p_order_type IS NULL OR p_order_type NOT IN ('dine_in', 'takeout') THEN
    RAISE EXCEPTION '不正な order_type: %', p_order_type USING ERRCODE = '22023';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION '不正な total_amount: %', p_total_amount USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION '存在しない店舗です' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION '明細が空です' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS e
     WHERE COALESCE((e->>'quantity')::integer, 0) <= 0
        OR COALESCE((e->>'unit_price')::integer, -1) < 0
        OR (e->>'menu_item_id') IS NULL
  ) THEN
    RAISE EXCEPTION '明細の数量・単価・商品IDが不正です' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS e
     WHERE NULLIF(e->>'serving_timing', '') IS NOT NULL
       AND (e->>'serving_timing') NOT IN ('asap', 'first', 'after_meal')
  ) THEN
    RAISE EXCEPTION '提供タイミングの値が不正です' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) AS e
      JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
     WHERE m.is_sold_out = true
  ) THEN
    RAISE EXCEPTION '売り切れの商品が含まれています'
      USING ERRCODE = '22023', DETAIL = 'sold_out';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF v_item ? 'options' AND jsonb_typeof(v_item->'options') = 'array' THEN
      v_menu_id := (v_item->>'menu_item_id')::uuid;
      FOR v_opt IN SELECT * FROM jsonb_array_elements(v_item->'options') LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.menu_item_options o
           WHERE o.id = (v_opt->>'option_id')::uuid
             AND o.menu_item_id = v_menu_id
             AND o.is_available = true
        ) THEN
          RAISE EXCEPTION '選べないオプションが含まれています' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- ── 金額（サーバー側で計算する。p_total_amount は使わない） ──
  SELECT COALESCE(SUM(
           ((e->>'unit_price')::integer + COALESCE((
              SELECT SUM(mo.price) FROM public.menu_item_options mo
               WHERE mo.id IN (
                 SELECT (o->>'option_id')::uuid
                   FROM jsonb_array_elements(COALESCE(e->'options', '[]'::jsonb)) AS o
               )
            ), 0)) * (e->>'quantity')::integer
         ), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS e;

  v_discount := public.set_drink_discount_for(p_store_id, p_order_type, p_items);
  v_discount := LEAST(v_discount, v_subtotal);          -- 念のため小計を超えない
  v_total    := FLOOR((v_subtotal - v_discount) * 1.1); -- 税は割引後に掛ける

  -- ── 注文本体 ──
  INSERT INTO public.orders (
    id, store_id, table_number, table_id, table_label, status, order_type,
    total_amount, discount_amount
  ) VALUES (
    p_order_id, p_store_id,
    CASE WHEN p_order_type = 'takeout' THEN 0    ELSE COALESCE(p_table_number, 0) END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_id    END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_label END,
    'pending', p_order_type, v_total, v_discount
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false;   -- 同じ注文の再送。既存行には触れない
  END IF;

  -- ── 明細（割引は明細に散らさない。注文全体の discount_amount に持つ） ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_menu_id := (v_item->>'menu_item_id')::uuid;
    v_opt_ids := ARRAY[]::uuid[];
    v_extra   := 0;
    IF v_item ? 'options' AND jsonb_typeof(v_item->'options') = 'array' THEN
      SELECT COALESCE(array_agg((o->>'option_id')::uuid), ARRAY[]::uuid[])
        INTO v_opt_ids
        FROM jsonb_array_elements(v_item->'options') AS o;
      SELECT COALESCE(SUM(mo.price), 0) INTO v_extra
        FROM public.menu_item_options mo
       WHERE mo.id = ANY (v_opt_ids);
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price, serving_timing)
    VALUES (
      p_order_id, v_menu_id,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::integer + v_extra,
      NULLIF(v_item->>'serving_timing', '')
    )
    RETURNING id INTO v_item_id;

    IF array_length(v_opt_ids, 1) > 0 THEN
      INSERT INTO public.order_item_options (order_item_id, option_id, name, price)
      SELECT v_item_id, mo.id, mo.name, mo.price
        FROM public.menu_item_options mo
       WHERE mo.id = ANY (v_opt_ids)
       ORDER BY mo.display_order, mo.created_at;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. 設定の保存（manager のみ）
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_set_drink_setting(
  p_enabled  boolean,
  p_discount integer,
  p_takeout  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'セットドリンクの設定を変更する権限がありません' USING ERRCODE = '42501';
  END IF;
  IF p_discount IS NULL OR p_discount < 0 OR p_discount > 10000 THEN
    RAISE EXCEPTION '割引額が不正です: %', p_discount USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores
     SET set_drink_enabled  = COALESCE(p_enabled, false),
         set_drink_discount = p_discount,
         set_drink_takeout  = COALESCE(p_takeout, false)
   WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_set_drink_setting(boolean, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_set_drink_setting(boolean, integer, boolean) TO authenticated;

-- 割引の計算はお客様の画面（anon）も「いくら引かれるか」を出すために使う
GRANT EXECUTE ON FUNCTION public.set_drink_discount_for(uuid, text, jsonb) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, set_drink_enabled, set_drink_discount, set_drink_takeout FROM public.stores;
--   -- 既定は OFF。管理画面「メニュー ＞ セットドリンク」で ON にすると効きはじめる。
--
--   -- 直近の注文の割引:
--   SELECT created_at, order_type, total_amount, discount_amount
--     FROM public.orders ORDER BY created_at DESC LIMIT 10;
