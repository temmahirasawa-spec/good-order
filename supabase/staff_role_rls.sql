-- ============================================================
-- 権限分離をRLSレベルまで実効化する
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/staff_foundation.sql 実行済み（auth.users.raw_app_meta_data.role
-- に 'kitchen' | 'register' | 'manager' が設定されている）。
--
-- 設計方針:
--   kitchen/register/manager は全員 Postgres の同一ロール "authenticated" である
--   （Supabase Authはapp_metadataをPostgresロールには変換しない）。そのため
--   GRANT/REVOKEだけでは役割ごとに列/行を出し分けられない。auth.jwt()で
--   JWTのapp_metadata.roleをRLSポリシー内から参照し、役割ごとの条件分岐を行う。
--
--   1) 売上集計（lib/salesData.ts）は SECURITY DEFINER 関数に移し、関数内で
--      role='manager' を強制する。orders/order_items の生テーブルSELECTポリシー
--      自体は authenticated のまま変更しない（kitchen/registerが自分の業務で
--      これらのテーブルを直接読む必要があるため。変更するとkitchen/registerが
--      壊れる）。
--   2) orders/order_items のUPDATEは、役割ごとに遷移先ステータスを制限する
--      （kitchenはserved/picked_upのみ、registerはpaidのみ、managerは無制限）。
--
-- 2026-07 追記: カウンター（受け渡し担当）ロール 'counter' を追加した。
--   app_metadata.role に設定できる値は
--   'kitchen' | 'register' | 'counter' | 'manager' の4種になる。
--
-- ■ orders.status の UPDATE 権限マトリクス（変更前 → 変更後）
--
--   role      | served      | picked_up          | paid        | その他status
--   ----------+-------------+--------------------+-------------+--------------
--   manager   | ○ → ○      | ○ → ○             | ○ → ○      | ○ → ○
--   kitchen   | ○ → ○      | ○ → ○             | × → ×      | × → ×
--   register  | × → ×      | × → ×             | ○ → ○      | × → ×
--   counter   | (新規) ×    | (新規) ○           | (新規) ×    | (新規) ×
--
--   変更点は「counter に picked_up のみを許可した」1点だけ。
--   picked_up は counter / kitchen / manager の3ロールが可能になる。
--   会計（paid）は register / manager のみのまま、金額列を含む
--   その他の更新権限も一切緩めていない。
--
-- ■ order_items.cooking_status の UPDATE 権限（変更なし）
--
--   role      | 変更前 | 変更後
--   ----------+--------+--------
--   manager   | ○     | ○
--   kitchen   | ○     | ○
--   register  | ×     | ×
--   counter   | (新規) × ← 受け渡しに調理ステータスの変更は不要なので付与しない
--
-- ■ 売上・経営データ（get_sales_orders）の権限（変更なし）
--
--   manager のみ ○。kitchen / register / counter は ×。


-- ────────────────────────────────────────────────────────────
-- 1. 売上・経営データ（lib/salesData.ts）を manager 限定に
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_sales_orders(start_ts timestamptz, end_ts timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'insufficient_privilege: manager role required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'table_number', o.table_number,
      'total_amount', o.total_amount,
      'order_type', o.order_type,
      'created_at', o.created_at,
      'items', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'menu_items', jsonb_build_object(
              'name', mi.name,
              'category_id', mi.category_id,
              'categories', jsonb_build_object('name', c.name)
            )
          )
        ), '[]'::jsonb)
        FROM public.order_items oi
        LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN public.categories c ON c.id = mi.category_id
        WHERE oi.order_id = o.id
      )
    )
    ORDER BY o.created_at ASC
  ), '[]'::jsonb)
  INTO result
  FROM public.orders o
  WHERE o.status = 'paid'
    AND o.created_at >= start_ts
    AND o.created_at < end_ts;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_orders(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_orders(timestamptz, timestamptz) TO authenticated;
-- anon には付与しない（管理ダッシュボードはログイン後にのみ使う）


-- ────────────────────────────────────────────────────────────
-- 2. kitchen/register の最小権限（UPDATE先ステータスの制限）
-- ────────────────────────────────────────────────────────────
-- 注意: これは「どのステータス値に変更できるか」を役割ごとに制限するもので、
-- 同一UPDATE文で他の列（total_amount等）を書き換えること自体を防ぐものでは
-- ない（アプリのコードは常に status 単体でUPDATEしているため実運用上は
-- 問題にならない想定）。完全な列レベルの改ざん防止にはトリガーや列権限の
-- 追加設計が必要で、今回はそこまでは行っていない。

DROP POLICY IF EXISTS "orders_update_authenticated" ON public.orders;
DROP POLICY IF EXISTS "orders_update_role_scoped" ON public.orders;
CREATE POLICY "orders_update_role_scoped"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'kitchen'  AND status IN ('served', 'picked_up'))
    -- counter（受け渡し担当）は picked_up のみ。会計・金額系には触れない
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'counter'  AND status = 'picked_up')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'register' AND status = 'paid')
  );

DROP POLICY IF EXISTS "order_items_update_authenticated" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_kitchen_manager" ON public.order_items;
CREATE POLICY "order_items_update_kitchen_manager"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    -- counter は含めない（受け渡しに調理ステータスの変更は不要なため）
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('kitchen', 'manager')
  );

-- order_items の DELETE は現状どの画面のコードからも呼ばれていないため、
-- 既存の authenticated 限定のまま変更しない
-- （supabase/order_items_update_rls.sql の order_items_delete_authenticated）。
