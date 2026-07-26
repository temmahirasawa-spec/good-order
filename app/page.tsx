"use client";

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useCartStore } from "@/lib/store";

function TopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table");
  const tableNumber = tableParam ? parseInt(tableParam, 10) : null;
  const isTakeoutOnly = tableNumber === null;

  const setTable      = useCartStore((s) => s.setTable);
  const setOrderType  = useCartStore((s) => s.setOrderType);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);
  const videoRef      = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (tableNumber) setTable(tableNumber);
  }, [tableNumber, setTable]);

  // iOS Safari では autoplay に playsinline が必須
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  const handleStart = () => {
    if (isTakeoutOnly) {
      setOrderType("takeout");
      setTakeoutMode(false);
      router.push("/order/takeout");
    } else {
      setOrderType("dine_in");
      setTakeoutMode(false);
      router.push(`/order?table=${tableNumber}`);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden">

      {/* ── 背景動画 ────────────────────────────────────── */}
      <video
        ref={videoRef}
        src="/images/hero/background.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* ── オーバーレイ 30% ─────────────────────────────── */}
      <div className="absolute inset-0 bg-black/65" />

      {/* ── コンテンツ（動画・オーバーレイより手前） ──────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-between min-h-screen px-6 py-12">

        {/* 上部装飾 */}
        <div className="w-12 h-px bg-white/50" />

        {/* 中央ブロック */}
        <div className="flex flex-col items-center gap-10">

          {/* ロゴ */}
          <Image
            src="/images/logo/logo.png"
            alt="YORKYS BRUNCH"
            width={220}
            height={120}
            className="object-contain drop-shadow-lg"
            priority
          />

          {/* ── テーブル番号 / テイクアウト表示 ── */}
          {isTakeoutOnly ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <p
                className="text-[10px] tracking-[0.35em] uppercase text-white/50"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                Takeout
              </p>
              <div className="flex items-center gap-4">
                <span className="text-4xl">🛍</span>
                <span
                  className="text-2xl font-light leading-none tracking-wide text-white"
                >
                  テイクアウト注文
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white">
              <p
                className="text-[10px] tracking-[0.35em] uppercase text-white/50"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                Table
              </p>
              <div className="flex items-center gap-5">
                <div className="w-8 h-px bg-white/30" />
                <span
                  className="text-6xl font-light leading-none tracking-tight text-white"
                  style={{ fontFamily: "HalisR, sans-serif" }}
                >
                  {tableNumber}
                </span>
                <div className="w-8 h-px bg-white/30" />
              </div>
            </div>
          )}

          {/* ── ウェルカムメッセージ ── */}
          <p className="text-sm text-white/75 text-center leading-[2] px-2 tracking-wide">
            この度はご来店いただき<br />
            誠にありがとうございます。<br />
            素敵な時間をお過ごしくださいませ。
          </p>

          {/* ── メニューを見るボタン ── */}
          <button
            onClick={handleStart}
            className="w-full max-w-xs border border-white/60 bg-white/10 backdrop-blur-sm text-white rounded-2xl py-4 text-sm font-medium tracking-wide active:bg-white/20 active:scale-[0.98] transition-all duration-150"
          >
            {isTakeoutOnly ? "テイクアウトメニューを見る" : "メニューを見る"}
          </button>
        </div>

        {/* 下部クレジット */}
        <p
          className="text-[10px] text-white/40 tracking-widest"
          style={{ fontFamily: "HalisR, sans-serif" }}
        >
          POWERED BY GOOD ORDER
        </p>
      </div>
    </main>
  );
}

export default function TopPage() {
  return (
    <div className="mx-auto max-w-md min-h-screen relative overflow-hidden">
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <TopContent />
      </Suspense>
    </div>
  );
}
