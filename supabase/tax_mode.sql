-- ============================================================
-- 消費税の扱い（内税 / 外税、店内10% / テイクアウト8%）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / order_insert_rpc.sql / serving_timing.sql /
--       menu_item_options.sql / sold_out.sql / set_drink_discount.sql 実行済み。
--
-- 何のためのものか（2026-09-15、洋輔さんの指摘）:
--   店舗はメニューの価格を**税込**で登録していたのに、システムは**税抜**として扱い、
--   最後にさらに10%を掛けていた。**二重に課税していた**。
--     例: パンケーキ 1,340 + 1,540 + アメリカーノ 550 = 3,430（すべて税込のつもり）
--         → 本来 3,430 円のところ 3,773 円を請求していた
--   プレオープン前でお客様への影響は無かったが、明日から実営業に入るため急いで直す。
--
--   あわせて軽減税率にも対応する。テイクアウトは 8%、店内飲食は 10%。
--
-- 入れるもの:
--   stores.tax_mode          … 'included'（内税）/ 'excluded'（外税）
--   stores.tax_rate_dine_in  … 店内の税率（%）。既定 10
--   stores.tax_rate_takeout  … テイクアウトの税率（%）。既定 8
--   orders.tax_amount        … その注文の消費税額（円）。レシート・集計用に残す
--   orders.tax_rate          … その注文に適用した税率（%）
--
-- **既定は 'included'（内税）**。いまの登録データが税込なので、
-- この SQL を流した時点で金額が正しくなる。外税で運用したい場合は管理画面で切り替える。
--
-- 計算の決まり（アプリ側 lib/tax.ts と必ず同じにすること）:
--   内税: 合計 = 小計 − 割引
--         消費税 = floor(合計 × 税率 ÷ (100 + 税率))   … 合計に含まれている分
--   外税: 課税対象 = 小計 − 割引
--         消費税 = floor(課税対象 × 税率 ÷ 100)
--         合計   = 課税対象 + 消費税
--
-- 税率は**注文の種別**（dine_in / takeout）で決める。1回の注文の中で品目ごとに
-- 分けることはしない。内税運用ではお客様の支払額は変わらず、レシートの内訳だけが
-- 変わるため。品目ごとに分ける必要が出たら、そのとき order_items 側に持たせる。


-- ────────────────────────────────────────────────────────────
-- 1. 設定（店舗ごと）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS tax_mode         text    NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS tax_rate_dine_in integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tax_rate_takeout integer NOT NULL DEFAULT 8;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_tax_mode_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_tax_mode_chk CHECK (tax_mode IN ('included', 'excluded'));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_tax_rate_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_tax_rate_chk
  CHECK (tax_rate_dine_in BETWEEN 0 AND 100 AND tax_rate_takeout BETWEEN 0 AND 100);


-- ────────────────────────────────────────────────────────────
-- 2. 注文に消費税額と税率を残す
-- ────────────────────────────────────────────────────────────
-- レシートに「税率ごとの消費税額」を刷るために要る（インボイス対応の下ごしらえ）。
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate   integer NOT NULL DEFAULT 10;


-- ────────────────────────────────────────────────────────────
-- 3. 金額の計算を1か所にまとめる
-- ────────────────────────────────────────────────────────────
-- 小計（p_subtotal）と割引（p_discount）から、消費税と合計を出す。
-- **lib/tax.ts の calcTotals() と同じ規則。変えるときは必ず両方直すこと。**
CREATE OR REPLACE FUNCTION public.calc_order_total(
  p_subtotal integer,
  p_discount integer,
  p_mode     text,
  p_rate     integer,
  OUT tax    integer,
  OUT total  integer
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base integer := GREATEST(0, COALESCE(p_subtotal, 0) - COALESCE(p_discount, 0));
BEGIN
  IF p_mode = 'included' THEN
    -- 価格に消費税が含まれている。合計はそのまま。内訳として税を割り戻す
    total := v_base;
    tax   := FLOOR(v_base::numeric * p_rate / (100 + p_rate));
  ELSE
    -- 価格は税抜。最後に加算する
    tax   := FLOOR(v_base::numeric * p_rate / 100);
    total := v_base + tax;
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. 注文の登録（place_order）に税の扱いを組み込む
-- ────────────────────────────────────────────────────────────
-- set_drink_discount.sql の place_order と同じ引数・同じ検証。違いは金額の出し方だけ。
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
  v_tax       integer;
  v_mode      text;
  v_rate      integer;
BEGIN
  -- ── 入力の検証（set_drink_discount.sql と同じ） ──
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
  v_discount := LEAST(v_discount, v_subtotal);

  -- 税の設定を引く。テイクアウトは軽減税率
  SELECT tax_mode,
         CASE WHEN p_order_type = 'takeout' THEN tax_rate_takeout ELSE tax_rate_dine_in END
    INTO v_mode, v_rate
    FROM public.stores WHERE id = p_store_id;
  v_mode := COALESCE(v_mode, 'included');
  v_rate := COALESCE(v_rate, 10);

  SELECT c.tax, c.total INTO v_tax, v_total
    FROM public.calc_order_total(v_subtotal, v_discount, v_mode, v_rate) AS c;

  -- ── 注文本体 ──
  INSERT INTO public.orders (
    id, store_id, table_number, table_id, table_label, status, order_type,
    total_amount, discount_amount, tax_amount, tax_rate
  ) VALUES (
    p_order_id, p_store_id,
    CASE WHEN p_order_type = 'takeout' THEN 0    ELSE COALESCE(p_table_number, 0) END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_id    END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_label END,
    'pending', p_order_type, v_total, v_discount, v_tax, v_rate
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false;   -- 同じ注文の再送。既存行には触れない
  END IF;

  -- ── 明細 ──
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
CREATE OR REPLACE FUNCTION public.save_tax_setting(
  p_mode         text,
  p_rate_dine_in integer,
  p_rate_takeout integer
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
    RAISE EXCEPTION '税の設定を変更する権限がありません' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('included', 'excluded') THEN
    RAISE EXCEPTION '税の扱いが不正です: %', p_mode USING ERRCODE = '22023';
  END IF;
  IF p_rate_dine_in IS NULL OR p_rate_dine_in < 0 OR p_rate_dine_in > 100
     OR p_rate_takeout IS NULL OR p_rate_takeout < 0 OR p_rate_takeout > 100 THEN
    RAISE EXCEPTION '税率が不正です' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores
     SET tax_mode         = p_mode,
         tax_rate_dine_in = p_rate_dine_in,
         tax_rate_takeout = p_rate_takeout
   WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_tax_setting(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tax_setting(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_order_total(integer, integer, text, integer) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, tax_mode, tax_rate_dine_in, tax_rate_takeout FROM public.stores;
--
--   -- 内税で 3,430 − 200 の場合 → 合計 3,230 / うち消費税 293
--   SELECT * FROM public.calc_order_total(3430, 200, 'included', 10);
--   -- 外税なら → 消費税 323 / 合計 3,553
--   SELECT * FROM public.calc_order_total(3430, 200, 'excluded', 10);
