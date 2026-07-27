"use client";

import { useEffect, useState } from "react";

/**
 * クライアントでの初回描画が終わったかどうか。
 *
 * カートの中身は zustand の persist（localStorage）なので、
 * **サーバー描画では常に空・クライアントの初回描画では復元済み**という食い違いが起きる。
 * 個数によって出し分けるDOM（バッジ、下部バーの有無など）をそのまま書くと
 * ハイドレーション不一致になり、React がその Suspense 境界を丸ごと
 * クライアント再描画に切り替える。その際にイベントハンドラが失われて
 * 「見えているのに何も反応しない画面」になるので、必ずこのフラグで遅らせること。
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
