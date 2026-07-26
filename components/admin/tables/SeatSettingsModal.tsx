"use client";

/**
 * 席カテゴリーと卓の設定
 * （Figma: Modal / 席設定 — PC 541:793 / Half Modal / 席設定 — SP 541:926）
 *
 * カテゴリーの管理と卓の追加を**1つの画面に統合**している。別画面に分けない。
 * 卓をチップで並べるのは「A3だけ撤去して A1・A2・A4… にする」歯抜けを
 * 表現できるようにするため。卓数の数値入力にすると席レイアウト変更のたびに
 * 番号を振り直すことになる。
 *
 * 保存はサーバー側 save_table_layout() 1回で丸ごと入れ替える。
 * カテゴリーと卓を同時に作り直すので、個別のINSERT/DELETEを並べると
 * 途中で失敗したときに半分だけ反映された状態が残る。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import CodePicker from "@/components/admin/tables/CodePicker";
import { tableShortLabel, type LayoutCategoryInput, type TableGroup } from "@/lib/tables";

interface DraftTable {
  id: string | null;
  number: number;
  /** 既存の卓かどうか（削除時の確認文言を変えるため） */
  existing: boolean;
}
interface DraftCategory {
  id: string | null;
  code: string;
  name: string;
  tables: DraftTable[];
  /** 元々このカテゴリーに属していた卓の数（削除警告用） */
  originalTableCount: number;
}

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function toDraft(groups: TableGroup[]): DraftCategory[] {
  return groups.map((g) => ({
    id: g.category.id,
    code: g.category.code,
    name: g.category.name,
    tables: g.tables.map((t) => ({ id: t.id, number: t.number, existing: true })),
    originalTableCount: g.tables.length,
  }));
}

export default function SeatSettingsModal({
  open,
  groups,
  onClose,
  onSave,
}: {
  open: boolean;
  groups: TableGroup[];
  onClose: () => void;
  onSave: (payload: LayoutCategoryInput[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftCategory[]>([]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // コード欄の実測位置からポップオーバーを置くための参照（行ごとに1つ）
  const codeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 開くたびにサーバーの内容から作り直す（キャンセル後に編集途中が残らないように）
  useEffect(() => {
    if (open) {
      setDraft(toDraft(groups));
      setError(null);
      setPickerFor(null);
    }
  }, [open, groups]);

  const usedCodes = useMemo(
    () => draft.map((c) => c.code),
    [draft]
  );

  if (!open) return null;

  const patch = (index: number, next: Partial<DraftCategory>) =>
    setDraft((d) => d.map((c, i) => (i === index ? { ...c, ...next } : c)));

  const addCategory = () => {
    const free = LETTERS.find((l) => !usedCodes.includes(l));
    if (!free) {
      setError("カテゴリーはA〜Zの26個までです");
      return;
    }
    setDraft((d) => [...d, { id: null, code: free, name: "", tables: [], originalTableCount: 0 }]);
  };

  const removeCategory = (index: number) => {
    const c = draft[index];
    const count = c.tables.length;
    const message =
      count > 0
        ? `「${c.code} ・ ${c.name || "（名称未設定）"}」には卓が${count}件あります。カテゴリーごと削除しますか？\n\n削除しても、その卓での過去の注文は残ります（伝票の卓名も変わりません）。`
        : `「${c.code} ・ ${c.name || "（名称未設定）"}」を削除しますか？`;
    if (!window.confirm(message)) return;
    setDraft((d) => d.filter((_, i) => i !== index));
  };

  const addTable = (index: number) => {
    setDraft((d) =>
      d.map((c, i) => {
        if (i !== index) return c;
        const next = c.tables.reduce((m, t) => Math.max(m, t.number), 0) + 1;
        return { ...c, tables: [...c.tables, { id: null, number: next, existing: false }] };
      })
    );
  };

  const removeTable = (index: number, tIndex: number) => {
    const t = draft[index].tables[tIndex];
    if (t.existing) {
      const label = tableShortLabel(draft[index].code, t.number);
      if (
        !window.confirm(
          `${label} を削除しますか？\n\n削除しても、この卓での過去の注文は残ります（伝票の卓名も変わりません）。印刷済みの二次元コードは読み取れなくなります。`
        )
      ) {
        return;
      }
    }
    setDraft((d) =>
      d.map((c, i) => (i === index ? { ...c, tables: c.tables.filter((_, j) => j !== tIndex) } : c))
    );
  };

  /* ⠿ でカテゴリーを並び替える。行全体をドロップ先にし、掴めるのはグリップだけ */
  const handleDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) return;
    setDraft((d) => {
      const next = d.slice();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  const handleSave = async () => {
    if (draft.some((c) => !c.name.trim())) {
      setError("カテゴリーの名称を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        draft.map((c, ci) => ({
          id: c.id,
          code: c.code,
          name: c.name.trim(),
          display_order: ci + 1,
          tables: c.tables.map((t, ti) => ({ id: t.id, number: t.number, display_order: ti + 1 })),
        }))
      );
      onClose();
    } catch (e) {
      console.error("[SeatSettingsModal] save failed:", e);
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
      <p className="type-jp-caption text-text-secondary">
        コードと名称を設定すると、卓の表示が「A1」「B3」のようになります。⠿ で並び順を変えられます。
      </p>

      <div className="flex flex-col w-full">
        {draft.map((c, i) => (
          <div
            key={`${c.id ?? "new"}-${i}`}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={() => handleDrop(i)}
            className={`border-b border-border-divider flex flex-col gap-[10px] py-[14px] w-full ${
              dragIndex === i ? "opacity-50" : ""
            }`}
          >
            <div className="flex gap-[10px] items-center w-full">
              <span
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                aria-label="ドラッグして並び替え"
                className="shrink-0 flex items-center cursor-grab active:cursor-grabbing"
              >
                <Icon name="grip" className="w-4 h-4 text-text-tertiary" />
              </span>

              <div className="relative shrink-0">
                <button
                  type="button"
                  ref={(el) => { codeButtonRefs.current[i] = el; }}
                  onClick={() => setPickerFor(pickerFor === i ? null : i)}
                  className="bg-surface-white border border-border rounded-[var(--radius-sm)] flex h-[36px] items-center justify-between pl-[var(--space-12)] pr-[var(--space-8)] w-[60px]"
                >
                  <span className="type-en-data-m text-text-primary">{c.code}</span>
                  <Icon name="chevron-down" className="w-3.5 h-3.5 text-text-primary" />
                </button>
                <CodePicker
                  open={pickerFor === i}
                  value={c.code}
                  anchorRef={{ current: codeButtonRefs.current[i] }}
                  usedCodes={usedCodes.filter((_, ci) => ci !== i)}
                  onSelect={(code) => patch(i, { code })}
                  onClose={() => setPickerFor(null)}
                />
              </div>

              <input
                value={c.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="カウンター席"
                className="bg-surface-white border border-border rounded-[var(--radius-sm)] flex-1 min-w-0 h-[36px] px-[var(--space-12)] type-jp-body text-text-primary"
              />

              <button
                type="button"
                onClick={() => removeCategory(i)}
                aria-label={`${c.code} を削除`}
                className="bg-bg-tertiary flex items-center justify-center rounded-full w-[32px] h-[32px] shrink-0"
              >
                <Icon name="trash" className="w-4 h-4 text-text-primary" />
              </button>
            </div>

            <div className="flex flex-wrap gap-[var(--space-8)] items-start pl-[26px] w-full">
              {c.tables.map((t, ti) => (
                <span
                  key={`${t.id ?? "new"}-${ti}`}
                  className="bg-bg-tertiary flex gap-[var(--space-4)] items-center pl-[var(--space-12)] pr-[var(--space-8)] py-[6px] rounded-[var(--radius-full)]"
                >
                  <span className="type-en-data-s text-text-primary">
                    {tableShortLabel(c.code, t.number)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTable(i, ti)}
                    aria-label={`${tableShortLabel(c.code, t.number)} を削除`}
                    className="flex items-center justify-center"
                  >
                    <Icon name="close" className="w-3 h-3 text-text-primary" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => addTable(i)}
                className="border border-border border-dashed flex items-center px-[var(--space-12)] py-[6px] rounded-[var(--radius-full)]"
              >
                <span className="type-jp-micro-label text-text-secondary whitespace-nowrap">
                  ＋ 卓を追加
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCategory}
        className="border border-border border-dashed flex h-[44px] items-center justify-center rounded-[var(--radius-md)] w-full"
      >
        <span className="type-jp-body text-text-primary">＋ カテゴリーを追加</span>
      </button>

      {error && <p className="type-jp-caption text-status-urgent">{error}</p>}
    </>
  );

  const footer = (
    <>
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
    </>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end lg:items-center lg:justify-center" onClick={onClose}>
      {/* PC=中央モーダル520px / SP=ハーフモーダル。中身は共通 */}
      <div
        className="bg-surface-white w-full lg:w-[520px] max-h-[90vh] rounded-t-[var(--radius-xl)] lg:rounded-[var(--radius-xl)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-divider px-[var(--space-24)] py-[var(--space-16)] shrink-0">
          <h2 className="type-jp-heading-l text-text-primary">席カテゴリーと卓の設定</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="flex flex-col gap-[var(--space-16)] overflow-y-auto px-[var(--space-24)] py-[var(--space-16)]">
          {body}
        </div>
        <div className="flex gap-[var(--space-12)] border-t border-border-divider px-[var(--space-24)] py-[var(--space-16)] shrink-0 safe-bottom">
          {footer}
        </div>
      </div>
    </div>
  );
}
