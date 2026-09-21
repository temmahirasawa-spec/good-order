-- ============================================================
-- レジの会計画面で伝票を直せるようにする（2026-09-21）
-- 実行は Supabase MCP 経由（本番 good-order / oiropkuvaenebmlicrac）
-- ============================================================
--
-- 前提: set_drink_table_scope.sql / tax_mode.sql / pickup_completed.sql 実行済み。
--       **列の追加・削除は無く、RLS も緩めない。** 追加するのは関数だけ。
--
-- ■ 何を作るか（洋輔さん経由の店舗の要望。天真の指示 2026-09-21）
--   「会計の画面に来てから一切編集ができない。明細を消す・伝票ごと消す・
--     無いものを足す、ができれば便利」
--
--   1. register_delete_order_item … 明細を1行消す
--   2. register_delete_order      … 伝票（注文1回ぶん）ごと消す
--   ※「足す」は新しい RPC を作らない。既存の place_order をレジから呼ぶ
--      （同じ卓の追加注文になるので、厨房伝票・受渡番号・割引・税が全部そのまま効く）
--
-- ■ 安全のための線引き
--   - **会計済み（paid）の注文には一切触れない。** 消せるのは会計前だけ。
--     売上（ダッシュボード・日報）は paid しか見ていないので、売上の数字は動かない
--   - 役割は manager と register だけ（RLS では「レジは会計前の注文を触れない」を
--     表現できないため、SECURITY DEFINER の関数の中で自分で見る）
--   - 楽観ロック（updated_at 一致）。他の端末が先に触っていたら何もせず NULL を返す
--   - 明細を消して 0 件になる注文は、**注文ごと消す**。
--     明細 0 件の注文は厨房画面から永久に消えなくなるため（isFinished が false のまま）
--
-- ■ 金額の作り直し
--   明細をいじると 小計・セットドリンク割引・消費税・合計が全部ずれる。
--   レジ画面は 合計/割引/消費税 を orders の列から読んでいるので、
--   **消した時点で orders を書き直さないと、小計と合計が合わなくなる。**
--   割引は「同じ卓の会計前の注文ぜんぶ」で数えるため（set_drink_table_scope.sql）、
--   1件だけ直すと後の注文の割引が古いままになる。そこで
--   **その卓の会計前の注文を古い順に全部計算し直す**（recalc_bill_totals）。
--   計算の規則は place_order と同じものを使う（calc_order_total / set_drink_discount_for）。


-- ────────────────────────────────────────────────────────────
-- 1. 卓（またはテイクアウト1件）の金額を作り直す
-- ────────────────────────────────────────────────────────────
-- p_order_id で指定した注文が属する「卓の会計前の注文」を古い順に見て、
-- 1件ずつ place_order と同じ順番で割引を積み上げながら totals を書き直す。
-- テイクアウト（卓が無い）はその注文だけ。
CREATE OR REPLACE FUNCTION public.recalc_bill_totals(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o                public.orders%ROWTYPE;
  r                public.orders%ROWTYPE;
  v_items          jsonb;
  v_subtotal       integer;
  v_prior_items    jsonb    := '[]'::jsonb;
  v_prior_discount integer  := 0;
  v_discount       integer;
  v_mode           text;
  v_rate           integer;
  v_tax            integer;
  v_total          integer;
  v_scoped         boolean;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT tax_mode INTO v_mode FROM public.stores WHERE id = o.store_id;
  v_mode := COALESCE(v_mode, 'included');

  -- 卓でまとめて数えるのは「店内」かつ卓が分かるときだけ（place_order と同じ条件）
  v_scoped := o.order_type = 'dine_in'
              AND (o.table_id IS NOT NULL
                   OR NULLIF(btrim(COALESCE(o.table_label, '')), '') IS NOT NULL);

  FOR r IN
    SELECT * FROM public.orders x
     WHERE CASE
             WHEN v_scoped THEN
               x.store_id = o.store_id
               AND x.order_type = 'dine_in'
               AND x.status <> 'paid'
               AND x.business_date = o.business_date
               AND (
                 (o.table_id IS NOT NULL AND x.table_id = o.table_id)
                 OR (o.table_id IS NULL AND x.table_id IS NULL
                     AND NULLIF(btrim(COALESCE(x.table_label, '')), '')
                       = NULLIF(btrim(COALESCE(o.table_label, '')), ''))
               )
             ELSE x.id = o.id
           END
     ORDER BY x.created_at, x.id
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'menu_item_id', oi.menu_item_id,
             'quantity',     oi.quantity,
             -- order_items.unit_price はオプション込みなので options は付けない
             'unit_price',   oi.unit_price
           )), '[]'::jsonb),
           COALESCE(SUM(oi.unit_price * oi.quantity), 0)
      INTO v_items, v_subtotal
      FROM public.order_items oi
     WHERE oi.order_id = r.id;

    IF v_scoped THEN
      -- 「これまで＋この注文」で数えた割引から、これまでに付けた分を引く（place_order と同じ）
      v_discount := public.set_drink_discount_for(r.store_id, 'dine_in', v_prior_items || v_items)
                  - v_prior_discount;
      v_discount := GREATEST(v_discount, 0);
    ELSE
      v_discount := public.set_drink_discount_for(r.store_id, r.order_type, v_items);
    END IF;
    v_discount := LEAST(v_discount, v_subtotal);

    -- 税率は注文の種別で決まる。**注文したときの税率ではなく今の設定を使う**のは、
    -- place_order と同じ関数で計算し直す以上ここだけ別扱いにできないため。
    -- 営業中に税の設定を変えない運用（docs/specs/tax-mode.md）が前提。
    SELECT CASE WHEN r.order_type = 'takeout' THEN tax_rate_takeout ELSE tax_rate_dine_in END
      INTO v_rate FROM public.stores WHERE id = r.store_id;
    v_rate := COALESCE(v_rate, 10);

    SELECT c.tax, c.total INTO v_tax, v_total
      FROM public.calc_order_total(v_subtotal, v_discount, v_mode, v_rate) AS c;

    UPDATE public.orders
       SET total_amount    = v_total,
           discount_amount = v_discount,
           tax_amount      = v_tax,
           tax_rate        = v_rate
     WHERE id = r.id;

    v_prior_items    := v_prior_items || v_items;
    v_prior_discount := v_prior_discount + v_discount;
  END LOOP;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. 明細を1行消す
-- ────────────────────────────────────────────────────────────
-- 戻り値は jsonb。
--   {"ok": false}                                     … 競合（他の端末が先に触った）・会計済み・見つからない
--   {"ok": true, "order_deleted": false, "updated_at": ...}  … 明細だけ消えた
--   {"ok": true, "order_deleted": true}               … 最後の1行だったので注文ごと消えた
CREATE OR REPLACE FUNCTION public.register_delete_order_item(
  p_item_id             uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_order_id uuid;
  v_status   text;
  v_left     integer;
  v_new      timestamptz;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS DISTINCT FROM 'manager' AND v_role IS DISTINCT FROM 'register' THEN
    RAISE EXCEPTION '伝票を直す権限がありません' USING ERRCODE = '42501';
  END IF;

  SELECT oi.order_id, o.status INTO v_order_id, v_status
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE oi.id = p_item_id
     AND o.status <> 'paid'
     AND o.updated_at = p_expected_updated_at
   FOR UPDATE OF o;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  DELETE FROM public.order_items WHERE id = p_item_id;   -- order_item_options は CASCADE

  SELECT count(*) INTO v_left FROM public.order_items WHERE order_id = v_order_id;

  IF v_left = 0 THEN
    -- 明細0件の注文は厨房画面から永久に消えないので、注文ごと落とす
    DELETE FROM public.print_jobs WHERE order_id = v_order_id;
    DELETE FROM public.orders     WHERE id = v_order_id;
    RETURN jsonb_build_object('ok', true, 'order_deleted', true);
  END IF;

  -- 金額を作り直す（卓の後続の注文の割引も含めて）
  PERFORM public.recalc_bill_totals(v_order_id);

  SELECT updated_at INTO v_new FROM public.orders WHERE id = v_order_id;
  RETURN jsonb_build_object('ok', true, 'order_deleted', false, 'updated_at', v_new);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. 伝票（注文1回ぶん）ごと消す
-- ────────────────────────────────────────────────────────────
-- 消す順番は docs/preopen-audit-2026-09-16.md に書いた手作業の SQL と同じ。
-- 戻り値は true/false（false = 競合・会計済み・見つからない）。
CREATE OR REPLACE FUNCTION public.register_delete_order(
  p_order_id            uuid,
  p_expected_updated_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_store    uuid;
  v_sibling  uuid;
  o          public.orders%ROWTYPE;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS DISTINCT FROM 'manager' AND v_role IS DISTINCT FROM 'register' THEN
    RAISE EXCEPTION '伝票を直す権限がありません' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o
    FROM public.orders
   WHERE id = p_order_id
     AND status <> 'paid'
     AND updated_at = p_expected_updated_at
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  v_store := o.store_id;

  -- 同じ卓に会計前の注文がまだ残るなら、消したあとに割引を数え直す相手を控えておく
  SELECT x.id INTO v_sibling
    FROM public.orders x
   WHERE x.store_id = v_store
     AND x.order_type = 'dine_in'
     AND x.status <> 'paid'
     AND x.business_date = o.business_date
     AND x.id <> o.id
     AND (
       (o.table_id IS NOT NULL AND x.table_id = o.table_id)
       OR (o.table_id IS NULL AND x.table_id IS NULL
           AND NULLIF(btrim(COALESCE(x.table_label, '')), '')
             = NULLIF(btrim(COALESCE(o.table_label, '')), ''))
     )
   ORDER BY x.created_at
   LIMIT 1;

  DELETE FROM public.order_items WHERE order_id = p_order_id;  -- options は CASCADE
  DELETE FROM public.print_jobs  WHERE order_id = p_order_id;
  DELETE FROM public.orders      WHERE id = p_order_id;

  IF v_sibling IS NOT NULL THEN
    PERFORM public.recalc_bill_totals(v_sibling);
  END IF;

  RETURN true;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. 権限
-- ────────────────────────────────────────────────────────────
-- recalc_bill_totals は中から呼ぶだけなので anon/authenticated には開けない。
REVOKE ALL ON FUNCTION public.recalc_bill_totals(uuid) FROM PUBLIC, anon, authenticated;

-- ⚠ CREATE FUNCTION は既定で **PUBLIC に EXECUTE を与える**。
-- 関数の中で役割を見ているので実害は無いが、ログインしていない相手が呼べる状態にはしない。
-- REVOKE を先に書かないと anon に実行権が残る（2026-09-21、本番に流したあと気づいて締め直した）。
REVOKE ALL ON FUNCTION public.register_delete_order_item(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_delete_order(uuid, timestamptz)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_delete_order_item(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_delete_order(uuid, timestamptz)      TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. 実行後の確認
-- ────────────────────────────────────────────────────────────
--   SELECT p.proname, array_to_string(p.proacl, ' | ') AS grants
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname='public'
--      AND p.proname IN ('recalc_bill_totals','register_delete_order_item','register_delete_order');
--   -- 3行。register_* は authenticated だけ、recalc_bill_totals は誰にも付いていないこと
--   -- （2026-09-21 に本番で確認済み）
--
--   -- 金額が合っているか（会計前の注文。小計 − 割引 と 合計 の関係を見る）
--   SELECT o.id, o.total_amount, o.discount_amount, o.tax_amount,
--          (SELECT COALESCE(SUM(oi.unit_price * oi.quantity),0)
--             FROM public.order_items oi WHERE oi.order_id = o.id) AS subtotal
--     FROM public.orders o
--    WHERE o.status <> 'paid' AND o.business_date = public.orderly_business_date(now())
--    ORDER BY o.created_at;
