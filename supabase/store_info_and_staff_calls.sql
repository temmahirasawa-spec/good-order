-- ============================================================
-- 店舗情報の設定 と スタッフ呼び出しの項目設定
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / staff_foundation.sql / staff_calls.sql / staff_role_rls.sql 実行済み。
--
-- 何のためのものか（2026-09-15、洋輔さんの依頼）:
--   1. 「店舗情報」の中身（写真・住所・営業時間・電話番号）が **コードに直書き**（lib/siteConfig.ts）で、
--      店舗側から変える手段が無かった。写真も出ていなかった。
--   2. 「スタッフを呼ぶ」の選択肢が **お水 / お会計 / 呼ぶ の3つ固定**だった。
--      店舗ごとに自由に決めたい。
--
-- どちらも store 側で完結させる。


-- ────────────────────────────────────────────────────────────
-- 1. 店舗情報（stores に列を足す）
-- ────────────────────────────────────────────────────────────
-- お客様の「店舗情報」モーダルに出る項目。NULL のときはコード側の既定値
-- （lib/siteConfig.ts の STORE）にフォールバックするので、流しただけでは見た目は変わらない。
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS info_image_url text,
  ADD COLUMN IF NOT EXISTS address        text,
  ADD COLUMN IF NOT EXISTS hours          text,
  ADD COLUMN IF NOT EXISTS holiday        text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS map_url        text;

-- 保存（manager のみ）。空文字は NULL にして、既定値へのフォールバックを効かせる
CREATE OR REPLACE FUNCTION public.save_store_info(
  p_name       text,
  p_image_url  text,
  p_address    text,
  p_hours      text,
  p_holiday    text,
  p_phone      text,
  p_map_url    text
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

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores
     SET name           = COALESCE(NULLIF(btrim(p_name), ''), name),
         info_image_url = NULLIF(btrim(p_image_url), ''),
         address        = NULLIF(btrim(p_address), ''),
         hours          = NULLIF(btrim(p_hours), ''),
         holiday        = NULLIF(btrim(p_holiday), ''),
         phone          = NULLIF(btrim(p_phone), ''),
         map_url        = NULLIF(btrim(p_map_url), '')
   WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_store_info(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_store_info(text, text, text, text, text, text, text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. スタッフ呼び出しの項目
-- ────────────────────────────────────────────────────────────
-- staff_calls.call_type / call_label は自由なテキストなので、
-- **呼び出しを受ける側（厨房・レジ）の作りは変えなくてよい。**
CREATE TABLE IF NOT EXISTS public.staff_call_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- お客様に見える文言。例「お水をください」
  label         text        NOT NULL,
  -- components/Icon.tsx の名前。知らない名前が入っていたら画面側で 'bell' に落とす
  icon          text        NOT NULL DEFAULT 'bell',
  -- staff_calls.call_type に入る値。集計のためのもので、お客様には見えない
  call_type     text        NOT NULL DEFAULT 'other',
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_call_options_order
  ON public.staff_call_options (store_id, display_order);

ALTER TABLE public.staff_call_options ENABLE ROW LEVEL SECURITY;

-- お客様（anon）は「使う項目」を読むだけ
DROP POLICY IF EXISTS "staff_call_options_select_all" ON public.staff_call_options;
CREATE POLICY "staff_call_options_select_all"
  ON public.staff_call_options FOR SELECT
  TO anon, authenticated
  USING (true);

-- 書き換えは RPC（manager 限定）だけ。直接の INSERT/UPDATE/DELETE は誰にも開けない
REVOKE INSERT, UPDATE, DELETE ON public.staff_call_options FROM PUBLIC, anon, authenticated;

-- 初期値: いまコードに入っている3つ。**流した時点で今までと同じ見え方になる**
INSERT INTO public.staff_call_options (store_id, label, icon, call_type, display_order)
SELECT s.id, x.label, x.icon, x.call_type, x.ord
  FROM public.stores s,
       (VALUES ('お水をください',        'water-drop', 'water', 1),
               ('お会計をお願いします',  'card',       'bill',  2),
               ('スタッフを呼ぶ',        'bell',       'other', 3)) AS x(label, icon, call_type, ord)
 WHERE NOT EXISTS (SELECT 1 FROM public.staff_call_options o WHERE o.store_id = s.id);

-- 保存（manager のみ）。**丸ごと置き換える。** 並び替え・追加・削除を1回で反映するため
CREATE OR REPLACE FUNCTION public.save_staff_call_options(p_options jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'スタッフ呼び出しの項目を変更する権限がありません' USING ERRCODE = '42501';
  END IF;
  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION '項目の形式が不正です' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_options) = 0 THEN
    RAISE EXCEPTION '項目を1つ以上残してください' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_options) > 8 THEN
    RAISE EXCEPTION '項目は8つまでです' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_options) AS e
     WHERE btrim(COALESCE(e->>'label', '')) = ''
        OR length(e->>'label') > 30
  ) THEN
    RAISE EXCEPTION '項目名は1〜30文字で入れてください' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  DELETE FROM public.staff_call_options WHERE store_id = v_store_id;

  INSERT INTO public.staff_call_options (store_id, label, icon, call_type, display_order, is_active)
  SELECT v_store_id,
         btrim(e->>'label'),
         COALESCE(NULLIF(btrim(e->>'icon'), ''), 'bell'),
         COALESCE(NULLIF(btrim(e->>'call_type'), ''), 'other'),
         COALESCE((e->>'display_order')::integer, ord),
         COALESCE((e->>'is_active')::boolean, true)
    FROM jsonb_array_elements(p_options) WITH ORDINALITY AS t(e, ord);
END;
$$;

REVOKE ALL ON FUNCTION public.save_staff_call_options(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_call_options(jsonb) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, info_image_url, address, hours, holiday, phone FROM public.stores;
--   SELECT label, icon, call_type, display_order, is_active
--     FROM public.staff_call_options ORDER BY display_order;
