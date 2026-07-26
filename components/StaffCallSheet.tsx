"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import OptionCard from "@/components/ui/OptionCard";
import type { IconName } from "@/components/Icon";

const STORE_ID = "10000000-0000-0000-0000-000000000001";
const COOLDOWN_MS = 3 * 60 * 1000;

type CallType = "water" | "bill" | "other";

const OPTIONS: { type: CallType; icon: IconName; label: string }[] = [
  { type: "water", icon: "water-drop", label: "お水をください" },
  { type: "bill",  icon: "card",       label: "お会計をお願いします" },
  { type: "other", icon: "bell",       label: "スタッフを呼ぶ" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StaffCallSheet({ open, onClose }: Props) {
  const tableNumber = useCartStore((s) => s.tableNumber);
  const tableLabel  = useCartStore((s) => s.tableLabel);

  const [mounted,  setMounted]  = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [sending,  setSending]  = useState<CallType | null>(null);
  const [toast,    setToast]    = useState(false);
  const [lastSent, setLastSent] = useState<Record<CallType, number>>({
    water: 0,
    bill: 0,
    other: 0,
  });
  const [now, setNow] = useState(() => Date.now());

  /* ── cooldown 表示更新のために 10 秒おきに now を更新 ── */
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(i);
  }, []);

  const setOverlay = useUiStore((s) => s.setOverlay);

  /* ── 親からの open に応じて開閉アニメーションを駆動 ── */
  useEffect(() => {
    if (open) {
      setMounted(true);
      setOverlay("staffCall");
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      setOverlay(null);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open, setOverlay]);

  const closeSheet = () => onClose();

  const handleSelect = async (opt: typeof OPTIONS[number]) => {
    const t = Date.now();
    if (t - lastSent[opt.type] < COOLDOWN_MS) return;
    if (sending) return;
    setSending(opt.type);
    try {
      const { error } = await supabase.from("staff_calls").insert({
        store_id: STORE_ID,
        table_number: tableNumber ?? 0,
        // 厨房のCall Chipに "A1" と出すためのラベル（Step3-O）
        table_label: tableLabel ?? null,
        call_type: opt.type,
        call_label: opt.label,
      });
      if (error) throw error;
      setLastSent((prev) => ({ ...prev, [opt.type]: t }));
      closeSheet();
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch (err) {
      console.error("[StaffCallSheet] insert failed:", err);
    } finally {
      setSending(null);
    }
  };

  const isCoolingDown = (type: CallType) =>
    now - lastSent[type] < COOLDOWN_MS;

  return (
    <>
      {/* ── ボトムシート（ItemModal と同系のスライドアップ） ── */}
      {mounted && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{
            transition: "background 220ms linear",
            background: visible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
          }}
          onClick={closeSheet}
        >
          <div
            className="bottom-sheet relative w-full max-w-md mx-auto bg-surface-white rounded-t-[var(--radius-xl)] overflow-hidden"
            style={{
              transform: visible ? "translateY(0)" : "translateY(100%)",
              transition: visible
                ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)"
                : "transform 220ms ease-out",
              boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-[20px] pt-[24px] pb-[24px]">
              {/* ── ヘッダー行: タイトル + 閉じる ── */}
              <div className="flex items-center justify-between">
                <h3 className="font-jp font-bold text-[22px] leading-[1.4] text-text-primary">
                  スタッフを呼ぶ
                </h3>
                <ModalCloseButton onClick={closeSheet} />
              </div>

              <p className="type-jp-body text-text-secondary mt-[12px]">
                ご用件を選んでください
              </p>

              <div className="flex flex-col gap-[12px] mt-[16px]">
                {OPTIONS.map((opt) => {
                  const cooling = isCoolingDown(opt.type);
                  const busy = sending === opt.type;
                  return (
                    <OptionCard
                      key={opt.type}
                      icon={opt.icon}
                      label={opt.label}
                      onClick={() => handleSelect(opt)}
                      disabled={cooling || busy}
                      trailing={
                        cooling ? (
                          <span className="type-jp-label text-text-tertiary shrink-0">
                            送信済み
                          </span>
                        ) : busy ? (
                          <span className="w-4 h-4 rounded-full border-2 border-border border-t-accent-primary animate-spin shrink-0" />
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>

              <div className="h-2 safe-bottom" />
            </div>
          </div>
        </div>
      )}

      {/* ── トースト ── */}
      {toast && (
        <div className="toast-enter fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          スタッフに伝わりました ✓
        </div>
      )}
    </>
  );
}
