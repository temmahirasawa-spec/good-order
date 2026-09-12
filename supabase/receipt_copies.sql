-- ============================================================
-- 伝票の枚数（1枚 / 毎回2枚 / フードとドリンクが両方あるときだけ2枚）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: print_jobs.sql / printer_status.sql / serving_timing.sql / menu_item_options.sql 実行済み。
--
-- 仕様: docs/specs/sold-out-and-receipt-copies.md（2026-09-12、洋輔さんの依頼）
--
-- 何のためのものか:
--   2026-09-04 の「FOOD と DRINK が両方入った注文だけ2枚」を、店舗が選べる設定にする。
--   YORKYS BRUNCH は「フードもドリンクもパンケーキも同じ1枚の伝票でいいので、
--   1オーダーにつき同じ伝票を毎回2枚出したい」（洋輔さん）。
--   管理画面「印刷状況」から切り替えられる。
--
-- 設計の要点:
--   - 値は3つ。既定は 'two_if_mixed'（＝2026-09-04 からの現状）なので、
--     この SQL を流しただけでは他店舗の挙動は変わらない。
--       'one'          … 常に1枚
--       'two'          … 常に同じ伝票を2枚（1/2・2/2）
--       'two_if_mixed' … フードとドリンクが両方あるときだけ2枚（それ以外は1枚）
--   - 紙の組み立て（何枚刷るか）は lib/receipt.ts の receiptCopies()。
--     ここでは claim_print_job() が返す JSON に "receiptCopies" を足すだけ。
--   - 書き込みは RPC 1本（save_receipt_copies）。刷り直し（requeue_print_job）と同じく
--     manager / kitchen / counter に開ける。伝票を必要とする当事者が自分で変えられるように。
--   - 初期データで YORKYS BRUNCH を 'two' にする（依頼そのもの）。管理画面でいつでも戻せる。
--
-- ⚠ 流す順番: **この SQL を流してから PR をマージすること。**
--   SQL だけ先に流しても壊れない（旧コードは receiptCopies を読まないので現状のまま）。


-- ────────────────────────────────────────────────────────────
-- 1. 列
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS receipt_copies text NOT NULL DEFAULT 'two_if_mixed';

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_receipt_copies_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_receipt_copies_chk
  CHECK (receipt_copies IN ('one', 'two', 'two_if_mixed'));


-- ────────────────────────────────────────────────────────────
-- 2. 初期データ（YORKYS BRUNCH: 毎回2枚。洋輔さんの依頼 2026-09-12）
-- ────────────────────────────────────────────────────────────
UPDATE public.stores
   SET receipt_copies = 'two'
 WHERE id = '10000000-0000-0000-0000-000000000001';


-- ────────────────────────────────────────────────────────────
-- 3. 伝票データ（claim_print_job）に枚数の設定を足す
-- ────────────────────────────────────────────────────────────
-- menu_item_options.sql の claim_print_job と同じ。返す JSON に
--   "receiptCopies": "one" | "two" | "two_if_mixed"
-- が増えるだけ。printer_poll()（printer_status.sql）はこの関数を呼ぶだけなので差し替えれば効く。
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
  v_copies text;
BEGIN
  UPDATE public.print_jobs j
     SET status = 'printing', claimed_at = now(), attempts = j.attempts + 1
   WHERE j.id = (
     SELECT id FROM public.print_jobs
      WHERE store_id = p_store_id AND status = 'pending'
      ORDER BY created_at LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.* INTO v_job;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_job.order_id;

  SELECT receipt_copies INTO v_copies FROM public.stores WHERE id = v_job.store_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'name',          m.name,
             'quantity',      oi.quantity,
             'servingTiming', oi.serving_timing,
             'categoryType',  COALESCE(c.category_type, 'food'),
             'options',       COALESCE((
               SELECT jsonb_agg(jsonb_build_object('name', oo.name, 'price', oo.price) ORDER BY oo.created_at, oo.id)
                 FROM public.order_item_options oo WHERE oo.order_item_id = oi.id
             ), '[]'::jsonb)
           )
           ORDER BY oi.created_at, oi.id
         ), '[]'::jsonb),
         COALESCE(SUM(oi.quantity), 0)
    INTO v_items, v_count
    FROM public.order_items oi
    JOIN public.menu_items m ON m.id = oi.menu_item_id
    LEFT JOIN public.categories c ON c.id = m.category_id
   WHERE oi.order_id = v_job.order_id;

  RETURN jsonb_build_object(
    'jobId', v_job.id, 'seq', v_job.seq, 'orderType', v_order.order_type,
    'tableLabel', v_order.table_label, 'pickupNo', v_order.pickup_no,
    'createdAt', v_order.created_at, 'items', v_items, 'itemCount', v_count,
    'receiptCopies', COALESCE(v_copies, 'two_if_mixed')
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. 保存RPC（manager / kitchen / counter）
-- ────────────────────────────────────────────────────────────
-- stores には authenticated の書き込みポリシー（stores_write_authenticated）があるが、
-- 他の設定（ブランドカラー・ベストセラー）と同じく、値の検証とロールの確認を
-- 1か所にまとめるため RPC を入口にする。
CREATE OR REPLACE FUNCTION public.save_receipt_copies(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_store_id uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('manager', 'kitchen', 'counter') THEN
    RAISE EXCEPTION '伝票の枚数を変更する権限がありません' USING ERRCODE = '42501';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('one', 'two', 'two_if_mixed') THEN
    RAISE EXCEPTION '伝票の枚数の値が不正です: %', p_mode USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at LIMIT 1;

  UPDATE public.stores SET receipt_copies = p_mode WHERE id = v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_receipt_copies(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_receipt_copies(text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT name, receipt_copies FROM public.stores;
--   -- YORKYS BRUNCH が 'two' なら成功。マージ後、次の注文から同じ伝票が2枚出る。
--   -- 管理画面「印刷状況」の「伝票の枚数」で 1枚 / 2枚 / 両方あるときだけ2枚 に切り替えられる。
