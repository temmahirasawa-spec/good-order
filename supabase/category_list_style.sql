-- ============================================================
-- カテゴリーの「一覧の見せ方」（写真カード / 文字リスト / 自動）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / category_heading.sql 実行済み。
--
-- 仕様: docs/specs/menu-text-rows.md（案A 行リスト、2026-09-08 決定）
--
-- 何のためのものか:
--   写真を用意しない商品（YORKYS ではドリンク）を、写真なしでも成立する
--   「文字の行」で出せるようにする。
--     'auto'  … そのカテゴリーの商品に写真が1枚も無ければ文字リスト、1枚でもあれば写真カード（既定）
--     'photo' … 常に写真カード
--     'list'  … 常に文字リスト（写真がある商品は小さなサムネ付きの行になる）
--   判定はアプリ側（lib/orderHome.ts）の1か所で行う。
--
-- ⚠ 流す順番について:
--   **必ず、この SQL を流してから PR をマージすること。**
--   この SQL だけ先に流してもアプリは壊れない（列が増えるだけ）。

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS list_style text NOT NULL DEFAULT 'auto';

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_list_style_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_list_style_chk CHECK (list_style IN ('auto', 'photo', 'list'));

-- 実行後の確認:
--   SELECT name, list_style FROM public.categories ORDER BY display_order;
--   -- 実行直後は全件 'auto'。写真が無いカテゴリーだけ自動で文字リストになる。
