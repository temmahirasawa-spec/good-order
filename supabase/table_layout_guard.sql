-- ============================================================
-- 席設定の保存に安全弁を入れる（全卓が一度に消える事故の防止）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/tables_qr.sql 実行済み。
--
-- ────────────────────────────────────────────────────────────
-- なぜ必要か（2026-08-26 の監査で判明）
-- ────────────────────────────────────────────────────────────
-- save_table_layout() は「渡された一覧に無い卓・カテゴリーを削除する」実装。
-- 一覧をそのまま正とするので、**空の一覧が渡ると全部消える**。
--
-- 実際に起こりうる筋道:
--   1. /admin/tables の読み込みが通信エラーで失敗する
--   2. catch 節が groups を空配列にして画面を続行する（tables/page.tsx）
--   3. 画面には「席カテゴリー 0件」と出る。マネージャーがカテゴリーを1つ足して保存
--   4. save_table_layout に「新規1件だけ」の一覧が渡り、既存の全カテゴリー・全卓が DELETE される
--
-- 卓が消えると short_code も消えるため、**印刷済みの二次元コードが一斉に無効**になる。
-- 同じ卓を作り直しても別のコードが振られるので、紙は全部刷り直しになる。
--
-- ────────────────────────────────────────────────────────────
-- 方針
-- ────────────────────────────────────────────────────────────
-- 削除しようとしている件数を数え、**明らかに誤操作と分かる規模**なら
-- 例外を投げてトランザクションごと巻き戻す。
--   - 5卓以上を一度に消そうとしている、かつ
--   - それが既存卓の半数以上を占める
-- この2つを同時に満たすときだけ止める。
--
-- 1〜2卓を整理する通常の運用は今までどおり通る。
-- 本当に全卓を作り直したいときは、卓を数回に分けて消せばよい。
--
-- カテゴリーについても同じ考え方で、既存が3件以上あって
-- 全部消えるケースを止める。

CREATE OR REPLACE FUNCTION public.save_table_layout(p_categories jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_cat jsonb;
  v_tbl jsonb;
  v_cat_id uuid;
  v_tbl_id uuid;
  v_kept_cat_ids uuid[] := '{}';
  v_kept_tbl_ids uuid[] := '{}';
  v_tbl_total integer;
  v_tbl_deleting integer;
  v_cat_total integer;
  v_cat_deleting integer;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    IF (v_cat ->> 'code') !~ '^[A-Z]$' THEN
      RAISE EXCEPTION 'コードは英大文字1文字にしてください: %', v_cat ->> 'code';
    END IF;

    IF (v_cat ->> 'id') IS NULL THEN
      INSERT INTO public.table_categories (store_id, code, name, display_order)
      VALUES (v_store_id, v_cat ->> 'code', v_cat ->> 'name', (v_cat ->> 'display_order')::int)
      RETURNING id INTO v_cat_id;
    ELSE
      v_cat_id := (v_cat ->> 'id')::uuid;
      UPDATE public.table_categories
         SET code = v_cat ->> 'code',
             name = v_cat ->> 'name',
             display_order = (v_cat ->> 'display_order')::int
       WHERE id = v_cat_id;
    END IF;
    v_kept_cat_ids := v_kept_cat_ids || v_cat_id;

    FOR v_tbl IN SELECT * FROM jsonb_array_elements(COALESCE(v_cat -> 'tables', '[]'::jsonb)) LOOP
      IF (v_tbl ->> 'id') IS NULL THEN
        INSERT INTO public.tables (store_id, category_id, number, short_code, display_order)
        VALUES (v_store_id, v_cat_id, (v_tbl ->> 'number')::int,
                public.generate_table_short_code(), (v_tbl ->> 'display_order')::int)
        RETURNING id INTO v_tbl_id;
      ELSE
        v_tbl_id := (v_tbl ->> 'id')::uuid;
        -- short_code と legacy_number は**絶対に更新しない**（印刷済みカードが死ぬ）
        UPDATE public.tables
           SET category_id = v_cat_id,
               number = (v_tbl ->> 'number')::int,
               display_order = (v_tbl ->> 'display_order')::int
         WHERE id = v_tbl_id;
      END IF;
      v_kept_tbl_ids := v_kept_tbl_ids || v_tbl_id;
    END LOOP;
  END LOOP;

  -- ── ここからが今回足した安全弁 ──────────────────────────────
  -- 削除しようとしている件数を、実際に消す前に数える。
  SELECT count(*) INTO v_tbl_total
    FROM public.tables WHERE store_id = v_store_id;
  SELECT count(*) INTO v_tbl_deleting
    FROM public.tables
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_tbl_ids));

  -- 5卓以上、かつ既存の半数以上が一度に消えるなら誤操作とみなして中断する。
  -- 通常の「1〜2卓を整理する」操作はここを通らない。
  IF v_tbl_deleting >= 5 AND v_tbl_deleting * 2 >= v_tbl_total THEN
    RAISE EXCEPTION
      '一度に % 卓（全 % 卓中）を削除しようとしています。誤操作の可能性があるため中断しました。'
      '本当に消す場合は数回に分けて操作してください。',
      v_tbl_deleting, v_tbl_total
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT count(*) INTO v_cat_total
    FROM public.table_categories WHERE store_id = v_store_id;
  SELECT count(*) INTO v_cat_deleting
    FROM public.table_categories
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_cat_ids));

  IF v_cat_total >= 3 AND v_cat_deleting = v_cat_total THEN
    RAISE EXCEPTION
      '席カテゴリーを全件（%件）削除しようとしています。誤操作の可能性があるため中断しました。',
      v_cat_total
      USING ERRCODE = 'raise_exception';
  END IF;
  -- ── 安全弁ここまで ────────────────────────────────────────

  DELETE FROM public.tables
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_tbl_ids));

  DELETE FROM public.table_categories
   WHERE store_id = v_store_id AND NOT (id = ANY (v_kept_cat_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.save_table_layout(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_table_layout(jsonb) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 動作確認（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
--   SELECT count(*) FROM public.tables;            -- 現在の卓数
--   -- 管理画面で卓を1つ消して保存 → 通る
--   -- 管理画面で卓を全部消して保存 → 「誤操作の可能性があるため中断しました」
