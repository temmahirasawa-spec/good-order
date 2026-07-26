import { supabase } from "./supabase";

export const MENU_IMAGES_BUCKET = "menu-images";
export const MENU_VIDEOS_BUCKET = "menu-videos";

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
      cacheControl: "3600",
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
      cacheControl: "3600",
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
