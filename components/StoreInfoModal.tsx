"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/lib/uiStore";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import InfoRow from "@/components/ui/InfoRow";
import { fetchStoreInfo, STORE_INFO_DEFAULT, type StoreInfo } from "@/lib/storeInfo";
import SeeMoreButton from "@/components/ui/SeeMoreButton";
/* 店舗情報の実体は lib/siteConfig.ts に集約している。
   同じ住所・営業時間が構造化データ（JSON-LD）と meta description にも出るため、
   ここで別に持つと必ずどれかが古くなる。 */

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StoreInfoModal({ open, onClose }: Props) {
  /* 店舗情報は管理画面「店舗情報」で変えられる（lib/storeInfo.ts）。
     読めないときは siteConfig の既定値のまま出す */
  const [info, setInfo] = useState<StoreInfo>(STORE_INFO_DEFAULT);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchStoreInfo()
      .then((i) => { if (!cancelled) setInfo(i); })
      .catch((err) => console.warn("[StoreInfoModal] fetchStoreInfo failed:", err));
    return () => { cancelled = true; };
  }, [open]);

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
          className="overflow-y-auto px-[20px] pb-[24px]"
          style={{ maxHeight: "80vh" }}
        >
          {/* ── ヘッダー行: タイトル + 閉じる。
              **上に貼り付けて位置を固定する**（2026-09-19、天真の指示）。
              下まで読んでも右上の × が消えない。地を白で塗るので本文が透けない ── */}
          <div className="sticky top-0 z-10 bg-surface-white pt-[24px] pb-[var(--space-8)] flex items-center justify-between">
            <h2 className="font-jp font-bold text-[22px] leading-[1.4] text-text-primary">
              店舗情報
            </h2>
            <ModalCloseButton onClick={onClose} />
          </div>

          {/* ── ヒーロー画像 ── */}
          <div className="relative w-full h-[171px] rounded-[var(--radius-sm)] overflow-hidden bg-bg-tertiary mt-[var(--space-8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={info.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* ── 店名 ── */}
          <h3 className="type-jp-heading-l text-text-primary mt-[24px]">
            {info.name}
          </h3>

          {/* ── 店舗情報リスト ──
                 **項目は店舗が決める**（管理画面「店舗情報」）。載せない項目は行ごと出ない */}
          {info.rows.length > 0 && (
            <div className="flex flex-col gap-[20px] mt-[20px]">
              {info.rows.map((r, i) => (
                <InfoRow key={i} icon={r.icon} label={r.label} value={r.value} />
              ))}
            </div>
          )}

          {/* ── 地図で見る ── */}
          <SeeMoreButton label="地図で見る" href={info.mapUrl} className="mt-[24px]" />

          <div className="h-2 safe-bottom" />
        </div>
      </div>
    </div>
  );
}
