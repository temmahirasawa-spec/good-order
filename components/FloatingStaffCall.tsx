"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import StaffCallSheet from "@/components/StaffCallSheet";

export default function FloatingStaffCall() {
  const totalItems = useCartStore((s) => s.totalItems());
  const activeOverlay = useUiStore((s) => s.activeOverlay);
  const [open, setOpen] = useState(false);
  const liftForCart = totalItems > 0;

  // シート/モーダル/オーバーレイが開いている間は FAB を隠す
  if (activeOverlay) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="スタッフを呼ぶ"
        className="fixed right-4 w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-all safe-bottom"
        style={{
          bottom: liftForCart ? 88 : 24,
          background: "var(--ink)",
          boxShadow: "0 4px 16px rgba(26, 23, 20, 0.25)",
          transition: "bottom 220ms cubic-bezier(0.32, 0.72, 0, 1), transform 120ms",
          zIndex: 50,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2a5 5 0 00-5 5v3.528a4 4 0 01-.732 2.3L4 16h16l-2.268-3.172A4 4 0 0117 10.528V7a5 5 0 00-5-5z"
            stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M10 20a2 2 0 104 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <StaffCallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
