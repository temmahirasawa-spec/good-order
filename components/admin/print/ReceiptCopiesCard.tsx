"use client";

/**
 * 伝票の枚数（管理画面「印刷状況」の設定カード）
 *
 * 3択のラジオ。押した瞬間に切り替え（楽観的更新）、保存に失敗したときだけ元に戻す（CLAUDE.md 4章）。
 * 見た目はこの画面の他のカード（白地・角丸 md・枠線）と、商品詳細の
 * Serving Timing Card（ラジオ＋ラベル＋補足）を組み合わせたもの。Figma に対応ノードは無い。
 */
import { useState } from "react";
import {
  RECEIPT_COPIES_OPTIONS,
  RECEIPT_COPIES_TITLE,
  type ReceiptCopiesMode,
} from "@/lib/receiptCopies";

export default function ReceiptCopiesCard({
  value,
  onSave,
  className = "",
}: {
  /** null = 読み込み中 */
  value: ReceiptCopiesMode | null;
  /** 保存。失敗したら throw する（呼び出し側は何もしなくてよい。ここで元に戻す） */
  onSave: (mode: ReceiptCopiesMode) => Promise<void>;
  className?: string;
}) {
  const [draft, setDraft] = useState<ReceiptCopiesMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = draft ?? value;

  const select = async (mode: ReceiptCopiesMode) => {
    if (saving || current === mode) return;
    const prev = current;
    setError(null);
    setDraft(mode);      // 楽観: 先に切り替える
    setSaving(true);
    try {
      await onSave(mode);
    } catch (err) {
      console.error("[ReceiptCopiesCard] save failed:", err);
      setDraft(prev);    // 失敗したときだけ戻す
      setError("保存できませんでした。通信環境をご確認のうえ、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={RECEIPT_COPIES_TITLE}
      className={`bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)] ${className}`}
    >
      <div className="flex flex-col gap-[var(--space-4)]">
        <h2 className="type-jp-body-bold text-text-primary">{RECEIPT_COPIES_TITLE}</h2>
        <p className="type-jp-caption text-text-secondary">
          1回の注文で印刷する枚数です。変更は次の注文から効きます（刷り直しにも同じ枚数で出ます）。
        </p>
      </div>

      <div role="radiogroup" aria-label={RECEIPT_COPIES_TITLE} className="flex flex-col gap-[var(--space-8)]">
        {RECEIPT_COPIES_OPTIONS.map((opt) => {
          const on = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving || value === null}
              onClick={() => void select(opt.value)}
              className={`flex gap-[var(--space-12)] items-center px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] border w-full text-left bg-surface-white disabled:opacity-60 transition-colors ${
                on ? "border-text-primary" : "border-border hover:bg-bg-secondary"
              }`}
              style={on ? { boxShadow: "inset 0 0 0 1px var(--color-text-primary)" } : undefined}
            >
              <span
                aria-hidden
                className={`shrink-0 w-[18px] h-[18px] rounded-full bg-surface-white ${
                  on ? "border-[5px] border-text-primary" : "border border-border"
                }`}
              />
              <span className="flex flex-col gap-[2px] min-w-0">
                <span className="type-jp-body-bold text-text-primary">{opt.label}</span>
                <span className="type-jp-caption text-text-secondary">{opt.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {value === null && (
        <p className="type-jp-caption text-text-tertiary">読み込み中…</p>
      )}
      {error && <p className="type-jp-caption text-status-urgent">{error}</p>}
    </section>
  );
}
