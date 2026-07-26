/**
 * UI の一時状態（シート・モーダル・オーバーレイ）を共有するストア。
 *   - どれかが開いている間は FAB / カートバーを消す目的で参照する
 *   - ページをまたいでは保持しない（リロードで null に戻る）
 */
import { create } from "zustand";

export type OverlayKind = "modal" | "staffCall" | "category" | "storeInfo" | "drawer";

interface UiState {
  activeOverlay: OverlayKind | null;
  setOverlay: (kind: OverlayKind | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeOverlay: null,
  setOverlay: (kind) => set({ activeOverlay: kind }),
}));
