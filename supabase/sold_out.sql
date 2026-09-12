-- ============================================================
-- 売り切れ（SOLD OUT）: 商品を注文画面に残したまま、注文できなくする
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / order_insert_rpc.sql / serving_timing.sql / menu_item_options.sql 実行済み。
--
-- 仕様: docs/specs/sold-out-and-receipt-copies.md（2026-09-12、洋輔さんの依頼）
--
-- 何のためのものか:
--   これまで「売り切れ」は公開トグル（menu_items.is_available）を OFF にして
--   商品ごと隠すしかなかった。お客様には「そんな商品は無かった」ように見える。
--   これからは商品を残したまま「SOLD OUT」と出し、カートに入れられないようにする。
--
-- 設計の要点:
--   - is_available（公開）とは別の列にする。「隠す」と「売り切れを見せる」は別の操作。
--   - 既定 false。この SQL を流しただけでは、お客様の画面は 1px も変わらない。
--   - 注文の登録（place_order）で売り切れの商品を弾く。画面側でも押せなくするが、
--     売り切れにした直後に古い画面から送られてくる注文はここで止める（最後の砦）。
--   - RLS は触らない。売り切れの切替は管理画面「メニュー管理」から、
--     公開トグルと同じ経路（authenticated の UPDATE）で行う。
--
-- ⚠ 流す順番: **この SQL を流してから PR をマージすること。**
--   アプリ側は新しい列（is_sold_out）を前提に SELECT する。SQL だけ先に流しても壊れない。


-- ────────────────────────────────────────────────────────────
-- 1. 列
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_sold_out boolean NOT NULL DEFAULT false;


-- ────────────────────────────────────────────────────────────
-- 2. 注文の登録（place_order）で売り切れを弾く
-- ────────────────────────────────────────────────────────────
-- menu_item_options.sql の place_order と同じ引数・同じ振る舞い。
-- 違いは「明細に is_sold_out = true の商品があれば注文ごと拒否する」の1点だけ。
-- 拒否するときの DETAIL を 'sold_out' に固定し、アプリ側（lib/soldOut.ts）が
-- 通信エラーと区別して「売り切れの商品が含まれています」と案内できるようにする。
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
  v_rows     integer;
  v_item     jsonb;
  v_opt      jsonb;
  v_item_id  uuid;
  v_menu_id  uuid;
  v_opt_ids  uuid[];
  v_extra    integer;
BEGIN
  -- ── 入力の検証（order_insert_rpc.sql / serving_timing.sql / menu_item_options.sql と同じ） ──
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

  -- ── 売り切れの検証（今回の追加） ──
  -- 画面側でも押せなくしているが、売り切れにした直後に古い画面から届く注文はここで止める。
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) AS e
      JOIN public.menu_items m ON m.id = (e->>'menu_item_id')::uuid
     WHERE m.is_sold_out = true
  ) THEN
    RAISE EXCEPTION '売り切れの商品が含まれています'
      USING ERRCODE = '22023', DETAIL = 'sold_out';
  END IF;

  -- ── オプションの検証（menu_item_options.sql と同じ）: 商品のものであり、表示中であること ──
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

  -- ── 注文本体 ──
  INSERT INTO public.orders (
    id, store_id, table_number, table_id, table_label, status, order_type, total_amount
  ) VALUES (
    p_order_id, p_store_id,
    CASE WHEN p_order_type = 'takeout' THEN 0    ELSE COALESCE(p_table_number, 0) END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_id    END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_label END,
    'pending', p_order_type, p_total_amount
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false;   -- 同じ注文の再送。既存行には触れない
  END IF;

  -- ── 明細（1件ずつ。オプションの価格を足し、スナップショットを残す） ──
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
      p_order_id,
      v_menu_id,
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
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, is_available, is_sold_out FROM public.menu_items ORDER BY display_order;
--   -- 全件 is_sold_out = false なら成功（お客様の画面はまだ何も変わらない）。
--   -- 管理画面「メニュー管理」で「売り切れ」を ON にすると、その商品が SOLD OUT になる。
