-- ============================================================
-- 動画メニュー機能
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================

-- 1. menu_items に video_url カラムを追加
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS video_url text;

-- 2. menu-videos バケットを作成（Public: true）
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-videos', 'menu-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS（menu-images と同じ構成）
--    SELECT: 全員 / INSERT・DELETE: authenticated のみ
DROP POLICY IF EXISTS "menu_videos_select_all" ON storage.objects;
CREATE POLICY "menu_videos_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-videos');

DROP POLICY IF EXISTS "menu_videos_write_authenticated" ON storage.objects;
CREATE POLICY "menu_videos_write_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-videos');

DROP POLICY IF EXISTS "menu_videos_delete_authenticated" ON storage.objects;
CREATE POLICY "menu_videos_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-videos');
