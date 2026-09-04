/**
 * お客様画面で共有するメニュー・カテゴリのキャッシュ ＋ Realtime 差分適用。
 * - 初回 mount で categories + menu_items を 1 回ずつ並列取得
 * - 以降は 30 秒キャッシュ、再 mount でフェッチしない
 * - menu_items の Realtime は Store 内で 1 本だけ購読し、差分で state を更新
 *   （全件再取得するのは並び替えが複数件にまたがる等の例外時のみ）
 */

import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { MenuItem } from "./menu";
import {
  fetchCategories,
  fetchMenuItemOptions,
  MENU_ITEM_COLUMNS,
  primeCategoriesCache,
  rowToMenuItem,
  invalidateCategoriesCache,
  type ApiCategory,
  type ApiMenuItem,
} from "./api";
import type { MenuOption } from "./menuOptions";

const TTL_MS = 30_000;

interface MenuDataState {
  categories: ApiCategory[];
  menuItems: MenuItem[];         // is_available=true のアイテム（店内 + テイクアウト）
  /** 商品ID → 表示中のオプション（docs/specs/menu-options.md）。無い商品はキー自体が無い */
  menuOptions: Record<string, MenuOption[]>;
  loadedAt: number | null;
  loading: boolean;
  error: string | null;

  fetchAll: (force?: boolean) => Promise<void>;
  invalidate: () => void;

  startRealtime: () => void;
  stopRealtime: () => void;
}

let channel: RealtimeChannel | null = null;
let refCount = 0;

export const useMenuDataStore = create<MenuDataState>((set, get) => ({
  categories: [],
  menuItems: [],
  menuOptions: {},
  loadedAt: null,
  loading: false,
  error: null,

  fetchAll: async (force = false) => {
    const now = Date.now();
    const { loadedAt, loading } = get();
    if (loading) return;
    if (!force && loadedAt && now - loadedAt < TTL_MS) return;

    set({ loading: true, error: null });
    try {
      // categories と menu_items を並列で取得
      const [cats, rowsRes, optionRows] = await Promise.all([
        fetchCategories(),
        supabase
          .from("menu_items")
          .select(MENU_ITEM_COLUMNS)
          .eq("is_available", true)
          .order("display_order"),
        // オプションの取得に失敗しても一覧は出す（オプション無しとして扱う）
        fetchMenuItemOptions().catch((e) => {
          console.warn("[menuDataStore] fetchMenuItemOptions failed:", e);
          return [];
        }),
      ]);
      const menuOptions: Record<string, MenuOption[]> = {};
      for (const o of optionRows) {
        (menuOptions[o.menu_item_id] ??= []).push({ id: o.id, name: o.name, price: o.price });
      }

      // api.ts のモジュールキャッシュにも同じ結果を入れて、以降の buildCatMap 呼び出しを節約
      primeCategoriesCache(cats.map((c) => ({ id: c.id, slug: c.slug })));

      const catMap = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
      const rows = (rowsRes.data ?? []) as ApiMenuItem[];
      const items = rows.map((r) => rowToMenuItem(r, catMap));

      set({
        categories: cats,
        menuItems: items,
        menuOptions,
        loadedAt: Date.now(),
        loading: false,
      });
    } catch (e) {
      console.error("[menuDataStore] fetchAll failed:", e);
      set({ loading: false, error: String(e) });
    }
  },

  invalidate: () => {
    invalidateCategoriesCache();
    set({ loadedAt: null });
  },

  startRealtime: () => {
    refCount += 1;
    if (channel) return;
    channel = supabase
      .channel("menu-data-shared")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "menu_items" },
        (payload) => handleInsert(payload.new as ApiMenuItem)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_items" },
        (payload) => handleUpdate(payload.new as ApiMenuItem)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "menu_items" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const id = (payload.old as any)?.id as string | undefined;
          if (id) handleDelete(id);
        }
      )
      .subscribe();
  },

  stopRealtime: () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) return;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  },
}));

/* ── Realtime 差分適用 ── */
function handleInsert(row: ApiMenuItem) {
  if (!row) return;
  if (row.is_available === false) return;
  const cats = useMenuDataStore.getState().categories;
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
  const item = rowToMenuItem(row, catMap);
  useMenuDataStore.setState((s) => {
    if (s.menuItems.find((m) => m.id === item.id)) return {};
    const next = [...s.menuItems, item].sort(sortByDisplayOrder());
    return { menuItems: next };
  });
}

function handleUpdate(row: ApiMenuItem) {
  if (!row) return;
  const cats = useMenuDataStore.getState().categories;
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
  useMenuDataStore.setState((s) => {
    const idx = s.menuItems.findIndex((m) => m.id === row.id);
    // is_available=false に変わった → 除外
    if (row.is_available === false) {
      if (idx === -1) return {};
      const next = s.menuItems.filter((m) => m.id !== row.id);
      return { menuItems: next };
    }
    const item = rowToMenuItem(row, catMap);
    if (idx === -1) {
      return { menuItems: [...s.menuItems, item] };
    }
    const next = s.menuItems.slice();
    next[idx] = item;
    return { menuItems: next };
  });
}

function handleDelete(id: string) {
  useMenuDataStore.setState((s) => ({
    menuItems: s.menuItems.filter((m) => m.id !== id),
  }));
}

/**
 * 並び替えのフォールバック関数（no-op）。
 * display_order の厳密な再ソートは差分 INSERT/UPDATE では行わず、
 * 並びが壊れた場合は呼び出し側で fetchAll(true) を使って全件リロードする想定。
 */
function sortByDisplayOrder(): (a: MenuItem, b: MenuItem) => number {
  return () => 0;
}
