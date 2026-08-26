-- ============================================================
-- カテゴリーの見出しをDBで管理できるようにする
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / category_tag_color.sql 実行済み。
--
-- ────────────────────────────────────────────────────────────
-- なぜ必要か（2026-08-26 に判明した設計ミス）
-- ────────────────────────────────────────────────────────────
-- カテゴリー自体は categories テーブルで管理しているのに、
-- お客様側 /order の見出し（説明文・英語名・日本語名）だけが
-- app/order/page.tsx の SECTION_COPY にハードコードされていた。
--
-- そのため **管理画面からカテゴリーを追加しても、お客様の画面に出ない**。
-- コード側に用意した11個の枠しか表示されず、店舗が自分でメニュー構成を
-- 変えられない状態だった。
--
-- 見出しの3要素をすべて categories テーブルに持たせ、
-- 管理画面から設定できるようにする。
--
-- ────────────────────────────────────────────────────────────
-- 列の割り当て
-- ────────────────────────────────────────────────────────────
--   name        … カテゴリー名（日本語）  例: パンケーキ     ← 既存列
--   caption     … カテゴリー名（英語）    例: PANCAKE       ← 既存列を流用
--   description … 説明文（40文字以内）    例: これがYORKYSの原点！看板メニュー
--   en_size     … 英語名の文字サイズ      'large' | 'medium' | 'small'（既定 large）
--   jp_size     … 日本語名の文字サイズ    'large' | 'medium' | 'small'（既定 small）
--
-- サイズは新しい値を作らず、既存のデザイントークンに割り当てる:
--   英語   large=type-en-display-xl / medium=type-en-display-l / small=type-en-display-m
--   日本語 large=type-jp-heading-m  / medium=type-jp-body-bold / small=type-jp-caption-bold
--   （既定値は現状の見た目と同じ組み合わせ）

ALTER TABLE public.categories
  -- 40文字の制限はアプリ側でも入力時に弾くが、RPCを直接叩かれても壊れないよう
  -- DB側でも制約をかける
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS en_size     text NOT NULL DEFAULT 'large',
  ADD COLUMN IF NOT EXISTS jp_size     text NOT NULL DEFAULT 'small';

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_description_len_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_description_len_chk
  CHECK (description IS NULL OR char_length(description) <= 40);

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_en_size_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_en_size_chk
  CHECK (en_size IN ('large', 'medium', 'small'));

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_jp_size_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_jp_size_chk
  CHECK (jp_size IN ('large', 'medium', 'small'));

-- categories は既に categories_select_all（anon,authenticated 読み取り可）/
-- categories_write_authenticated（authenticated 書き込み可）が設定済みのため
-- RLSポリシーの追加・変更は不要。

-- ────────────────────────────────────────────────────────────
-- 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT slug, name, caption, description, en_size, jp_size
--     FROM public.categories ORDER BY display_order;
