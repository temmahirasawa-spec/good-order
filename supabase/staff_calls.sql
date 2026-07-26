-- ============================================================
-- staff_calls テーブル（スタッフ呼び出し機能）
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_calls (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     uuid        REFERENCES public.stores(id),
  table_number integer     NOT NULL,
  call_type    text        NOT NULL,                -- 'water' | 'bill' | 'other'
  call_label   text        NOT NULL,                -- 表示用日本語テキスト
  status       text        NOT NULL DEFAULT 'waiting', -- 'waiting' | 'done'
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.staff_calls ENABLE ROW LEVEL SECURITY;

-- お客様（anon）は INSERT のみ可
DROP POLICY IF EXISTS "staff_calls_insert_all" ON public.staff_calls;
CREATE POLICY "staff_calls_insert_all"
  ON public.staff_calls FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 管理者（authenticated）は SELECT/UPDATE/DELETE 可
DROP POLICY IF EXISTS "staff_calls_select_authenticated" ON public.staff_calls;
CREATE POLICY "staff_calls_select_authenticated"
  ON public.staff_calls FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_calls_update_authenticated" ON public.staff_calls;
CREATE POLICY "staff_calls_update_authenticated"
  ON public.staff_calls FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_calls_delete_authenticated" ON public.staff_calls;
CREATE POLICY "staff_calls_delete_authenticated"
  ON public.staff_calls FOR DELETE
  TO authenticated
  USING (true);

-- 動作確認用：わざと1件入れて、厨房画面で見えるか確認する
-- INSERT INTO public.staff_calls (store_id, table_number, call_type, call_label)
-- VALUES ('10000000-0000-0000-0000-000000000001', 99, 'water', 'お水をください');
