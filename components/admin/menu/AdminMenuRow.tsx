"use client";

/**
 * メニュー管理一覧の行（Figma: Admin Menu Row 306:1548 / Admin Menu Row (Mobile) 418:463）
 * grip・サムネイル・商品名（1行省略）・カテゴリ名・価格は共通。右端のみ
 * PC=公開トグル／SP=編集ボタンで切り替える（Figmaの2バリアントを1コンポーネントに統合）。
 *
 * 並び替えは **PC=⠿ドラッグ / SP=▲▼ボタン**（display_order を永続化。
 * hooks/useDragReorder.ts + supabase/list_reorder.sql）。
 * スマホのドラッグは長押しでコンテキストメニューが出て実用に耐えないため分けている。
 * 並び替えできるのは**カテゴリー/テイクアウトで絞り込んでいるとき**だけ。
 * 「すべて」表示では呼び出し元が reorder/move を渡さないことで無効化する。
 *
 * FigmaのPC版行には編集ボタンが無いため、行全体クリックで編集パネルを開く
 * （SPは明示的な編集ボタンも併存。トグルはクリック伝播を止めて誤操作を防ぐ）。
 *
 * 売り切れ（docs/specs/sold-out-and-receipt-copies.md）: 価格の右に「売り切れ」チップ。
 * 押すと ON/OFF が切り替わる（PC / SP 共通）。ON のときはサムネにも SOLD OUT の帯を出し、
 * お客様の画面と同じ見え方にする。公開トグルとは別の操作（隠すのではなく、残したまま止める）。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import ReorderButtons from "@/components/admin/ReorderButtons";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { SoldOutBand } from "@/components/ui/SoldOut";
import { SOLD_OUT_ADMIN_LABEL } from "@/lib/soldOut";
import type { ReorderRowBindings } from "@/hooks/useDragReorder";

export default function AdminMenuRow({
  name,
  categoryLabel,
  price,
  thumbnailUrl,
  available,
  soldOut = false,
  toggling,
  onToggleAvailable,
  onToggleSoldOut,
  onEdit,
  dimmed,
  reorder,
  move,
}: {
  name: string;
  categoryLabel: string;
  price: number;
  thumbnailUrl: string | null;
  available: boolean;
  /** 売り切れ（menu_items.is_sold_out） */
  soldOut?: boolean;
  toggling: boolean;
  onToggleAvailable: () => void;
  /** 「売り切れ」チップを押したとき。未指定ならチップを出さない */
  onToggleSoldOut?: () => void;
  onEdit: () => void;
  dimmed?: boolean;
  /** ⠿ ドラッグ並び替えのバインディング（PCのみ）。未指定なら並び替え不可 */
  reorder?: ReorderRowBindings;
  /** SPの▲▼並び替え。未指定なら並び替え不可 */
  move?: { up: () => void; down: () => void; isFirst: boolean; isLast: boolean };
}) {
  return (
    <div
      onClick={onEdit}
      {...(reorder?.row ?? {})}
      className={`border-b flex gap-[var(--space-12)] h-[64px] items-center py-[var(--space-8)] w-full transition-opacity cursor-pointer ${
        reorder?.dragOver ? "border-b-accent-primary" : "border-b-border-divider"
      } ${reorder?.dragging ? "opacity-40" : dimmed ? "opacity-50" : ""}`}
    >
      {/* PCは⠿ドラッグ、SPは▲▼。並び替え不可のときはどちらも出さない */}
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

      <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[48px]">
        {thumbnailUrl && (
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            className={`object-cover ${soldOut ? "opacity-40" : ""}`}
            unoptimized
          />
        )}
        {soldOut && <SoldOutBand size="sm" />}
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

      {/* 売り切れチップ（PC / SP 共通）。クリック伝播を止めて行クリック=編集と競合しないようにする */}
      {onToggleSoldOut && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSoldOut();
          }}
          disabled={toggling}
          aria-pressed={soldOut}
          aria-label={soldOut ? "売り切れを解除する" : "売り切れにする"}
          className={`shrink-0 h-[28px] px-[var(--space-12)] rounded-full border type-jp-caption-bold whitespace-nowrap transition-colors disabled:opacity-50 ${
            soldOut
              ? "bg-status-urgent-subtle border-transparent text-status-urgent"
              : "bg-surface-white border-border text-text-secondary hover:bg-bg-secondary"
          }`}
        >
          {SOLD_OUT_ADMIN_LABEL}
        </button>
      )}

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
