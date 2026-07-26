"use client";

/**
 * タグ単一選択（Figma: Form Field/Tag Select Field 306:1499）
 * なし／人気／おすすめ／限定。選択中はink地+inverse文字。
 */
const TAG_OPTIONS = ["", "人気", "おすすめ", "限定"];

export default function TagSelectField({
  value,
  onChange,
}: {
  value: string;
  onChange: (tag: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-4)] items-start w-full">
      <p className="type-jp-caption-bold text-text-primary whitespace-nowrap">タグ</p>
      <div className="flex gap-[var(--space-8)] items-start flex-wrap">
        {TAG_OPTIONS.map((tag) => {
          const selected = value === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(tag)}
              className={`flex items-start px-[14px] py-[var(--space-8)] rounded-[var(--radius-full)] whitespace-nowrap type-jp-caption-bold ${
                selected
                  ? "bg-surface-ink text-text-inverse"
                  : "bg-surface-white border border-border text-text-secondary"
              }`}
            >
              {tag || "なし"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
