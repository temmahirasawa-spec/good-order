-- ============================================================
-- 受渡の完了を、注文の状態とは別の欄で持つ（orders.picked_up_at）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: setup.sql / staff_foundation.sql / staff_role_rls.sql /
--       pickup_no.sql / order_items_cooking_status.sql 実行済み。
--
-- 何のためのものか（2026-09-14 に見つかった穴を塞ぐ）:
--   orders.status は1つしかないのに、
--     ・調理／提供／受渡 の進み具合
--     ・会計が済んだかどうか
--   という**別々の2つ**を同じ欄に詰め込んでいる。あとから来た方が前を上書きするので、
--   画面ごとに取りこぼしが出る。実際に次の2つが起きていた:
--
--     1. 厨房: 提供済み(served) → 会計(paid) で「提供済みだった」記憶が消え、
--        終わった注文が厨房に戻ってきた（2026-09-14 修正済み）
--     2. 受渡: テイクアウトを提供済み(served) にしたあとに会計すると paid に
--        上書きされ、**まだ渡していないのに受渡画面から消える**（本ファイルで対応）
--
-- ここでの直し方:
--   **会計の記録には一切触らない。** 代わりに「受け渡した」を picked_up_at という
--   独立した欄に持ち、受渡画面はそれで判断する。
--   受渡完了のときは:
--     ・status が 'paid'（会計済み）なら **status は変えない**。picked_up_at だけ入れる
--       → 会計済みの記録を消さない。レジに未会計として戻ってこない
--     ・それ以外なら 従来どおり status='picked_up' にして picked_up_at も入れる
--       → まだ会計していないテイクアウトは、レジに残って会計できる
--
--   本筋は status を「調理・提供の進み具合」と「会計の状態」の2欄に分けること。
--   それは会計まわりの作り替えになるので、ここではやっていない。
--
-- 権限の方針:
--   RLS は触らない。受渡完了は SECURITY DEFINER の RPC に寄せ、
--   その中でロール（counter / kitchen / manager）を見る。
--   **金額・会計に関わる権限（paid）は register / manager のみ、は変えていない。**


-- ────────────────────────────────────────────────────────────
-- 1. 「受け渡した時刻」の欄
-- ────────────────────────────────────────────────────────────
-- NULL = まだ渡していない。受渡画面はこれで絞る。
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;

-- 既に受渡済み（status='picked_up'）の過去データを埋める。
-- 正確な受渡時刻は残っていないので、最後に更新した時刻で代用する。
UPDATE public.orders
   SET picked_up_at = updated_at
 WHERE status = 'picked_up'
   AND picked_up_at IS NULL;

-- 受渡画面が毎秒引くので、未受渡のテイクアウトだけを拾う索引を足す
CREATE INDEX IF NOT EXISTS idx_orders_pickup_waiting
  ON public.orders (order_type, picked_up_at)
  WHERE picked_up_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 2. 受渡完了（受渡画面の「受渡完了」ボタン）
-- ────────────────────────────────────────────────────────────
-- 戻り値は更新後の updated_at。**NULL は「更新できなかった」**の意味で、
--   ・他の端末が先に更新していた（楽観ロックの競合）
--   ・その注文がもう受渡済み、またはテイクアウトではない
-- のいずれか。画面は NULL なら取り直す（今までの 0件更新と同じ扱い）。
CREATE OR REPLACE FUNCTION public.mark_order_picked_up(
  p_order_id           uuid,
  p_expected_updated_at timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_status text;
  v_new    timestamptz;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS DISTINCT FROM 'manager'
     AND v_role IS DISTINCT FROM 'kitchen'
     AND v_role IS DISTINCT FROM 'counter' THEN
    RAISE EXCEPTION '受渡を完了する権限がありません' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
    FROM public.orders
   WHERE id = p_order_id
     AND order_type = 'takeout'
     AND picked_up_at IS NULL
     AND updated_at = p_expected_updated_at
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;   -- 競合、もしくは既に受渡済み
  END IF;

  UPDATE public.orders
     SET picked_up_at = now(),
         -- **会計済み(paid)のときは status を書き換えない。**
         -- 書き換えると会計の記録が消え、レジに未会計として戻ってしまう。
         status = CASE WHEN v_status = 'paid' THEN status ELSE 'picked_up' END
   WHERE id = p_order_id
  RETURNING updated_at INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_picked_up(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_picked_up(uuid, timestamptz) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   -- 受渡待ちのテイクアウト（会計の有無にかかわらず出る）:
--   SELECT id, status, pickup_no, picked_up_at, updated_at
--     FROM public.orders
--    WHERE order_type = 'takeout' AND picked_up_at IS NULL
--    ORDER BY updated_at;
--
--   -- 過去の受渡済みが埋まったか:
--   SELECT count(*) FILTER (WHERE picked_up_at IS NOT NULL) AS 受渡済み,
--          count(*) FILTER (WHERE status = 'picked_up' AND picked_up_at IS NULL) AS 埋め漏れ
--     FROM public.orders;
