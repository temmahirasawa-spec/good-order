-- ============================================================
-- セットドリンク割引を「1回の注文」ではなく「同じ卓の会計前の注文ぜんぶ」で数える（2026-09-16）
-- 実行は Supabase MCP 経由（本番 good-order / oiropkuvaenebmlicrac）
-- ============================================================
--
-- 前提: set_drink_discount.sql / order_stale_table_id.sql 実行済み。列の追加・RLS の変更は無い。
--
-- ■ 何が起きていたか（プレオープン初日に洋輔さんが発見）
--   割引は place_order が「その注文の明細」だけで計算していた。フードを先に頼み、
--   あとからドリンクを別の注文（別のスマホ含む）で頼むと、どちらの注文にも
--   組み合わせが無く、割引が 0 円になった。初日は卓ごとに見て最大 3,200 円ぶん付いていない。
--
-- ■ 決めたこと（天真 2026-09-16）: 案2「注文するときに、その卓の前の注文も見て割引を付ける」。
--   今日の分はさかのぼって計算し直さない。
--
-- ■ 直し方
--   - 「同じ卓」= table_id、無ければ卓ラベル（厨房・レジ・伝票と同じ規則）。
--     「会計前」= 同じ営業日で status <> 'paid'。会計が済むと次のお客様は白紙から数える。
--   - この注文に付ける割引 = （卓のこれまで＋この注文 で計算した割引）−（これまでの注文に既に付けた割引）。
--     0 未満にはしない、この注文の小計を超えない。
--   - お客様の画面（カート・完了画面）が同じ数字を出せるよう、卓の「これまでのフードの数・
--     ドリンクの単価・付いた割引」だけを返す読み取り関数を anon に開ける。商品名・金額の合計・
--     注文 ID は返さない。
--   - テイクアウトは卓が無いので従来どおり（その注文だけ）。

-- ────────────────────────────────────────────────────────────
-- 1. 卓の「これまで」（会計前の注文の明細）を、set_drink_discount_for が読める形で返す
-- ────────────────────────────────────────────────────────────
-- 返る配列の要素: {"menu_item_id", "quantity", "unit_price"}。
-- order_items.unit_price はオプション込みなので options は付けない（二重に足さないため）。
CREATE OR REPLACE FUNCTION public.set_drink_table_prior_items(
  p_store_id    uuid,
  p_table_id    uuid,
  p_table_label text,
  p_exclude_order uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'menu_item_id', oi.menu_item_id,
           'quantity',     oi.quantity,
           'unit_price',   oi.unit_price
         )), '[]'::jsonb)
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.store_id = p_store_id
     AND o.order_type = 'dine_in'
     AND o.status <> 'paid'
     AND o.business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date
     AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
     AND (
       (p_table_id IS NOT NULL AND o.table_id = p_table_id)
       OR (p_table_id IS NULL AND o.table_id IS NULL
           AND NULLIF(btrim(COALESCE(o.table_label, '')), '') = NULLIF(btrim(COALESCE(p_table_label, '')), ''))
     );
$$;

-- これまでの注文に既に付けた割引の合計
CREATE OR REPLACE FUNCTION public.set_drink_table_prior_discount(
  p_store_id    uuid,
  p_table_id    uuid,
  p_table_label text,
  p_exclude_order uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(o.discount_amount), 0)::integer
    FROM public.orders o
   WHERE o.store_id = p_store_id
     AND o.order_type = 'dine_in'
     AND o.status <> 'paid'
     AND o.business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date
     AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
     AND (
       (p_table_id IS NOT NULL AND o.table_id = p_table_id)
       OR (p_table_id IS NULL AND o.table_id IS NULL
           AND NULLIF(btrim(COALESCE(o.table_label, '')), '') = NULLIF(btrim(COALESCE(p_table_label, '')), ''))
     );
$$;

-- ────────────────────────────────────────────────────────────
-- 2. お客様の画面用: 卓の「これまで」の要約（anon 可。名前も ID も返さない）
-- ────────────────────────────────────────────────────────────
-- 返り値: {"food_qty": 3, "drink_prices": [550, 660], "applied": 200}
CREATE OR REPLACE FUNCTION public.get_set_drink_table_context(
  p_store_id    uuid,
  p_table_id    uuid,
  p_table_label text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_food  integer;
  v_drinks jsonb;
BEGIN
  v_items := public.set_drink_table_prior_items(p_store_id, p_table_id, p_table_label, NULL);
  SELECT COALESCE(SUM((e->>'quantity')::integer), 0) INTO v_food
    FROM jsonb_array_elements(v_items) AS e
    JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
    LEFT JOIN public.categories c ON c.id = m.category_id
   WHERE COALESCE(c.category_type, 'food') <> 'drink';
  SELECT COALESCE(jsonb_agg(s.p ORDER BY s.p), '[]'::jsonb) INTO v_drinks
    FROM (
      SELECT (e->>'unit_price')::integer AS p
        FROM jsonb_array_elements(v_items) AS e
        JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
        JOIN public.categories c ON c.id = m.category_id AND c.category_type = 'drink',
        generate_series(1, (e->>'quantity')::integer)
    ) s;
  RETURN jsonb_build_object(
    'food_qty', v_food,
    'drink_prices', v_drinks,
    'applied', public.set_drink_table_prior_discount(p_store_id, p_table_id, p_table_label, NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_drink_table_prior_items(uuid, uuid, text, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_drink_table_prior_discount(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_set_drink_table_context(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_set_drink_table_context(uuid, uuid, text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. place_order: 割引を卓の「これまで＋この注文」で計算する（それ以外は order_stale_table_id.sql と同じ）
-- ────────────────────────────────────────────────────────────
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
  v_prior     jsonb;
BEGIN
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

  -- 消えた卓の救済（order_stale_table_id.sql）
  IF p_table_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tables WHERE id = p_table_id) THEN
    SELECT t.id INTO p_table_id
      FROM public.tables t
      JOIN public.table_categories c ON c.id = t.category_id
     WHERE c.name || ' ' || c.code || '-' || t.number::text
           = NULLIF(btrim(COALESCE(p_table_label, '')), '')
     LIMIT 1;
  END IF;

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

  /* ── セットドリンク割引（2026-09-16: 卓の会計前の注文をまとめて数える）──
     この注文だけ → 卓のこれまで＋この注文 で計算し、既に付けた分を引いた残りをこの注文に付ける。
     卓が無い注文（table_id も label も無い）とテイクアウトは、これまでどおりこの注文だけ。 */
  IF p_order_type = 'dine_in'
     AND (p_table_id IS NOT NULL OR NULLIF(btrim(COALESCE(p_table_label, '')), '') IS NOT NULL) THEN
    v_prior := public.set_drink_table_prior_items(p_store_id, p_table_id, p_table_label, p_order_id);
    v_discount := public.set_drink_discount_for(p_store_id, p_order_type, v_prior || p_items)
                - public.set_drink_table_prior_discount(p_store_id, p_table_id, p_table_label, p_order_id);
    v_discount := GREATEST(v_discount, 0);
  ELSE
    v_discount := public.set_drink_discount_for(p_store_id, p_order_type, p_items);
  END IF;
  v_discount := LEAST(v_discount, v_subtotal);

  SELECT tax_mode,
         CASE WHEN p_order_type = 'takeout' THEN tax_rate_takeout ELSE tax_rate_dine_in END
    INTO v_mode, v_rate
    FROM public.stores WHERE id = p_store_id;
  v_mode := COALESCE(v_mode, 'included');
  v_rate := COALESCE(v_rate, 10);

  SELECT c.tax, c.total INTO v_tax, v_total
    FROM public.calc_order_total(v_subtotal, v_discount, v_mode, v_rate) AS c;

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
    RETURN false;
  END IF;

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
-- 実行後の確認（取引内。必ず ROLLBACK）
-- ────────────────────────────────────────────────────────────
--   BEGIN;
--   SELECT public.place_order('66666666-6666-4666-8666-666666666661', '10000000-0000-0000-0000-000000000001', 0,
--     'c6966132-d75b-4177-b065-ee2129785f50', 'テーブル席 A-1', 'dine_in', 1340,
--     '[{"menu_item_id":"<パンケーキ>","quantity":1,"unit_price":1340}]');      -- フードだけ → 割引 0
--   SELECT public.place_order('66666666-6666-4666-8666-666666666662', ... 同じ卓 ...,
--     '[{"menu_item_id":"<アメリカーノ>","quantity":1,"unit_price":550}]');      -- ドリンクだけ → 割引 200
--   SELECT public.get_set_drink_table_context('10000000-0000-0000-0000-000000000001','c6966132-d75b-4177-b065-ee2129785f50','テーブル席 A-1');
--   ROLLBACK;
