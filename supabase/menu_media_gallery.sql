-- ============================================================
-- 画像ギャラリー対応（最大5枚の画像 + 1動画）
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================

-- image_url はカバー画像として維持、追加画像を text[] で保持する
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS additional_images text[] DEFAULT '{}'::text[];

-- ユーザー向けギャラリー = [image_url, ...additional_images]（最大5枚）
-- 管理画面側で length 制限をかける（DB制約はなし、柔軟性維持）
