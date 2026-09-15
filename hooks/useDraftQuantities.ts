"use client";

/**
 * 一覧に並ぶ商品ごとの「これから何個入れるか」の下書き。
 *
 * 2026-09-16、天真の指示:
 *   「プラスボタンを押すだけでカートに入ってしまっているようですが、
 *     これはあくまで数量の選択であって『カートに入れる』ボタンではない」
 *
 * それまで一覧のステッパーは**カートの中身を直接**増減していた。
 * これを「下書き」に変え、カートへ入るのは「カートに入れる」を押したときだけにする。
 * TOP のカルーセル（MenuCardM）が先に この形だったので、それを一覧にも広げたもの。
 *
 * 下書きはページを離れると消える（カートと違い保存しない）。
 * 1個より下には行かない（0個を入れる操作に意味がないため）。
 */
import { useCallback, useState } from "react";

export function useDraftQuantities() {
  const [draft, setDraft] = useState<Record<string, number>>({});

  const draftOf = useCallback((id: string) => draft[id] ?? 1, [draft]);

  const bump = useCallback((id: string, delta: number) => {
    setDraft((d) => ({ ...d, [id]: Math.max(1, (d[id] ?? 1) + delta) }));
  }, []);

  /** カートに入れたあとは下書きを 1 に戻す（次に開いたとき前の数が残っていると驚く） */
  const reset = useCallback((id: string) => {
    setDraft((d) => {
      if (d[id] === undefined) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });
  }, []);

  return { draftOf, bump, reset };
}
