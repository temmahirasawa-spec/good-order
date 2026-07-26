-- ============================================================
-- カテゴリーの type カラム追加（任意・将来のハードコード解消用）
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- 現状はクライアント側で slug によるハードコード判定
-- （pancake 等は food / coffee 等は drink）をしている。
-- このマイグレーションを実行すれば categories.category_type で
-- 管理できるようになる。UI 側は後日切替。
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS category_type text NOT NULL DEFAULT 'food';

-- 既存レコードの type を slug から推定
UPDATE public.categories SET category_type = 'drink'
  WHERE slug IN ('coffee', 'tea', 'soft', 'alcohol', 'drink');

UPDATE public.categories SET category_type = 'food'
  WHERE slug IN ('pancake', 'eggs_benedict', 'french_toast', 'sandwich', 'fritter', 'burger', 'lunch');

-- 許容値のチェック（軽いCHECK制約）
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_type_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_type_chk CHECK (category_type IN ('food', 'drink'));
