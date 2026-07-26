-- ============================================================
-- スタッフ側 機能基盤の追加（デザイン着手前の土台）
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 実行前の実態確認（psqlで直接確認済み）:
--   - orders.status の CHECK 制約は既に 'paid' を含む
--     （pending, preparing, served, paid）。setup.sql には無いが
--     本番側で個別に追加されていた状態。今回はこれに 'picked_up' を足す。
--   - orders / order_items に updated_at 列はまだ無い。
--   - staff_calls.status に CHECK 制約はまだ無い（text自由入力）。
--   - stores に is_accepting_orders はまだ無い。


-- ────────────────────────────────────────────────────────────
-- 1. 同時操作の競合検知: updated_at + 自動更新トリガー
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON public.orders;
CREATE TRIGGER trg_orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_order_items_set_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_set_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 2. スタッフ呼び出しの個別対応: status を3値に拡張
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.staff_calls
  DROP CONSTRAINT IF EXISTS staff_calls_status_chk;
ALTER TABLE public.staff_calls
  ADD CONSTRAINT staff_calls_status_chk
  CHECK (status IN ('waiting', 'acknowledged', 'done'));


-- ────────────────────────────────────────────────────────────
-- 3. 店舗の受付停止・営業状態
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_accepting_orders boolean NOT NULL DEFAULT true;

-- stores は既に stores_select_all（anon,authenticated 読み取り可）/
-- stores_write_authenticated（authenticated 書き込み可）が設定済みのため
-- RLSポリシーの追加・変更は不要。


-- ────────────────────────────────────────────────────────────
-- 4. テイクアウトの受け渡し状態: orders.status に picked_up を追加
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'preparing', 'served', 'picked_up', 'paid'));


-- ────────────────────────────────────────────────────────────
-- 5. スタッフ権限分離の土台
--   方式(a): Supabase Auth の app_metadata.role を使用。
--   理由は完了報告に記載。既存の管理者アカウントは全員 manager に移行する。
-- ────────────────────────────────────────────────────────────

UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'manager')
WHERE raw_app_meta_data->>'role' IS NULL;

-- 今後スタッフ個別ロールを付与する場合の実行例（Supabaseダッシュボード SQL Editor 等で）:
--   UPDATE auth.users SET raw_app_meta_data =
--     COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"kitchen"}'::jsonb
--   WHERE email = 'kitchen-staff@example.com';
--   （role は 'kitchen' | 'register' | 'manager' のいずれか）
