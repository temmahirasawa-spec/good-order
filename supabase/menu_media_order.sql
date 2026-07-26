-- ============================================================
-- メディア並び替え対応
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================

-- media_order: ユーザー画面に表示する順でメディアを保存
--   各要素 { "type": "image" | "video", "url": "..." }
--   配列の先頭 = カバー（一覧画面のサムネイル / 動画）
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS media_order jsonb DEFAULT '[]'::jsonb;
