"use client";

/**
 * セットドリンク設定（メニュー ＞ セットドリンク）
 *
 * 仕様: docs/specs/set-drink-discount.md（2026-09-13、洋輔さんの依頼）
 *   「食事とドリンクをご注文でドリンク200円引き。フードの数分だけドリンクの金額 -200円」
 *
 * この機能に関する設定はこの画面だけで完結させる（天真の指示）。
 * 割引の計算そのものはサーバー側（supabase/set_drink_discount.sql の place_order）。
 *
 * 対象カテゴリーは「カテゴリ管理」の**区分（フード / ドリンク）**で決まるので、
 * ここでは今どれが対象かを一覧で見せて、変更はカテゴリ管理へ送る。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { fetchCategories, type ApiCategory } from "@/lib/api";
import {
  SET_DRINK_DEFAULT,
  SET_DRINK_MAX,
  SET_DRINK_TITLE,
  fetchSetDrinkSetting,
  saveSetDrinkSetting,
  type SetDrinkSetting,
} from "@/lib/setDrink";
import { describeDbError } from "@/lib/dbError";

export default function SetDrinkSettingPage() {
  const [setting, setSetting] = useState<SetDrinkSetting | null>(null);
  const [draft, setDraft]     = useState<SetDrinkSetting>(SET_DRINK_DEFAULT);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, cats] = await Promise.all([fetchSetDrinkSetting(), fetchCategories()]);
        if (cancelled) return;
        setSetting(s);
        setDraft(s);
        setCategories(cats);
      } catch (err) {
        console.error("[SetDrinkSettingPage] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<SetDrinkSetting>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  }, []);

  const dirty = setting !== null && (
    draft.enabled !== setting.enabled ||
    draft.discount !== setting.discount ||
    draft.takeout !== setting.takeout
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSetDrinkSetting(draft);
      setSetting(draft);
      setSaved(true);
    } catch (err) {
      console.error("[SetDrinkSettingPage] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  /* 対象カテゴリー。区分は「カテゴリ管理」で決まる */
  const { foods, drinks } = useMemo(() => ({
    foods:  categories.filter((c) => c.category_type !== "drink").map((c) => c.name),
    drinks: categories.filter((c) => c.category_type === "drink").map((c) => c.name),
  }), [categories]);

  const example = `パンケーキ1点 ＋ ドリンク2点 → ドリンク1杯ぶん −¥${draft.discount.toLocaleString()}`;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title={SET_DRINK_TITLE} count="食事と一緒のドリンクを割引" onMenuClick={openDrawer} />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-32)]">
            {setting === null && error === null ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-16)] max-w-[720px]">
                {/* ── 使うかどうか ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex items-center justify-between gap-[var(--space-16)]">
                    <div className="flex flex-col gap-[var(--space-4)] min-w-0">
                      <h2 className="type-jp-body-bold text-text-primary">セットドリンク割引を使う</h2>
                      <p className="type-jp-caption text-text-secondary">
                        フード1品につき、ドリンク1杯まで割り引きます。お客様のカートで自動で引かれます。
                      </p>
                    </div>
                    <ToggleSwitch
                      on={draft.enabled}
                      onClick={() => update({ enabled: !draft.enabled })}
                      ariaLabel="セットドリンク割引を使う"
                    />
                  </div>
                  <p className="type-jp-caption text-text-tertiary bg-bg-secondary rounded-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-8)]">
                    例: {example}
                  </p>
                </section>

                {/* ── 金額と範囲。OFF のときは薄くして触れなくする ── */}
                <section
                  className={`bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-16)] transition-opacity ${
                    draft.enabled ? "" : "opacity-50 pointer-events-none"
                  }`}
                  aria-hidden={!draft.enabled}
                >
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <label htmlFor="set-drink-discount" className="type-jp-caption-bold text-text-primary">
                      1杯あたりの割引額（円・税抜き）
                    </label>
                    <input
                      id="set-drink-discount"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={SET_DRINK_MAX}
                      step={10}
                      value={draft.discount}
                      onChange={(e) => update({ discount: Math.max(0, Math.min(SET_DRINK_MAX, parseInt(e.target.value) || 0)) })}
                      className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-en-price-m text-text-primary w-[160px]"
                    />
                    <p className="type-jp-caption text-text-tertiary">
                      ドリンクの単価より高い額は引きません（100円のドリンクなら100円引き）。
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-[var(--space-16)]">
                    <div className="flex flex-col gap-[var(--space-4)] min-w-0">
                      <p className="type-jp-caption-bold text-text-primary">テイクアウトの注文にも適用する</p>
                      <p className="type-jp-caption text-text-tertiary">
                        オフのときは店内のご注文だけが対象です。
                      </p>
                    </div>
                    <ToggleSwitch
                      on={draft.takeout}
                      onClick={() => update({ takeout: !draft.takeout })}
                      ariaLabel="テイクアウトの注文にも適用する"
                    />
                  </div>
                </section>

                {/* ── 対象カテゴリー（区分はカテゴリ管理で決まる） ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">どれがフードで、どれがドリンクか</h2>
                    <p className="type-jp-caption text-text-secondary">
                      カテゴリーの「区分」で決まります。変えるときは
                      <Link href="/admin/menu/categories" className="text-accent-deep underline mx-[2px]">カテゴリ管理</Link>
                      から。
                    </p>
                  </div>
                  {[["ドリンク（割引される側）", drinks], ["フード（割引の条件になる側）", foods]].map(([label, names]) => (
                    <div key={label as string} className="flex flex-col gap-[var(--space-8)]">
                      <p className="type-jp-caption-bold text-text-secondary">{label as string}</p>
                      {(names as string[]).length === 0 ? (
                        <p className="type-jp-caption text-status-urgent">
                          該当するカテゴリーがありません。この状態では割引は付きません。
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-[var(--space-8)]">
                          {(names as string[]).map((n) => (
                            <span key={n} className="type-jp-caption text-text-primary bg-bg-secondary rounded-full px-[var(--space-12)] py-[var(--space-4)]">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </section>

                {error && <p className="type-jp-caption text-status-urgent">{error}</p>}

                <div className="flex items-center gap-[var(--space-12)]">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="bg-text-primary text-surface-white rounded-full h-[48px] px-[var(--space-32)] type-jp-body-bold disabled:opacity-40"
                  >
                    {saving ? "保存中…" : "保存する"}
                  </button>
                  {saved && !dirty && (
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
