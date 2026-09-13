"use client";

/**
 * メニュー管理一覧の行（Figma: Admin Menu Row 306:1548 / Admin Menu Row (Mobile) 418:463）
 * grip・サムネイル・商品名（1行省略）・カテゴリ名・価格は共通。SPだけ右端に編集ボタンが付く。
 *
 * 並び替えは **PC=⠿ドラッグ / SP=▲▼ボタン**（display_order を永続化。
 * hooks/useDragReorder.ts + supabase/list_reorder.sql）。
 * スマホのドラッグは長押しでコンテキストメニューが出て実用に耐えないため分けている。
 * 並び替えできるのは**カテゴリー/テイクアウトで絞り込んでいるとき**だけ。
 * 「すべて」表示では呼び出し元が reorder/move を渡さないことで無効化する。
 *
 * FigmaのPC版行には編集ボタンが無いため、行全体クリックで編集パネルを開く
 * （SPは明示的な編集ボタンも併存。状態チップはクリック伝播を止めて誤操作を防ぐ）。
 *
 * **状態チップ（2026-09-13、天真が案Aを選択）**
 * 以前は「売り切れチップ」＋「公開トグル」の2つが別々の見た目で並び、
 * トグルが何のスイッチか分からなかった。**1列・1つのチップ**にまとめた。
 *   販売中 → 押すと 売り切れ ／ 売り切れ → 押すと 販売中（営業中いちばん使う操作が1タップ）
 *   非表示 → 押しても切り替わらない。戻すのは編集パネルの「公開する」
 * 公開・非公開は営業中の操作ではないので、一覧からは外して編集パネルに集約した。
 * 3案の比較は .claude/verification/2026-09-13-admin-state/。
 */
import Image from "next/image";
import { Icon } from "@/components/Icon";
import ReorderButtons from "@/components/admin/ReorderButtons";
import { SoldOutBand } from "@/components/ui/SoldOut";
import { MENU_ITEM_STATE_LABEL, menuItemState } from "@/lib/soldOut";
import type { ReorderRowBindings } from "@/hooks/useDragReorder";

export default function AdminMenuRow({
  name,
  categoryLabel,
  price,
  thumbnailUrl,
  available,
  soldOut = false,
  toggling = false,
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
  /** 公開（menu_items.is_available）。false なら状態は「非表示」 */
  available: boolean;
  /** 売り切れ（menu_items.is_sold_out） */
  soldOut?: boolean;
  /** 保存中に状態チップを押せなくする。状態チップは楽観的更新なので通常は不要 */
  toggling?: boolean;
  /** 状態チップを押したとき（販売中 ⇄ 売り切れ）。未指定ならチップを出さない */
  onToggleSoldOut?: () => void;
  onEdit: () => void;
  dimmed?: boolean;
  /** ⠿ ドラッグ並び替えのバインディング（PCのみ）。未指定なら並び替え不可 */
  reorder?: ReorderRowBindings;
  /** SPの▲▼並び替え。未指定なら並び替え不可 */
  move?: { up: () => void; down: () => void; isFirst: boolean; isLast: boolean };
}) {
  const state = menuItemState(available, soldOut);
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
            className={`object-cover ${soldOut ? "sold-out-photo" : ""}`}
            unoptimized
          />
        )}
        {/* 写真がある商品だけ帯を出す（空箱に帯だけだと「画像なし」に見える） */}
        {soldOut && thumbnailUrl && <SoldOutBand size="sm" />}
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

      {/* 状態チップ（PC / SP 共通）。クリック伝播を止めて行クリック=編集と競合しないようにする。
          「非表示」は押しても切り替わらない（戻すのは編集パネル）ので、ボタンにせず文字で置く。 */}
      {onToggleSoldOut && (state === "hidden" ? (
        <span
          className="shrink-0 h-[30px] px-[var(--space-12)] rounded-full inline-flex items-center bg-bg-tertiary text-text-tertiary type-jp-caption-bold whitespace-nowrap"
        >
          {MENU_ITEM_STATE_LABEL.hidden}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSoldOut();
          }}
          disabled={toggling}
          aria-pressed={soldOut}
          aria-label={soldOut ? "売り切れを解除して販売中にする" : "売り切れにする"}
          className={`shrink-0 h-[30px] px-[var(--space-12)] rounded-full border type-jp-caption-bold whitespace-nowrap transition-colors disabled:opacity-50 ${
            soldOut
              ? "bg-status-urgent-subtle border-transparent text-status-urgent"
              : "bg-surface-white border-border text-text-secondary hover:bg-bg-secondary"
          }`}
        >
          {MENU_ITEM_STATE_LABEL[state]}
        </button>
      ))}

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
