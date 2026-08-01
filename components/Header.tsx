"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import AppDrawer from "@/components/ui/AppDrawer";

interface HeaderProps {
  mode?: "home" | "sub";
  title?: string;
  titleNode?: React.ReactNode;  // title より優先（クリック可能なタイトル等）
  onBack?: () => void;
}

export default function Header({ mode = "home", title, titleNode, onBack }: HeaderProps) {
  const router       = useRouter();
  const total        = useCartStore((s) => s.totalItems());
  const tableNo      = useCartStore((s) => s.tableNumber);

  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ── カートに入った合図はバッジの跳ねだけに集約する ──
     以前はアイコン自体も回転しながら弾んでいたが、跳ねる動きが複数あると
     画面が落ち着かない。伝える仕事はバッジ一つに持たせる。 */
  const cartIconRef = useRef<HTMLButtonElement>(null);
  const badgeRef    = useRef<HTMLSpanElement>(null);
  const prevTotalRef = useRef(total);
  useEffect(() => {
    if (total > prevTotalRef.current) {
      const badge = badgeRef.current;
      if (badge) {
        /* 連打に対応するため、付け直す前に一度リセットする */
        badge.classList.remove("badge-pop");
        void badge.offsetWidth; // reflow を強制して再生し直す
        badge.classList.add("badge-pop");
      }
    }
    prevTotalRef.current = total;
  }, [total]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="relative flex items-center justify-between h-14 px-4">

        {/* ── 左：ロゴ or 戻る ── */}
        {mode === "home" ? (
          <Image
            src="/images/logo/logoSmallBlack.webp"
            alt="YORKYS BRUNCH"
            width={96}
            height={28}
            className="object-contain"
            priority
          />
        ) : (
          <button
            onClick={onBack ?? (() => router.push("/order"))}
            aria-label="ホームへ戻る"
            className="back-to-home shrink-0"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>ホーム</span>
          </button>
        )}

        {/* ── 中央：テーブル番号 or サブタイトル ── */}
        <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
          {mode === "home" && tableNo ? (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[10px] tracking-[0.2em] uppercase text-gray-400"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                Table
              </span>
              <span
                className="text-lg font-medium text-warm-700"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                {tableNo}
              </span>
            </div>
          ) : mode === "sub" ? (
            titleNode ? (
              <div className="pointer-events-auto">{titleNode}</div>
            ) : (
              <span className="text-sm font-semibold truncate max-w-[200px]" style={{ color: "var(--ink)" }}>
                {title}
              </span>
            )
          ) : null}
        </div>

        {/* ── 右：カート + ハンバーガー ── */}
        <div className="flex items-center gap-2">
          <button
            ref={cartIconRef}
            data-cart-icon="true"
            onClick={() => router.push("/cart")}
            aria-label="カート"
            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 shadow-soft shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"
                stroke="#3D2800" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            {total > 0 && (
              <span
                ref={badgeRef}
                className="absolute -top-1 -right-1 w-4 h-4 bg-warm-700 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
              >
                {total > 9 ? "9+" : total}
              </span>
            )}
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="メニュー"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 shadow-soft shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5h12M3 9h12M3 13h12" stroke="#3D2800" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

      </div>

      {/* ── ドロワー（ナビ + スタッフ呼出/店舗情報シート内蔵） ── */}
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
