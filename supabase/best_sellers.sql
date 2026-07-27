-- ============================================================
-- ベストセラー設定
--   トップページ最上部の「Best Seller」枠に出す商品を店舗側で指定できるようにする
--   Supabase Dashboard > SQL Editor に貼り付けて実行してください
-- ============================================================
--
-- 設計の要点:
--   * 表示ON/OFFは **stores に列を1つ足す**。settings テーブルを新設しなくても、
--     同じ性質のフラグ（is_accepting_orders）がすでに stores にある。
--   * 並び順は既存の一覧と同じく display_order（1..N の連番）。
--   * anon にも SELECT を開ける。ここに入るのは menu_item_id と並び順だけで、
--     メニュー自体は元から公開情報。お客様側のトップページが直接読む必要がある。
--   * 書き込みは manager 限定の RPC 1本に集約する。トグルと一覧を同時に保存するので、
--     個別のINSERT/DELETEを並べると途中で失敗して半分だけ反映された状態が残る。
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: 影響件数の確認（先にこれだけ実行してください）
-- ────────────────────────────────────────────────────────────
--   SELECT id, name, is_accepting_orders FROM public.stores;
--   -- 対象は1店舗のはず。best_seller_enabled は既定 true で入るので、
--   -- 実行直後の見え方は「今までどおり（自動算出）」から変わりません。


-- ────────────────────────────────────────────────────────────
-- STEP 1: 表示ON/OFFフラグ
-- ────────────────────────────────────────────────────────────
-- 既定 true。移行直後は登録0件なので、後述のフォールバックで
-- 従来どおり注文数からの自動算出が出る（＝見え方が変わらない）。
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS best_seller_enabled boolean NOT NULL DEFAULT true;


-- ────────────────────────────────────────────────────────────
-- STEP 2: 登録テーブル
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.best_sellers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- 商品を削除したらベストセラーからも自動で消える（枠に幽霊が残らない）
  menu_item_id  uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_best_sellers_store
  ON public.best_sellers (store_id, display_order);


-- ────────────────────────────────────────────────────────────
-- STEP 3: RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.best_sellers ENABLE ROW LEVEL SECURITY;

-- お客様側のトップページが読むので anon にも SELECT を開ける。
-- 中身は menu_item_id と並び順だけで、メニュー自体は元から公開情報。
DROP POLICY IF EXISTS "best_sellers_select_all" ON public.best_sellers;
CREATE POLICY "best_sellers_select_all"
  ON public.best_sellers FOR SELECT
  TO anon, authenticated
  USING (true);

-- 書き込みポリシーは置かない。保存は STEP 4 の save_best_sellers() だけを入口にする。


-- ────────────────────────────────────────────────────────────
-- STEP 4: 保存RPC（manager のみ）
-- ────────────────────────────────────────────────────────────
--   p_items の形: [{"menu_item_id": uuid, "display_order": 1}, ...]
--   一覧に無い行は削除される。トグルと一覧を1トランザクションで入れ替える。
CREATE OR REPLACE FUNCTION public.save_best_sellers(
  p_enabled boolean,
  p_items   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_count integer;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items);
  IF v_count > 20 THEN
    RAISE EXCEPTION 'ベストセラーは最大20件です（%件）', v_count;
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores SET best_seller_enabled = p_enabled WHERE id = v_store_id;

  DELETE FROM public.best_sellers
   WHERE store_id = v_store_id
     AND menu_item_id NOT IN (
       SELECT (e ->> 'menu_item_id')::uuid FROM jsonb_array_elements(p_items) AS e
     );

  INSERT INTO public.best_sellers (store_id, menu_item_id, display_order)
  SELECT v_store_id,
         (e ->> 'menu_item_id')::uuid,
         (e ->> 'display_order')::int
    FROM jsonb_array_elements(p_items) AS e
  ON CONFLICT (store_id, menu_item_id)
  DO UPDATE SET display_order = EXCLUDED.display_order;
END;
$$;

REVOKE ALL ON FUNCTION public.save_best_sellers(boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_best_sellers(boolean, jsonb) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 5: 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT best_seller_enabled FROM public.stores;
--   SELECT b.display_order, m.name
--     FROM public.best_sellers b JOIN public.menu_items m ON m.id = b.menu_item_id
--    ORDER BY b.display_order;
--   -- 実行直後は0件（＝従来どおり注文数からの自動算出が出る）
