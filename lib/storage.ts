import { supabase } from "./supabase";

export const MENU_IMAGES_BUCKET = "menu-images";
export const MENU_VIDEOS_BUCKET = "menu-videos";

/**
 * CDN キャッシュ期間（秒）= 30日。
 * アップロードのパスは `${Date.now()}-${乱数}.webp` で毎回ユニークなので、
 * 差し替え＝別URLになる。同じURLの中身が変わることがない以上、短く保つ
 * 理由がない（既定の3600だと客側で毎時取り直しになっていた）。
 */
const CACHE_CONTROL = "2592000";

/**
 * メニュー画像をSupabase Storageにアップロードし、公開URLを返す
 * @param file       アップロードするFileオブジェクト
 * @param path       保存先パス例: "pancake/plain.jpg"
 * @returns          公開URL
 */
export async function uploadMenuImage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: CACHE_CONTROL,
      upsert: true,
    });

  if (error) throw error;

  return getMenuImageUrl(data.path);
}

/**
 * Storageパスから公開URLを取得する
 * @param path   Storage内のパス例: "pancake/plain.jpg"
 * @returns      公開URL
 */
export function getMenuImageUrl(path: string): string {
  const { data } = supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Storage上のメニュー画像を削除する
 * @param path   Storage内のパス
 */
export async function deleteMenuImage(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .remove([path]);
  if (error) throw error;
}

/**
 * URLからStorageパスを抽出するユーティリティ
 * (Supabase公開URLの末尾部分がパスに対応)
 */
export function extractStoragePath(publicUrl: string): string {
  const marker = `/${MENU_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : publicUrl;
}

/* ── 動画アップロード系 ── */

export async function uploadMenuVideo(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MENU_VIDEOS_BUCKET)
    .upload(path, file, {
      cacheControl: CACHE_CONTROL,
      upsert: true,
      contentType: file.type || "video/mp4",
    });
  if (error) throw error;
  return getMenuVideoUrl(data.path);
}

export function getMenuVideoUrl(path: string): string {
  const { data } = supabase.storage
    .from(MENU_VIDEOS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteMenuVideo(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(MENU_VIDEOS_BUCKET)
    .remove([path]);
  if (error) throw error;
}

export function extractVideoStoragePath(publicUrl: string): string {
  const marker = `/${MENU_VIDEOS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : publicUrl;
}

/* ── 未保存アップロードの後始末 ───────────────────────────────
 * 管理画面の編集パネルは、ファイルを選んだ瞬間にアップロードして
 * すぐプレビューする作りになっている。そのため保存せずに閉じられると
 * オブジェクトだけが Storage に残る（＝どこからも参照されない孤児）。
 * キャンセル時にこれを呼んで掃除する。
 *
 * **失敗してもユーザー操作はブロックしない**（掃除は本筋ではないので、
 * ここで alert を出すと「消したいのは自分ではない」のに止められることになる）。
 * Storage 由来でない URL（初期データのローカル画像など）は対象外。 */
export type UploadedMedia = { type: "image" | "video"; url: string };

export async function deleteUploadedMedia(media: UploadedMedia[]): Promise<void> {
  await Promise.all(
    media.map(async (m) => {
      try {
        if (m.type === "video") {
          const path = extractVideoStoragePath(m.url);
          if (path === m.url) return;
          await deleteMenuVideo(path);
        } else {
          const path = extractStoragePath(m.url);
          if (path === m.url) return;
          await deleteMenuImage(path);
        }
      } catch (err) {
        console.warn("[storage] 未参照メディアの削除に失敗（無視）:", m.url, err);
      }
    })
  );
}
