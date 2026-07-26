"use client";

/**
 * カテゴリタブ + タブナビ（Figma: Tab 46:23 / Tab Nav 47:2）
 * Active = Bold + 下線（3px 黒）、Inactive = Medium グレー。
 * 下線は opacity-0 で高さを保持（レイアウトシフト防止）。
 * 実装想定: アンカーリンク + IntersectionObserver で Active 同期。
 * activeId が変わると、そのタブが見える位置まで横スクロールで追従する
 * （scrollspy でページを縦スクロールした時に現在地タブが隠れないように）。
 */
import { useEffect, useRef } from "react";

export function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-[10px] items-center pt-[14px] px-[2px] shrink-0"
    >
      <span
        className={`whitespace-nowrap ${
          active
            ? "type-jp-body-bold text-text-primary"
            : "type-jp-body text-text-secondary"
        }`}
      >
        {label}
      </span>
      <span
        className={`h-[3px] w-full bg-text-primary ${active ? "" : "opacity-0"}`}
      />
    </button>
  );
}

export function TabNav({
  tabs,
  activeId,
  onSelect,
  className = "",
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const navRef = useRef<HTMLElement>(null);

  /* ── アクティブタブを中央付近まで横スクロールで追従（縦スクロールは発生させない）。
   *   scrollTo({behavior:'smooth'}) は prefers-reduced-motion 環境で無視される
   *   ことがあるため、scrollLeft への直接代入で確実に追従させる ── */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    if (!el) return;
    const targetLeft = el.offsetLeft - (nav.clientWidth - el.clientWidth) / 2;
    const maxLeft = nav.scrollWidth - nav.clientWidth;
    nav.scrollLeft = Math.min(Math.max(0, targetLeft), Math.max(0, maxLeft));
  }, [activeId]);

  return (
    <nav
      ref={navRef}
      className={`relative bg-surface-white border-b border-border-divider h-[50px] overflow-x-auto overflow-y-hidden ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {/* 内側 Content が横 padding を持つ二層構造（スクロール終端でも右に16px残す） */}
      <div className="flex gap-[var(--space-24)] items-start px-[var(--space-16)] w-max">
        {tabs.map((tab) => (
          <div key={tab.id} data-tab-id={tab.id} className="shrink-0">
            <Tab
              label={tab.label}
              active={tab.id === activeId}
              onClick={onSelect ? () => onSelect(tab.id) : undefined}
            />
          </div>
        ))}
      </div>
    </nav>
  );
}
