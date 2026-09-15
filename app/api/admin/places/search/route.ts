import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 店名から Google の店舗候補を探す（管理画面「店舗情報」の店名欄）
 *
 * 2026-09-15、洋輔さんの依頼。
 *   「地図のURLに関しては、Google Places API などを使って
 *     店舗名を入力した時点で自動入力されるような実装をお願いします」
 *
 * GOOD LOOP（app/api/admin/places/search/route.ts）と同じ作りにそろえている。
 * 違いは認証のやり方だけ。GOOD ORDER にはサーバー側の Supabase クライアントが無いので、
 * **画面から送られてきたアクセストークンを検証する**。
 *
 * ⚠ 鍵（GOOGLE_PLACES_API_KEY）は**サーバー側だけ**で使う。
 * NEXT_PUBLIC_ を付けない。付けるとブラウザに配られ、誰でも課金を消費できてしまう。
 *
 * ⚠ **店長（manager）だけが叩ける。** 未ログインや他のロールからの乱用で
 * 課金が膨らむのを防ぐため。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
}

/** 送られてきたトークンが manager のものか確かめる */
async function isManager(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;
  return data.user.app_metadata?.role === "manager";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query === "") {
    return NextResponse.json({ candidates: [] as PlaceCandidate[] });
  }

  if (!(await isManager(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    /* 鍵が無いときは 501。画面側は「この機能は設定されていません」と出して、
       手入力に切り替えられるようにする（エラーで止めない） */
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "ja", regionCode: "JP" }),
  });

  if (!res.ok) {
    console.error("[places] search failed:", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "places_search_failed" }, { status: 502 });
  }

  const data: {
    places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[];
  } = await res.json();

  const candidates: PlaceCandidate[] = (data.places ?? []).slice(0, 6).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
  }));

  return NextResponse.json({ candidates });
}
