"use client";

/**
 * お客様側の画面が店舗メディア（トップページの動画）を読むためのフック。
 *
 * 取得は1ページ読み込みにつき1回だけ（モジュールスコープでPromiseを共有する）。
 * / と /order はそれぞれ別ページなので、共有しても片方の更新がもう片方に
 * 漏れることはない。
 *
 * **失敗しても例外を投げない。**fetchStoreMedia() が既定値（＝移行前にコードへ
 * 直接書かれていたアセット）にフォールバックするので、store_media が未作成でも
 * 従来どおりの見え方になる。
 */

import { useEffect, useState } from "react";
import {
  fetchStoreMedia,
  STORE_MEDIA_FALLBACK,
  type StoreMedia,
  type StoreMediaMap,
  type StoreMediaSlot,
} from "./storeMedia";

let cached: Promise<StoreMediaMap> | null = null;

function load(): Promise<StoreMediaMap> {
  if (!cached) cached = fetchStoreMedia();
  return cached;
}

export interface UseStoreVideoResult {
  media: StoreMedia;
  /** 取得が終わったか。終わるまで動画を描画しないための判定に使う */
  loaded: boolean;
}

export function useStoreVideo(slot: StoreMediaSlot): UseStoreVideoResult {
  const [media, setMedia] = useState<StoreMedia>(STORE_MEDIA_FALLBACK[slot]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load().then((map) => {
      if (cancelled) return;
      setMedia(map[slot]);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slot]);

  return { media, loaded };
}
