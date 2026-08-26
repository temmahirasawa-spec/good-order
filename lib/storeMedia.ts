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
import { asset } from "./siteConfig";
import {
  DEFAULT_BACKGROUND_COLOR,
  foregroundToneFor,
  normalizeHex,
  type ForegroundTone,
} from "./backgroundColor";

export const STORE_MEDIA_SLOTS = ["order_hero", "landing_background"] as const;
export type StoreMediaSlot = (typeof STORE_MEDIA_SLOTS)[number];

/** 着地画面（landing_background）の背景に何を使うか。order_hero では常に "video" */
export const BACKGROUND_TYPES = ["color", "image", "video"] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export interface StoreMedia {
  enabled: boolean;
  /** null = 動画なし。お客様側は枠ごと描画しない */
  url: string | null;
  posterUrl: string | null;
  /** ISO文字列。null = 一度も保存されていない */
  updatedAt: string | null;
  /**
   * 背景に使うもの。**既定は "video"。**
   * 列を足す前のデータ・取得失敗時もここが "video" になるので、
   * 既存店舗の見え方は従来のまま変わらない（supabase/store_display_settings.sql 参照）。
   */
  backgroundType: BackgroundType;
  /** "#RRGGBB"（大文字）。null = 一度も色を選んでいない */
  backgroundColor: string | null;
  /** backgroundType === "image" のときに使う画像。動画の url とは別に持つ */
  imageUrl: string | null;
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
    url: asset("/images/hero/background.mp4"),
    posterUrl: asset("/images/pancake/p1.webp"),
    updatedAt: null,
    backgroundType: "video",
    backgroundColor: null,
    imageUrl: null,
  },
  landing_background: {
    enabled: true,
    url: asset("/images/hero/background.mp4"),
    posterUrl: asset("/images/hero/background-poster.webp"),
    updatedAt: null,
    backgroundType: "video",
    backgroundColor: null,
    imageUrl: null,
  },
};

interface StoreMediaRow {
  slot: string;
  enabled: boolean;
  url: string | null;
  poster_url: string | null;
  updated_at: string | null;
  background_type?: string | null;
  background_color?: string | null;
  image_url?: string | null;
}

function isSlot(value: string): value is StoreMediaSlot {
  return (STORE_MEDIA_SLOTS as readonly string[]).includes(value);
}

/** 未知の値・NULL（＝列を足す前のデータ）は "video" に倒す。既存店舗の見え方を変えないため */
function parseBackgroundType(value: unknown): BackgroundType {
  return typeof value === "string" && (BACKGROUND_TYPES as readonly string[]).includes(value)
    ? (value as BackgroundType)
    : "video";
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
    /* 背景タイプの3列は supabase/store_display_settings.sql で足すもの。
       まだ流していない DB では列が無くクエリごと失敗するので、
       **先に新しい形で引き、列が無いエラーだったら旧い形で引き直す**。
       こうしておくと、マイグレーション適用前でもお客様側が従来どおり動く。 */
    const NEW_COLUMNS = "slot, enabled, url, poster_url, updated_at, background_type, background_color, image_url";
    const OLD_COLUMNS = "slot, enabled, url, poster_url, updated_at";

    let res = await supabase.from("store_media").select(NEW_COLUMNS).eq("store_id", STORE_ID);
    if (res.error) {
      res = (await supabase
        .from("store_media")
        .select(OLD_COLUMNS)
        .eq("store_id", STORE_ID)) as typeof res;
    }
    if (res.error) throw res.error;

    for (const row of (res.data ?? []) as unknown as StoreMediaRow[]) {
      if (!isSlot(row.slot)) continue;
      result[row.slot] = {
        enabled: row.enabled,
        url: row.url,
        posterUrl: row.poster_url,
        updatedAt: row.updated_at,
        backgroundType: parseBackgroundType(row.background_type),
        backgroundColor: row.background_color ?? null,
        imageUrl: row.image_url ?? null,
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
/**
 * 着地画面（`/`）の背景を1つに解決する。
 *
 * **管理画面のプレビューとお客様側（TopScreen）が同じこの関数を通る。**
 * 別々に条件分岐を書くと、管理画面で「白文字になるはず」と見えたものが
 * 本番で黒文字になる、という食い違いが必ず起きるため。
 */
export interface ResolvedLandingBackground {
  /** 実際に描くもの。"none" = 表示OFF、または選ばれたタイプの中身が未設定 */
  kind: "color" | "image" | "video" | "none";
  /** 常に有効な #RRGGBB。動画・画像の下地としても敷く */
  color: string;
  imageUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  /** 文字とロゴの色。画像・動画・未設定のときは常に "light"（白） */
  tone: ForegroundTone;
  /** 暗幕（bg-black/65）を敷くか。色のときだけ敷かない（色が濁るため） */
  overlay: boolean;
}

export function resolveLandingBackground(media: StoreMedia): ResolvedLandingBackground {
  const color = normalizeHex(media.backgroundColor ?? "") ?? DEFAULT_BACKGROUND_COLOR;

  // 表示OFF は従来どおり「下地だけが残る」。既定色は #1A1A1A ＝ 従来の bg-black 相当
  if (!media.enabled) {
    return { kind: "none", color, imageUrl: null, videoUrl: null, posterUrl: null, tone: "light", overlay: false };
  }

  if (media.backgroundType === "color") {
    return {
      kind: "color",
      color,
      imageUrl: null,
      videoUrl: null,
      posterUrl: null,
      tone: foregroundToneFor(color),
      overlay: false,
    };
  }

  if (media.backgroundType === "image") {
    if (!media.imageUrl) {
      return { kind: "none", color, imageUrl: null, videoUrl: null, posterUrl: null, tone: "light", overlay: false };
    }
    return {
      kind: "image",
      color,
      imageUrl: media.imageUrl,
      videoUrl: null,
      posterUrl: null,
      tone: "light",
      overlay: true,
    };
  }

  // video（＝既定）
  if (!media.url) {
    return { kind: "none", color, imageUrl: null, videoUrl: null, posterUrl: null, tone: "light", overlay: false };
  }
  return {
    kind: "video",
    color,
    imageUrl: null,
    videoUrl: media.url,
    posterUrl: media.posterUrl,
    tone: "light",
    overlay: true,
  };
}

export type StoreMediaInput = Pick<
  StoreMedia,
  "enabled" | "url" | "posterUrl" | "backgroundType" | "backgroundColor" | "imageUrl"
>;

export async function saveStoreMedia(
  slot: StoreMediaSlot,
  media: StoreMediaInput
): Promise<void> {
  const { error } = await supabase.rpc("save_store_media", {
    p_slot: slot,
    p_enabled: media.enabled,
    p_url: media.url,
    p_poster_url: media.posterUrl,
    p_background_type: media.backgroundType,
    p_background_color: media.backgroundColor,
    p_image_url: media.imageUrl,
  });
  if (error) throw error;
}
