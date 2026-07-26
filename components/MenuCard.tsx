"use client";

import Image from "next/image";
import { useState } from "react";
import type { MenuItem } from "@/lib/menu";
import { useCartStore } from "@/lib/store";

interface MenuCardProps {
  item: MenuItem;
}

const TAG_COLORS: Record<string, string> = {
  人気:     "bg-warm-400 text-white",
  おすすめ: "bg-warm-500 text-white",
  NEW:      "bg-brand-accent text-white",
};

export default function MenuCard({ item }: MenuCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const cartEntry = cartItems.find((i) => i.item.id === item.id);
  const qty = cartEntry?.quantity ?? 0;

  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 600);
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden flex gap-3 p-3 active:scale-[0.99] transition-transform">
      {/* Image */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-cream-200">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="96px"
          unoptimized
        />
        {item.tag && (
          <span
            className={`absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[item.tag] ?? "bg-warm-300 text-white"}`}
          >
            {item.tag}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0 justify-between">
        <div>
          <p className="text-[11px] text-brand-muted font-halis tracking-wide mb-0.5 truncate"
             style={{ fontFamily: "HalisR, sans-serif" }}>
            {item.nameEn}
          </p>
          <h3 className="text-sm font-medium text-brand-text leading-snug mb-1 line-clamp-2">
            {item.name}
          </h3>
          <p className="text-xs text-brand-muted leading-relaxed line-clamp-2">
            {item.description}
          </p>
        </div>

        {/* Price + Add button */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-medium text-warm-700">
            ¥{item.price.toLocaleString()}
          </span>

          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                added
                  ? "bg-warm-500 text-white scale-95"
                  : "bg-cream-200 text-warm-700 active:bg-warm-300"
              }`}
            >
              <span className="text-base leading-none">+</span>
              追加
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, qty - 1)}
                className="w-7 h-7 rounded-full bg-cream-200 text-warm-700 flex items-center justify-center text-base font-medium active:bg-warm-300 transition-colors"
              >
                −
              </button>
              <span className="text-sm font-medium text-warm-700 w-4 text-center">
                {qty}
              </span>
              <button
                onClick={() => updateQuantity(item.id, qty + 1)}
                className="w-7 h-7 rounded-full bg-warm-400 text-white flex items-center justify-center text-base font-medium active:bg-warm-500 transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
