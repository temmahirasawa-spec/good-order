-- ============================================================
-- ブランドカラー（お客様画面のアクセント色）を店舗ごとに設定する
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / best_sellers.sql 実行済み（stores に設定列を足す流儀はそれと同じ）。
--
-- 仕様: docs/specs/brand-color.md（2026-09-08 決定: 既定はオリーブモス #5E6B4A）
--
-- 何のためのものか:
--   管理画面「表示設定 ＞ ブランドカラー」で選んだ色を保存し、
--   お客様画面のボタン・選択中のチップ・合計の背景などのアクセント色に使う。
--   派生色（押した時の色・濃い色・薄い地）と、その上に載せる文字色（白か墨か）は
--   アプリ側（lib/brandColor.ts）が HEX から計算する。DB に持つのは1色だけ。
--
-- 設計の要点:
--   - NULL = アプリの既定色（design-tokens.css のオリーブモス）。
--   - stores は anon も SELECT できる（is_accepting_orders と同じ）。お客様画面が読むため。
--   - 書き込みは manager 限定の RPC 1本。形式（#RRGGBB）はここでも検証する。
--
-- ⚠ 流す順番について:
--   **必ず、この SQL を流してから PR をマージすること。**
--   この SQL だけ先に流してもアプリは壊れない（列が増えるだけ）。


-- ────────────────────────────────────────────────────────────
-- 1. 列
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS brand_accent text NULL;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_brand_accent_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_brand_accent_chk
  CHECK (brand_accent IS NULL OR brand_accent ~ '^#[0-9A-F]{6}$');


-- ────────────────────────────────────────────────────────────
-- 2. 保存RPC（manager のみ）
-- ────────────────────────────────────────────────────────────
--   p_hex: '#RRGGBB'（大文字）。NULL を渡すと既定色に戻す。
CREATE OR REPLACE FUNCTION public.save_brand_accent(p_hex text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_hex text;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  v_hex := upper(trim(p_hex));
  IF v_hex IS NOT NULL AND v_hex !~ '^#[0-9A-F]{6}$' THEN
    RAISE EXCEPTION 'ブランドカラーは #RRGGBB の形式で指定してください（%）', p_hex;
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores SET brand_accent = v_hex WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_brand_accent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_brand_accent(text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, brand_accent FROM public.stores;
--   -- 実行直後は NULL（＝アプリの既定色オリーブモス）。
