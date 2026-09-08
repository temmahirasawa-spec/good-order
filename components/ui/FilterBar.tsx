"use client";

/**
 * 絞り込みチップ + 絞り込みバー（Figma: Filter Chip 46:32 / Filter Bar 47:18）
 * Chip: Default = 白地アウトライン、Selected = アクセント塗り + Bold。高さ 36px。
 *   - showIcon=false で右の ▾ を消す（Figma の BOOLEAN「Show Icon」、2026-09-08 追加）。
 *     トップのドリンク区画のサブカテゴリー絞り込みはこれ。
 *   - size="md" で高さ 44px（SP のタップ領域の下限）。同じくサブカテゴリー用。
 * Bar: 先頭に「カスタマイズ」リード、続けて Filter Chip を横スクロール配置。
 * （Figma 実物では カスタマイズ もスクロール Content 内に含まれる）
 */
import { Icon } from "@/components/Icon";

export function FilterChip({
  label,
  selected,
  onClick,
  showIcon = true,
  size = "sm",
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
  /** 右端の ▾。絞り込みの「開く」を示さないチップ（サブカテゴリー）では消す */
  showIcon?: boolean;
  /** sm = 36px（既定）/ md = 44px */
  size?: "sm" | "md";
}) {
  const height = size === "md" ? "h-[var(--size-control-md)]" : "h-[var(--size-control-sm)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      /* is-active のときはホバーで色を変えない（選択中は状態が確定しているため） */
      className={`chip ${selected ? "is-active" : ""} flex gap-[var(--space-4)] ${height} items-center px-[var(--space-16)] rounded-full shrink-0 ${
        selected
          ? "bg-accent-primary"
          : "bg-surface-white border border-border"
      }`}
    >
      <span
        className={`whitespace-nowrap ${
          selected ? "type-jp-body-bold text-accent-contrast" : "type-jp-body text-text-primary"
        }`}
      >
        {label}
      </span>
      {showIcon && (
        <Icon
          name="chevron-down"
          className={`w-4 h-4 shrink-0 ${selected ? "text-accent-contrast" : "text-text-primary"}`}
        />
      )}
    </button>
  );
}

export function FilterBar({
  chips,
  selectedIds,
  onToggle,
  onCustomize,
  className = "",
}: {
  chips: { id: string; label: string }[];
  selectedIds: string[];
  onToggle?: (id: string) => void;
  onCustomize?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-white h-[52px] py-[var(--space-8)] overflow-x-auto overflow-y-hidden ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {/* 内側 Content が横 padding を持つ二層構造 */}
      <div className="flex gap-[var(--space-8)] items-center px-[var(--space-16)] w-max">
        <button
          type="button"
          onClick={onCustomize}
          className="flex gap-[6px] items-center shrink-0"
        >
          <Icon name="sliders" className="w-4 h-4 text-text-primary shrink-0" />
          <span className="type-jp-body text-text-primary whitespace-nowrap">
            カスタマイズ
          </span>
        </button>
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            selected={selectedIds.includes(chip.id)}
            onClick={onToggle ? () => onToggle(chip.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
