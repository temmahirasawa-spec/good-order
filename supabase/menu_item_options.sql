-- ============================================================
-- メニューのオプション（トッピング）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / order_insert_rpc.sql / print_jobs.sql / printer_status.sql /
--       serving_timing.sql 実行済み。
--
-- 仕様: docs/specs/menu-options.md（2026-09-04 に天真が決定）
--
-- 何のためのものか:
--   商品ごとに「追加で選べるもの」（トッピング等）を管理画面から設定し、
--   お客様が商品詳細で選んで注文できるようにする。店舗専用ではなく汎用の仕組み。
--
-- 設計の要点:
--   - お客様が選んだオプションは order_item_options に「名前と価格のスナップショット」で残す。
--     後でオプションを消したり値段を変えても、過去の注文・伝票は変わらない。
--   - 行の単価 order_items.unit_price は **オプション込み** で保存する。
--     既存の合計・消費税・売上集計（unit_price × quantity）がそのまま効く。
--   - オプションの価格は place_order() の中で DB から引き直す（お客様側の値を信用しない）。
--   - RLS は menu_items / order_items と同じ考え方。anon の権限は増やさない。
--
-- ⚠ 流す順番: **この SQL を流してから PR をマージすること。**
--   アプリ側は新しい列（options_enabled 等）と表を前提に読む。SQL だけ先に流しても壊れない。


-- ────────────────────────────────────────────────────────────
-- 1. 商品: オプションの設定
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS options_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS options_heading text NOT NULL DEFAULT 'トッピング',
  ADD COLUMN IF NOT EXISTS options_select_mode text NOT NULL DEFAULT 'multiple';

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_options_select_mode_chk;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_options_select_mode_chk
  CHECK (options_select_mode IN ('multiple', 'single'));


-- ────────────────────────────────────────────────────────────
-- 2. オプションの一覧（商品ごと）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_item_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  price         integer     NOT NULL DEFAULT 0 CHECK (price >= 0),   -- 税抜き円。0 = 無料
  display_order integer     NOT NULL DEFAULT 0,
  is_available  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_item_options_item
  ON public.menu_item_options (menu_item_id, display_order);

ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_item_options_select_all" ON public.menu_item_options;
CREATE POLICY "menu_item_options_select_all"
  ON public.menu_item_options FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "menu_item_options_write_authenticated" ON public.menu_item_options;
CREATE POLICY "menu_item_options_write_authenticated"
  ON public.menu_item_options FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 3. 注文明細に付いたオプション（スナップショット）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_item_options (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  uuid        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_id      uuid        REFERENCES public.menu_item_options(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  price          integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_item_options_item
  ON public.order_item_options (order_item_id);

ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
-- 書き込みは place_order()（SECURITY DEFINER）だけが行う。anon の INSERT ポリシーは作らない
DROP POLICY IF EXISTS "order_item_options_select_authenticated" ON public.order_item_options;
CREATE POLICY "order_item_options_select_authenticated"
  ON public.order_item_options FOR SELECT TO authenticated USING (true);


-- ────────────────────────────────────────────────────────────
-- 4. 注文の登録（place_order）にオプションを通す
-- ────────────────────────────────────────────────────────────
-- serving_timing.sql の place_order と同じ引数・同じ振る舞い。
-- 違いは p_items の各要素で "options": [{"option_id": "uuid"}, ...] を受け取り、
--   - その商品のオプションであること・表示中であることを確認し（違えば注文ごと拒否）
--   - 価格を DB から引いて unit_price に足し
--   - order_item_options に名前と価格を残すこと。
-- unit_price はお客様側が送る「商品そのものの価格」で、ここでオプション分を足す。
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
  -- ── 入力の検証（order_insert_rpc.sql / serving_timing.sql と同じ） ──
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

  -- ── オプションの検証（今回の追加）: 商品のものであり、表示中であること ──
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
      -- 同じオプションを2回送られても1つとして扱う
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
-- 5. 伝票データ（claim_print_job）にオプションを足す
-- ────────────────────────────────────────────────────────────
-- serving_timing.sql の claim_print_job と同じ。items の各要素に
--   "options": [{"name": "アボカド", "price": 120}, ...]
-- が増える（無ければ空配列）。
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
     SET status = 'printing', claimed_at = now(), attempts = j.attempts + 1
   WHERE j.id = (
     SELECT id FROM public.print_jobs
      WHERE store_id = p_store_id AND status = 'pending'
      ORDER BY created_at LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.* INTO v_job;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_job.order_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'name',          m.name,
             'quantity',      oi.quantity,
             'servingTiming', oi.serving_timing,
             'categoryType',  COALESCE(c.category_type, 'food'),
             'options',       COALESCE((
               SELECT jsonb_agg(jsonb_build_object('name', oo.name, 'price', oo.price) ORDER BY oo.created_at, oo.id)
                 FROM public.order_item_options oo WHERE oo.order_item_id = oi.id
             ), '[]'::jsonb)
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
    'jobId', v_job.id, 'seq', v_job.seq, 'orderType', v_order.order_type,
    'tableLabel', v_order.table_label, 'pickupNo', v_order.pickup_no,
    'createdAt', v_order.created_at, 'items', v_items, 'itemCount', v_count
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. 初期データ（YORKYS BRUNCH: グリーンサラダボウルの12種）
-- ────────────────────────────────────────────────────────────
-- 商品は本番の id で指定し、念のため名前でも拾う。既に同名のオプションがあれば足さない。
DO $$
DECLARE
  v_item uuid;
BEGIN
  SELECT id INTO v_item FROM public.menu_items
   WHERE id = '17bc4c4d-5927-4ab6-a237-9c5fcc363421'
      OR name LIKE '%グリーンサラダボウル%'
   ORDER BY (id = '17bc4c4d-5927-4ab6-a237-9c5fcc363421') DESC
   LIMIT 1;
  IF v_item IS NULL THEN
    RAISE NOTICE 'グリーンサラダボウルが見つからないため初期データは入れませんでした';
    RETURN;
  END IF;

  UPDATE public.menu_items
     SET options_enabled = true, options_heading = 'トッピング', options_select_mode = 'multiple'
   WHERE id = v_item;

  INSERT INTO public.menu_item_options (menu_item_id, name, price, display_order)
  SELECT v_item, x.name, x.price, x.ord
    FROM (VALUES
      ('アボカド',          120, 1),
      ('キャロットラペ',    100, 2),
      ('さつまいもコンポート', 100, 3),
      ('かぼちゃマッシュ',  100, 4),
      ('ブロッコリー',      100, 5),
      ('ハーブ蒸し鶏',      180, 6),
      ('無添加ロースハム',  200, 7),
      ('スモークサーモン',  180, 8),
      ('生ハム',            180, 9),
      ('ゆで卵',            100, 10),
      ('カッテージチーズ',  120, 11),
      ('グリークヨーグルト', 120, 12)
    ) AS x(name, price, ord)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.menu_item_options o WHERE o.menu_item_id = v_item AND o.name = x.name
   );
END $$;


-- ────────────────────────────────────────────────────────────
-- 7. 動作確認用（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
--   SELECT m.name, m.options_enabled, m.options_heading, m.options_select_mode, o.name, o.price, o.display_order
--     FROM public.menu_items m LEFT JOIN public.menu_item_options o ON o.menu_item_id = m.id
--    WHERE m.options_enabled ORDER BY m.name, o.display_order;
