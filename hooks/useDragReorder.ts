"use client";

/**
 * 管理画面の一覧（メニュー管理・カテゴリ管理）の ⠿ ドラッグ並び替え。
 *
 * - 並び順の真実は既存の display_order 列（1..N の連番。supabase/list_reorder.sql
 *   のマイグレーションで詰め直し済み）。
 * - drop 時にまずローカルを楽観的に更新し、そのあと変更のあった行だけを
 *   1リクエスト（RPC）で永続化する。失敗したときだけ元の配列へロールバックする。
 */
import { useCallback, useRef, useState } from "react";

export interface ReorderableRow {
  id: string;
  display_order: number;
}

export interface ReorderRowBindings {
  /** ⠿ グリップに展開する（ここだけがドラッグ開始点） */
  handle: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  /** 行全体に展開する（ドロップ先） */
  row: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  dragging: boolean;
  dragOver: boolean;
}

export function useDragReorder<T extends ReorderableRow>({
  items,
  setItems,
  persist,
  disabled = false,
}: {
  items: T[];
  setItems: (next: T[]) => void;
  /** 変更のあった行だけを1リクエストで永続化する */
  persist: (changed: { id: string; display_order: number }[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // 保存中に再度 drop されても、そのときの items から計算できるよう最新値を保持
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const clear = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const commit = useCallback(
    async (targetId: string) => {
      const current = itemsRef.current;
      const from = current.findIndex((i) => i.id === dragId);
      const to = current.findIndex((i) => i.id === targetId);
      if (from < 0 || to < 0 || from === to) return;

      const prev = current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      const renumbered = next.map((it, idx) => ({ ...it, display_order: idx + 1 }));
      const prevOrderById = new Map(prev.map((p) => [p.id, p.display_order]));
      const changed = renumbered
        .filter((it) => prevOrderById.get(it.id) !== it.display_order)
        .map((it) => ({ id: it.id, display_order: it.display_order }));

      // 楽観的更新
      setItems(renumbered);
      if (changed.length === 0) return;

      try {
        await persist(changed);
      } catch (err) {
        console.error("[useDragReorder] persist failed:", err);
        setItems(prev); // 失敗時のみロールバック
        alert("並び替えの保存に失敗しました。元の順序に戻します。");
      }
    },
    [dragId, persist, setItems]
  );

  const bindingsFor = useCallback(
    (id: string): ReorderRowBindings => ({
      handle: {
        draggable: !disabled,
        onDragStart: (e: React.DragEvent) => {
          if (disabled) return;
          setDragId(id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        },
        onDragEnd: clear,
      },
      row: {
        onDragOver: (e: React.DragEvent) => {
          if (disabled || dragId === null || dragId === id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverId(id);
        },
        onDragLeave: () => {
          setDragOverId((curr) => (curr === id ? null : curr));
        },
        onDrop: (e: React.DragEvent) => {
          if (disabled) return;
          e.preventDefault();
          const target = id;
          clear();
          void commit(target);
        },
      },
      dragging: dragId === id,
      dragOver: dragOverId === id && dragId !== null && dragId !== id,
    }),
    [clear, commit, disabled, dragId, dragOverId]
  );

  return { bindingsFor, dragging: dragId !== null };
}
