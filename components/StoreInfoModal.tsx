"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/lib/uiStore";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import InfoRow from "@/components/ui/InfoRow";
import SeeMoreButton from "@/components/ui/SeeMoreButton";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ── 店舗情報（Figma: Store Info — Half Modal 191:31 の記載値） ── */
const STORE = {
  name: "YORKYS BRUNCH 夙川店",
  address: "兵庫県西宮市霞町5-44 ビンテージ夙川2F",
  hours: "11:00 - 21:00（L.O. 20:30）",
  holiday: "不定休",
  phone: "0798-42-8289",
  heroImage: "/images/pancake/p1.png",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("YORKYS BRUNCH 夙川店"),
};

export default function StoreInfoModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const setOverlay = useUiStore((s) => s.setOverlay);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setOverlay("storeInfo");
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      setOverlay(null);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, setOverlay]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end"
      style={{
        transition: "background 220ms linear",
        background: visible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
      }}
      onClick={onClose}
    >
      <div
        className="bottom-sheet relative w-full max-w-md mx-auto bg-surface-white rounded-t-[var(--radius-xl)] overflow-hidden"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: visible
            ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "transform 220ms ease-out",
          maxHeight: "80vh",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="overflow-y-auto px-[20px] pt-[24px] pb-[24px]"
          style={{ maxHeight: "80vh" }}
        >
          {/* ── ヘッダー行: タイトル + 閉じる ── */}
          <div className="flex items-center justify-between">
            <h2 className="font-jp font-bold text-[22px] leading-[1.4] text-text-primary">
              店舗情報
            </h2>
            <ModalCloseButton onClick={onClose} />
          </div>

          {/* ── ヒーロー画像 ── */}
          <div className="relative w-full h-[171px] rounded-[var(--radius-sm)] overflow-hidden bg-bg-tertiary mt-[16px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STORE.heroImage}
              alt={STORE.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* ── 店名 ── */}
          <h3 className="type-jp-heading-l text-text-primary mt-[24px]">
            {STORE.name}
          </h3>

          {/* ── 店舗情報リスト ── */}
          <div className="flex flex-col gap-[20px] mt-[20px]">
            <InfoRow icon="map-pin" label="住所"     value={STORE.address} />
            <InfoRow icon="clock"   label="営業時間" value={STORE.hours} />
            <InfoRow icon="clock"   label="定休日"   value={STORE.holiday} />
            <InfoRow icon="phone"   label="電話番号" value={STORE.phone} />
          </div>

          {/* ── 地図で見る ── */}
          <SeeMoreButton label="地図で見る" href={STORE.mapUrl} className="mt-[24px]" />

          <div className="h-2 safe-bottom" />
        </div>
      </div>
    </div>
  );
}
