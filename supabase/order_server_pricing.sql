-- ============================================================
-- 注文の値段をサーバーで決める（お客様の端末が送った値段を使わない）（2026-10-01）
-- 実行は天真（Supabase の SQL Editor。本番 good-order / oiropkuvaenebmlicrac）
-- ============================================================
--
-- 前提: set_drink_table_scope.sql / tax_mode.sql / register_edit.sql 実行済み。
--       （いまの本番の place_order は set_drink_table_scope.sql の section 3 と同じ中身。
--         2026-10-01 に pg_get_functiondef で確認）
--       **列・表の追加は無く、RLS も触らない。** 差し替えるのは place_order 1つだけ。
--       引数・戻り値・権限は今と同じなので、お客様のスマホに開きっぱなしの古い画面も、
--       レジの「足す」（lib/api.ts の addItemsFromRegister）も、そのまま動く。
--
-- ■ 何が起きていたか（docs/preopen-verify-2026-09-16.md の O3）
--   place_order は明細の unit_price（商品そのものの値段）を、お客様の端末が送った値のまま
--   order_items に保存し、合計もそこから計算していた。端末の値を書き換えれば
--   1円でも注文が通る（9/16 の点検で再現）。オプションの値段・セットドリンク割引・税・合計は
--   既にサーバーで計算していたが、その元になる「商品の値段」だけが端末任せだった。
--
-- ■ 直し方
--   1. 商品の値段は menu_items.price から引く。p_items の unit_price は**値段には使わない**。
--      古い画面が送ってくるので受け取りはする（「0以上の整数」の確認も今までどおり）。
--      食い違ったときは WARNING をログに残す（＝改ざんや古いカートに、あとから気づけるように）
--   2. その店のメニューにある商品かを確かめる（menu_items.store_id = p_store_id）。
--      無ければ「メニューに無い商品」で弾く。エラーコードは外部キー違反と同じ 23503 で、
--      文面に menu_item_id を入れる ＝ 画面側（lib/soldOut.ts の isUnavailableError）が
--      今までと同じ「お取り扱いが終わった商品」の案内を出す（今までは order_items の
--      外部キー違反で同じ所に落ちていた。新たに弾くのは「よその店の商品」だけ）
--   3. セットドリンク割引にも「DB の値段に置き換えた明細」を渡す（割引の元の単価も端末任せにしない）
--   4. オプションの値段・税・提供タイミング・売り切れ・消えた卓の救済・再送の扱いは今と同じ
--
-- ■ 決めたこと
--   - 端末の値段と DB の値段が食い違っても**注文は止めない**（DB の値段で登録する）。
--     止めると、古い画面を開いたままのお客様が「通信エラー」で注文できなくなる
--     （2026-09-15 の「押しても永久に通らない」と同じ壊れ方）。
--     お客様の画面は、カートを開くたびに値段を最新のメニューに合わせる（lib/cartPricing.ts）ので、
--     ふだんは食い違わない。
--   - 注文時点の単価のスナップショット（order_items.unit_price）という意味は変わらない。
--     「お客様がカートに入れた時点の値段」ではなく「注文を受けた時点のメニューの値段」になる。
--
-- ■ 流す順番: この SQL → PR のマージ（規約どおり）。
--   どちらが先でも壊れない作りにしてある（新しい画面も unit_price を送り続ける）。
--
-- ■ 戻し方: set_drink_table_scope.sql の section 3（place_order）をもう一度流す。
--   引数・戻り値が同じなので CREATE OR REPLACE で元の関数に戻る。
--
-- ■ 回帰テスト: tests/order-pricing.test.mjs（npm test）。
--   この SQL ファイルをそのまま PGlite（手元で動く Postgres）に流して、値段・割引・税・
--   1杯ごとの選択・テイクアウト・お客様の画面の計算との一致を確かめる。


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
  v_items     jsonb;    -- p_items を DB の値段で作り直した明細。金額はすべてこれで計算する
  v_missing   text;
  v_mismatch  text;
  v_subtotal  integer;
  v_discount  integer;
  v_total     integer;
  v_tax       integer;
  v_mode      text;
  v_rate      integer;
  v_prior     jsonb;
BEGIN
  -- ── 入力の検証（set_drink_table_scope.sql と同じ。順番も同じ） ──
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
  -- unit_price は値段には使わないが、古い画面との互換のため「0以上の整数」であることは今までどおり見る
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

  -- ── その店のメニューにある商品か（2026-10-01） ──
  -- 消えた商品は今までも order_items の外部キー違反（23503）で落ちていた。同じコードで先に弾き、
  -- 文面に menu_item_id を入れて、画面側の「お取り扱いが終わった商品」の判定に乗せる。
  SELECT string_agg(DISTINCT e->>'menu_item_id', ', ')
    INTO v_missing
    FROM jsonb_array_elements(p_items) AS e
   WHERE NOT EXISTS (
           SELECT 1 FROM public.menu_items m
            WHERE m.id = (e->>'menu_item_id')::uuid
              AND m.store_id = p_store_id
         );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'メニューに無い商品が含まれています（menu_item_id: %）', v_missing
      USING ERRCODE = '23503';
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

  -- ── 明細を DB の値段で作り直す（2026-10-01） ──
  -- unit_price = menu_items.price（商品そのもの）。オプションの値段は今までどおり下で DB から足す。
  -- options が配列でないもの（壊れた入力）は「オプション無し」として扱う。並びは送られた順のまま。
  SELECT jsonb_agg(jsonb_build_object(
           'menu_item_id',   m.id,
           'quantity',       (e.value->>'quantity')::integer,
           'unit_price',     m.price,
           'options',        CASE WHEN jsonb_typeof(e.value->'options') = 'array'
                                  THEN e.value->'options' ELSE '[]'::jsonb END,
           'serving_timing', NULLIF(e.value->>'serving_timing', '')
         ) ORDER BY e.ord)
    INTO v_items
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(value, ord)
    JOIN public.menu_items m
      ON m.id = (e.value->>'menu_item_id')::uuid
     AND m.store_id = p_store_id;

  -- 上の確認のあとで商品が消された場合（管理画面の削除と同時に注文が来た等）、その行が黙って
  -- 抜けた注文にならないよう、行の数が合わなければ同じエラーで弾く（今までの外部キー違反と同じ結果）
  IF COALESCE(jsonb_array_length(v_items), 0) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'メニューに無い商品が含まれています（menu_item_id: 確認中に消えた商品）'
      USING ERRCODE = '23503';
  END IF;

  -- 値段が負の商品は通さない。今までは端末の値段で弾いていた線を、DB の値段で守る
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) AS e WHERE (e->>'unit_price')::integer < 0) THEN
    RAISE EXCEPTION '明細の数量・単価・商品IDが不正です' USING ERRCODE = '22023';
  END IF;

  -- ── 金額（ここから先は v_items だけを使う。p_items の unit_price は見ない） ──
  SELECT COALESCE(SUM(
           ((e->>'unit_price')::integer + COALESCE((
              SELECT SUM(mo.price) FROM public.menu_item_options mo
               WHERE mo.id IN (
                 SELECT (o->>'option_id')::uuid
                   FROM jsonb_array_elements(e->'options') AS o
               )
            ), 0)) * (e->>'quantity')::integer
         ), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(v_items) AS e;

  /* ── セットドリンク割引（set_drink_table_scope.sql と同じ規則。渡す明細だけ v_items に） ──
     卓のこれまで＋この注文 で計算し、既に付けた分を引いた残りをこの注文に付ける。
     卓が無い注文（table_id も label も無い）とテイクアウトは、この注文だけで数える。
     「これまで」は order_items.unit_price（place_order が保存した値）なので、これからの注文は DB の値段 */
  IF p_order_type = 'dine_in'
     AND (p_table_id IS NOT NULL OR NULLIF(btrim(COALESCE(p_table_label, '')), '') IS NOT NULL) THEN
    v_prior := public.set_drink_table_prior_items(p_store_id, p_table_id, p_table_label, p_order_id);
    v_discount := public.set_drink_discount_for(p_store_id, p_order_type, v_prior || v_items)
                - public.set_drink_table_prior_discount(p_store_id, p_table_id, p_table_label, p_order_id);
    v_discount := GREATEST(v_discount, 0);
  ELSE
    v_discount := public.set_drink_discount_for(p_store_id, p_order_type, v_items);
  END IF;
  v_discount := LEAST(v_discount, v_subtotal);

  -- 税（tax_mode.sql）。テイクアウトは軽減税率
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

  -- ── 明細（単価は DB の値段 ＋ DB のオプションの値段） ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_menu_id := (v_item->>'menu_item_id')::uuid;
    SELECT COALESCE(array_agg((o->>'option_id')::uuid), ARRAY[]::uuid[])
      INTO v_opt_ids
      FROM jsonb_array_elements(v_item->'options') AS o;
    SELECT COALESCE(SUM(mo.price), 0) INTO v_extra
      FROM public.menu_item_options mo
     WHERE mo.id = ANY (v_opt_ids);

    INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price, serving_timing)
    VALUES (
      p_order_id, v_menu_id,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::integer + v_extra,
      v_item->>'serving_timing'
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

  -- ── 端末が送った値段と食い違った明細をログに残す（注文は DB の値段で通っている） ──
  -- Supabase の Logs（Postgres）で「price_mismatch」を検索すると見つかる。
  -- ふだんは出ない。出るのは、改ざん・カートを開いたまま店が値段を変えた場合など。
  SELECT string_agg(format('%s 端末%s→DB%s', m.id, (e->>'unit_price')::integer, m.price), ', ')
    INTO v_mismatch
    FROM jsonb_array_elements(p_items) AS e
    JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
   WHERE (e->>'unit_price')::integer <> m.price;
  IF v_mismatch IS NOT NULL THEN
    RAISE WARNING 'place_order price_mismatch: 注文 % は端末の単価を使わず DB の価格で登録しました（%）',
      p_order_id, v_mismatch;
  END IF;

  RETURN true;
END;
$$;

-- 権限は今までと同じ（order_insert_rpc.sql と同じ形。CREATE OR REPLACE でも残るが、念のため明示する）
REVOKE ALL ON FUNCTION public.place_order(uuid, uuid, integer, uuid, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, integer, uuid, text, text, integer, jsonb) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 実行後の確認
-- ────────────────────────────────────────────────────────────
-- 「--   」の行が SQL（先頭の「--」を外して流す）。「--   -- 」の行は期待する結果の説明。
-- (1) 差し替わったか・権限が今までどおりか
--   SELECT p.proname, array_to_string(p.proacl, ' | ') AS grants,
--          pg_get_functiondef(p.oid) LIKE '%price_mismatch%' AS is_new
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'place_order';
--   -- 1行。is_new = true。grants に anon と authenticated があり、先頭に「=X」（PUBLIC）が無いこと
--
-- (2) 1円で送っても DB の値段で入るか（取引の中で試して**必ず ROLLBACK**。本番に何も残さない）
-- ※ テイクアウトで試すのは、本物の卓のセットドリンク割引の計算に混ざらないようにするため。
--   BEGIN;
--   SELECT public.place_order(
--     '77777777-7777-4777-8777-777777777771', '10000000-0000-0000-0000-000000000001', 0, NULL, NULL,
--     'takeout', 1,
--     (SELECT jsonb_build_array(jsonb_build_object('menu_item_id', id, 'quantity', 2, 'unit_price', 1))
--        FROM public.menu_items WHERE is_available AND NOT is_sold_out AND NOT options_enabled
--       ORDER BY display_order LIMIT 1));
--   SELECT o.total_amount, o.tax_amount, o.tax_rate, oi.quantity, oi.unit_price, m.price AS menu_price
--     FROM public.orders o
--     JOIN public.order_items oi ON oi.order_id = o.id
--     JOIN public.menu_items m ON m.id = oi.menu_item_id
--    WHERE o.id = '77777777-7777-4777-8777-777777777771';
--   -- unit_price = menu_price（1 ではない）。内税・テイクアウト（割引なし）なら total_amount = menu_price × 2
--   ROLLBACK;
--
-- (3) セットドリンク割引も DB の値段で付くか（店内・実在しない卓ラベルで試す。必ず ROLLBACK）
--   BEGIN;
--   SELECT public.place_order(
--     '77777777-7777-4777-8777-777777777772', '10000000-0000-0000-0000-000000000001', 0, NULL,
--     '確認用 Z-99', 'dine_in', 1,
--     jsonb_build_array(
--       (SELECT jsonb_build_object('menu_item_id', m.id, 'quantity', 1, 'unit_price', 1)
--          FROM public.menu_items m JOIN public.categories c ON c.id = m.category_id
--         WHERE c.category_type = 'food' AND m.is_available AND NOT m.is_sold_out AND NOT m.options_enabled
--         ORDER BY m.display_order LIMIT 1),
--       (SELECT jsonb_build_object('menu_item_id', m.id, 'quantity', 1, 'unit_price', 1)
--          FROM public.menu_items m JOIN public.categories c ON c.id = m.category_id
--         WHERE c.category_type = 'drink' AND m.is_available AND NOT m.is_sold_out AND NOT m.options_enabled
--         ORDER BY m.display_order LIMIT 1)));
--   SELECT o.total_amount, o.discount_amount, o.tax_amount,
--          (SELECT SUM(oi.unit_price * oi.quantity) FROM public.order_items oi WHERE oi.order_id = o.id) AS subtotal
--     FROM public.orders o WHERE o.id = '77777777-7777-4777-8777-777777777772';
--   -- subtotal = 2品のメニューの値段の合計。セットドリンク割引が ON なら discount_amount = min(割引額, ドリンクの値段)、
--   -- total_amount = subtotal − discount_amount（内税）
--   ROLLBACK;
