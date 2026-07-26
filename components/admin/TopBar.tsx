"use client";

/**
 * PC/SP共通のTop Barパターン（Figma: Top Bar 216:1904 / 216:1955）
 * PC: タイトル+件数の行 → その下にストリップ行（同じ枠内、border-b）
 * SP: ハンバーガー+タイトル+件数の1行 → その下に別枠でストリップ行
 * 中身（Call Strip / Table Chip等）は strip スロットとして受け取る。
 * action指定時（Menu Management等、件数の代わりに新規追加ボタンを置く画面用）は
 * 件数表示の代わりにそちらを優先表示する。
 */
import HeaderIconButton from "@/components/ui/HeaderIconButton";

export default function TopBar({
  title,
  subtitlePc,
  count,
  action,
  onMenuClick,
  strip,
}: {
  title: string;
  /** PC版のみ、件数の前に付ける接頭辞（例: "対応中"） */
  subtitlePc?: string;
  count?: string;
  /** 件数表示の代わりにタイトル行右側へ置く要素（新規追加ボタン等） */
  action?: React.ReactNode;
  onMenuClick: () => void;
  strip?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-white border-b border-border-divider shrink-0">
      {/* ── PC ── */}
      <div className="hidden lg:flex flex-col gap-[var(--space-12)] pt-[var(--space-20)] pb-[var(--space-16)] px-[var(--space-24)]">
        <div className="flex items-center justify-between">
          <h1 className="type-jp-heading-xl text-text-primary">{title}</h1>
          {action ?? (
            <span className="font-en font-semibold text-[14px] leading-[1.2] text-text-secondary whitespace-nowrap">
              {subtitlePc ? `${subtitlePc} ` : ""}
              {count}
            </span>
          )}
        </div>
        {strip && (
          <div className="flex gap-[var(--space-12)] items-start overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {strip}
          </div>
        )}
      </div>

      {/* ── SP ── */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-[var(--space-16)] py-[var(--space-12)]">
          <div className="flex gap-[var(--space-12)] items-center">
            <HeaderIconButton icon="menu" onClick={onMenuClick} label="メニューを開く" />
            <h1 className="type-jp-heading-l text-text-primary">{title}</h1>
          </div>
          {action ?? (
            <span className="font-en font-semibold text-[14px] leading-[1.2] text-text-secondary whitespace-nowrap">
              {count}
            </span>
          )}
        </div>
        {strip && (
          <div
            className="flex gap-[var(--space-12)] items-start overflow-x-auto pb-[var(--space-12)] px-[var(--space-16)]"
            style={{ scrollbarWidth: "none" }}
          >
            {strip}
          </div>
        )}
      </div>
    </div>
  );
}
