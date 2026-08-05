"use client";

/**
 * ベストセラー設定（表示設定 > ベストセラー タブ）。
 *
 * **もとは components/admin/menu/BestSellerModal.tsx でメニュー管理の Top Bar から
 * 開くモーダルだった。**画面内に移したので、モーダルの器（背景の暗幕・ヘッダー・
 * 「キャンセル」）は無くなり、フッターは「保存する」1つだけになった。
 * 中身（表示トグル・登録済みリスト・商品追加フォーム）は移す前と同じ。
 *
 * 並び替えは **PC=⠿ドラッグ / SP=▲▼**。SPでドラッグにすると長押しでブラウザの
 * コンテキストメニューが出るため、カテゴリ管理・メニュー管理と同じ
 * components/admin/ReorderButtons.tsx をそのまま流用している（新しく作らない）。
 */
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
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

/* 注釈は PC / SP で1行目だけ差し替える（並び替えの操作方法が違うため）。 */
const NOTE_REORDER_PC = "行を上下にドラッグすると、表示される順番を並べ替えられます。";
const NOTE_REORDER_SP = "行の左にある上下のボタンで、表示される順番を並べ替えられます。";
const NOTES_COMMON = [
  "売り切れ・非表示にした商品は、ベストセラーからも自動的に隠れます。",
  `登録できるのは最大${BEST_SELLER_MAX}件までです。`,
];

export default function BestSellerPanel({
  setting,
  candidates,
  categories,
  onSave,
}: {
  /** null = 読み込み中 */
  setting: BestSellerSetting | null;
  /** 選択肢になる全商品（テイクアウト専用も含む） */
  candidates: BestSellerCandidate[];
  categories: { id: string; name: string }[];
  onSave: (next: BestSellerSetting) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [pickCategory, setPickCategory] = useState("");
  const [pickItem, setPickItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // サーバーから届いた内容で初期化する
  useEffect(() => {
    if (!setting) return;
    setEnabled(setting.enabled);
    setIds(setting.itemIds);
  }, [setting]);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  /* すでに登録済みの商品は選択肢から外す（重複登録を防ぐ） */
  const selectable = useMemo(
    () => candidates.filter((c) => !ids.includes(c.id)),
    [candidates, ids]
  );
  const itemChoices = useMemo(
    () => (pickCategory ? selectable.filter((c) => c.categoryId === pickCategory) : []),
    [selectable, pickCategory]
  );

  if (!setting) {
    return (
      <div className="flex flex-col gap-[var(--space-12)] w-full">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-[48px] w-full" />
        <div className="skeleton h-[70px] w-full" />
      </div>
    );
  }

  const isFull = ids.length >= BEST_SELLER_MAX;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    setSaved(false);
    setIds((cur) => {
      const next = cur.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const handleAdd = () => {
    if (!pickItem || isFull) return;
    setSaved(false);
    setIds((cur) => [...cur, pickItem]);
    setPickItem("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ enabled, itemIds: ids });
      setSaved(true);
    } catch (e) {
      console.error("[BestSellerPanel] save failed:", e);
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  /* SP は縦積み。横並びだと商品名が切れて読めない。
     各フィールドと「選ぶ」の高さは 44px 以上にしてタップ領域を確保する。 */
  const selectClass =
    "bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary disabled:opacity-50";

  return (
    <div className="flex flex-col gap-[var(--space-16)] w-full">
      {/* ── 表示ON/OFF ── */}
      <div className="bg-bg-secondary flex items-center justify-between gap-[var(--space-12)] px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] w-full">
        <span className="type-jp-body text-text-primary">注文ホームにベストセラーを表示する</span>
        <ToggleSwitch
          on={enabled}
          onClick={() => { setEnabled((v) => !v); setSaved(false); }}
          ariaLabel="注文ホームにベストセラーを表示する"
        />
      </div>

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
              {/* PC=⠿ドラッグ / SP=▲▼ */}
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
                onClick={() => { setIds((cur) => cur.filter((x) => x !== id)); setSaved(false); }}
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
          <div className="flex flex-col lg:flex-row gap-[var(--space-12)] lg:gap-[var(--space-8)] lg:items-end">
            <label className="flex flex-col gap-[var(--space-4)] flex-1 min-w-0">
              <span className="type-jp-label text-text-secondary">カテゴリ</span>
              <select
                value={pickCategory}
                onChange={(e) => { setPickCategory(e.target.value); setPickItem(""); }}
                className={selectClass}
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
                className={selectClass}
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
            {/* 「保存する」と主従が読めなくなるので Outline にする（黒いボタンを2つ並べない） */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={!pickItem}
              className="bg-surface-white border border-border rounded-[var(--radius-full)] h-[44px] px-[var(--space-20)] shrink-0 type-jp-heading-s text-text-primary disabled:opacity-40"
            >
              選ぶ
            </button>
          </div>
        </div>
      )}

      {/* ── 注釈 ── */}
      <ul className="type-jp-label text-text-tertiary w-full list-disc pl-[1.25em] flex flex-col gap-[var(--space-2)]">
        <li className="hidden lg:list-item leading-[1.4]">{NOTE_REORDER_PC}</li>
        <li className="lg:hidden leading-[1.4]">{NOTE_REORDER_SP}</li>
        {NOTES_COMMON.map((n) => (
          <li key={n} className="leading-[1.4]">{n}</li>
        ))}
      </ul>

      {error && (
        <div className="bg-status-urgent-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-urgent">{error}</p>
        </div>
      )}
      {saved && !error && (
        <div className="bg-status-success-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-success">保存しました。</p>
        </div>
      )}

      {/* ── 保存 ──
          画面内なので「キャンセル」は置かない（戻り先が無い）。PCは右寄せ、SPは全幅。 */}
      <div className="flex justify-end w-full">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-surface-ink h-[48px] rounded-[var(--radius-full)] w-full lg:w-auto lg:px-[var(--space-40)] type-jp-heading-s text-text-inverse disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}
