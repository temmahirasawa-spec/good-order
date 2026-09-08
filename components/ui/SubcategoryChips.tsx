"use client";

/**
 * サブカテゴリーの絞り込みチップ（トップのドリンク区画。docs/specs/home-layout.md 案A）
 * 「すべて」＋サブカテゴリーを横スクロールで並べ、押すとその区分の上位 N 件に入れ替わる。
 * 一覧ページの上部タブ（Tab Nav = スクロール移動）とは役割が違うので器を分けている。
 * チップは Filter Chip の ▾ なし・高さ 44。
 */
import { FilterChip } from "@/components/ui/FilterBar";

export const ALL_CHIP_ID = "__all__";

export default function SubcategoryChips({
  chips,
  selectedId,
  onSelect,
  className = "",
}: {
  chips: { id: string; label: string }[];
  /** 未選択（すべて）は ALL_CHIP_ID */
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto overflow-y-hidden ${className}`}
      style={{ scrollbarWidth: "none" }}
      role="group"
      aria-label="サブカテゴリーで絞り込む"
    >
      <div className="flex gap-[var(--space-8)] items-center px-[var(--space-16)] w-max">
        <FilterChip
          label="すべて"
          selected={selectedId === ALL_CHIP_ID}
          onClick={() => onSelect(ALL_CHIP_ID)}
          showIcon={false}
          size="md"
        />
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            selected={selectedId === chip.id}
            onClick={() => onSelect(chip.id)}
            showIcon={false}
            size="md"
          />
        ))}
      </div>
    </div>
  );
}
