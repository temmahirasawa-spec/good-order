-- ============================================================
-- 厨房伝票の印刷ジョブキュー（print_jobs）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / takeout.sql / staff_foundation.sql /
--       tables_qr.sql / pickup_no.sql 実行済み。
--
-- 何のためのものか:
--   EPSON TM-m30III-H のサーバーダイレクトプリント（プリンタが数秒おきに
--   こちらのサーバーへ「印刷するものある?」と HTTP で聞きに来る方式）で
--   厨房伝票を出すための、印刷待ち行列。
--   注文が入ったら AFTER INSERT トリガーが1行積み、プリンタが取りに来たら
--   'printing' に変え、印刷完了の報告が来たら 'done' にする。
--
-- 設計の要点:
--   - 印刷は注文の「後ろ」に足すだけ。orders / order_items のスキーマも
--     既存のビジネスロジックも一切変更しない。印刷が失敗しても注文は通る。
--   - ジョブは「プリンタが刷り終えたと報告するまで」消さない。
--     プリンタが落ちていても復帰後に出る（＝印刷漏れに強い）。
--   - 一度プリンタに渡したジョブは二度渡さない（'printing' に落とす）。
--     ただし報告が来ないまま放置されると永久に出ないので、
--     RECLAIM_AFTER 経過したものだけ 'pending' に戻す（下記 6）。
--   - 採番・claim の直列化は FOR UPDATE SKIP LOCKED の行ロックのみ。
--     advisory lock は使わない（pickup_no.sql と同じ方針）。
--
-- 権限の方針:
--   - anon（お客様のブラウザ）からは一切触れない。REVOKE する。
--     注文の INSERT 自体は anon が行うが、ジョブを積むのは SECURITY DEFINER
--     のトリガーなので anon に print_jobs の権限は要らない。
--   - authenticated（店舗スタッフ）は SELECT のみ。管理画面の「印刷状況」で
--     未印刷・失敗を見るため。書き換えは RPC 経由に限る。
--   - プリンタ応答API（app/api/print/...）は service_role キーで動くため
--     RLS を素通りする。claim / complete は RPC にして手順を1文にまとめる。


-- ────────────────────────────────────────────────────────────
-- 1. テーブル
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'printing', 'done', 'failed')),

  -- 伝票の「新規 / 追加(2) / 追加(3)」の N。1 = 新規。
  -- 注文が入った時点で確定させ、以後変えない（後から数え直すと
  -- 会計済みになった時点で番号が変わってしまい、紙と食い違うため）。
  seq         smallint    NOT NULL DEFAULT 1,

  attempts    smallint    NOT NULL DEFAULT 0,   -- プリンタに渡した回数
  last_error  text,                             -- プリンタが返した失敗理由

  created_at  timestamptz NOT NULL DEFAULT now(),
  claimed_at  timestamptz,                      -- プリンタに渡した時刻
  printed_at  timestamptz                       -- 「刷り終えた」報告が来た時刻
);

-- 1注文につきジョブは1つ。lib/store.ts の saveOrderToDb は
-- upsert(ignoreDuplicates) なので同じ id の再送では AFTER INSERT 自体が
-- 発火しないが、将来の経路も含めて二重投入を機構的に防いでおく。
CREATE UNIQUE INDEX IF NOT EXISTS uq_print_jobs_order
  ON public.print_jobs (order_id);

-- プリンタが「次の1件」を引くときの経路。pending を作成順に舐める。
CREATE INDEX IF NOT EXISTS idx_print_jobs_pending
  ON public.print_jobs (store_id, created_at)
  WHERE status = 'pending';

-- 取りこぼし回収（6）と管理画面の絞り込み用。
CREATE INDEX IF NOT EXISTS idx_print_jobs_printing
  ON public.print_jobs (claimed_at)
  WHERE status = 'printing';


-- ────────────────────────────────────────────────────────────
-- 2. 「新規 / 追加(N)」の N を数える
-- ────────────────────────────────────────────────────────────
-- 定義: 同じ卓の、同じ営業日の、まだ会計（status = 'paid'）が済んでいない
--       注文のうち、自分より前にあるものの数 + 1。
--
-- したがって会計が済むと次の注文はまた「新規」に戻る。
-- ＝ 席の入れ替わりで番号がリセットされる、という運用上の意味になる。
-- 席を跨いだ通し番号にしたい場合はこの関数だけ差し替えればよい。
--
-- テイクアウトは卓を持たず1注文で完結するため常に 1（＝「新規」）。
--
-- 卓の識別は table_id（tables_qr.sql）を優先し、移行前の注文などで
-- table_id が NULL のものは table_number でグループ化する。
--
-- VOLATILE（＝既定。STABLE にしないこと）:
--   AFTER INSERT トリガーから呼ぶため、たった今 INSERT された自分自身の行を
--   SELECT できる必要がある。STABLE にすると呼び出し元の文のスナップショットに
--   固定され、自分の行が見えず常に 1 を返してしまう。
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

  -- テイクアウトは常に新規扱い
  IF v_order.order_type = 'takeout' THEN
    RETURN 1;
  END IF;

  v_key := COALESCE(v_order.table_id::text, 'n:' || COALESCE(v_order.table_number, 0)::text);

  SELECT COUNT(*) INTO v_count
    FROM public.orders o
   WHERE o.store_id = v_order.store_id
     AND o.order_type = 'dine_in'
     AND COALESCE(o.table_id::text, 'n:' || COALESCE(o.table_number, 0)::text) = v_key
     AND o.business_date IS NOT DISTINCT FROM v_order.business_date
     AND o.status <> 'paid'
     -- 自分より前のものだけ数える。created_at が同値のときは id で決着させ、
     -- 同時 INSERT でも順序が一意に決まるようにする。
     AND (o.created_at < v_order.created_at
          OR (o.created_at = v_order.created_at AND o.id < v_order.id));

  -- smallint に収める（99卓ぶんも追加が続くことは実運用では無い）
  RETURN LEAST(v_count + 1, 99)::smallint;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. 注文が入ったらジョブを積む（AFTER INSERT トリガー）
-- ────────────────────────────────────────────────────────────
-- anon（お客様のブラウザ）が orders を INSERT するため SECURITY DEFINER。
-- print_jobs の権限を anon に与えずに済ませるのが目的。
--
-- AFTER INSERT にしているのは、2 の採番が同じトランザクション内で
-- 自分自身の行を SELECT できる必要があるため（BEFORE では見えない）。
--
-- 例外を握りつぶしている点が重要:
--   ジョブ作成に失敗しても注文の INSERT は成功させる。
--   「印刷が壊れても注文は通る」を DB レベルで担保する。
CREATE OR REPLACE FUNCTION public.enqueue_print_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.print_jobs (store_id, order_id, seq)
    VALUES (NEW.store_id, NEW.id, public.print_job_seq_for_order(NEW.id))
    ON CONFLICT (order_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- 印刷ジョブの失敗で注文自体を落とさない
    RAISE WARNING '[enqueue_print_job] order % のジョブ作成に失敗: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;  -- AFTER トリガーの返り値は無視される
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enqueue_print_job ON public.orders;
CREATE TRIGGER trg_orders_enqueue_print_job
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_print_job();


-- ────────────────────────────────────────────────────────────
-- 4. プリンタが「次の1件」を引く（claim）
-- ────────────────────────────────────────────────────────────
-- pending の最古を1件だけ 'printing' に変え、伝票に必要なデータを
-- まとめて1つの JSON で返す。該当が無ければ NULL を返す。
--
-- FOR UPDATE SKIP LOCKED により、同時に複数から呼ばれても
-- 同じジョブが2台に渡ることはない（＝二重印刷が起きない）。
--
-- 返す JSON の形（app/api/print が受け取る）:
--   {
--     "jobId": uuid, "seq": 1,
--     "orderType": "dine_in" | "takeout",
--     "tableLabel": "A-1" | null,
--     "pickupNo": 7 | null,
--     "createdAt": "2026-08-20T02:24:00Z",
--     "items": [{ "name": "ブレンドコーヒー", "quantity": 3 }, ...],
--     "itemCount": 6
--   }
-- 金額は伝票に刷らない決定のため、返り値に含めない。
CREATE OR REPLACE FUNCTION public.claim_print_job(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job    public.print_jobs%ROWTYPE;
  v_order  public.orders%ROWTYPE;
  v_items  jsonb;
  v_count  integer;
BEGIN
  UPDATE public.print_jobs j
     SET status     = 'printing',
         claimed_at = now(),
         attempts   = j.attempts + 1
   WHERE j.id = (
     SELECT id FROM public.print_jobs
      WHERE store_id = p_store_id
        AND status = 'pending'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.* INTO v_job;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_job.order_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('name', m.name, 'quantity', oi.quantity)
           ORDER BY oi.created_at, oi.id
         ), '[]'::jsonb),
         COALESCE(SUM(oi.quantity), 0)
    INTO v_items, v_count
    FROM public.order_items oi
    JOIN public.menu_items m ON m.id = oi.menu_item_id
   WHERE oi.order_id = v_job.order_id;

  RETURN jsonb_build_object(
    'jobId',      v_job.id,
    'seq',        v_job.seq,
    'orderType',  v_order.order_type,
    'tableLabel', v_order.table_label,
    'pickupNo',   v_order.pickup_no,
    'createdAt',  v_order.created_at,
    'items',      v_items,
    'itemCount',  v_count
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. 印刷結果の報告を受ける（complete）
-- ────────────────────────────────────────────────────────────
-- p_ok = true  → 'done'
-- p_ok = false → 'pending' に戻して再挑戦。ただし MAX_ATTEMPTS を超えたら
--                'failed' で止める（紙切れのまま無限に刷り直そうとしない）。
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
BEGIN
  IF p_ok THEN
    UPDATE public.print_jobs
       SET status = 'done', printed_at = now(), last_error = NULL
     WHERE id = p_job_id;
  ELSE
    UPDATE public.print_jobs
       SET status     = CASE WHEN attempts >= MAX_ATTEMPTS THEN 'failed' ELSE 'pending' END,
           last_error = p_error
     WHERE id = p_job_id;
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. 渡したまま報告が返ってこないジョブを回収する
-- ────────────────────────────────────────────────────────────
-- プリンタに渡した直後に電源やWi-Fiが落ちると 'printing' のまま残り、
-- 放置すると永久に印刷されない。一定時間で 'pending' に戻す。
--
-- 注意: これは「出ない」より「2枚出るかもしれない」を選ぶ判断。
--   実際には印刷できていたのに報告だけ届かなかった場合、回収すると
--   同じ伝票がもう1枚出る。厨房伝票では欠落のほうが事故が大きいため
--   こちらを取る。RECLAIM_AFTER を短くしすぎると二重印刷が増えるので
--   プリンタのポーリング間隔（3秒想定）より十分長い 2分にしてある。
--
-- claim のたびに呼ぶ想定（app/api/print 側で claim の直前に実行する）。
-- 別途 cron を立てる必要は無い。
CREATE OR REPLACE FUNCTION public.reclaim_stale_print_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  RECLAIM_AFTER constant interval := interval '2 minutes';
  v_n integer;
BEGIN
  UPDATE public.print_jobs
     SET status = 'pending'
   WHERE status = 'printing'
     AND claimed_at < now() - RECLAIM_AFTER;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 7. RLS と権限
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- anon（公開されている鍵で動くお客様のブラウザ）からは完全に遮断する。
-- 注文内容が読めてしまうため、SELECT も含めて渡さない。
REVOKE ALL ON TABLE public.print_jobs FROM anon;

-- 店舗スタッフは「印刷状況」画面のために読むだけ。
GRANT SELECT ON TABLE public.print_jobs TO authenticated;

DROP POLICY IF EXISTS "print_jobs_select_authenticated" ON public.print_jobs;
CREATE POLICY "print_jobs_select_authenticated"
  ON public.print_jobs FOR SELECT
  TO authenticated
  USING (true);

-- 状態を変えられるのは RPC（SECURITY DEFINER）だけ。
-- authenticated 向けの INSERT / UPDATE / DELETE ポリシーは意図的に作らない。

-- 採番・claim・complete・回収の各関数は service_role（サーバー側APIのキー）
-- からのみ呼ぶ。anon / authenticated には実行権限を渡さない。
REVOKE ALL ON FUNCTION public.claim_print_job(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_print_job(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reclaim_stale_print_jobs()           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_print_job(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stale_print_jobs()           TO service_role;


-- ────────────────────────────────────────────────────────────
-- 8. 動作確認用（実行しなくてよい）
-- ────────────────────────────────────────────────────────────
-- 未印刷の件数と、直近に積まれたジョブを見る:
--   SELECT status, COUNT(*) FROM public.print_jobs GROUP BY status;
--   SELECT j.id, j.status, j.seq, j.attempts, o.table_label, o.order_type, j.created_at
--     FROM public.print_jobs j JOIN public.orders o ON o.id = j.order_id
--    ORDER BY j.created_at DESC LIMIT 20;
--
-- 特定の伝票を刷り直す（管理画面の再印刷ボタンと同じこと）:
--   UPDATE public.print_jobs SET status = 'pending', last_error = NULL, attempts = 0
--    WHERE id = '...';
