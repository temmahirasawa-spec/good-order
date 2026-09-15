-- ============================================================
-- 使う機能のON/OFF（厨房画面・スタッフ呼び出し）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / staff_foundation.sql / staff_call_options（store_info_and_staff_calls.sql）実行済み。
--
-- 何のためのものか（2026-09-15、洋輔さんの依頼）:
--   「厨房にiPadを置かないことになったので、厨房の画面を一旦使わないようにできますか？
--     タイミング見て機能確認のためにやっていきます」
--   「それに伴い『スタッフを呼ぶ』も一旦なくしてもらって」
--
--   どちらも**あとから戻せる**必要があるので、消すのではなく設定で切る。
--
-- 天真の決定（2026-09-15）:
--   - 厨房画面を OFF にしても **厨房伝票の印刷は続ける**。
--     伝票で注文を受け取る運用になるので、印刷は止めてはいけない
--   - スタッフ呼び出しを OFF にしたら、**お客様側の入口を全部消す**
--     （ハンバーガーメニューの項目と、画面右下のベルの両方）
--   - 設定は既存の「表示設定」にまとめる。画面を増やさない

ALTER TABLE public.stores
  -- 厨房画面（/admin/kitchen）を使うか。OFF でもサイドバーから消えるだけで、
  -- 印刷・レジ・テイクアウト受渡は今までどおり動く
  ADD COLUMN IF NOT EXISTS kitchen_enabled    boolean NOT NULL DEFAULT true,
  -- お客様の「スタッフを呼ぶ」を使うか
  ADD COLUMN IF NOT EXISTS staff_call_enabled boolean NOT NULL DEFAULT true;

-- 保存（manager のみ）
CREATE OR REPLACE FUNCTION public.save_feature_toggles(
  p_kitchen    boolean,
  p_staff_call boolean
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
    RAISE EXCEPTION '機能の設定を変更する権限がありません' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores
     SET kitchen_enabled    = COALESCE(p_kitchen, true),
         staff_call_enabled = COALESCE(p_staff_call, true)
   WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_feature_toggles(boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_feature_toggles(boolean, boolean) TO authenticated;

-- 実行後の確認:
--   SELECT name, kitchen_enabled, staff_call_enabled FROM public.stores;
--   -- どちらも既定 true。流しただけでは何も変わらない
