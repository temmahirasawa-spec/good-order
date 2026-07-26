-- ============================================================
-- 緊急対応: orders / order_items の匿名(anon)無条件読み取りを塞ぐ
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 背景:
--   supabase/history_rls.sql が orders / order_items の SELECT を
--   anon ロールに USING (true)（無条件）で開放していた。
--   NEXT_PUBLIC_SUPABASE_ANON_KEY はブラウザに公開される鍵のため、
--   ログイン無しで全テーブル番号・注文内容・金額を読み取れる状態だった。
--
-- 方針:
--   1. orders / order_items の SELECT を authenticated 限定に戻す
--      （setup.sql が本来定義していた状態への復帰。kitchen/register/
--        管理ダッシュボードはログイン済みセッションで動くため無影響）
--   2. お客様側（anon）が必要としていた2つの機能は、生テーブルの
--      SELECT ではなく「集計済み・非識別情報のみを返す」SECURITY
--      DEFINER 関数経由に置き換える。関数はテーブル番号・金額列を
--      一切 SELECT せず、返り値にも含めないため、anon に table_number
--      / total_amount / order_type を渡す経路がなくなる。
--        - get_order_statuses(order_ids): /history の注文ステータス
--          確認（app/history/page.tsx）。id は既に localStorage に
--          保存された注文IDのみを渡す前提（UUIDは実質推測不可）。
--          念のため直近90日以内の注文に限定する。
--        - get_recent_item_counts(days): /order トップページの
--          「人気メニューTOP3」集計（lib/api.ts）。店舗全体の
--          直近N日間の menu_item_id ごとの合計注文数のみを返す。
--
-- 対応するアプリ側の変更:
--   - lib/api.ts: fetchRecentOrderItemCounts を
--     supabase.from("order_items")... から
--     supabase.rpc("get_recent_item_counts", { days }) に変更
--   - app/history/page.tsx: supabase.from("orders").select("id,status")...
--     を supabase.rpc("get_order_statuses", { order_ids: ids }) に変更
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1: anon 向けの無条件 SELECT ポリシーを撤廃し、
--          authenticated 限定に戻す
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orders_select_all" ON public.orders;
DROP POLICY IF EXISTS "orders_select_authenticated" ON public.orders;
CREATE POLICY "orders_select_authenticated"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "order_items_select_all" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_authenticated" ON public.order_items;
CREATE POLICY "order_items_select_authenticated"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- STEP 2: お客様側（anon）用の集計専用関数
--   SECURITY DEFINER で RLS をバイパスして内部的に集計するが、
--   返り値には非識別・非金銭情報しか含めない。
-- ────────────────────────────────────────────────────────────

-- /history: 指定した注文IDのステータスだけを返す。
-- 金額・テーブル番号・商品明細などは一切返さない。
-- 直近90日より古い注文IDを渡された場合は結果に含めない
-- （UUIDは実質推測不可能だが、念のため無期限のIDオラクル化を避ける）。
CREATE OR REPLACE FUNCTION public.get_order_statuses(order_ids uuid[])
RETURNS TABLE (id uuid, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.status
  FROM public.orders o
  WHERE o.id = ANY(order_ids)
    AND o.created_at > now() - interval '90 days';
$$;

REVOKE ALL ON FUNCTION public.get_order_statuses(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_statuses(uuid[]) TO anon, authenticated;


-- /order トップページ「人気メニューTOP3」用：
-- 直近 N 日間の menu_item_id ごとの合計注文数だけを返す
-- （店舗全体の集計値のみ。個々の注文・テーブル・金額は返さない）。
CREATE OR REPLACE FUNCTION public.get_recent_item_counts(days integer DEFAULT 14)
RETURNS TABLE (menu_item_id uuid, total_quantity bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT oi.menu_item_id, SUM(oi.quantity)::bigint AS total_quantity
  FROM public.order_items oi
  WHERE oi.created_at > now() - (GREATEST(days, 0) || ' days')::interval
  GROUP BY oi.menu_item_id;
$$;

REVOKE ALL ON FUNCTION public.get_recent_item_counts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_item_counts(integer) TO anon, authenticated;
