/**
 * 店舗メディア（トップページの動画）のデータアクセス層。
 *
 * 対象は2か所。どちらも同じ4項目（表示ON/OFF・動画URL・ポスターURL・更新日時）を持つ。
 *   - order_hero         … /order（注文ホーム）先頭の16:9ヒーロー
 *   - landing_background … /（二次元コードの着地点）の全画面背景
 *
 * 実体は store_media テーブルのスロット行。詳細は supabase/store_media.sql の設計メモを参照。
 */

import { supabase } from "./supabase";
import { STORE_ID } from "./api";
import type { MediaItem } from "./menu";

export const STORE_MEDIA_SLOTS = ["order_hero", "landing_background"] as const;
export type StoreMediaSlot = (typeof STORE_MEDIA_SLOTS)[number];

export interface StoreMedia {
  enabled: boolean;
  /** null = 動画なし。お客様側は枠ごと描画しない */
  url: string | null;
  posterUrl: string | null;
  /** ISO文字列。null = 一度も保存されていない */
  updatedAt: string | null;
}

export type StoreMediaMap = Record<StoreMediaSlot, StoreMedia>;

/**
 * マイグレーション適用前・取得失敗時に使う既定値。
 *
 * **中身は移行前にコードへ直接書かれていた値と同一**（app/order/page.tsx の HERO_MEDIA と
 * components/top/TopScreen.tsx の <video src>）。ここを既定にしておくことで、
 * store_media がまだ無い状態でも、取得に失敗した状態でも、お客様側の見え方が
 * 従来とまったく変わらない。supabase/store_media.sql の STEP 5 が入れる初期データとも一致する。
 */
export const STORE_MEDIA_FALLBACK: StoreMediaMap = {
  order_hero: {
    enabled: true,
    url: "/images/hero/background.mp4",
    posterUrl: "/images/pancake/p1.webp",
    updatedAt: null,
  },
  landing_background: {
    enabled: true,
    url: "/images/hero/background.mp4",
    posterUrl: "/images/hero/background-poster.webp",
    updatedAt: null,
  },
};

interface StoreMediaRow {
  slot: string;
  enabled: boolean;
  url: string | null;
  poster_url: string | null;
  updated_at: string | null;
}

function isSlot(value: string): value is StoreMediaSlot {
  return (STORE_MEDIA_SLOTS as readonly string[]).includes(value);
}

/**
 * 全スロットをまとめて取得する。
 *
 * **例外を投げない。**お客様側の画面が直接呼ぶので、テーブルがまだ無い（マイグレーション未適用）
 * ・通信に失敗した、のどちらでも既定値を返して従来どおりの見え方を保つ。
 * ベストセラー設定が「読めなかったら従来動作にフォールバック」しているのと同じ方針
 * （hooks/useOrderPageData.ts）。
 */
export async function fetchStoreMedia(): Promise<StoreMediaMap> {
  const result: StoreMediaMap = {
    order_hero: { ...STORE_MEDIA_FALLBACK.order_hero },
    landing_background: { ...STORE_MEDIA_FALLBACK.landing_background },
  };

  try {
    const { data, error } = await supabase
      .from("store_media")
      .select("slot, enabled, url, poster_url, updated_at")
      .eq("store_id", STORE_ID);

    if (error) throw error;

    for (const row of (data ?? []) as StoreMediaRow[]) {
      if (!isSlot(row.slot)) continue;
      result[row.slot] = {
        enabled: row.enabled,
        url: row.url,
        posterUrl: row.poster_url,
        updatedAt: row.updated_at,
      };
    }
  } catch (err) {
    console.error("[storeMedia] fetch failed, falling back to bundled assets:", err);
  }

  return result;
}

/**
 * components/ui/VideoBlock.tsx が受け取る形（MediaItem[]）に変換する。
 *
 * 表示OFF・動画なしのときは**空配列**を返す。VideoBlock は動画が見つからないと
 * `return null` して枠ごと消えるので、お客様側はこれだけで非表示になる。
 * 並び（画像 → 動画）は移行前の HERO_MEDIA 定数と同じにしてある。
 */
export function toMediaItems(media: StoreMedia): MediaItem[] {
  if (!media.enabled || !media.url) return [];
  const out: MediaItem[] = [];
  if (media.posterUrl) out.push({ type: "image", url: media.posterUrl });
  out.push({ type: "video", url: media.url });
  return out;
}

/**
 * 1スロットを保存する（manager のみ）。
 * 削除は url / posterUrl に null を渡す。行は残り、中身だけ空になる。
 */
export async function saveStoreMedia(
  slot: StoreMediaSlot,
  media: Pick<StoreMedia, "enabled" | "url" | "posterUrl">
): Promise<void> {
  const { error } = await supabase.rpc("save_store_media", {
    p_slot: slot,
    p_enabled: media.enabled,
    p_url: media.url,
    p_poster_url: media.posterUrl,
  });
  if (error) throw error;
}
