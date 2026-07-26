"use client";

/**
 * メニュー管理一覧の行（Figma: Admin Menu Row 306:1548 / Admin Menu Row (Mobile) 418:463）
 * grip・サムネイル・商品名（1行省略）・カテゴリ名・価格は共通。右端のみ
 * PC=公開トグル／SP=編集ボタンで切り替える（Figmaの2バリアントを1コンポーネントに統合）。
 *
 * grip（⠿）をドラッグすると表示順を並び替えられる（display_order を永続化。
 * hooks/useDragReorder.ts + supabase/list_reorder.sql）。
 * カテゴリーフィルター適用中は一覧が部分集合になり順序を正しく計算できないため、
 * 呼び出し元が reorder を渡さないことで並び替えを無効化する。
 *
 * FigmaのPC版行には編集ボタンが無いため、行全体クリックで編集パネルを開く
 * （SPは明示的な編集ボタンも併存。トグルはクリック伝播を止めて誤操作を防ぐ）。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import type { ReorderRowBindings } from "@/hooks/useDragReorder";

export default function AdminMenuRow({
  name,
  categoryLabel,
  price,
  thumbnailUrl,
  available,
  toggling,
  onToggleAvailable,
  onEdit,
  dimmed,
  reorder,
}: {
  name: string;
  categoryLabel: string;
  price: number;
  thumbnailUrl: string | null;
  available: boolean;
  toggling: boolean;
  onToggleAvailable: () => void;
  onEdit: () => void;
  dimmed?: boolean;
  /** ⠿ ドラッグ並び替えのバインディング。未指定なら並び替え不可 */
  reorder?: ReorderRowBindings;
}) {
  return (
    <div
      onClick={onEdit}
      {...(reorder?.row ?? {})}
      className={`border-b flex gap-[var(--space-12)] h-[64px] items-center py-[var(--space-8)] w-full transition-opacity cursor-pointer ${
        reorder?.dragOver ? "border-b-accent-primary" : "border-b-border-divider"
      } ${reorder?.dragging ? "opacity-40" : dimmed ? "opacity-50" : ""}`}
    >
      <span
        {...(reorder?.handle ?? {})}
        onClick={(e) => e.stopPropagation()}
        aria-label={reorder ? "ドラッグして並び替え" : undefined}
        className={`shrink-0 flex items-center ${
          reorder ? "cursor-grab active:cursor-grabbing" : "opacity-40"
        }`}
      >
        <Icon name="grip" className="w-4 h-4 text-text-tertiary" />
      </span>

      <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[48px]">
        {thumbnailUrl && (
          <Image src={thumbnailUrl} alt={name} fill className="object-cover" unoptimized />
        )}
      </div>

      <div className="flex flex-[1_0_0] flex-col gap-[var(--space-2)] items-start min-w-0 overflow-hidden">
        <p className="type-jp-body-bold text-text-primary w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {name}
        </p>
        <p className="type-jp-caption text-text-tertiary whitespace-nowrap">{categoryLabel}</p>
      </div>

      <p className="type-en-price-m text-text-primary shrink-0 whitespace-nowrap">
        ¥{price.toLocaleString()}
      </p>

      {/* PC: 公開トグル（クリック伝播を止めて行クリック=編集と競合しないようにする） */}
      <div onClick={(e) => e.stopPropagation()} className="hidden lg:block shrink-0">
        <ToggleSwitch
          on={available}
          disabled={toggling}
          onClick={onToggleAvailable}
          ariaLabel={available ? "非公開にする" : "公開する"}
        />
      </div>

      {/* SP: 編集ボタン（表示・非表示の切り替えは編集パネル側で行う） */}
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
