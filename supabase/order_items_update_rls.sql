-- ============================================================
-- order_items の UPDATE 用 RLS ポリシー（管理者向け）
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- 厨房画面で order_items.cooking_status を更新するために必要。
-- 現状は INSERT / SELECT のポリシーしかなく、UPDATE が無音で
-- ブロックされている（RLS 有効 + ポリシー無し = 拒否）。
-- ============================================================

DROP POLICY IF EXISTS "order_items_update_authenticated" ON public.order_items;
CREATE POLICY "order_items_update_authenticated"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- 念のため DELETE も authenticated だけ許可（管理画面のクリーンアップ用途）
DROP POLICY IF EXISTS "order_items_delete_authenticated" ON public.order_items;
CREATE POLICY "order_items_delete_authenticated"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (true);
