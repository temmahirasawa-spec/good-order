-- ============================================================
-- 注文の登録を SECURITY DEFINER の RPC に移す（place_order）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / takeout.sql / staff_foundation.sql /
--       tables_qr.sql / pickup_no.sql / staff_role_rls.sql /
--       print_jobs.sql 実行済み。
--
-- ────────────────────────────────────────────────────────────
-- なぜ必要か（2026-08-20 に発覚した不具合の修正）
-- ────────────────────────────────────────────────────────────
-- お客様が注文を確定しても DB に保存されていなかった。
--
--   [saveOrderToDb] failed: {code: 42501,
--     message: new row violates row-level security policy for table "orders"}
--
-- 原因は2つの変更の組み合わせ。どちらも単体では正しい:
--   1. pickup_no.sql の作業で lib/store.ts を .insert() から
--      .upsert(..., { onConflict: "id", ignoreDuplicates: true }) に変更した
--      （同じ注文が再送されても受渡番号が振り直されないようにするため）
--   2. staff_role_rls.sql で orders の UPDATE をスタッフのロール限定に絞った
--
-- PostgREST の upsert は ON CONFLICT DO NOTHING であっても **UPDATE 権限を要求する**。
-- anon には UPDATE ポリシーが1つも無いため、upsert 全体が拒否されていた。
-- 実測: 素の INSERT は 201 で成功、upsert だけが 401 / 42501 で失敗。
--
-- ────────────────────────────────────────────────────────────
-- なぜ RPC にするのか（RLS を緩めない）
-- ────────────────────────────────────────────────────────────
-- anon に orders の UPDATE ポリシーを与えれば最小の変更で直るが、それは
-- 「金額を後から書き換えられる経路」を作ることになり RLS の緩和にあたる。
-- orders_anon_lockdown.sql で anon の読み取りを SECURITY DEFINER 関数に
-- 移したのと同じやり方で、書き込みも関数の内側に閉じる。
--
-- この方式なら副次的に次も満たせる:
--   - 注文とその明細が **1トランザクション** で入る。
--     従来は orders と order_items を別々に往復していたため、
--     途中で失敗すると「明細の無い注文」が残りえた
--   - status をクライアントに決めさせない（従来は anon が status='paid' の
--     注文を直接 INSERT できてしまっていた）
--   - 再送は「何もしない」で確実に冪等（受渡番号も振り直されない）


-- ────────────────────────────────────────────────────────────
-- 1. 注文の登録
-- ────────────────────────────────────────────────────────────
-- p_items の形:
--   [{"menu_item_id": "uuid", "quantity": 2, "unit_price": 1100}, ...]
--
-- 返り値は「今回この呼び出しで新しく登録されたか」。
-- false は再送（既存の注文なので何もしていない）を意味し、失敗ではない。
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
  v_rows integer;
BEGIN
  -- ── 入力の検証 ──
  IF p_order_type IS NULL OR p_order_type NOT IN ('dine_in', 'takeout') THEN
    RAISE EXCEPTION '不正な order_type: %', p_order_type USING ERRCODE = '22023';
  END IF;

  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION '不正な total_amount: %', p_total_amount USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION '存在しない店舗です' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
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

  -- ── 注文本体 ──
  -- テイクアウトは卓を持たない、という正規化はここで行う
  -- （従来 lib/store.ts が担っていた分岐をサーバー側に移した）。
  -- status は必ず 'pending'。クライアントが渡してきても採用しない。
  -- pickup_no / business_date は BEFORE INSERT トリガー（pickup_no.sql）が採番する。
  INSERT INTO public.orders (
    id, store_id, table_number, table_id, table_label,
    status, order_type, total_amount
  ) VALUES (
    p_order_id,
    p_store_id,
    CASE WHEN p_order_type = 'takeout' THEN 0    ELSE COALESCE(p_table_number, 0) END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_id    END,
    CASE WHEN p_order_type = 'takeout' THEN NULL ELSE p_table_label END,
    'pending',
    p_order_type,
    p_total_amount
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 同じ注文の再送。既存行には一切触れない（受渡番号も変わらない）。
  -- 明細も入れ直さない
  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  -- ── 明細 ──
  -- 注文本体と同じトランザクションなので、ここで落ちれば注文ごと無かったことになる。
  -- 「明細の無い注文」が残ることはない
  INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price)
  SELECT p_order_id,
         (e->>'menu_item_id')::uuid,
         (e->>'quantity')::integer,
         (e->>'unit_price')::integer
    FROM jsonb_array_elements(p_items) AS e;

  RETURN true;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. 権限
-- ────────────────────────────────────────────────────────────
-- お客様（anon）とスタッフ（authenticated）が呼ぶ。
REVOKE ALL ON FUNCTION public.place_order(uuid, uuid, integer, uuid, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, integer, uuid, text, text, integer, jsonb) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 【この先は今回は実行しない】直接 INSERT の経路を閉じる
-- ────────────────────────────────────────────────────────────
-- 上の RPC 経由の注文が本番で問題なく動くことを確認したうえで、
-- 別途これを実行すると anon が orders / order_items を直接 INSERT する経路が塞がる
-- （現状 anon は status='paid' の注文を直接作れてしまうため、いずれ塞ぐべき）。
--
-- 今回いっしょに実行しないのは、RPC に不具合があったときに
-- 注文が完全に通らなくなる状態を作らないため。段階を分ける。
--
--   DROP POLICY IF EXISTS "orders_insert_all"      ON public.orders;
--   DROP POLICY IF EXISTS "order_items_insert_all" ON public.order_items;
--
-- 実行後に注文が通らなくなった場合は、setup.sql の該当箇所を流し直せば戻せる。


-- ────────────────────────────────────────────────────────────
-- 4. 動作確認用（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
--   SELECT public.place_order(
--     gen_random_uuid(),
--     '10000000-0000-0000-0000-000000000001',
--     1, NULL, 'A-1', 'dine_in', 1210,
--     '[{"menu_item_id":"<実在するmenu_items.id>","quantity":1,"unit_price":1100}]'::jsonb
--   );
--   -- true が返れば登録成功。同じ order_id でもう一度呼ぶと false（再送扱い）
