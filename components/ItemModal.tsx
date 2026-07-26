"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import { useCartStore } from "@/lib/store";
import { flyToCart } from "@/lib/animations";
import RippleButton from "@/components/RippleButton";
import SheetCloseButton from "@/components/SheetCloseButton";
import { useUiStore } from "@/lib/uiStore";

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

export default function ItemModal({ item, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const setOverlay = useUiStore((s) => s.setOverlay);

  const [mounted,  setMounted]  = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [qty,      setQty]      = useState(1);

  const imgRef      = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs   = useRef<Array<HTMLVideoElement | null>>([]);
  const touchStartY = useRef(0);

  const [activeIdx, setActiveIdx] = useState(0);

  const pauseAllVideos = () => {
    videoRefs.current.forEach((v) => v?.pause());
  };

  /* ── open / close animation ── */
  useEffect(() => {
    if (item) {
      setQty(1);
      setActiveIdx(0);
      setMounted(true);
      setOverlay("modal");
      // 前のスライド位置をリセット
      if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      pauseAllVideos();
      setVisible(false);
      setOverlay(null);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [item, setOverlay]);

  const handleClose = () => {
    pauseAllVideos();
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  const scrollToIdx = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

  /* ── swipe-down to close ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - touchStartY.current > 80) handleClose();
  };

  /* ── カートに吸い込まれるアニメーション（ユーティリティに委譲） ── */
  const handleAddToCart = () => {
    if (!item) return;
    const imgEl  = imgRef.current;
    const cartEl = document.querySelector("[data-cart-icon]") as HTMLElement | null;

    if (imgEl && cartEl) {
      flyToCart(imgEl, cartEl);
      // 少し遅らせてカートに追加 → Header 側の totalItems 増加で bump が発火
      window.setTimeout(() => addItem(item, qty), 420);
      // モーダルはふわっと閉じる
      window.setTimeout(() => handleClose(), 380);
    } else {
      addItem(item, qty);
      handleClose();
    }
  };

  if (!mounted || !item) return null;

  /* ── カルーセルのスライド構築：media の並び順を優先 ── */
  type Slide = { type: "video" | "image"; src: string };
  let slides: Slide[] = (item.media ?? []).map((m) => ({ type: m.type, src: m.url }));
  if (slides.length === 0) {
    // legacy フォールバック
    const galleryImages = (item.images && item.images.length > 0)
      ? item.images
      : [item.image].filter(Boolean);
    slides = galleryImages.map((src) => ({ type: "image" as const, src }));
    if (item.video) slides.push({ type: "video" as const, src: item.video });
  }
  const hasCarousel = slides.length > 1;
  const hasVideo = slides.some((s) => s.type === "video");
  const containerAspect = hasVideo ? "16/9" : "4/3";

  return (
    <>
      {/* ── overlay ── */}
      <div
        className="fixed inset-0 z-50 flex items-end"
        style={{ transition: "background 220ms linear", background: visible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)" }}
        onClick={handleClose}
      >
        {/* ── panel ── */}
        <div
          className="bottom-sheet relative w-full max-w-md mx-auto bg-white rounded-t-3xl overflow-hidden flex flex-col"
          style={{
            transform: visible ? "translateY(0)" : "translateY(100%)",
            transition: visible
              ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)"
              : "transform 220ms ease-out",
          }}
          onClick={e => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* × 閉じるボタン（統一スタイル） */}
          <SheetCloseButton onClick={handleClose} />

          {/* scrollable body */}
          <div className="overflow-y-auto flex-1">
            {/* ① メディアカルーセル（動画 + 画像、最大 6 スライド） */}
            <div
              ref={imgRef}
              className="relative w-full bg-black"
              style={{ aspectRatio: containerAspect }}
            >
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
                style={{ scrollbarWidth: "none" }}
              >
                {slides.map((slide, i) => (
                  <div
                    key={`${slide.type}-${i}`}
                    className="w-full h-full shrink-0 snap-center"
                  >
                    {slide.type === "video" ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        ref={(el) => {
                          videoRefs.current[i] = el;
                        }}
                        src={slide.src}
                        poster={item.image || undefined}
                        autoPlay
                        muted
                        loop
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.src}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* 左右ナビゲーションボタン（2枚以上のときのみ） */}
              {hasCarousel && activeIdx > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToIdx(activeIdx - 1)}
                  aria-label="前のメディア"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {hasCarousel && activeIdx < slides.length - 1 && (
                <button
                  type="button"
                  onClick={() => scrollToIdx(activeIdx + 1)}
                  aria-label="次のメディア"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}

              {/* dot indicator */}
              {hasCarousel && (
                <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                  {slides.map((s, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeIdx
                          ? "w-4 bg-white"
                          : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pt-4 pb-2">
              {/* ② タイトルエリア */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* タグ（商品名の上） */}
                  {item.tag && (
                    <span className="inline-block mb-1.5 text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-warm-100 text-warm-700">
                      {item.tag}
                    </span>
                  )}
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{item.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{item.nameEn}</p>
                </div>
              </div>

              {/* ③ 価格 */}
              <p className="font-price text-2xl mt-3" style={{ color: "var(--ink)" }}>
                ¥{item.price.toLocaleString()}
              </p>

              {/* ⑤ 説明文（スクロール可能エリア） */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Description
                </p>
                <div className="max-h-28 overflow-y-auto pr-1">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>

              {/* footer の高さ分の余白 */}
              <div className="h-24" />
            </div>
          </div>

          {/* ⑥ 固定フッター */}
          <div className="bottom-sheet-actions absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3">
            <div className="flex items-center gap-3">
              {/* 数量セレクター */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-2 py-1.5 shrink-0">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-warm-700 font-bold shadow-soft"
                >
                  −
                </button>
                <span className="text-sm font-semibold text-gray-800 w-5 text-center">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-7 h-7 rounded-full bg-warm-700 flex items-center justify-center text-white font-bold"
                >
                  +
                </button>
              </div>

              {/* カートに追加ボタン（主要 CTA：ゴールド背景 + 黒字） */}
              <RippleButton
                onClick={handleAddToCart}
                className="btn-primary flex-1 text-sm"
                style={{ height: 44, borderRadius: 10 }}
              >
                カートに追加する <span className="font-price ml-1">¥{(item.price * qty).toLocaleString()}</span>
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
