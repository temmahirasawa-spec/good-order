-- ============================================================
-- 注文履歴のお客様側同期（RLS 緩和）
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- お客様（anon）が自分の注文ステータスを見られるよう、
-- orders / order_items の SELECT を anon にも許可する。
-- 書き込み（UPDATE/DELETE）は引き続き authenticated のみ。
--
-- ※ 個人情報（名前・メール等）は orders に保存していないため影響なし。
-- ============================================================

DROP POLICY IF EXISTS "orders_select_authenticated" ON public.orders;
CREATE POLICY "orders_select_all"
  ON public.orders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "order_items_select_authenticated" ON public.order_items;
CREATE POLICY "order_items_select_all"
  ON public.order_items FOR SELECT
  TO anon, authenticated
  USING (true);
