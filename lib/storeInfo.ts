/**
 * 店舗情報 と スタッフ呼び出しの項目（どちらも店舗が管理画面から変える）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   - 店舗情報（写真・住所・営業時間・電話番号）が lib/siteConfig.ts に直書きで、
 *     店舗側から変えられなかった。写真は basePath を通しておらず 404 だった
 *   - スタッフ呼び出しが「お水 / お会計 / 呼ぶ」の3つ固定だった
 *
 * DB: stores.info_image_url ほか / staff_call_options（supabase/store_info_and_staff_calls.sql）
 *
 * **未設定のときは lib/siteConfig.ts の STORE にフォールバックする。**
 * SQL を流しただけ・設定を空にしただけでは、今までと同じ見え方のままになる。
 *
 * ⚠ 構造化データ（JSON-LD）と meta description は今までどおり siteConfig を使う。
 * サーバー側で組み立てるため。**管理画面で住所を変えても検索エンジン向けの情報は変わらない。**
 * そちらも変える必要が出たら siteConfig も直すこと。
 */
import { supabase } from "./supabase";
import { STORE, asset } from "./siteConfig";
import { STORE_ID } from "./api";
import type { IconName } from "@/components/Icon";

/* ── 店舗情報 ───────────────────────────────────────────── */

/**
 * 店舗情報の1項目。**数も内容も店舗が決める**（2026-09-15、洋輔さんの依頼）。
 * それまで 住所/営業時間/定休日/電話番号 の4つ固定で、「載せない」ができなかった。
 */
export interface StoreInfoRow {
  /** 見出し。例「営業時間」 ⚠ お客様の目に触れる */
  label: string;
  value: string;
  /** 左に出すアイコン。components/Icon.tsx の名前 */
  icon: IconName;
}

export interface StoreInfo {
  name: string;
  /** ヒーロー写真の URL。未設定なら既定の写真 */
  imageUrl: string;
  /** 「地図で見る」の行き先。店名から自動で入る（Google Places） */
  mapUrl: string;
  /** 並び順はこの配列の順。追加・削除・並べ替えができる */
  rows: StoreInfoRow[];
}

/** 項目に選べるアイコン */
export const STORE_INFO_ICONS: { value: IconName; label: string }[] = [
  { value: "map-pin", label: "地図" },
  { value: "clock",   label: "時計" },
  { value: "phone",   label: "電話" },
  { value: "list",    label: "情報" },
  { value: "card",    label: "支払い" },
  { value: "bag",     label: "持ち帰り" },
];
const STORE_ICON_SET = new Set(STORE_INFO_ICONS.map((i) => i.value));

/** コードに入っている既定値。管理画面が空のときはこれが出る */
export const STORE_INFO_DEFAULT: StoreInfo = {
  name: STORE.name,
  imageUrl: asset(STORE.heroImage),
  mapUrl: STORE.mapUrl,
  rows: [
    { label: "住所",     value: STORE.address, icon: "map-pin" },
    { label: "営業時間", value: STORE.hours,   icon: "clock" },
    { label: "定休日",   value: STORE.holiday, icon: "clock" },
    { label: "電話番号", value: STORE.phone,   icon: "phone" },
  ],
};

export async function fetchStoreInfo(): Promise<StoreInfo> {
  const { data, error } = await supabase
    .from("stores")
    .select("name, info_image_url, map_url, info_rows")
    .eq("id", STORE_ID)
    .maybeSingle();
  if (error) {
    if (error.code === "42703") {
      console.warn("[storeInfo] stores.info_rows がありません。supabase/store_info_rows.sql を流してください。");
      return STORE_INFO_DEFAULT;
    }
    throw error;
  }
  const row = (data ?? {}) as Record<string, unknown>;
  const pick = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  /* 項目は**空でも既定値に戻さない**。「1つも載せない」も選べるようにするため。
     列がまだ無い（SQL 未適用）ときだけ既定値を使う */
  const raw = Array.isArray(row.info_rows) ? (row.info_rows as unknown[]) : null;
  const rows: StoreInfoRow[] = raw
    ? raw
        .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
        .filter((r): r is Record<string, unknown> => r !== null)
        .map((r) => ({
          label: String(r.label ?? "").trim(),
          value: String(r.value ?? "").trim(),
          /* 知らないアイコン名でも画面を壊さない */
          icon: (STORE_ICON_SET.has(r.icon as IconName) ? r.icon : "list") as IconName,
        }))
        .filter((r) => r.label !== "")
    : STORE_INFO_DEFAULT.rows;

  return {
    name:     pick(row.name,           STORE_INFO_DEFAULT.name),
    imageUrl: pick(row.info_image_url, STORE_INFO_DEFAULT.imageUrl),
    mapUrl:   pick(row.map_url,        STORE_INFO_DEFAULT.mapUrl),
    rows,
  };
}

/** 保存（manager のみ）。項目は**丸ごと置き換える** */
export async function saveStoreInfo(info: StoreInfo): Promise<void> {
  const { error } = await supabase.rpc("save_store_info_v2", {
    p_name:      info.name,
    p_image_url: info.imageUrl,
    p_map_url:   info.mapUrl,
    p_rows:      info.rows.map((r) => ({ label: r.label, value: r.value, icon: r.icon })),
  });
  if (error) throw error;
}

/* ── 店名から Google の店舗候補を探す ───────────────────────── */

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
}

/** Places の候補から「地図で見る」のURLを作る */
export function mapUrlForPlace(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

/**
 * 店名で検索する。**鍵が未設定のときは null** を返す（エラーにしない）。
 * 画面側は null なら「この機能は使えません」と出して手入力に切り替える。
 */
export async function searchPlaces(query: string): Promise<PlaceCandidate[] | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch(asset("/api/admin/places/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  if (res.status === 501) return null;   // 鍵が未設定
  if (!res.ok) throw new Error(`places search failed: ${res.status}`);
  const json = (await res.json()) as { candidates?: PlaceCandidate[] };
  return json.candidates ?? [];
}

/* ── スタッフ呼び出しの項目 ───────────────────────────────── */

/** 管理画面で選べるアイコン。Icon.tsx にある名前のうち、呼び出しに合うものだけ */
export const STAFF_CALL_ICONS: { value: IconName; label: string }[] = [
  { value: "water-drop", label: "水" },
  { value: "card",       label: "会計" },
  { value: "bell",       label: "ベル" },
  { value: "bowl",       label: "料理" },
  { value: "clock",      label: "時計" },
  { value: "bag",        label: "持ち帰り" },
  { value: "check",      label: "チェック" },
  { value: "phone",      label: "電話" },
];

export interface StaffCallOption {
  /** お客様に見える文言。⚠ お客様の目に触れる */
  label: string;
  icon: IconName;
  /** staff_calls.call_type に入る値。集計用で、お客様には見えない */
  callType: string;
  isActive: boolean;
}

/** SQL 未適用・0件のときに使う。いまコードに入っていた3つと同じ */
export const STAFF_CALL_DEFAULT: StaffCallOption[] = [
  { label: "お水をください",       icon: "water-drop", callType: "water", isActive: true },
  { label: "お会計をお願いします", icon: "card",       callType: "bill",  isActive: true },
  { label: "スタッフを呼ぶ",       icon: "bell",       callType: "other", isActive: true },
];

const ICON_SET = new Set(STAFF_CALL_ICONS.map((i) => i.value));

/**
 * 項目を読む。**お客様の画面では「使う」にしたものだけ**を使う想定。
 * 管理画面は `includeInactive: true` で全部読む。
 */
export async function fetchStaffCallOptions(
  { includeInactive = false }: { includeInactive?: boolean } = {}
): Promise<StaffCallOption[]> {
  const { data, error } = await supabase
    .from("staff_call_options")
    .select("label, icon, call_type, is_active, display_order")
    .order("display_order", { ascending: true });
  if (error) {
    // 42P01 = undefined_table
    if (error.code === "42P01" || error.code === "42703") {
      console.warn("[storeInfo] staff_call_options がありません。SQL を流してください。");
      return STAFF_CALL_DEFAULT;
    }
    throw error;
  }
  const rows = (data ?? []) as {
    label: string; icon: string; call_type: string; is_active: boolean;
  }[];
  const mapped = rows.map((r) => ({
    label: r.label,
    /* 知らないアイコン名が入っていても画面を壊さない */
    icon: (ICON_SET.has(r.icon as IconName) ? r.icon : "bell") as IconName,
    callType: r.call_type || "other",
    isActive: r.is_active !== false,
  }));
  const usable = includeInactive ? mapped : mapped.filter((o) => o.isActive);
  return usable.length > 0 ? usable : STAFF_CALL_DEFAULT;
}

/** 保存（manager のみ）。**丸ごと置き換える**ので、並び替え・追加・削除が1回で反映される */
export async function saveStaffCallOptions(options: StaffCallOption[]): Promise<void> {
  const { error } = await supabase.rpc("save_staff_call_options", {
    p_options: options.map((o, i) => ({
      label: o.label,
      icon: o.icon,
      call_type: o.callType,
      display_order: i + 1,
      is_active: o.isActive,
    })),
  });
  if (error) throw error;
}
