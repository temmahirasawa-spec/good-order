-- ============================================================
-- 店舗メディア（トップページの動画）
--   お客様側の2か所の動画を、管理画面「店舗設定 > トップページ」から
--   差し替え・削除・非表示にできるようにする
--   Supabase ダッシュボード → SQL Editor で実行
-- ============================================================
--
-- 設計の要点:
--   * **スロット制のテーブルを1つ新設する。**stores に列を足す案も検討したが、
--     対象が2か所（/order の16:9ヒーロー、/ の全画面背景）あり、
--     どちらも「表示ON/OFF・動画URL・ポスターURL・更新日時」の同じ4項目を持つ。
--     列を足す方式だと stores に 4列 × スロット数 が並ぶことになる。
--   * anon にも SELECT を開ける。お客様側の / と /order が未認証で読む。
--     中身は公開済み動画のURLだけで、元から誰でも見られるもの。
--     （stores も setup.sql の stores_select_all で同じ扱いになっている）
--   * 書き込みは manager 限定の RPC 1本に集約する。best_sellers.sql と同じ方針。
--   * **slot の許可値はテーブルのCHECK制約にしない。**RPC 側で検査する。
--     スロットを増やすときに ALTER TABLE ではなく関数の差し替えで済ませるため。
--   * Storage は既存の menu-videos / menu-images バケットを `top/` 配下で使う
--     （supabase/menu_videos.sql・setup.sql）。バケットは新設しない。
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: 影響件数の確認（先にこれだけ実行してください）
-- ────────────────────────────────────────────────────────────
--   SELECT id, name FROM public.stores ORDER BY created_at;
--   -- 対象は1店舗のはず。STEP 5 の初期データで、現在ハードコードされている
--   -- /images/hero/background.mp4 がそのまま入るので、実行後の見え方は変わりません。


-- ────────────────────────────────────────────────────────────
-- STEP 1: テーブル
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_media (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- 'order_hero'（/order の16:9ヒーロー） / 'landing_background'（/ の全画面背景）
  slot        text        NOT NULL,
  kind        text        NOT NULL DEFAULT 'video',
  -- NULL = 動画なし。お客様側は枠ごと描画しない
  url         text,
  -- 動画の1フレーム目。<video poster> に入る
  poster_url  text,
  enabled     boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slot)
);


-- ────────────────────────────────────────────────────────────
-- STEP 2: RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.store_media ENABLE ROW LEVEL SECURITY;

-- お客様側の / と /order が未認証で読むので anon にも開ける。
-- 入っているのは公開バケットの動画URLだけ。
DROP POLICY IF EXISTS "store_media_select_all" ON public.store_media;
CREATE POLICY "store_media_select_all"
  ON public.store_media FOR SELECT
  TO anon, authenticated
  USING (true);

-- 書き込みポリシーは置かない。保存は STEP 3 の save_store_media() だけを入口にする。


-- ────────────────────────────────────────────────────────────
-- STEP 3: 保存RPC（manager のみ）
-- ────────────────────────────────────────────────────────────
--   表示ON/OFF・動画URL・ポスターURLを1トランザクションで入れ替える。
--   削除は p_url / p_poster_url に NULL を渡す（行は残し、中身だけ空にする）。
CREATE OR REPLACE FUNCTION public.save_store_media(
  p_slot       text,
  p_enabled    boolean,
  p_url        text,
  p_poster_url text
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

  -- スロットの許可値はここで検査する（テーブルのCHECK制約にしない。冒頭の設計メモ参照）
  IF p_slot NOT IN ('order_hero', 'landing_background') THEN
    RAISE EXCEPTION '未知のスロットです: %', p_slot;
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  INSERT INTO public.store_media (store_id, slot, kind, url, poster_url, enabled, updated_at)
  VALUES (v_store_id, p_slot, 'video', p_url, p_poster_url, p_enabled, now())
  ON CONFLICT (store_id, slot) DO UPDATE
    SET url        = EXCLUDED.url,
        poster_url = EXCLUDED.poster_url,
        enabled    = EXCLUDED.enabled,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_store_media(text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_store_media(text, boolean, text, text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 4: Storage
-- ────────────────────────────────────────────────────────────
-- 新しいバケットは作らない。既存の menu-videos（supabase/menu_videos.sql）と
-- menu-images（supabase/setup.sql）を `top/` 配下で使う。
-- どちらも public: true で、SELECT 全員 / INSERT・DELETE authenticated のポリシーが
-- 既に入っているため、追加の作業は不要。


-- ────────────────────────────────────────────────────────────
-- STEP 5: 初期データ（現在ハードコードされているアセットの移行）
-- ────────────────────────────────────────────────────────────
--   * app/order/page.tsx の HERO_MEDIA と components/top/TopScreen.tsx の
--     <video src> に直接書かれていた値をそのまま入れる。
--   * `/images/...` は public/ 配下の相対パス。Next.js がそのまま配信するので
--     <video src> にも <img src> にも使える。Storage には置かない。
--   * これを入れることで、マイグレーション適用後の見え方が一切変わらない。
INSERT INTO public.store_media (store_id, slot, kind, url, poster_url, enabled)
SELECT s.id, v.slot, 'video', v.url, v.poster_url, true
  FROM (SELECT id FROM public.stores ORDER BY created_at LIMIT 1) AS s
  CROSS JOIN (VALUES
    ('order_hero',         '/images/hero/background.mp4', '/images/pancake/p1.webp'),
    ('landing_background', '/images/hero/background.mp4', '/images/hero/background-poster.webp')
  ) AS v(slot, url, poster_url)
ON CONFLICT (store_id, slot) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- STEP 6: 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT slot, enabled, url, poster_url, updated_at
--     FROM public.store_media ORDER BY slot;
--   -- 2件（landing_background / order_hero）が入っていれば成功。
--   -- この状態でお客様側の / と /order を開き、動画が今までどおり出ることを確認してください。
