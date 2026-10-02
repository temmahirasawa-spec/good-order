-- ============================================================
-- テスト用のスキーマ（PGlite に流す。本番には流さない）
-- ============================================================
--
-- 本番（good-order / oiropkuvaenebmlicrac）の列・制約を、値段の計算に関わる表だけ写したもの。
-- 2026-10-01 に information_schema / pg_constraint を読んで合わせた。
-- 関数はここでは作らない。リポジトリの supabase/*.sql をそのまま流す（tests/support/db.mjs）。
--
-- 本番と違うところ:
--   - stores の set_drink_* / tax_* 列は、supabase/set_drink_discount.sql と tax_mode.sql が足す
--   - orders.business_date は、本番では受渡番号の採番トリガー（assign_pickup_no）が入れる。
--     ここでは営業日だけを入れる小さなトリガーで代わりにする（受渡番号・印刷ジョブは作らない）
--   - 写真・説明文など、値段の計算に関係しない列は省いた

-- Supabase の役割（GRANT / REVOKE が通るように）
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.stores (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  slug                text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  is_accepting_orders boolean     NOT NULL DEFAULT true
);

CREATE TABLE public.categories (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  slug                  text        NOT NULL,
  name                  text        NOT NULL,
  display_order         integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  category_type         text        NOT NULL DEFAULT 'food',
  serving_timing_choice boolean     NOT NULL DEFAULT false,
  parent_id             uuid        REFERENCES public.categories(id)
);

CREATE TABLE public.menu_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id         uuid        REFERENCES public.categories(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  price               integer     NOT NULL,
  is_available        boolean     NOT NULL DEFAULT true,
  display_order       integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  is_takeout          boolean     NOT NULL DEFAULT false,
  options_enabled     boolean     NOT NULL DEFAULT false,
  options_heading     text        NOT NULL DEFAULT 'トッピング',
  options_select_mode text        NOT NULL DEFAULT 'multiple'
    CONSTRAINT menu_items_options_select_mode_chk CHECK (options_select_mode IN ('multiple', 'single')),
  is_sold_out         boolean     NOT NULL DEFAULT false
);

CREATE TABLE public.menu_item_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  price         integer     NOT NULL DEFAULT 0 CHECK (price >= 0),
  display_order integer     NOT NULL DEFAULT 0,
  is_available  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.table_categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code          text        NOT NULL,
  name          text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tables (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id   uuid        NOT NULL REFERENCES public.table_categories(id),
  number        integer     NOT NULL,
  short_code    text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_number    integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'pending'
    CONSTRAINT orders_status_check CHECK (status IN ('pending', 'preparing', 'served', 'picked_up', 'paid')),
  total_amount    integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  order_type      text        NOT NULL DEFAULT 'dine_in',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  pickup_no       smallint,
  business_date   date,
  table_id        uuid        REFERENCES public.tables(id) ON DELETE SET NULL,
  table_label     text,
  discount_amount integer     NOT NULL DEFAULT 0,
  picked_up_at    timestamptz,
  tax_amount      integer     NOT NULL DEFAULT 0,
  tax_rate        integer     NOT NULL DEFAULT 10
);

CREATE TABLE public.order_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id   uuid        NOT NULL REFERENCES public.menu_items(id),
  quantity       integer     NOT NULL,
  unit_price     integer     NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  cooking_status text        NOT NULL DEFAULT 'pending'
    CONSTRAINT order_items_cooking_status_chk CHECK (cooking_status IN ('pending', 'cooking', 'done')),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  serving_timing text
    CONSTRAINT order_items_serving_timing_chk
    CHECK (serving_timing IS NULL OR serving_timing IN ('asap', 'first', 'after_meal'))
);

CREATE TABLE public.order_item_options (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  uuid        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_id      uuid        REFERENCES public.menu_item_options(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  price          integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 営業日（本番の assign_pickup_no と同じ日付の決め方。orderly_business_date は Asia/Tokyo の日付）
CREATE FUNCTION public.test_set_business_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.business_date := COALESCE(NEW.business_date, (now() AT TIME ZONE 'Asia/Tokyo')::date);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_business_date
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.test_set_business_date();
