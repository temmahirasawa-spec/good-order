-- ============================================================
-- 店舗情報の項目を自由に増やせるようにする（stores.info_rows）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/store_info_and_staff_calls.sql 実行済み。
--
-- 何のためのものか（2026-09-15、洋輔さんの依頼）:
--   「店舗名や住所の入力欄はプリセットとして置いておきつつ、
--     営業時間や定休日を書かないケースもあり得るので、項目の削除や追加ができるように」
--
--   それまで 住所 / 営業時間 / 定休日 / 電話番号 の**4つが固定**で、
--   空にすると既定値に戻る作りだった。＝「載せない」ができなかった。
--
-- 入れるもの:
--   stores.info_rows jsonb … [{ "label": "住所", "value": "…", "icon": "map-pin" }, …]
--   並び順は配列の順。項目の追加・削除・並べ替えはこの配列を丸ごと置き換える。
--
-- 店舗名・写真・地図のURLは行にしない。
--   見出しと画像とボタンで扱いが違ううえ、**地図のURLは店名から自動で入る**ため
--   （Google Places）。行にすると「消してもいい項目」に見えてしまう。


-- ────────────────────────────────────────────────────────────
-- 1. 列を足して、いまの内容を移す
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS info_rows jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 既存の4列から作り直す。**値が入っているものだけ**行にする
-- （空欄＝載せない、という今回の考え方に合わせる）。
UPDATE public.stores s
   SET info_rows = COALESCE((
     SELECT jsonb_agg(r ORDER BY ord)
       FROM (
         VALUES (1, 'map-pin', '住所',     s.address),
                (2, 'clock',   '営業時間', s.hours),
                (3, 'clock',   '定休日',   s.holiday),
                (4, 'phone',   '電話番号', s.phone)
       ) AS v(ord, icon, label, value)
       CROSS JOIN LATERAL (
         SELECT jsonb_build_object('label', v.label, 'value', v.value, 'icon', v.icon) AS r
       ) AS x
      WHERE NULLIF(btrim(v.value), '') IS NOT NULL
   ), '[]'::jsonb)
 WHERE s.info_rows = '[]'::jsonb;

-- ⚠ 旧列（address / hours / holiday / phone）は**消していない**。
-- 列の削除は取り返しがつかないため。読むのをやめただけで、中身はそのまま残っている。


-- ────────────────────────────────────────────────────────────
-- 2. 保存（manager のみ）
-- ────────────────────────────────────────────────────────────
-- 項目は**丸ごと置き換える**。追加・削除・並べ替えを1回で反映するため。
CREATE OR REPLACE FUNCTION public.save_store_info_v2(
  p_name      text,
  p_image_url text,
  p_map_url   text,
  p_rows      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION '店舗情報を変更する権限がありません' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION '項目の形式が不正です' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 12 THEN
    RAISE EXCEPTION '項目は12個までです' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) AS e
     WHERE btrim(COALESCE(e->>'label', '')) = ''
        OR length(e->>'label') > 20
        OR length(COALESCE(e->>'value', '')) > 200
  ) THEN
    RAISE EXCEPTION '項目名は1〜20文字、内容は200文字までです' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores
     SET name           = COALESCE(NULLIF(btrim(p_name), ''), name),
         info_image_url = NULLIF(btrim(p_image_url), ''),
         map_url        = NULLIF(btrim(p_map_url), ''),
         info_rows      = p_rows
   WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_store_info_v2(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_store_info_v2(text, text, text, jsonb) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, map_url, jsonb_pretty(info_rows) FROM public.stores;
