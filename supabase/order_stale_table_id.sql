-- 作り直された卓（tables の行が消えた卓）でも注文が通るようにする
-- リポジトリ: supabase/order_stale_table_id.sql（2026-09-16）
--
-- ■ 何が起きていたか
--   管理画面の席設定（save_table_layout）は、一覧に無い卓を **DELETE** する。
--   2026-09-08 に「A-1」を「テーブル席 / ボックス席」に組み替えたとき、
--   古い tables の行が消えて、新しい行が作られた。
--
--   ところがお客様のスマホは、カート（localStorage の orderly-cart）に
--   **その時の tables.id を持ち続けている**。二次元コードから入り直さないかぎり消えない。
--   その状態で注文すると orders.table_id の外部キーに引っかかり、
--
--     insert or update on table "orders" violates foreign key constraint "orders_table_id_fkey"
--
--   で **注文が丸ごと失敗する**。お客様は何度押しても通らない（2026-09-16、洋輔さんが遭遇）。
--
-- ■ 直し方
--   注文を落とさない。卓の行が見つからないときは、
--     1. **同じラベルの卓が今あるなら、そこに付け替える。**
--        ラベル（"テーブル席 A-1"）は resolve_table が作る形と同じで、
--        席の物理的な位置を指している。行が作り直されただけなら同じ席に戻る
--     2. 見つからなければ table_id は NULL。**table_label は残す**ので、
--        厨房もレジも「テーブル席 A-1」として読める
--
--   ⚠ レジは会計を table_id で束ねている。NULL のまま table_number が 0 だと
--     別のお客様の伝票と合流してしまうため、**レジ側も table_label で束ねるように直した**
--     （app/admin/(protected)/register/page.tsx の tableKey）。片方だけ入れないこと。

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

  /* ── 消えた卓の救済（2026-09-16）─────────────────────────────
     お客様のスマホが覚えている卓が、席設定の作り直しで消えていることがある。
     **ここで注文を落とさない。** 同じラベルの卓が今あるなら付け替え、
     無ければ NULL にして table_label だけ残す。
     ラベルの作り方は resolve_table と同じ（カテゴリー名 + コード-番号）。 */
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

  v_discount := public.set_drink_discount_for(p_store_id, p_order_type, p_items);
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
