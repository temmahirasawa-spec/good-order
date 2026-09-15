"use client";

/**
 * スタッフ呼び出しの項目設定（サイドバー「スタッフ呼び出し」）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「いまは水、会計、呼ぶの3択ですが、それを自由に設定させたいです」
 *
 * お客様の「スタッフを呼ぶ」（components/StaffCallSheet.tsx）に並ぶ項目を決める。
 * 保存は**丸ごと置き換え**なので、並び替え・追加・削除が1回で反映される
 * （supabase/store_info_and_staff_calls.sql の save_staff_call_options）。
 *
 * 呼び出しを受ける側（厨房の呼び出しチップ）は `call_label` をそのまま出すので、
 * ここで項目を増やしても厨房側の作りは変わらない。
 */
import { useCallback, useEffect, useState } from "react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import { Icon } from "@/components/Icon";
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

export default function StaffCallSettingPage() {
  const [saved, setSaved]   = useState<StaffCallOption[] | null>(null);
  const [draft, setDraft]   = useState<StaffCallOption[]>(STAFF_CALL_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const o = await fetchStaffCallOptions({ includeInactive: true });
        if (cancelled) return;
        setSaved(o); setDraft(o);
      } catch (err) {
        console.error("[StaffCallSettingPage] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const touch = useCallback(() => setDone(false), []);
  const patch = (i: number, p: Partial<StaffCallOption>) => {
    setDraft((d) => d.map((o, k) => (k === i ? { ...o, ...p } : o)));
    touch();
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    setDraft((d) => {
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  };
  const remove = (i: number) => {
    if (draft.length <= 1) return;   // 1つは残す
    setDraft((d) => d.filter((_, k) => k !== i));
    touch();
  };
  const add = () => {
    if (draft.length >= MAX) return;
    setDraft((d) => [...d, { label: "", icon: "bell", callType: "other", isActive: true }]);
    touch();
  };

  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const emptyLabel = draft.some((o) => !o.label.trim());

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveStaffCallOptions(draft);
      setSaved(draft);
      setDone(true);
    } catch (err) {
      console.error("[StaffCallSettingPage] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title="スタッフ呼び出し" count={`${draft.length}件の項目`} onMenuClick={openDrawer} />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-32)]">
            {saved === null && error === null ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-16)] max-w-[720px]">

                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-4)]">
                  <h2 className="type-jp-body-bold text-text-primary">お客様が選べるご用件</h2>
                  <p className="type-jp-caption text-text-secondary">
                    お客様が「スタッフを呼ぶ」を押したときに、この順番で並びます。
                    厨房の呼び出し表示にも、ここで決めた文言がそのまま出ます。
                  </p>
                </section>

                <div className="flex flex-col gap-[var(--space-12)]">
                  {draft.map((opt, i) => (
                    <section
                      key={i}
                      className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]"
                    >
                      <div className="flex items-start gap-[var(--space-12)]">
                        <div className="flex flex-col gap-[var(--space-4)] shrink-0">
                          <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            aria-label="1つ上へ"
                            className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border grid place-items-center disabled:opacity-30"
                          >
                            <Icon name="chevron-up" className="w-4 h-4 text-text-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === draft.length - 1}
                            aria-label="1つ下へ"
                            className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border grid place-items-center disabled:opacity-30"
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
                                    on ? "border-text-primary bg-bg-secondary" : "border-border bg-surface-white"
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

                <div className="flex items-center gap-[var(--space-12)]">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saving || emptyLabel}
                    className="bg-text-primary text-surface-white rounded-full h-[48px] px-[var(--space-32)] type-jp-body-bold disabled:opacity-40"
                  >
                    {saving ? "保存中…" : "保存する"}
                  </button>
                  {done && !dirty && (
                    <span className="type-jp-caption text-status-success">保存しました</span>
                  )}
                </div>
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
