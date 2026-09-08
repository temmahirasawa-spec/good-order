-- ============================================================
-- サブカテゴリー（親カテゴリー）と、トップに出す件数
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / categories_type.sql / category_heading.sql 実行済み。
--
-- 仕様: docs/specs/home-layout.md（2026-09-08 決定）
--
-- 何のためのものか:
--   1. カテゴリーを2階層にする。
--        親（parent_id が NULL）… トップの区画・タブになる。例: ドリンク
--        子（parent_id あり）  … 親の中の区分。例: カフェ / ソフトドリンク / ビール
--      商品は今までどおり menu_items.category_id で1つのカテゴリーに属する。
--      子がある親には、子に属する商品がまとめて出る（親に直接ぶら下がる商品も出る）。
--   2. トップの各区画に出す件数（top_limit）。既定 5。0 = 全件。
--      残りは「すべてを見る」から一覧ページ /order/[slug] へ。
--
-- 設計の要点:
--   - 2階層まで。孫は作らない（アプリ側でも親を選ぶ候補から「子」を除く）。
--   - 親を消したら子は「親なし（＝親カテゴリー）」に戻る（ON DELETE SET NULL）。
--     子ごと消えると商品まで巻き添えになる（menu_items は CASCADE）ため。
--   - RLS は触らない。anon の権限も増やさない（列が増えるだけ）。
--
-- ⚠ 流す順番について:
--   アプリ側のコードは、この SQL が流れている前提で新しい列を読む。
--   **必ず、この SQL を流してから PR をマージすること。**
--   逆にすると、お客様側のカテゴリー取得が「列が無い」エラーで失敗する。
--   この SQL だけ先に流してもアプリは壊れない（列が増えるだけ）。


-- ────────────────────────────────────────────────────────────
-- 1. 親カテゴリー
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL
    REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON public.categories (parent_id);

-- 自分自身を親にはできない
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_parent_not_self_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_parent_not_self_chk CHECK (parent_id IS NULL OR parent_id <> id);


-- ────────────────────────────────────────────────────────────
-- 2. トップに出す件数（既定 5、0 = 全件）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS top_limit integer NOT NULL DEFAULT 5;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_top_limit_chk;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_top_limit_chk CHECK (top_limit >= 0 AND top_limit <= 100);


-- ────────────────────────────────────────────────────────────
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, slug, parent_id, top_limit FROM public.categories ORDER BY display_order;
--   -- 実行直後は全件 parent_id = NULL / top_limit = 5。
--   -- 見え方: トップの各区画が「上位5件＋すべてを見る」になる（サブカテゴリーはまだ無い）。
--   -- サブカテゴリーは管理画面「カテゴリ管理」で、カテゴリーの「親カテゴリー」を選ぶと作れる。
