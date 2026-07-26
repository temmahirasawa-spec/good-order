-- ============================================================
-- Step3-O 追補: 卓ラベルの表示形式を「カテゴリー名 ＋ コード-番号」に変更
--   例: "A1" → "テーブル A-1" / "カウンター C-1"
--   Supabase Dashboard > SQL Editor に貼り付けて実行してください
--   （前提: supabase/tables_qr.sql 実行済み）
-- ============================================================
--
-- 変更の理由:
--   "A1" だけだと、現場のスタッフが「Aってどの席だっけ」を覚えていないと使えない。
--   カテゴリー名を前に付ければ、設定した名称がそのまま卓名になる。
--   コードと番号の間にハイフンを入れるのは "A11" が「A-1の1」なのか「A-11」なのか
--   読み違えないようにするため（2桁以上の卓番号で実際に起きる）。
--
-- 表示は必ず orders.table_label（注文時点のスナップショット）。
-- カテゴリー名を変えても過去の伝票は変わらない、という性質はそのまま。
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: 影響件数の確認（先にこれだけ実行してください）
-- ────────────────────────────────────────────────────────────
--   SELECT count(*) FILTER (WHERE table_id IS NOT NULL) AS relabel_target,
--          count(*) FILTER (WHERE table_id IS NULL AND table_label IS NOT NULL) AS keep_as_is
--     FROM public.orders
--    WHERE order_type = 'dine_in';
--
--   relabel_target … 新形式に付け替える注文
--   keep_as_is     … 卓が既に削除されている注文。**スナップショットなので触らない**


-- ────────────────────────────────────────────────────────────
-- STEP 1: resolve_table を新形式に（短縮形も返す）
-- ────────────────────────────────────────────────────────────
-- お客様側TOPは幅が無いので短縮形（"C-1"）を、スタッフ側は
-- フル（"カウンター C-1"）を使う。クライアントで文字列を切らずに済むよう両方返す。
DROP FUNCTION IF EXISTS public.resolve_table(text, integer);

CREATE OR REPLACE FUNCTION public.resolve_table(
  p_short_code    text DEFAULT NULL,
  p_legacy_number integer DEFAULT NULL
)
RETURNS TABLE (id uuid, label text, short_label text, legacy_number integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id,
         c.name || ' ' || c.code || '-' || t.number::text AS label,
         c.code || '-' || t.number::text                  AS short_label,
         t.legacy_number
    FROM public.tables t
    JOIN public.table_categories c ON c.id = t.category_id
   WHERE (p_short_code    IS NOT NULL AND t.short_code    = p_short_code)
      OR (p_legacy_number IS NOT NULL AND t.legacy_number = p_legacy_number)
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_table(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_table(text, integer) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 2: 既存スナップショットの付け替え
-- ────────────────────────────────────────────────────────────
-- table_id が残っている行（＝卓がまだ存在する行）だけを新形式に直す。
-- 卓が削除済みの行は当時のラベルのまま残す（スナップショットの意味を壊さないため）。
UPDATE public.orders o
   SET table_label = c.name || ' ' || c.code || '-' || t.number::text
  FROM public.tables t
  JOIN public.table_categories c ON c.id = t.category_id
 WHERE o.table_id = t.id
   AND o.order_type = 'dine_in';

UPDATE public.staff_calls sc
   SET table_label = c.name || ' ' || c.code || '-' || t.number::text
  FROM public.tables t
  JOIN public.table_categories c ON c.id = t.category_id
 WHERE t.legacy_number IS NOT NULL
   AND t.legacy_number = sc.table_number
   AND (sc.store_id IS NULL OR t.store_id = sc.store_id);


-- ────────────────────────────────────────────────────────────
-- STEP 3: 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT table_label, count(*)
--     FROM public.orders
--    WHERE order_type = 'dine_in'
--    GROUP BY table_label
--    ORDER BY table_label;
--   -- "テーブル A-1" のような形になっていればOK。
--   -- 卓を削除済みの注文だけ古い形式（"A1"）が残るのは想定どおり。
