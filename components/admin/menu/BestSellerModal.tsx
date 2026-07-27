"use client";

/**
 * ベストセラーの設定
 * （Figma: Modal / ベストセラー設定 — PC 620:863 / Half Modal — SP 620:964 /
 *   Best Seller Row 619:841 / Best Seller Row (Mobile) 619:862）
 *
 * トップページ最上部の「Best Seller」枠に何を出すかを店舗側で指定する。
 * 並び替えは **PC=⠿ドラッグ / SP=▲▼**（管理画面の他の一覧と同じルール）。
 *
 * 保存はサーバー側 save_best_sellers() 1回でトグルと一覧を丸ごと入れ替える。
 */
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import ReorderButtons from "@/components/admin/ReorderButtons";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { BEST_SELLER_MAX, type BestSellerSetting } from "@/lib/bestSellers";

export interface BestSellerCandidate {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  thumbnailUrl: string | null;
}

export default function BestSellerModal({
  open,
  setting,
  candidates,
  categories,
  onClose,
  onSave,
}: {
  open: boolean;
  setting: BestSellerSetting | null;
  /** 選択肢になる全商品（テイクアウト専用も含む） */
  candidates: BestSellerCandidate[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (next: BestSellerSetting) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [pickCategory, setPickCategory] = useState("");
  const [pickItem, setPickItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 開くたびにサーバーの内容から作り直す（キャンセル後に編集途中が残らないように）
  useEffect(() => {
    if (open && setting) {
      setEnabled(setting.enabled);
      setIds(setting.itemIds);
      setPickCategory("");
      setPickItem("");
      setError(null);
    }
  }, [open, setting]);

  const byId = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  );

  /* すでに登録済みの商品は選択肢から外す（重複登録を防ぐ） */
  const selectable = useMemo(
    () => candidates.filter((c) => !ids.includes(c.id)),
    [candidates, ids]
  );
  const itemChoices = useMemo(
    () => (pickCategory ? selectable.filter((c) => c.categoryId === pickCategory) : []),
    [selectable, pickCategory]
  );

  if (!open) return null;

  const isFull = ids.length >= BEST_SELLER_MAX;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    setIds((cur) => {
      const next = cur.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const handleAdd = () => {
    if (!pickItem || isFull) return;
    setIds((cur) => [...cur, pickItem]);
    setPickItem("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ enabled, itemIds: ids });
      onClose();
    } catch (e) {
      console.error("[BestSellerModal] save failed:", e);
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end lg:items-center lg:justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-white w-full lg:w-[560px] max-h-[90vh] rounded-t-[var(--radius-xl)] lg:rounded-[var(--radius-xl)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-divider px-[var(--space-24)] py-[var(--space-16)] shrink-0">
          <h2 className="type-jp-heading-l text-text-primary">ベストセラーの設定</h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-[var(--space-16)] overflow-y-auto px-[var(--space-24)] py-[var(--space-20)]">
          {/* 他の設定項目より一段上の意味を持つので、bg/warm の帯で区別する */}
          <div className="bg-bg-warm flex items-center justify-between rounded-[var(--radius-md)] px-[var(--space-20)] py-[var(--space-16)]">
            <span className="type-jp-heading-s text-text-primary">トップページに表示する</span>
            <ToggleSwitch on={enabled} onClick={() => setEnabled((v) => !v)} />
          </div>

          <p className="type-jp-caption text-text-secondary leading-[1.7]">
            ベストセラーは、トップページの最上部に横スライドで表示されるおすすめ枠です。
            ここで選んだ商品が、選んだ順番のまま表示されます（最大{BEST_SELLER_MAX}件）。
          </p>

          <div className="flex items-baseline justify-between">
            <h3 className="type-jp-heading-s text-text-primary">登録済みの商品</h3>
            <p className="type-en-data-s text-text-secondary">
              {ids.length} / {BEST_SELLER_MAX}
            </p>
          </div>

          <div className="flex flex-col w-full">
            {ids.length === 0 && (
              <p className="type-jp-caption text-text-tertiary py-[var(--space-16)]">
                まだ登録されていません。下のフォームから追加してください。
              </p>
            )}
            {ids.map((id, i) => {
              const item = byId.get(id);
              return (
                <div
                  key={id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                    setDragIndex(null);
                  }}
                  className={`border-b border-border-divider flex gap-[var(--space-12)] items-center py-[10px] w-full ${
                    dragIndex === i ? "opacity-40" : ""
                  }`}
                >
                  {/* PC=⠿ドラッグ / SP=▲▼（管理画面の他の一覧と同じルール） */}
                  <span
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => setDragIndex(null)}
                    aria-label="ドラッグして並び替え"
                    className="hidden lg:flex shrink-0 items-center cursor-grab active:cursor-grabbing"
                  >
                    <Icon name="grip" className="w-4 h-4 text-text-tertiary" />
                  </span>
                  <div className="lg:hidden">
                    <ReorderButtons
                      label={item?.name ?? "商品"}
                      onMoveUp={() => move(i, i - 1)}
                      onMoveDown={() => move(i, i + 1)}
                      disableUp={i === 0}
                      disableDown={i === ids.length - 1}
                    />
                  </div>

                  <span className="bg-bg-tertiary flex items-center justify-center rounded-full shrink-0 w-[24px] h-[24px] type-en-data-s text-text-secondary">
                    {i + 1}
                  </span>

                  <div className="relative bg-border-divider rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[40px]">
                    {item?.thumbnailUrl && (
                      <Image src={item.thumbnailUrl} alt={item.name} fill className="object-cover" unoptimized />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-[var(--space-2)] min-w-0">
                    <p className="type-jp-body text-text-primary truncate">
                      {item?.name ?? "（削除された商品）"}
                    </p>
                    <p className="type-jp-label text-text-secondary truncate">
                      {item?.categoryName ?? ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIds((cur) => cur.filter((x) => x !== id))}
                    aria-label={`${item?.name ?? "商品"} を削除`}
                    className="bg-bg-tertiary flex items-center justify-center rounded-full shrink-0 w-[32px] h-[32px]"
                  >
                    <Icon name="trash" className="w-4 h-4 text-text-primary" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 上限に達したらフォームごと隠す。押せるのにエラーになるより親切 */}
          {isFull ? (
            <p className="type-jp-caption text-text-secondary border border-border border-dashed rounded-[var(--radius-md)] px-[var(--space-16)] py-[var(--space-16)]">
              上限の{BEST_SELLER_MAX}件に達しました。追加するには、どれかを削除してください。
            </p>
          ) : (
            <div className="border border-border border-dashed rounded-[var(--radius-md)] flex flex-col gap-[var(--space-8)] px-[var(--space-16)] py-[var(--space-12)]">
              <p className="type-jp-label text-text-secondary">商品を追加</p>
              <div className="flex flex-col lg:flex-row gap-[var(--space-8)] lg:items-end">
                <label className="flex flex-col gap-[var(--space-4)] flex-1 min-w-0">
                  <span className="type-jp-label text-text-secondary">カテゴリ</span>
                  <select
                    value={pickCategory}
                    onChange={(e) => { setPickCategory(e.target.value); setPickItem(""); }}
                    className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[40px] px-[var(--space-12)] type-jp-body text-text-primary"
                  >
                    <option value="">選択してください</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-[var(--space-4)] flex-1 min-w-0">
                  <span className="type-jp-label text-text-secondary">商品名</span>
                  <select
                    value={pickItem}
                    onChange={(e) => setPickItem(e.target.value)}
                    disabled={!pickCategory}
                    className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[40px] px-[var(--space-12)] type-jp-body text-text-primary disabled:opacity-50"
                  >
                    <option value="">
                      {!pickCategory
                        ? "先にカテゴリを選択"
                        : itemChoices.length === 0
                          ? "追加できる商品がありません"
                          : "選択してください"}
                    </option>
                    {itemChoices.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!pickItem}
                  className="bg-surface-ink rounded-[var(--radius-full)] h-[40px] px-[var(--space-20)] shrink-0 type-jp-body-bold text-text-inverse disabled:opacity-40"
                >
                  選ぶ
                </button>
              </div>
            </div>
          )}

          {error && <p className="type-jp-caption text-status-urgent">{error}</p>}
        </div>

        <div className="flex gap-[var(--space-12)] border-t border-border-divider px-[var(--space-24)] py-[var(--space-16)] shrink-0 safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="bg-surface-white border border-border flex-1 h-[48px] rounded-[var(--radius-full)] type-jp-heading-s text-text-primary"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-surface-ink flex-1 h-[48px] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
