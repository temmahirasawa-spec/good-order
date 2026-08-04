-- ============================================================
-- 表示設定：二次元コード着地画面の「背景タイプ」（色 / 画像 / 動画）
--   管理画面「表示設定 > 動画設定」の2枚目のカードが書き込む。
--   Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- ⚠ 実行順序: **supabase/store_media.sql を先に流してから**このファイルを流すこと。
--    こちらは store_media テーブルに列を足す差分なので、テーブルが無いと失敗する。
--
-- 設計の要点:
--   * **既定値は 'video'。**これが今回いちばん大事な点。
--     既存行（store_media.sql の STEP 5 が入れる2件）は ALTER TABLE の DEFAULT で
--     自動的に background_type='video' になるため、店舗が何も操作しなくても
--     お客様側の見え方は今までと1pxも変わらない。
--   * 画像URLは url ではなく **image_url という別列**に持つ。
--     url（動画）と同じ列を使い回すと、「動画 → 画像 → 動画に戻す」の往復で
--     先に入れた動画が消える。タイプを切り替えても前のものが残るようにする。
--   * background_color は NULL 可。色を一度も選んでいない状態を表す。
--     お客様側は NULL のとき既定色（#1A1A1A）にフォールバックする
--     （lib/backgroundColor.ts の DEFAULT_BACKGROUND_COLOR と同値）。
--   * 許可値の検査は CHECK 制約ではなく RPC 側で行う（store_media.sql と同じ方針）。
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: 影響件数の確認（先にこれだけ実行してください）
-- ────────────────────────────────────────────────────────────
--   SELECT slot, enabled, url, poster_url FROM public.store_media ORDER BY slot;
--   -- 2件（landing_background / order_hero）が出るはずです。
--   -- 0件の場合は supabase/store_media.sql をまだ流していません。先にそちらを実行してください。


-- ────────────────────────────────────────────────────────────
-- STEP 1: 列の追加
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.store_media
  -- 'color' | 'image' | 'video'。既存行は DEFAULT により 'video' で埋まる（＝従来どおりの見え方）
  ADD COLUMN IF NOT EXISTS background_type  text NOT NULL DEFAULT 'video',
  -- '#RRGGBB'（大文字）。NULL = 一度も色を選んでいない
  ADD COLUMN IF NOT EXISTS background_color text,
  -- 背景タイプが 'image' のときに使う画像。動画の url とは別に持つ（冒頭の設計メモ参照）
  ADD COLUMN IF NOT EXISTS image_url        text;


-- ────────────────────────────────────────────────────────────
-- STEP 2: 保存RPC の差し替え（manager のみ）
-- ────────────────────────────────────────────────────────────
--   引数が増えるので、**古い4引数版は明示的に落とす**。
--   残しておくと PostgREST から見て同名関数が2つある状態になり、
--   引数名の付け方によってはどちらが呼ばれるか曖昧になるため。
DROP FUNCTION IF EXISTS public.save_store_media(text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.save_store_media(
  p_slot             text,
  p_enabled          boolean,
  p_url              text,
  p_poster_url       text,
  p_background_type  text,
  p_background_color text,
  p_image_url        text
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
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  IF p_slot NOT IN ('order_hero', 'landing_background') THEN
    RAISE EXCEPTION '未知のスロットです: %', p_slot;
  END IF;

  IF p_background_type NOT IN ('color', 'image', 'video') THEN
    RAISE EXCEPTION '未知の背景タイプです: %', p_background_type;
  END IF;

  -- 色は #RRGGBB（大文字小文字は問わない）だけ受け付ける。
  -- 画面側でも検証しているが、RPC を直接叩かれても壊れないようにここでも見る。
  IF p_background_color IS NOT NULL AND p_background_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION '背景色の形式が不正です: %', p_background_color;
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  INSERT INTO public.store_media (
    store_id, slot, kind, url, poster_url, enabled,
    background_type, background_color, image_url, updated_at
  )
  VALUES (
    v_store_id, p_slot, 'video', p_url, p_poster_url, p_enabled,
    p_background_type, upper(p_background_color), p_image_url, now()
  )
  ON CONFLICT (store_id, slot) DO UPDATE
    SET url              = EXCLUDED.url,
        poster_url       = EXCLUDED.poster_url,
        enabled          = EXCLUDED.enabled,
        background_type  = EXCLUDED.background_type,
        background_color = EXCLUDED.background_color,
        image_url        = EXCLUDED.image_url,
        updated_at       = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_store_media(text, boolean, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_store_media(text, boolean, text, text, text, text, text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 3: 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT slot, enabled, background_type, background_color, url, image_url
--     FROM public.store_media ORDER BY slot;
--   -- 2件とも background_type = 'video' / background_color = NULL / image_url = NULL に
--   -- なっていれば成功です。この状態でお客様側の / を開き、背景動画が今までどおり
--   -- 出ることを確認してください（＝適用しても見え方が変わらない）。
