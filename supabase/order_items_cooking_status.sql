-- ============================================================
-- order_items にアイテム単位の調理ステータスを追加
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- 値: 'pending' | 'cooking' | 'done'
-- 既存行は DEFAULT で 'pending' に初期化される
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cooking_status text NOT NULL DEFAULT 'pending';

-- クエリ高速化のためのインデックス
CREATE INDEX IF NOT EXISTS idx_order_items_cooking_status
  ON public.order_items(cooking_status);

-- 任意のチェック制約（軽量）
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_cooking_status_chk;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_cooking_status_chk
  CHECK (cooking_status IN ('pending', 'cooking', 'done'));
