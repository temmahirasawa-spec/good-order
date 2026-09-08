/**
 * サーバー側でブランドカラーを読む（app/layout.tsx 専用）。
 *
 * お客様画面のアクセント色は design-tokens.css の変数で決まる。店舗が管理画面で色を
 * 選んでいたら、最初の HTML の <style> で同名の変数を上書きしておく（クライアント側で
 * 後から当てると、既定色で一瞬描かれてから変わる「ちらつき」が出る）。
 *
 * lib/supabase.ts のクライアントは使わない。Next.js のサーバーコンポーネントでは
 * fetch の結果が既定でビルド時に固定されるため、ここでは 60 秒で更新される fetch を
 * 明示的に渡す。読めなかったら null（＝既定色のまま）。壊れてもページは出す。
 */
import { createClient } from "@supabase/supabase-js";
import { STORE_ID } from "./api";
import { normalizeHex } from "./backgroundColor";

const REVALIDATE_SECONDS = 60;

export async function fetchBrandAccentServer(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: REVALIDATE_SECONDS } } as RequestInit),
      },
    });
    const { data, error } = await client
      .from("stores")
      .select("brand_accent")
      .eq("id", STORE_ID)
      .maybeSingle();
    if (error) return null;
    const hex = data?.brand_accent as string | null | undefined;
    return hex ? normalizeHex(hex) : null;
  } catch {
    return null;
  }
}
