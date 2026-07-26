-- ============================================================
-- テイクアウト機能
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================================

-- 1. orders テーブルに order_type を追加
--    'dine_in'（店内）または 'takeout'（テイクアウト専用直接アクセス）
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in';

-- 2. menu_items テーブルに is_takeout を追加
--    true = テイクアウト専用メニュー、false = 店内メニュー
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_takeout boolean NOT NULL DEFAULT false;

-- 2-b. テイクアウト品はカテゴリ無しを許可（NOT NULL を外す）
ALTER TABLE public.menu_items
  ALTER COLUMN category_id DROP NOT NULL;

-- 3. ダミーのテイクアウトメニュー 5 品（カテゴリなし・重複防止で name+store_id の ON CONFLICT 代替）
DO $$
DECLARE
  v_store uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  -- 既存の同名テイクアウト品は skip
  IF NOT EXISTS (SELECT 1 FROM public.menu_items
                 WHERE store_id = v_store AND name = 'ブランチボックス' AND is_takeout = true) THEN
    INSERT INTO public.menu_items
      (store_id, name, description, price, is_takeout, is_available, display_order)
    VALUES
      (v_store, 'ブランチボックス',
       'パンケーキ・サラダ・フルーツ・ドリンクのセット。ランチにぴったりのボリューム満点ボックス。',
       1800, true, true, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items
                 WHERE store_id = v_store AND name = 'フレンチトーストBOX' AND is_takeout = true) THEN
    INSERT INTO public.menu_items
      (store_id, name, description, price, is_takeout, is_available, display_order)
    VALUES
      (v_store, 'フレンチトーストBOX',
       '北海道産バター香る濃厚フレンチトースト2枚入り。メープルシロップ付き。',
       980, true, true, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items
                 WHERE store_id = v_store AND name = 'クロワッサンサンド' AND is_takeout = true) THEN
    INSERT INTO public.menu_items
      (store_id, name, description, price, is_takeout, is_available, display_order)
    VALUES
      (v_store, 'クロワッサンサンド',
       '自家製クロワッサンにスモークサーモンとクリームチーズを挟んだ贅沢サンド。',
       780, true, true, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items
                 WHERE store_id = v_store AND name = 'ドリップコーヒー（テイクアウト）' AND is_takeout = true) THEN
    INSERT INTO public.menu_items
      (store_id, name, description, price, is_takeout, is_available, display_order)
    VALUES
      (v_store, 'ドリップコーヒー（テイクアウト）',
       'YORKYS BRUNCHオリジナルブレンド。アイス／ホット選択可。',
       550, true, true, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items
                 WHERE store_id = v_store AND name = 'スコーン2個セット' AND is_takeout = true) THEN
    INSERT INTO public.menu_items
      (store_id, name, description, price, is_takeout, is_available, display_order)
    VALUES
      (v_store, 'スコーン2個セット',
       '毎朝焼き上げるプレーンスコーン2個入り。ジャム・クロテッドクリーム付き。',
       680, true, true, 5);
  END IF;
END $$;

-- 注意：category_id は NULL のまま（テイクアウトはカテゴリフィルタを使わないため）
