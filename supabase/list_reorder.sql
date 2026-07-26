-- ============================================================
-- 一覧の⠿ドラッグ並び替えを永続化する
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 対象テーブル: public.categories / public.menu_items
--
-- 【sort_order 列を新設していない理由】
--   指示は「対象テーブルに sort_order（int）を追加」だったが、両テーブルには
--   既に display_order integer NOT NULL DEFAULT 0 があり、
--     - お客様側の全クエリ（fetchCategories / メニュー一覧）が ORDER BY display_order
--     - 管理画面の編集パネルの「表示順」数値入力が display_order にバインド済み
--   という状態。ここに sort_order を足すと並び順の真実が2つになり、
--   「編集パネルで表示順を変えたのに一覧の並びが変わらない」等の不整合が
--   確実に発生する。そのため新しい列は作らず、既存の display_order を
--   そのまま並び順の単一の真実として使う。
--   指示のうち「既存行に現在の表示順で連番を振るマイグレーション」は、
--   display_order に対して下記 STEP 1 で実施している（初期データは
--   DEFAULT 99 や重複値が混ざっており、そのままではドラッグ並び替えが
--   安定しないため、この詰め直しは必須）。


-- ────────────────────────────────────────────────────────────
-- STEP 1: 既存行の display_order を現在の表示順のまま 1..N に詰め直す
-- ────────────────────────────────────────────────────────────
-- 並び順の判定は「現在の表示順」= display_order → created_at → id の順。
-- 同値・欠番・DEFAULT 99 のまま放置されている行をここで正規化する。

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id
      ORDER BY display_order, created_at, id
    ) AS rn
  FROM public.categories
)
UPDATE public.categories c
   SET display_order = n.rn
  FROM numbered n
 WHERE c.id = n.id
   AND c.display_order IS DISTINCT FROM n.rn;

-- menu_items は管理画面の一覧が（カテゴリ横断で）display_order 順に並ぶため
-- 店舗単位で通し番号にする。カテゴリ内の相対順序はこれで保たれる。
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id
      ORDER BY display_order, created_at, id
    ) AS rn
  FROM public.menu_items
)
UPDATE public.menu_items m
   SET display_order = n.rn
  FROM numbered n
 WHERE m.id = n.id
   AND m.display_order IS DISTINCT FROM n.rn;


-- ────────────────────────────────────────────────────────────
-- STEP 2: 複数行の順序更新を1リクエストで行うための関数
-- ────────────────────────────────────────────────────────────
-- PostgREST の upsert では NOT NULL 列（store_id / name / price 等）を
-- 省略した payload が通らないため、順序更新専用の RPC を用意する。
-- SECURITY INVOKER なので既存の RLS
-- （categories_write_authenticated / menu_items_write_authenticated）が
-- そのまま効き、認証済みスタッフ以外は実行しても0件更新になる。

CREATE OR REPLACE FUNCTION public.reorder_categories(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.categories c
     SET display_order = x.display_order
    FROM jsonb_to_recordset(p_items) AS x(id uuid, display_order integer)
   WHERE c.id = x.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_menu_items(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.menu_items m
     SET display_order = x.display_order
    FROM jsonb_to_recordset(p_items) AS x(id uuid, display_order integer)
   WHERE m.id = x.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_categories(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_menu_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_categories(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_menu_items(jsonb) TO authenticated;
-- anon には付与しない（並び替えは管理画面からのみ）
