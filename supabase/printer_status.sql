-- ============================================================
-- プリンタの生存記録と、伝票の刷り直し（管理画面「印刷状況」用）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/print_jobs.sql / staff_role_rls.sql 実行済み。
--
-- 何のためのものか:
--   営業中にプリンタが止まったことに気づけないのが一番怖い。
--   紙切れ・電源断・Wi-Fi断が起きても、伝票が出ないだけで誰も気づかず
--   注文だけが溜まっていく。それを店舗の画面から見えるようにする。
--
-- 入るもの:
--   1. printer_status … プリンタが最後に喋ってきた時刻と状態
--   2. printer_poll()  … 受け口APIが毎回呼ぶ処理を1本にまとめたもの
--   3. requeue_print_job() … 管理画面の「刷り直す」ボタン


-- ────────────────────────────────────────────────────────────
-- 1. プリンタの状態（店舗につき1行）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.printer_status (
  store_id       uuid        PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,

  -- 最後にプリンタが「印刷するものある?」と聞きに来た時刻。
  -- これが古ければプリンタが死んでいる（電源・Wi-Fi・設定のいずれか）
  last_seen_at   timestamptz,

  -- 最後に状態通知が来た時刻と、その中身
  last_status_at timestamptz,
  status_note    text,        -- 「用紙切れ」等の日本語。異常が無ければ NULL
  status_raw     text         -- 元のXML（調査用）
);


-- ────────────────────────────────────────────────────────────
-- 2. プリンタのポーリング1回ぶんの処理をまとめる
-- ────────────────────────────────────────────────────────────
-- 受け口API（app/api/print）が GetRequest のたびに呼ぶ。
-- 以前は reclaim → claim で2往復していたが、3秒おきに叩かれる経路なので
-- 1往復にまとめた。生存記録もここでやる。
--
-- 生存記録の書き込みは15秒に1回に間引く。
-- 3秒ごとに1行を更新し続けると1日3万回近い更新になり、
-- 1行しかないテーブルに不要なゴミ（dead tuple）が溜まるため。
-- 画面側の判定は「60秒以上音沙汰なし＝停止」なので15秒の粒度で足りる。
CREATE OR REPLACE FUNCTION public.printer_poll(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.printer_status (store_id, last_seen_at)
  VALUES (p_store_id, now())
  ON CONFLICT (store_id) DO UPDATE
    SET last_seen_at = now()
  WHERE public.printer_status.last_seen_at IS NULL
     OR public.printer_status.last_seen_at < now() - interval '15 seconds';

  -- 渡したまま報告が返ってこなかったジョブの回収（print_jobs.sql）
  PERFORM public.reclaim_stale_print_jobs();

  RETURN public.claim_print_job(p_store_id);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. 状態通知を記録する
-- ────────────────────────────────────────────────────────────
-- p_note は異常があるときだけ日本語（「用紙切れ」等）、正常なら NULL。
-- 日本語への変換は lib/receipt.ts の describePrintFailure() が行う。
CREATE OR REPLACE FUNCTION public.record_printer_status(
  p_store_id uuid,
  p_note     text,
  p_raw      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.printer_status (store_id, last_seen_at, last_status_at, status_note, status_raw)
  VALUES (p_store_id, now(), now(), p_note, left(p_raw, 2000))
  ON CONFLICT (store_id) DO UPDATE
    SET last_seen_at   = now(),
        last_status_at = now(),
        status_note    = EXCLUDED.status_note,
        status_raw     = EXCLUDED.status_raw;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. 伝票を刷り直す（管理画面のボタン）
-- ────────────────────────────────────────────────────────────
-- print_jobs には authenticated 向けの UPDATE ポリシーを置いていない
-- （print_jobs.sql の方針）。状態を変えられるのは関数の内側だけなので、
-- 刷り直しもここを通す。
--
-- 許可するロール: manager / kitchen / counter
--   厨房と受渡カウンターは伝票を必要とする当事者なので刷り直せてよい。
--   register（レジ）は伝票の再発行に関与しないため外してある。
--   会計（paid）権限まわりは一切触っていない。
CREATE OR REPLACE FUNCTION public.requeue_print_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('manager', 'kitchen', 'counter') THEN
    RAISE EXCEPTION '伝票を刷り直す権限がありません' USING ERRCODE = '42501';
  END IF;

  UPDATE public.print_jobs
     SET status     = 'pending',
         attempts   = 0,
         last_error = NULL,
         claimed_at = NULL,
         printed_at = NULL
   WHERE id = p_job_id;

  RETURN FOUND;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. RLS と権限
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.printer_status ENABLE ROW LEVEL SECURITY;

-- anon（お客様のブラウザ）には渡さない
REVOKE ALL ON TABLE public.printer_status FROM anon;

-- 店舗スタッフは読むだけ。書き換えは上の関数経由に限る
GRANT SELECT ON TABLE public.printer_status TO authenticated;

DROP POLICY IF EXISTS "printer_status_select_authenticated" ON public.printer_status;
CREATE POLICY "printer_status_select_authenticated"
  ON public.printer_status FOR SELECT
  TO authenticated
  USING (true);

-- printer_poll / record_printer_status はサーバー側APIだけが呼ぶ
REVOKE ALL ON FUNCTION public.printer_poll(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_printer_status(uuid, text, text)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.printer_poll(uuid)                      TO service_role;
GRANT EXECUTE ON FUNCTION public.record_printer_status(uuid, text, text) TO service_role;

-- 刷り直しは店舗スタッフの画面から呼ぶ（中でロールを見て弾く）
REVOKE ALL ON FUNCTION public.requeue_print_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requeue_print_job(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. 動作確認用（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
--   SELECT * FROM public.printer_status;
--   -- last_seen_at が数十秒以内なら、プリンタは生きて話しかけてきている
--
--   SELECT j.id, j.status, j.seq, j.attempts, j.last_error, o.table_label, j.created_at
--     FROM public.print_jobs j JOIN public.orders o ON o.id = j.order_id
--    ORDER BY j.created_at DESC LIMIT 20;
