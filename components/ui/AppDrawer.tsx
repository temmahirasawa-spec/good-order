"use client";

/**
 * 右からスライドインするアプリドロワー（既存 Header.tsx から抽出）。
 * スタッフ呼出 / 注文履歴 / テイクアウト / 店舗情報 への導線と、
 * StaffCallSheet・StoreInfoModal の開閉をここで一括管理する。
 * 旧デザインのページ（既存 Header.tsx 使用）専用。
 * 新デザイン側のハンバーガーは /order/menu（Menuページ）への遷移に置き換わったため
 * ここからは使われない（旧 underHeader バリアントは使用箇所が無くなったため削除済み）。
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import StaffCallSheet from "@/components/StaffCallSheet";
import StoreInfoModal from "@/components/StoreInfoModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AppDrawer({ open, onClose }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const isAtHome = pathname === "/order";
  const orderType      = useCartStore((s) => s.orderType);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [staffCallOpen, setStaffCallOpen] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);

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

  const goTakeout = () => {
    setTakeoutMode(true);
    onClose();
    router.push("/order/takeout");
  };
  const goHistory = () => {
    onClose();
    router.push("/history");
  };
  const goHome = () => {
    onClose();
    router.push("/order");
  };
  const openStaffCall = () => {
    onClose();
    // ドロワーのスライドアウト完了に合わせて少し遅延
    setTimeout(() => setStaffCallOpen(true), 180);
  };
  const openStoreInfo = () => {
    onClose();
    setTimeout(() => setStoreInfoOpen(true), 180);
  };

  return (
    <>
      {mounted && (
        <div
          className="fixed inset-0 z-50"
          style={{
            background: visible ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)",
            transition: "background 220ms linear",
          }}
          onClick={onClose}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl flex flex-col"
            style={{
              transform: visible ? "translateX(0)" : "translateX(100%)",
              transition: visible
                ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)"
                : "transform 220ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100">
              <span className="text-sm font-bold tracking-wider" style={{ color: "var(--ink)" }}>メニュー</span>
              <button
                onClick={onClose}
                aria-label="閉じる"
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg leading-none"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {!isAtHome && (
                <>
                  <DrawerItem icon="🏠" label="ホームへ戻る" onClick={goHome} />
                  <div className="drawer-divider" />
                </>
              )}
              <DrawerItem icon="🔔" label="スタッフを呼ぶ"           onClick={openStaffCall} />
              <DrawerItem icon="📜" label="注文履歴"                  onClick={goHistory} />
              {orderType === "dine_in" && (
                <DrawerItem icon="🛍" label="テイクアウトメニューを見る" onClick={goTakeout} />
              )}
              <DrawerItem icon="ℹ️" label="店舗情報"                  onClick={openStoreInfo} />
            </nav>
          </div>
        </div>
      )}

      {/* ── スタッフ呼び出しシート ── */}
      <StaffCallSheet
        open={staffCallOpen}
        onClose={() => setStaffCallOpen(false)}
      />

      {/* ── 店舗情報モーダル ── */}
      <StoreInfoModal
        open={storeInfoOpen}
        onClose={() => setStoreInfoOpen(false)}
      />
    </>
  );
}

function DrawerItem({
  icon, label, onClick,
}: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 h-14 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      <span className="text-xl w-6 text-center leading-none">{icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
