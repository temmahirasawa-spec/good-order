"use client";

/**
 * 絞り込みチップ + 絞り込みバー（Figma: Filter Chip 46:32 / Filter Bar 47:18）
 * Chip: Default = 白地アウトライン、Selected = アクセント塗り + Bold。高さ 36px。
 * Bar: 先頭に「カスタマイズ」リード、続けて Filter Chip を横スクロール配置。
 * （Figma 実物では カスタマイズ もスクロール Content 内に含まれる）
 */
import { Icon } from "@/components/Icon";

export function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex gap-[var(--space-4)] h-[var(--size-control-sm)] items-center px-[var(--space-16)] rounded-full shrink-0 ${
        selected
          ? "bg-accent-primary"
          : "bg-surface-white border border-border"
      }`}
    >
      <span
        className={`whitespace-nowrap text-text-primary ${
          selected ? "type-jp-body-bold" : "type-jp-body"
        }`}
      >
        {label}
      </span>
      <Icon name="chevron-down" className="w-4 h-4 text-text-primary shrink-0" />
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
