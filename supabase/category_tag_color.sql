-- ============================================================
-- カテゴリタグ色をDB管理に変更
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS tag_color text NOT NULL DEFAULT 'yellow';

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_tag_color_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_tag_color_chk
  CHECK (tag_color IN ('yellow','orange','pink','red','green','teal','blue','purple','brown','gray'));

-- 既存11カテゴリの色移行（lib/categoryLabels.ts の SUBCATEGORY_TAG_COLOR から引き継ぎ）
UPDATE public.categories SET tag_color = 'yellow' WHERE slug = 'pancake';
UPDATE public.categories SET tag_color = 'pink'   WHERE slug = 'eggs_benedict';
UPDATE public.categories SET tag_color = 'orange' WHERE slug = 'french_toast';
UPDATE public.categories SET tag_color = 'green'  WHERE slug = 'sandwich';
UPDATE public.categories SET tag_color = 'teal'   WHERE slug = 'fritter';
UPDATE public.categories SET tag_color = 'red'    WHERE slug = 'burger';
UPDATE public.categories SET tag_color = 'brown'  WHERE slug = 'lunch';
UPDATE public.categories SET tag_color = 'blue'   WHERE slug = 'coffee';
UPDATE public.categories SET tag_color = 'green'  WHERE slug = 'tea';
UPDATE public.categories SET tag_color = 'purple' WHERE slug = 'soft';
UPDATE public.categories SET tag_color = 'gray'   WHERE slug = 'alcohol';

-- categories は既に categories_select_all（anon,authenticated 読み取り可）/
-- categories_write_authenticated（authenticated 書き込み可）が設定済みのため
-- RLSポリシーの追加・変更は不要。
