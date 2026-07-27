"use client";

/**
 * 下部固定の「カートを見る」バー（Figma: Bottom View Cart Bar 173:156）
 * 単一CTAで足りる画面（TOP・カテゴリ一覧等）の下部固定バー。
 * fixed + safe-area、pt-8 / pb-16 / px-16、CTAはAddToCartButtonと同仕様のイエローピル。
 * カートが空の間と、シート/モーダル表示中は出さない（旧CartButtonの挙動を踏襲）。
 */
import { useRouter } from "next/navigation";
import { AddToCartButton } from "@/components/ui/Buttons";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import { useHydrated } from "@/hooks/useHydrated";

export default function BottomViewCartBar() {
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems());
  const activeOverlay = useUiStore((s) => s.activeOverlay);
  const hydrated = useHydrated();

  // 個数はlocalStorage由来なので、ハイドレーション完了までは出さない（不一致対策）
  if (!hydrated || totalItems === 0) return null;
  if (activeOverlay) return null;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 flex items-center pt-[var(--space-8)] px-[var(--space-16)]"
      style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
    >
      <AddToCartButton
        label="カートを見る"
        onClick={() => router.push("/cart")}
        className="flex-1"
      />
    </div>
  );
}
