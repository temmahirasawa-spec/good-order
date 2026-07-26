-- ============================================================
-- 受渡番号（pickup_no）: 口頭で呼び出せる日次リセットの連番
-- Supabase ダッシュボード → SQL Editor で実行してください
-- ============================================================
--
-- 前提: supabase/setup.sql / takeout.sql / staff_foundation.sql /
--       orders_anon_lockdown.sql 実行済み。
--
-- 設計:
--   - orders.id（クライアント生成UUID）は主キーのまま変更しない。
--     レジ画面の「# + 注文ID先頭6桁」は"内部照合用ID"として残し、
--     この pickup_no とは別物として扱う。
--   - 採番は必ずサーバー側（BEFORE INSERT トリガー）で行う。
--     クライアントが pickup_no を渡してきても無視して上書きする。
--   - 直列化は (store_id, business_date) のカウンタ行の行ロックのみで行う。
--     advisory lock は使わない。
--   - 01〜99 で循環する（99 の次は 01）。表示は常に2桁ゼロ埋め。
--   - 番号が飛ぶ（欠番が出る）ことは許容する。
--     ON CONFLICT で実際には INSERT されなかった場合や、トランザクションが
--     ロールバックした場合はその番号が欠番になる。
--
-- 冪等性について（重要）:
--   lib/store.ts の saveOrderToDb は「クライアント生成の id で INSERT する」
--   実装で、これまで upsert / ON CONFLICT は使っていなかった（＝同じ id の
--   再送は一意制約違反で落ちるだけ）。今回あわせてアプリ側を
--   upsert(..., { onConflict: "id", ignoreDuplicates: true })
--   ＝ INSERT ... ON CONFLICT DO NOTHING に変更した。
--   BEFORE INSERT トリガーは競合検知より前に走るので採番自体は消費される
--   （欠番になる）が、既存行の pickup_no は DO NOTHING により決して
--   書き換わらない。したがって「同一 id が再送されてもその注文の
--   pickup_no は変わらない」を満たす。


-- ────────────────────────────────────────────────────────────
-- 1. 営業日（business_date）の定義
-- ────────────────────────────────────────────────────────────
-- Asia/Tokyo の日付で判定する。
--
-- 営業が日を跨ぐ場合（例: 翌2時まで営業していて、深夜2時の注文も
-- 前日の営業日として扱いたい場合）は、下の INTERVAL を営業終了時刻ぶん
-- 大きくすること。例:
--   INTERVAL '0 hours' … JSTの暦日 = 営業日（現状。0時で番号がリセット）
--   INTERVAL '5 hours' … 朝5時に営業日が切り替わる（深夜帯は前日扱い）
-- ここを変更すると当日の採番系列が変わるため、営業時間外に流すこと。
-- STABLE（IMMUTABLEではない）: timestamptz AT TIME ZONE はタイムゾーン定義に
-- 依存するため Postgres 側の関数が STABLE 扱い。関数インデックスには使えない。
CREATE OR REPLACE FUNCTION public.orderly_business_date(ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (((ts AT TIME ZONE 'Asia/Tokyo') - INTERVAL '0 hours'))::date;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. 採番カウンタ
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pickup_no_counters (
  store_id      uuid     NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_date date     NOT NULL,
  last_no       smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, business_date)
);

-- アプリのロールからは一切触らせない（採番トリガー = SECURITY DEFINER 経由のみ）
ALTER TABLE public.pickup_no_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pickup_no_counters FROM anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. orders への列追加
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_no smallint;

-- どの営業日の 01〜99 なのかを明示的に持つ（循環するため created_at だけでは
-- 番号の一意性を説明できない）
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_date date;

CREATE INDEX IF NOT EXISTS idx_orders_business_date_pickup_no
  ON public.orders (store_id, business_date, pickup_no);


-- ────────────────────────────────────────────────────────────
-- 4. 採番トリガー
-- ────────────────────────────────────────────────────────────
-- anon（お客様）も orders を INSERT するため SECURITY DEFINER。
-- カウンタテーブルの権限をアプリロールに与えずに済ませるのが目的。
CREATE OR REPLACE FUNCTION public.assign_pickup_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_next smallint;
BEGIN
  v_date := public.orderly_business_date(COALESCE(NEW.created_at, now()));

  -- カウンタ行を用意（既にあれば何もしない）
  INSERT INTO public.pickup_no_counters (store_id, business_date, last_no)
  VALUES (NEW.store_id, v_date, 0)
  ON CONFLICT (store_id, business_date) DO NOTHING;

  -- UPDATE ... RETURNING がこの1行に行ロックを取るので、
  -- 同一営業日の同時INSERTはここで直列化される（advisory lock 不要）。
  UPDATE public.pickup_no_counters
     SET last_no = CASE WHEN last_no >= 99 THEN 1 ELSE last_no + 1 END
   WHERE store_id = NEW.store_id
     AND business_date = v_date
  RETURNING last_no INTO v_next;

  -- クライアントが渡してきた値は無視して常にサーバー採番で上書きする
  NEW.business_date := v_date;
  NEW.pickup_no     := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_assign_pickup_no ON public.orders;
CREATE TRIGGER trg_orders_assign_pickup_no
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_pickup_no();


-- ────────────────────────────────────────────────────────────
-- 5. 既存注文へのバックフィル
-- ────────────────────────────────────────────────────────────
-- 既存注文にも営業日ごとの連番を作成順で振っておく。
-- orders.updated_at は「調理完了になった時刻」として受渡画面の経過時間表示に
-- 使っているため、バックフィルの UPDATE で更新されないよう
-- set_updated_at トリガーを一時的に無効化する。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgname = 'trg_orders_set_updated_at'
                AND tgrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders DISABLE TRIGGER trg_orders_set_updated_at;
  END IF;
END $$;

WITH numbered AS (
  SELECT
    id,
    public.orderly_business_date(created_at) AS bd,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, public.orderly_business_date(created_at)
      ORDER BY created_at, id
    ) AS rn
  FROM public.orders
  WHERE pickup_no IS NULL
)
UPDATE public.orders o
   SET pickup_no     = (((n.rn - 1) % 99) + 1)::smallint,
       business_date = n.bd
  FROM numbered n
 WHERE o.id = n.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgname = 'trg_orders_set_updated_at'
                AND tgrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ENABLE TRIGGER trg_orders_set_updated_at;
  END IF;
END $$;

-- カウンタを既存の最大値まで進めておく（バックフィル分と衝突させない）
INSERT INTO public.pickup_no_counters AS c (store_id, business_date, last_no)
SELECT store_id, business_date, MAX(pickup_no)::smallint
  FROM public.orders
 WHERE business_date IS NOT NULL
   AND pickup_no IS NOT NULL
 GROUP BY store_id, business_date
ON CONFLICT (store_id, business_date)
DO UPDATE SET last_no = GREATEST(c.last_no, EXCLUDED.last_no);


-- ────────────────────────────────────────────────────────────
-- 6. お客様（anon）が自分の受渡番号を読めるようにする
-- ────────────────────────────────────────────────────────────
-- orders への直接SELECTは authenticated 限定のまま
-- （supabase/orders_anon_lockdown.sql）。
-- 既存の get_order_statuses に pickup_no を足して返す。
-- 返すのは status と pickup_no のみで、テーブル番号・金額・明細は返さない。
-- 引数の order_ids は localStorage に保存済みの自分の注文IDのみを渡す前提
-- （UUIDは実質推測不可能）。
DROP FUNCTION IF EXISTS public.get_order_statuses(uuid[]);

CREATE FUNCTION public.get_order_statuses(order_ids uuid[])
RETURNS TABLE (id uuid, status text, pickup_no smallint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.status, o.pickup_no
  FROM public.orders o
  WHERE o.id = ANY(order_ids)
    AND o.created_at > now() - interval '90 days';
$$;

REVOKE ALL ON FUNCTION public.get_order_statuses(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_statuses(uuid[]) TO anon, authenticated;
