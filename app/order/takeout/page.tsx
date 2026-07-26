"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import Header from "@/components/Header";
import ItemModal from "@/components/ItemModal";
import FloatingStaffCall from "@/components/FloatingStaffCall";
import CartButton from "@/components/CartButton";
import type { MenuItem } from "@/lib/menu";

/* ── スケルトン ── */
function ItemSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-soft">
      <div className="bg-gray-200 animate-pulse w-full" style={{ aspectRatio: "16/9" }} />
      <div className="px-4 py-3 space-y-2">
        <div className="h-3 bg-gray-200 animate-pulse rounded w-1/4" />
        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3" />
      </div>
    </div>
  );
}

export default function TakeoutMenuPage() {
  const router      = useRouter();
  const addItem      = useCartStore((s) => s.addItem);
  const orderType    = useCartStore((s) => s.orderType);
  const isTakeoutMode = useCartStore((s) => s.isTakeoutMode);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [addedId,      setAddedId]      = useState<string | null>(null);

  /* ── 共有ストアから取得（takeout のみフィルタ） ── */
  const allMenuItems  = useMenuDataStore((s) => s.menuItems);
  const storeLoading  = useMenuDataStore((s) => s.loading);
  const storeLoaded   = useMenuDataStore((s) => s.loadedAt);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime  = useMenuDataStore((s) => s.stopRealtime);

  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () => allMenuItems.filter((m) => m.isTakeout),
    [allMenuItems]
  );
  const loading = storeLoading && !storeLoaded;

  const handleDirectAdd = (item: MenuItem) => {
    addItem(item);
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 700);
  };

  const onBack = () => {
    if (orderType === "takeout") {
      // テイクアウト専用モードでは戻る先はトップ
      router.push("/");
    } else {
      router.push("/order");
    }
  };

  // 店内利用者（dine_in）でテイクアウトメニューを見ているときだけ目立つバナーを出す
  const showMixBanner = orderType === "dine_in" && isTakeoutMode;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-gray-50 flex flex-col">
      <Header mode="sub" title="🛍 テイクアウトメニュー" onBack={onBack} />

      {showMixBanner && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 text-center tracking-wide">
          🛍 テイクアウトメニューをカートに追加中
        </div>
      )}

      {/* ── メニューカードリスト ── */}
      <main className="flex-1 px-4 py-4 space-y-4">
        {loading ? (
          <>
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">
            現在、テイクアウトメニューはありません
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden shadow-soft"
            >
              {/* 上部：カバーメディア（media 先頭） */}
              <div
                className="relative w-full bg-gray-100 cursor-pointer"
                style={{ aspectRatio: "16/9" }}
                onClick={() => setSelectedItem(item)}
              >
                {(() => {
                  const cover = item.media?.[0];
                  if (cover?.type === "video") {
                    return (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        src={cover.url}
                        poster={item.image || undefined}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    );
                  }
                  const src = cover?.url ?? item.image;
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={item.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🛍</div>
                  );
                })()}
                <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  🛍 テイクアウト
                </span>
              </div>

              {/* 下部：テキスト + ボタン */}
              <div className="px-4 py-3">
                <div className="min-w-0 mb-3">
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">
                    {item.name}
                  </h3>
                  <p className="font-price text-base mt-1" style={{ color: "var(--ink)" }}>
                    ¥{item.price.toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="btn-secondary flex-1 text-xs"
                  >
                    詳細を見る
                  </button>

                  <button
                    onClick={() => handleDirectAdd(item)}
                    className={`btn-primary flex-1 text-xs ${addedId === item.id ? "scale-95" : ""}`}
                  >
                    {addedId === item.id ? "✓ 追加しました" : "＋ カートに追加"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* 戻るボタン（店内利用者のみ） */}
        {orderType === "dine_in" && (
          <div className="pt-2 pb-6">
            <button
              onClick={() => router.push("/order")}
              className="w-full py-3.5 rounded-2xl border border-warm-400 text-warm-700 text-sm font-medium flex items-center justify-center gap-2 active:bg-warm-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              店内メニューに戻る
            </button>
          </div>
        )}
      </main>

      {/* ── ハーフモーダル ── */}
      <ItemModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <FloatingStaffCall />
      <CartButton />
    </div>
  );
}
