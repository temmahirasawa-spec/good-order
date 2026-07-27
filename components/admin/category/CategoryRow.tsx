"use client";

/**
 * カテゴリ管理一覧の行（Figma: Category Row (Mobile) 429:2534）
 * grip・サムネイル・タグ色ドット・カテゴリ名/スラッグは共通。右端のみ
 * PC=表示順バッジ／SP=編集ボタンで切り替える（Admin Menu Row と同じ統合方針）。
 *
 * 並び替えは **PC=⠿ドラッグ / SP=▲▼ボタン**（display_order を永続化。
 * hooks/useDragReorder.ts + supabase/list_reorder.sql）。
 * カテゴリ管理は一覧が常に全件なので、こちらは常時並び替え可能でよい。
 *
 * FigmaのPC版行には編集ボタンが無いため、行全体クリックで編集パネルを開く。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import ReorderButtons from "@/components/admin/ReorderButtons";
import { TAG_BG, type TagColor } from "@/components/ui/CategoryTag";
import type { ReorderRowBindings } from "@/hooks/useDragReorder";

export default function CategoryRow({
  name,
  slug,
  thumbnailUrl,
  tagColor,
  displayOrder,
  onEdit,
  reorder,
  move,
}: {
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  tagColor: TagColor;
  displayOrder: number;
  onEdit: () => void;
  /** ⠿ ドラッグ並び替えのバインディング（PCのみ）。未指定なら並び替え不可 */
  reorder?: ReorderRowBindings;
  /** SPの▲▼並び替え。未指定なら並び替え不可 */
  move?: { up: () => void; down: () => void; isFirst: boolean; isLast: boolean };
}) {
  return (
    <div
      onClick={onEdit}
      {...(reorder?.row ?? {})}
      className={`border-b flex gap-[var(--space-12)] h-[56px] items-center py-[var(--space-8)] w-full cursor-pointer transition-opacity ${
        reorder?.dragOver ? "border-b-accent-primary" : "border-b-border-divider"
      } ${reorder?.dragging ? "opacity-40" : ""}`}
    >
      {reorder && (
        <span
          {...reorder.handle}
          onClick={(e) => e.stopPropagation()}
          aria-label="ドラッグして並び替え"
          className="hidden lg:flex shrink-0 items-center cursor-grab active:cursor-grabbing"
        >
          <Icon name="grip" className="w-4 h-4 text-text-tertiary" />
        </span>
      )}
      {move && (
        <div className="lg:hidden" onClick={(e) => e.stopPropagation()}>
          <ReorderButtons
            label={name}
            onMoveUp={move.up}
            onMoveDown={move.down}
            disableUp={move.isFirst}
            disableDown={move.isLast}
          />
        </div>
      )}

      <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[40px]">
        {thumbnailUrl && (
          <Image src={thumbnailUrl} alt={name} fill className="object-cover" unoptimized />
        )}
      </div>

      <span
        className={`shrink-0 rounded-full size-[16px] ${TAG_BG[tagColor]}`}
        title={tagColor}
      />

      <div className="flex flex-[1_0_0] flex-col gap-[var(--space-2)] items-start min-w-0 overflow-hidden">
        <p className="type-jp-body-bold text-text-primary w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {name}
        </p>
        <p className="type-jp-label text-text-tertiary w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {slug}
        </p>
      </div>

      {/* PC: 表示順バッジ（Figma: Order Badge 327:498。SPは編集ボタンに差し替わる）
          数字のみ・左右8/上下3・radius-full・EN/Data/S（Barlow SemiBold 13px, tracking 0.26px）。
          「表示順」というラベル文字はFigmaに入っていない。 */}
      <span className="hidden lg:flex bg-bg-tertiary items-start px-[var(--space-8)] py-[3px] rounded-[var(--radius-full)] shrink-0 type-en-data-s text-text-secondary whitespace-nowrap">
        {displayOrder}
      </span>

      {/* SP: 編集ボタン */}
      <button
        type="button"
        onClick={onEdit}
        aria-label="編集"
        className="lg:hidden bg-bg-tertiary flex items-center justify-center rounded-full shrink-0 size-[32px]"
      >
        <Icon name="edit" className="w-4 h-4 text-text-primary" />
      </button>
    </div>
  );
}
