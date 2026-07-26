"use client";

import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";

export default function CartButton() {
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());
  const activeOverlay = useUiStore((s) => s.activeOverlay);

  if (totalItems === 0) return null;
  if (activeOverlay) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center px-4 pb-6 safe-bottom"
      style={{ zIndex: 50 }}
    >
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push("/cart")}
          className="w-full flex items-center justify-between px-5 py-4 shadow-float transition-colors"
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            borderRadius: 14,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
              style={{ background: "var(--gold)", color: "var(--gold-on)" }}
            >
              {totalItems}
            </span>
            <span className="text-sm font-medium">カートを確認する</span>
          </div>
          <span
            className="font-price text-sm font-bold"
            style={{ color: "var(--gold)" }}
          >
            ¥{totalPrice.toLocaleString()}
          </span>
        </button>
      </div>
    </div>
  );
}
