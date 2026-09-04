-- ============================================================
-- 提供タイミング（でき次第 / 先出し / 食後）と、伝票の2枚出し
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / categories_type.sql / order_insert_rpc.sql /
--       print_jobs.sql / printer_status.sql 実行済み。
--
-- 仕様: docs/specs/serving-timing.md
--
-- 何のためのものか:
--   1. お客様が商品ごとに提供タイミングを選べるようにする。
--      対象カテゴリーは categories.serving_timing_choice（管理画面「カテゴリ管理」の
--      トグル「提供タイミングをお客様が選べる」）で決める。
--      選択肢の文言は区分（category_type）で決まる:
--        food  → 'asap'（でき次第） / 'after_meal'（食後）
--        drink → 'first'（先出し）  / 'after_meal'（食後）
--   2. 選んだ値を注文明細（order_items.serving_timing）に残し、伝票と厨房画面に出す。
--   3. 伝票の2枚出し（FOOD と DRINK が両方ある注文）の判定に使えるよう、
--      claim_print_job() が明細ごとの区分を返すようにする。
--      2枚出しの本体（紙の組み立て）は lib/receipt.ts。
--
-- 設計の要点:
--   - 値は 'asap' / 'first' / 'after_meal' の3値。「標準 / 食後」の2値にしないのは、
--     後からカテゴリーの区分を変えても、過去の注文・伝票の意味が変わらないようにするため。
--   - NULL = 提供タイミングの選択対象外（テイクアウト・対象外カテゴリー・移行前の注文）。
--   - RLS は一切触らない。anon の権限も増やさない。値の検証は place_order() の中で行う。
--   - 関数は CREATE OR REPLACE で差し替える。引数の型が同じなので既存の GRANT は残る。
--
-- ⚠ 流す順番について:
--   アプリ側のコードは、この SQL が流れている前提で新しい列を読む。
--   **必ず、この SQL を流してから PR をマージすること。**
--   逆にすると、お客様側のカテゴリー取得と厨房画面の明細取得が
--   「列が無い」エラーで失敗する。
--   この SQL だけ先に流してもアプリは壊れない（列が増えるだけ）。


-- ────────────────────────────────────────────────────────────
-- 1. カテゴリー: 提供タイミングをお客様が選べるか
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS serving_timing_choice boolean NOT NULL DEFAULT false;


-- ────────────────────────────────────────────────────────────
-- 2. 初期データ（YORKYS BRUNCH、2026-09-04 の決定）
-- ────────────────────────────────────────────────────────────
-- 2-a. 区分の補正。
--   本番のカテゴリーは全件が 'food' のままで、「ドリンク」「アルコール」も
--   フード区分になっていた（2026-09-04 に確認）。このままだと 2枚出しも
--   ドリンクの「先出し / 食後」も一度も効かないので、ここで直す。
--   管理画面「カテゴリ管理」の「区分」からいつでも変えられる。
UPDATE public.categories
   SET category_type = 'drink'
 WHERE category_type <> 'drink'
   AND (
     slug IN ('drink', 'alcohol', 'coffee', 'tea', 'soft')
     OR name IN ('ドリンク', 'アルコール', 'コーヒー', '紅茶', 'ソフトドリンク')
   );

-- 2-b. 対象カテゴリー: パンケーキ・フレンチトースト・ドリンク区分の全部を ON。
--   slug は環境で揺れる（本番は 'frenchtoast'、初期データは 'french_toast'）ので名前でも拾う。
UPDATE public.categories
   SET serving_timing_choice = true
 WHERE category_type = 'drink'
    OR slug IN ('pancake', 'french_toast', 'frenchtoast')
    OR name IN ('パンケーキ', 'フレンチトースト');


-- ────────────────────────────────────────────────────────────
-- 3. 注文明細: 選んだ提供タイミング
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS serving_timing text;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_serving_timing_chk;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_serving_timing_chk
  CHECK (serving_timing IS NULL OR serving_timing IN ('asap', 'first', 'after_meal'));


-- ────────────────────────────────────────────────────────────
-- 4. 注文の登録（place_order）に serving_timing を通す
-- ────────────────────────────────────────────────────────────
-- order_insert_rpc.sql の place_order と同じ引数・同じ振る舞い。
-- 違いは p_items の各要素で "serving_timing" を受け取り、明細に書くことだけ。
--   [{"menu_item_id": "uuid", "quantity": 2, "unit_price": 1100, "serving_timing": "after_meal"}, ...]
-- serving_timing が無い・null → NULL（選択対象外）。3値以外 → 注文ごと拒否。
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
  -- ── 入力の検証（order_insert_rpc.sql と同じ） ──
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

  -- ── 提供タイミングの検証（今回の追加） ──
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS e
     WHERE NULLIF(e->>'serving_timing', '') IS NOT NULL
       AND (e->>'serving_timing') NOT IN ('asap', 'first', 'after_meal')
  ) THEN
    RAISE EXCEPTION '提供タイミングの値が不正です' USING ERRCODE = '22023';
  END IF;

  -- ── 注文本体（order_insert_rpc.sql と同じ） ──
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

  -- 同じ注文の再送。既存行には一切触れない（受渡番号も変わらない）
  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  -- ── 明細 ──
  INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price, serving_timing)
  SELECT p_order_id,
         (e->>'menu_item_id')::uuid,
         (e->>'quantity')::integer,
         (e->>'unit_price')::integer,
         NULLIF(e->>'serving_timing', '')
    FROM jsonb_array_elements(p_items) AS e;

  RETURN true;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. 伝票データ（claim_print_job）に提供タイミングと区分を足す
-- ────────────────────────────────────────────────────────────
-- print_jobs.sql の claim_print_job と同じ振る舞い。返す JSON の items だけ増える:
--   { "name": "パンケーキ", "quantity": 1, "servingTiming": "after_meal" | null,
--     "categoryType": "food" | "drink" }
-- printer_poll()（printer_status.sql）はこの関数を呼ぶだけなので、差し替えれば効く。
CREATE OR REPLACE FUNCTION public.claim_print_job(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job    public.print_jobs%ROWTYPE;
  v_order  public.orders%ROWTYPE;
  v_items  jsonb;
  v_count  integer;
BEGIN
  UPDATE public.print_jobs j
     SET status     = 'printing',
         claimed_at = now(),
         attempts   = j.attempts + 1
   WHERE j.id = (
     SELECT id FROM public.print_jobs
      WHERE store_id = p_store_id
        AND status = 'pending'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.* INTO v_job;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_job.order_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'name',          m.name,
             'quantity',      oi.quantity,
             'servingTiming', oi.serving_timing,
             -- 区分が引けない（カテゴリーが消えている等）ときは food 扱い
             'categoryType',  COALESCE(c.category_type, 'food')
           )
           ORDER BY oi.created_at, oi.id
         ), '[]'::jsonb),
         COALESCE(SUM(oi.quantity), 0)
    INTO v_items, v_count
    FROM public.order_items oi
    JOIN public.menu_items m ON m.id = oi.menu_item_id
    LEFT JOIN public.categories c ON c.id = m.category_id
   WHERE oi.order_id = v_job.order_id;

  RETURN jsonb_build_object(
    'jobId',      v_job.id,
    'seq',        v_job.seq,
    'orderType',  v_order.order_type,
    'tableLabel', v_order.table_label,
    'pickupNo',   v_order.pickup_no,
    'createdAt',  v_order.created_at,
    'items',      v_items,
    'itemCount',  v_count
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. 動作確認用（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
--   -- 対象カテゴリーと区分:
--   SELECT slug, name, category_type, serving_timing_choice FROM public.categories ORDER BY display_order;
--
--   -- 直近の明細と提供タイミング:
--   SELECT o.table_label, m.name, oi.quantity, oi.serving_timing, oi.created_at
--     FROM public.order_items oi
--     JOIN public.orders o ON o.id = oi.order_id
--     JOIN public.menu_items m ON m.id = oi.menu_item_id
--    ORDER BY oi.created_at DESC LIMIT 20;
