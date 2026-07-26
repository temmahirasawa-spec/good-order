import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// Realtime に認証トークンを同期する
// （RLSで authenticated 限定のテーブルを購読するために必要）
if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) {
      supabase.realtime.setAuth(data.session.access_token);
    }
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }
  });
}

// ─── 型定義 ────────────────────────────────────────────────────

export interface DbStore {
  id: string;
  name: string;
  slug: string;
  is_accepting_orders: boolean;
  created_at: string;
}

export interface DbCategory {
  id: string;
  store_id: string;
  slug: string;
  name: string;
  caption: string | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
}

export interface DbMenuItem {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  additional_images: string[] | null;
  video_url: string | null;
  media_order: Array<{ type: "image" | "video"; url: string }> | null;
  tag: string | null;
  calories: number | null;
  serving_time_min: number | null;
  is_available: boolean;
  is_takeout: boolean;
  display_order: number;
  created_at: string;
}

export interface DbOrder {
  id: string;
  store_id: string;
  table_number: number;
  status: "pending" | "preparing" | "served" | "picked_up" | "paid";
  order_type: "dine_in" | "takeout";
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface DbStaffCall {
  id: string;
  store_id: string;
  table_number: number;
  call_type: "water" | "bill" | "other";
  call_label: string;
  status: "waiting" | "acknowledged" | "done";
  created_at: string;
}
