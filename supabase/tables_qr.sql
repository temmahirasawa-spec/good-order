-- ============================================================
-- Step3-O: テーブル・二次元コード管理
--   table_categories / tables の新設と、orders への table_id / table_label 追加
--   Supabase Dashboard > SQL Editor に貼り付けて実行してください
-- ============================================================
--
-- 【重要】STEP 0 の確認クエリを先に実行し、影響件数を確かめてから
--         STEP 1 以降を流してください。
--
-- 設計の要点:
--   * 二次元コードのURLには **不変の short_code** を埋める（?t=k3f9x2）。
--     ラベル（?table=A1）を埋めると、カテゴリーのコードを変えた瞬間に
--     印刷済みカードが全部無効になり、しかも画面にはエラーが出ないため
--     お客様が読み取って初めて気づく＝発覚が遅れる。
--   * orders は table_id（集計・絞り込み用）と table_label（表示用の
--     注文時点スナップショット）の両方を持つ。卓を消してもカテゴリーの
--     コードを変えても、過去の伝票の卓名は変わらない。
--   * anon には tables の SELECT を開けない。short_code は店頭に貼られて
--     いる以上「知っている人が引ける」のは前提だが、生SELECTを開けると
--     全卓の一覧を列挙できてしまう。1件だけ引ける SECURITY DEFINER の
--     resolve_table() 経由にして列挙を塞ぐ（orders_anon_lockdown.sql と同じ方針）。
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: 移行前の影響件数チェック（先にこれだけ実行してください）
-- ────────────────────────────────────────────────────────────
-- 1) 既存の注文件数と、卓番号の種類
--
--   SELECT count(*) AS orders_total,
--          count(*) FILTER (WHERE order_type = 'dine_in')  AS dine_in,
--          count(*) FILTER (WHERE order_type = 'takeout')  AS takeout,
--          count(DISTINCT table_number) FILTER (WHERE order_type = 'dine_in') AS distinct_tables
--     FROM public.orders;
--
-- 2) 実際に使われている卓番号の一覧（これがそのまま tables 行になる）
--
--   SELECT table_number, count(*) AS orders
--     FROM public.orders
--    WHERE order_type = 'dine_in'
--    GROUP BY table_number
--    ORDER BY table_number;
--
-- 3) staff_calls 側の卓番号（tables に無い番号が出ないかの確認用）
--
--   SELECT DISTINCT table_number FROM public.staff_calls ORDER BY table_number;
--
-- 期待する結果: 2) の table_number がすべて 1 以上の整数で、
--               STEP 4 のバックフィル後に table_id が NULL のまま残る
--               dine_in 注文が 0 件になること（STEP 4 末尾で検証します）。


-- ────────────────────────────────────────────────────────────
-- STEP 1: テーブル作成
-- ────────────────────────────────────────────────────────────

-- table_categories（席カテゴリー）
--   code は英大文字1文字。表示ラベルは code || number で "A1" を組み立てる。
CREATE TABLE IF NOT EXISTS public.table_categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code          text        NOT NULL CHECK (code ~ '^[A-Z]$'),
  name          text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

-- tables（卓）
--   short_code はURLに埋める不変の識別子。カテゴリーのコードや卓番号を
--   変えても short_code は変えない（＝印刷済みカードが生き続ける）。
CREATE TABLE IF NOT EXISTS public.tables (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id   uuid        NOT NULL REFERENCES public.table_categories(id) ON DELETE CASCADE,
  number        integer     NOT NULL CHECK (number > 0),
  short_code    text        NOT NULL UNIQUE CHECK (short_code ~ '^[a-z0-9]{6}$'),
  display_order integer     NOT NULL DEFAULT 0,
  -- 移行前の数値テーブル番号。既存の ?table=5 形式のURLを解決するために使う。
  -- 新規に追加した卓は NULL（旧形式のカードが存在しないため）。
  legacy_number integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, number)
);

-- legacy_number は「値があるものだけ一意」。NULL は何行あってもよい
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_legacy_number
  ON public.tables (store_id, legacy_number)
  WHERE legacy_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_category
  ON public.tables (category_id, display_order);

DROP TRIGGER IF EXISTS trg_table_categories_set_updated_at ON public.table_categories;
CREATE TRIGGER trg_table_categories_set_updated_at
  BEFORE UPDATE ON public.table_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tables_set_updated_at ON public.tables;
CREATE TRIGGER trg_tables_set_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- STEP 2: orders の拡張
-- ────────────────────────────────────────────────────────────
-- table_id … 集計・絞り込み用。卓を削除しても過去の注文が消えないよう SET NULL。
-- table_label … 注文時点のラベルのスナップショット。表示は必ずこちらを使う。
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_id    uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_label text;

CREATE INDEX IF NOT EXISTS idx_orders_table_id
  ON public.orders (table_id, created_at DESC);

-- staff_calls も厨房画面に卓名を出すのでラベルを持たせる。
-- 呼び出しは「今この瞬間」の対応なので table_id までは要らないが、
-- 卓名が Order Card は "A1"・Call Chip は "5" とバラバラだと現場が混乱する。
ALTER TABLE public.staff_calls
  ADD COLUMN IF NOT EXISTS table_label text;
-- 既存行のバックフィルは tables を作ったあと（STEP 4）で行う


-- ────────────────────────────────────────────────────────────
-- STEP 3: short_code 発行関数
-- ────────────────────────────────────────────────────────────
-- 紛らわしい文字（0/o, 1/l/i）を除いた32文字から6桁。約10億通りあるので
-- 実運用の卓数（数十）なら衝突はまず起きないが、UNIQUE 制約もあるので
-- 万一衝突したらループでやり直す。
CREATE OR REPLACE FUNCTION public.generate_table_short_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
  i integer;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tables t WHERE t.short_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- STEP 4: 既存データの移行（べき等）
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_store_id uuid;
  v_category_id uuid;
  v_created integer := 0;
  v_orphans integer;
BEGIN
  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'stores が空です。先に setup.sql を流してください';
  END IF;

  -- 4-1: 既定カテゴリー A「テーブル」
  INSERT INTO public.table_categories (store_id, code, name, display_order)
  VALUES (v_store_id, 'A', 'テーブル', 1)
  ON CONFLICT (store_id, code) DO NOTHING;

  SELECT id INTO v_category_id
    FROM public.table_categories
   WHERE store_id = v_store_id AND code = 'A';

  -- 4-2: 既存注文・スタッフ呼び出しに出てくる卓番号を tables 化
  --      number にも同じ値を入れるので、移行直後のラベルは "A5" のようになる
  INSERT INTO public.tables (store_id, category_id, number, short_code, display_order, legacy_number)
  SELECT v_store_id,
         v_category_id,
         n.table_number,
         public.generate_table_short_code(),
         n.table_number,
         n.table_number
    FROM (
      SELECT DISTINCT table_number
        FROM public.orders
       WHERE order_type = 'dine_in' AND table_number > 0
      UNION
      SELECT DISTINCT table_number
        FROM public.staff_calls
       WHERE table_number > 0
    ) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM public.tables t
      WHERE t.store_id = v_store_id AND t.legacy_number = n.table_number
   );
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RAISE NOTICE 'tables に % 行を作成しました', v_created;

  -- 4-3: 既存 orders のバックフィル
  UPDATE public.orders o
     SET table_id    = t.id,
         table_label = c.code || t.number::text
    FROM public.tables t
    JOIN public.table_categories c ON c.id = t.category_id
   WHERE o.order_type = 'dine_in'
     AND o.table_id IS NULL
     AND t.store_id = o.store_id
     AND t.legacy_number = o.table_number;

  -- テイクアウトはラベルを持たない（画面側で「テイクアウト」と出す）
  UPDATE public.orders
     SET table_label = NULL
   WHERE order_type = 'takeout' AND table_label IS NOT NULL;

  -- staff_calls のラベルも埋める（厨房のCall Chip用）
  UPDATE public.staff_calls sc
     SET table_label = c.code || t.number::text
    FROM public.tables t
    JOIN public.table_categories c ON c.id = t.category_id
   WHERE sc.table_label IS NULL
     -- staff_calls.store_id は NULL 許容なので、NULL の行も取りこぼさないよう緩めに突き合わせる
     AND (sc.store_id IS NULL OR t.store_id = sc.store_id)
     AND t.legacy_number = sc.table_number;

  -- 4-4: 検証。取り残しがあれば移行を中断してロールバックさせる
  SELECT count(*) INTO v_orphans
    FROM public.orders
   WHERE order_type = 'dine_in' AND table_number > 0 AND table_id IS NULL;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'table_id を割り当てられなかった店内注文が % 件あります。中断します', v_orphans;
  END IF;

  RAISE NOTICE '移行完了: 孤立した店内注文は 0 件です';
END;
$$;


-- ────────────────────────────────────────────────────────────
-- STEP 5: RLS
-- ────────────────────────────────────────────────────────────
-- 参照はスタッフ全員（authenticated）。更新は manager のみ。
-- anon には一切開けない（STEP 6 の resolve_table 経由でのみ1件引ける）。
ALTER TABLE public.table_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "table_categories_select_authenticated" ON public.table_categories;
CREATE POLICY "table_categories_select_authenticated"
  ON public.table_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tables_select_authenticated" ON public.tables;
CREATE POLICY "tables_select_authenticated"
  ON public.tables FOR SELECT TO authenticated USING (true);

-- 書き込みポリシーは置かない。レイアウトの保存は STEP 6 の
-- save_table_layout()（SECURITY DEFINER + manager チェック）だけを入口にする。
-- 1回の保存でカテゴリーと卓を同時に作り直すため、途中で失敗して
-- 半分だけ反映された状態を作らないようにトランザクションで包みたい。

REVOKE ALL ON public.table_categories FROM anon;
REVOKE ALL ON public.tables           FROM anon;


-- ────────────────────────────────────────────────────────────
-- STEP 6: RPC
-- ────────────────────────────────────────────────────────────

-- 6-1: お客様側の入口が卓を解決する（anon 可）
--   ?t=<short_code> か、旧形式の ?table=<legacy_number> のどちらかで1件引く。
--   返すのは id と label だけ。一覧の列挙はできない。
CREATE OR REPLACE FUNCTION public.resolve_table(
  p_short_code    text DEFAULT NULL,
  p_legacy_number integer DEFAULT NULL
)
RETURNS TABLE (id uuid, label text, legacy_number integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id,
         c.code || t.number::text AS label,
         t.legacy_number
    FROM public.tables t
    JOIN public.table_categories c ON c.id = t.category_id
   WHERE (p_short_code    IS NOT NULL AND t.short_code    = p_short_code)
      OR (p_legacy_number IS NOT NULL AND t.legacy_number = p_legacy_number)
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_table(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_table(text, integer) TO anon, authenticated;


-- 6-2: 席カテゴリー・卓のレイアウトをまとめて保存（manager のみ）
--   p_categories の形:
--   [
--     { "id": null|uuid, "code": "A", "name": "カウンター席", "display_order": 1,
--       "tables": [ { "id": null|uuid, "number": 1, "display_order": 1 }, ... ] },
--     ...
--   ]
--   一覧に無いカテゴリー・卓は削除される。卓を消しても orders.table_id は
--   SET NULL になるだけで、table_label のスナップショットが残るので
--   過去の伝票の卓名は変わらない。
CREATE OR REPLACE FUNCTION public.save_table_layout(p_categories jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_cat jsonb;
  v_tbl jsonb;
  v_cat_id uuid;
  v_tbl_id uuid;
  v_kept_cat_ids uuid[] := '{}';
  v_kept_tbl_ids uuid[] := '{}';
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    IF (v_cat ->> 'code') !~ '^[A-Z]$' THEN
      RAISE EXCEPTION 'コードは英大文字1文字にしてください: %', v_cat ->> 'code';
    END IF;

    IF (v_cat ->> 'id') IS NULL THEN
      INSERT INTO public.table_categories (store_id, code, name, display_order)
      VALUES (v_store_id, v_cat ->> 'code', v_cat ->> 'name', (v_cat ->> 'display_order')::int)
      RETURNING id INTO v_cat_id;
    ELSE
      v_cat_id := (v_cat ->> 'id')::uuid;
      UPDATE public.table_categories
         SET code = v_cat ->> 'code',
             name = v_cat ->> 'name',
             display_order = (v_cat ->> 'display_order')::int
       WHERE id = v_cat_id;
    END IF;
    v_kept_cat_ids := v_kept_cat_ids || v_cat_id;

    FOR v_tbl IN SELECT * FROM jsonb_array_elements(COALESCE(v_cat -> 'tables', '[]'::jsonb)) LOOP
      IF (v_tbl ->> 'id') IS NULL THEN
        INSERT INTO public.tables (store_id, category_id, number, short_code, display_order)
        VALUES (v_store_id, v_cat_id, (v_tbl ->> 'number')::int,
                public.generate_table_short_code(), (v_tbl ->> 'display_order')::int)
        RETURNING id INTO v_tbl_id;
      ELSE
        v_tbl_id := (v_tbl ->> 'id')::uuid;
        -- short_code と legacy_number は**絶対に更新しない**（印刷済みカードが死ぬ）
        UPDATE public.tables
           SET category_id = v_cat_id,
               number = (v_tbl ->> 'number')::int,
               display_order = (v_tbl ->> 'display_order')::int
         WHERE id = v_tbl_id;
      END IF;
      v_kept_tbl_ids := v_kept_tbl_ids || v_tbl_id;
    END LOOP;
  END LOOP;

  DELETE FROM public.tables
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_tbl_ids));

  DELETE FROM public.table_categories
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_cat_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.save_table_layout(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_table_layout(jsonb) TO authenticated;


-- 6-3: get_sales_orders に table_id / table_label を足す
--   ダッシュボードのテーブル稼働カードを、固定の T1〜T12 ではなく
--   実際の卓ラベル（A1〜C2）と実データ件数で出すために必要。
--   （staff_role_rls.sql の定義を丸ごと置き換える。manager 限定チェックは同じ）
CREATE OR REPLACE FUNCTION public.get_sales_orders(start_ts timestamptz, end_ts timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'table_number', o.table_number,
      'table_id', o.table_id,
      'table_label', o.table_label,
      'total_amount', o.total_amount,
      'order_type', o.order_type,
      'created_at', o.created_at,
      'items', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'menu_items', jsonb_build_object(
              'name', mi.name,
              'category_id', mi.category_id,
              'categories', jsonb_build_object('name', c.name)
            )
          )
        ), '[]'::jsonb)
        FROM public.order_items oi
        LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN public.categories c ON c.id = mi.category_id
        WHERE oi.order_id = o.id
      )
    )
    ORDER BY o.created_at ASC
  ), '[]'::jsonb)
  INTO result
  FROM public.orders o
  WHERE o.status = 'paid'
    AND o.created_at >= start_ts
    AND o.created_at < end_ts;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_orders(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_orders(timestamptz, timestamptz) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 7: 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT c.code, c.name, t.number, t.short_code, t.legacy_number
--     FROM public.tables t JOIN public.table_categories c ON c.id = t.category_id
--    ORDER BY c.display_order, t.display_order;
--
--   SELECT count(*) FILTER (WHERE table_id IS NULL AND order_type = 'dine_in') AS orphan_dine_in,
--          count(*) FILTER (WHERE table_label IS NULL AND order_type = 'dine_in') AS no_label_dine_in
--     FROM public.orders;
--   -- どちらも 0 になっていれば移行成功
