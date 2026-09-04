"use client";

/**
 * 商品のオプション（トッピング）の1行と、その一覧（商品詳細用・案A）
 *
 * Figma: Components / 04 Tags & Steppers / Option Row（2026-09-04 追加）。
 * 高さ 52（control/height-lg）、下に境界線（border/divider）。左に選ぶ印（チェック or ラジオ）と名前、
 * 右に価格。価格は「+¥120」、無料は「0円」（天真の決定）。
 * 行全体がタップ領域（SP の 44px 以上）。
 *
 * 仕様: docs/specs/menu-options.md
 */
import { Icon } from "@/components/Icon";
import {
  formatOptionPrice,
  selectModeHint,
  type MenuOption,
  type OptionSelectMode,
} from "@/lib/menuOptions";

export function OptionRow({
  type,
  selected,
  label,
  price,
  onToggle,
}: {
  type: OptionSelectMode;
  selected: boolean;
  label: string;
  price: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role={type === "single" ? "radio" : "checkbox"}
      aria-checked={selected}
      onClick={onToggle}
      className="flex items-center justify-between w-full h-[var(--size-control-lg)] border-b border-border-divider text-left"
    >
      <span className="flex items-center gap-[var(--space-12)] min-w-0">
        {type === "single" ? (
          <span
            aria-hidden
            className={`shrink-0 w-[18px] h-[18px] rounded-full bg-surface-white ${
              selected ? "border-[5px] border-text-primary" : "border border-border"
            }`}
          />
        ) : (
          <span
            aria-hidden
            className={`shrink-0 w-[18px] h-[18px] rounded-[var(--radius-xs)] flex items-center justify-center ${
              selected ? "bg-text-primary" : "bg-surface-white border border-border"
            }`}
          >
            {selected && <Icon name="check" className="w-3 h-3 text-text-inverse" />}
          </span>
        )}
        <span className="type-jp-body text-text-primary truncate">{label}</span>
      </span>
      <span className="type-en-price-s text-text-secondary shrink-0 pl-[var(--space-8)]">
        {formatOptionPrice(price)}
      </span>
    </button>
  );
}

/**
 * 見出し（例「トッピング」）＋「複数選べます / 1つ選べます」＋ 行の一覧。
 * multiple はチェックで増減、single は選んだ1つに置き換わる。
 */
export default function MenuOptionPicker({
  heading,
  mode,
  options,
  selectedIds,
  onChange,
  className = "",
}: {
  heading: string;
  mode: OptionSelectMode;
  options: MenuOption[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  className?: string;
}) {
  const toggle = (id: string) => {
    if (mode === "single") {
      onChange([id]);
      return;
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  return (
    <section className={`flex flex-col ${className}`} role={mode === "single" ? "radiogroup" : "group"} aria-label={heading}>
      <div className="flex items-baseline justify-between gap-[var(--space-8)] pb-[var(--space-4)]">
        <p className="type-jp-caption-bold text-text-secondary">{heading}</p>
        <p className="type-jp-caption text-text-tertiary">{selectModeHint(mode)}</p>
      </div>
      <div className="flex flex-col">
        {options.map((o) => (
          <OptionRow
            key={o.id}
            type={mode}
            selected={selectedIds.includes(o.id)}
            label={o.name}
            price={o.price}
            onToggle={() => toggle(o.id)}
          />
        ))}
      </div>
    </section>
  );
}
