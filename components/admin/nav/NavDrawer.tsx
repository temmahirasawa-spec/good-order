"use client";

/**
 * Nav Drawer（Figma 319:442）SP専用・ハンバーガーで開くオーバーレイ。
 * スクリム＋左からスライドする280px幅のドロワー。中身はNav Sidebar v2と共通（NavContent）。
 */
import { useEffect, useState } from "react";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import NavContent from "@/components/admin/nav/NavContent";
import type { StaffRole } from "@/lib/staffRoles";

export default function NavDrawer({
  open,
  onClose,
  role,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  role: StaffRole;
  onLogout: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: visible ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)",
        transition: "background 220ms linear",
      }}
      onClick={onClose}
    >
      <div
        className="absolute left-0 top-0 bottom-0 bg-surface-white flex flex-col gap-[var(--space-4)] items-start px-[var(--space-12)] py-[var(--space-24)] w-[280px]"
        style={{
          boxShadow: "4px 0px 24px 0px rgba(0,0,0,0.2)",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
          transition: visible
            ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "transform 220ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-[var(--space-16)] pl-[var(--space-12)] w-full">
          <p className="type-en-wordmark text-text-primary">
            GOOD ORDER
          </p>
          <ModalCloseButton onClick={onClose} />
        </div>
        <NavContent role={role} onNavigate={onClose} onLogout={onLogout} />
      </div>
    </div>
  );
}
