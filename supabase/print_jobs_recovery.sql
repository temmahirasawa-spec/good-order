-- ============================================================
-- 厨房伝票: 失敗した伝票の自動復帰と、「追加(N)」の卓の束ね方の統一（2026-09-16）
-- 実行は Supabase MCP 経由（本番 good-order / oiropkuvaenebmlicrac）
-- ============================================================
--
-- 前提: supabase/print_jobs.sql / printer_status.sql / order_stale_table_id.sql 実行済み。
-- 列の追加・削除、RLS の変更は無い。関数3つの差し替えだけ。
--
-- ■ 何が起きていたか（docs/preopen-verify-2026-09-16.md の P2 / S2）
--   1. 印刷に5回失敗した伝票は 'failed' で止まり、紙を替えても自動では出なかった。
--      戻す経路は管理画面の「刷り直す」だけで、厨房OFF・伝票1本の運用では
--      「気づかなければ一生出ない」伝票になる。
--   2. 「新規 / 追加(N)」の N を数えるとき、table_id が無い注文（席設定の作り直しで
--      卓の行が消えた注文）は table_number（全部 0）で束ねていたため、
--      別の卓の注文を数に含めた N が刷られていた。厨房画面・レジは
--      table_id → 卓ラベル → table_number の順に直したので、ここも同じ順序にする。
--
-- ■ 直し方
--   - complete_print_job: 1枚でも刷れた（＝プリンタが健全に戻った）瞬間に、
--     同じ店の**今日の**失敗した伝票を pending に戻す。紙を替えて次の注文が出れば、
--     溜まっていた分もすぐ続けて出る。
--   - reclaim_stale_print_jobs（printer_poll から約6秒おきに呼ばれる）: 今日の failed のうち、
--     最後に試してから 3 分以上たったものを pending に戻す。新しい注文が来なくても、
--     紙を替えてから最長 3 分で自動で出る。紙切れのまま放置しても、3分に1回・約30秒だけ
--     再挑戦して失敗に戻るだけで、他の伝票を止めない。
--   - 「今日」に限るのは、何日も前の失敗伝票が復旧時にまとめて出るのを防ぐため。
--   - 5回で止める設計（紙切れのまま無限に刷り直そうとしない）はそのまま残す。

-- ────────────────────────────────────────────────────────────
-- 1. 「新規 / 追加(N)」の N（卓の束ね方を厨房・レジと揃える）
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.print_job_seq_for_order(p_order_id uuid)
RETURNS smallint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
  v_key    text;
  v_count  integer;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN 1;
  END IF;

  IF v_order.order_type = 'takeout' THEN
    RETURN 1;
  END IF;

  -- table_id → 卓ラベル → table_number の順（lib/kitchenGrouping.ts の dineInTableKey と同じ）
  v_key := COALESCE(
    v_order.table_id::text,
    'l:' || NULLIF(btrim(COALESCE(v_order.table_label, '')), ''),
    'n:' || COALESCE(v_order.table_number, 0)::text
  );

  SELECT COUNT(*) INTO v_count
    FROM public.orders o
   WHERE o.store_id = v_order.store_id
     AND o.order_type = 'dine_in'
     AND COALESCE(
           o.table_id::text,
           'l:' || NULLIF(btrim(COALESCE(o.table_label, '')), ''),
           'n:' || COALESCE(o.table_number, 0)::text
         ) = v_key
     AND o.business_date IS NOT DISTINCT FROM v_order.business_date
     AND o.status <> 'paid'
     AND (o.created_at < v_order.created_at
          OR (o.created_at = v_order.created_at AND o.id < v_order.id));

  RETURN LEAST(v_count + 1, 99)::smallint;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. 印刷結果の報告（成功したら、今日の失敗分を戻す）
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_print_job(
  p_job_id uuid,
  p_ok     boolean,
  p_error  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  MAX_ATTEMPTS constant smallint := 5;
  v_store_id uuid;
BEGIN
  IF p_ok THEN
    UPDATE public.print_jobs
       SET status = 'done', printed_at = now(), last_error = NULL
     WHERE id = p_job_id
    RETURNING store_id INTO v_store_id;

    -- プリンタが刷れる状態に戻った。今日の失敗した伝票をもう一度流す
    IF v_store_id IS NOT NULL THEN
      UPDATE public.print_jobs j
         SET status = 'pending', attempts = 0, claimed_at = NULL
        FROM public.orders o
       WHERE o.id = j.order_id
         AND j.store_id = v_store_id
         AND j.status = 'failed'
         AND o.business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date;
    END IF;
  ELSE
    UPDATE public.print_jobs
       SET status     = CASE WHEN attempts >= MAX_ATTEMPTS THEN 'failed' ELSE 'pending' END,
           last_error = p_error
     WHERE id = p_job_id;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. 回収（報告なしの printing → pending に加えて、今日の failed を 3 分ごとに再挑戦）
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reclaim_stale_print_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  RECLAIM_AFTER constant interval := interval '2 minutes';
  RETRY_FAILED_AFTER constant interval := interval '3 minutes';
  v_n integer;
  v_m integer;
BEGIN
  UPDATE public.print_jobs
     SET status = 'pending'
   WHERE status = 'printing'
     AND claimed_at < now() - RECLAIM_AFTER;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.print_jobs j
     SET status = 'pending', attempts = 0, claimed_at = NULL
    FROM public.orders o
   WHERE o.id = j.order_id
     AND j.status = 'failed'
     AND o.business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date
     AND COALESCE(j.claimed_at, j.created_at) < now() - RETRY_FAILED_AFTER;
  GET DIAGNOSTICS v_m = ROW_COUNT;

  RETURN v_n + v_m;
END;
$$;

-- 権限は print_jobs.sql のとおり（service_role のみ）。CREATE OR REPLACE で引き継がれる。

-- ────────────────────────────────────────────────────────────
-- 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT proname, md5(prosrc) FROM pg_proc WHERE proname IN
--     ('print_job_seq_for_order','complete_print_job','reclaim_stale_print_jobs');
--   -- 取引内の動作確認（必ず ROLLBACK）:
--   BEGIN;
--     INSERT INTO public.orders (id, store_id, table_number, status, order_type, total_amount)
--       VALUES ('99999999-9999-4999-8999-999999999991', '10000000-0000-0000-0000-000000000001', 0, 'pending', 'dine_in', 1);
--     UPDATE public.print_jobs SET status='failed', attempts=5, claimed_at=now()-interval '10 minutes'
--       WHERE order_id='99999999-9999-4999-8999-999999999991';
--     SELECT public.reclaim_stale_print_jobs();  -- 1 以上
--     SELECT status, attempts FROM public.print_jobs WHERE order_id='99999999-9999-4999-8999-999999999991';  -- pending / 0
--   ROLLBACK;
