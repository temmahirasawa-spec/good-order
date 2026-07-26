"use client";

/**
 * カテゴリタグ色（categories.tag_color）の選択（Figma: Color Swatch Picker 306:1535）
 * tag/○○ の10色固定。選択中は text/primary の2px外枠。
 *
 * Figmaのコンポーネント説明文には「黒い外枠+チェック」とあるが、実際のコンポーネント
 * 描画には外枠しか無かったため外枠のみ実装している（差分としてユーザーに報告済み）。
 */
import { ALL_TAG_COLORS, TAG_BG, type TagColor } from "@/components/ui/CategoryTag";

export default function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-8)] items-start w-full">
      <p className="type-jp-caption-bold text-text-primary whitespace-nowrap">タグの色</p>
      <div className="flex flex-wrap gap-[10px] items-start w-full">
        {ALL_TAG_COLORS.map((color) => {
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={color}
              aria-pressed={selected}
              title={color}
              className={`rounded-[var(--radius-full)] shrink-0 size-[32px] ${TAG_BG[color]} ${
                selected ? "border-2 border-text-primary" : ""
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
