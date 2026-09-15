"use client";

/**
 * スタッフ呼び出しの詳細設定（表示設定 ＞ 機能設定 の「設定する」から開く）
 *
 * 2026-09-15 に独立ページ（/admin/staff-calls）から**この形に統合**した。
 * 天真の指示:
 *   「サイドバーのメニューに『スタッフ呼び出し』があるので、これを統合したい。
 *     『スタッフを呼ぶ』をオンにすると『設定する』ボタンが現れ、
 *     押すとポップアップで詳細設定ができる」
 *
 * 使うかどうか（ON/OFF）は親の機能設定が持ち、**中身の設定だけをここで扱う**。
 * 保存は丸ごと置き換え（supabase/store_info_and_staff_calls.sql の
 * save_staff_call_options）なので、並び替え・追加・削除が1回で反映される。
 */
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import {
  STAFF_CALL_DEFAULT,
  STAFF_CALL_ICONS,
  fetchStaffCallOptions,
  saveStaffCallOptions,
  type StaffCallOption,
} from "@/lib/storeInfo";
import { describeDbError } from "@/lib/dbError";

const MAX = 8;

export default function StaffCallSettingsModal({ onClose }: { onClose: () => void }) {
  const [saved, setSaved]   = useState<StaffCallOption[] | null>(null);
  const [draft, setDraft]   = useState<StaffCallOption[]>(STAFF_CALL_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const o = await fetchStaffCallOptions({ includeInactive: true });
        if (cancelled) return;
        setSaved(o); setDraft(o);
      } catch (err) {
        console.error("[StaffCallSettingsModal] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const patch = useCallback((i: number, p: Partial<StaffCallOption>) => {
    setDraft((d) => d.map((o, k) => (k === i ? { ...o, ...p } : o)));
  }, []);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    setDraft((d) => {
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const remove = (i: number) => {
    if (draft.length <= 1) return;   // 1つは残す
    setDraft((d) => d.filter((_, k) => k !== i));
  };
  const add = () => {
    if (draft.length >= MAX) return;
    setDraft((d) => [...d, { label: "", icon: "bell", callType: "other", isActive: true }]);
  };

  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const emptyLabel = draft.some((o) => !o.label.trim());

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveStaffCallOptions(draft);
      setSaved(draft);
      onClose();
    } catch (err) {
      console.error("[StaffCallSettingsModal] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end lg:items-center lg:justify-center"
      onClick={onClose}
    >
      {/* PC=中央モーダル560px / SP=ハーフモーダル（席設定と同じ器） */}
      <div
        className="bg-surface-white w-full lg:w-[560px] max-h-[90vh] rounded-t-[var(--radius-xl)] lg:rounded-[var(--radius-xl)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-divider px-[var(--space-24)] py-[var(--space-16)] shrink-0">
          <h2 className="type-jp-heading-l text-text-primary">スタッフ呼び出しの設定</h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-[var(--space-16)] overflow-y-auto px-[var(--space-24)] py-[var(--space-16)]">
          {saved === null && error === null ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
            </div>
          ) : (
            <>
              <p className="type-jp-caption text-text-secondary">
                お客様が「スタッフを呼ぶ」を押したときに、この順番で並びます。
                厨房の呼び出し表示にも、ここで決めた文言がそのまま出ます。
              </p>

              <div className="flex flex-col gap-[var(--space-12)]">
                {draft.map((opt, i) => (
                  <section
                    key={i}
                    className="bg-bg-secondary rounded-[var(--radius-md)] border border-border px-[var(--space-16)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]"
                  >
                    <div className="flex items-start gap-[var(--space-12)]">
                      <div className="flex flex-col gap-[var(--space-4)] shrink-0">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label="1つ上へ"
                          className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface-white grid place-items-center disabled:opacity-30"
                        >
                          <Icon name="chevron-up" className="w-4 h-4 text-text-secondary" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === draft.length - 1}
                          aria-label="1つ下へ"
                          className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface-white grid place-items-center disabled:opacity-30"
                        >
                          <Icon name="chevron-down" className="w-4 h-4 text-text-secondary" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-8)]">
                        <label className="type-jp-caption-bold text-text-primary" htmlFor={`label-${i}`}>
                          お客様に見える文言
                        </label>
                        <input
                          id={`label-${i}`}
                          type="text"
                          value={opt.label}
                          maxLength={30}
                          placeholder="例: おしぼりをください"
                          onChange={(e) => patch(i, { label: e.target.value })}
                          className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary w-full"
                        />

                        <p className="type-jp-caption-bold text-text-primary mt-[var(--space-4)]">アイコン</p>
                        <div className="flex flex-wrap gap-[var(--space-8)]">
                          {STAFF_CALL_ICONS.map((ic) => {
                            const on = opt.icon === ic.value;
                            return (
                              <button
                                key={ic.value}
                                type="button"
                                onClick={() => patch(i, { icon: ic.value })}
                                aria-pressed={on}
                                aria-label={ic.label}
                                className={`w-[44px] h-[44px] rounded-[var(--radius-sm)] border grid place-items-center ${
                                  on ? "border-text-primary bg-surface-white" : "border-border bg-surface-white"
                                }`}
                              >
                                <Icon
                                  name={ic.value}
                                  className={`w-5 h-5 ${on ? "text-text-primary" : "text-text-secondary"}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-[var(--space-12)] pt-[var(--space-8)] border-t border-border-divider">
                      <div className="flex items-center gap-[var(--space-8)]">
                        <span className="type-jp-caption text-text-secondary">お客様に見せる</span>
                        <ToggleSwitch
                          on={opt.isActive}
                          onClick={() => patch(i, { isActive: !opt.isActive })}
                          ariaLabel={`${opt.label || "この項目"}をお客様に見せる`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        disabled={draft.length <= 1}
                        className="type-jp-caption text-status-urgent disabled:opacity-30"
                      >
                        削除
                      </button>
                    </div>
                  </section>
                ))}
              </div>

              <button
                type="button"
                onClick={add}
                disabled={draft.length >= MAX}
                className="bg-surface-white border border-border rounded-[var(--radius-md)] h-[52px] type-jp-body-bold text-text-primary hover:bg-bg-secondary disabled:opacity-40"
              >
                {draft.length >= MAX ? `項目は${MAX}つまでです` : "＋ 項目を追加する"}
              </button>

              {emptyLabel && (
                <p className="type-jp-caption text-status-urgent">
                  文言が空の項目があります。入力するか、削除してください。
                </p>
              )}
              {error && <p className="type-jp-caption text-status-urgent">{error}</p>}
            </>
          )}
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
            disabled={!dirty || saving || emptyLabel}
            className="bg-surface-ink flex-1 h-[48px] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
