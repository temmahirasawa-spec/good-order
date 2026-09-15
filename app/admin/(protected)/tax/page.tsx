"use client";

/**
 * 税の設定（サイドバー「税の設定」）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「メニュー価格を税込で入れているのに、さらに10%かかる仕様になっている。
 *     外税か内税か選べるように。テイクアウトは8%、店内は10%」
 *
 * 仕様: docs/specs/tax-mode.md ／ DB: supabase/tax_mode.sql
 * この機能に関する設定はこの画面だけで完結させる。
 */
import { useCallback, useEffect, useState } from "react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import {
  TAX_DEFAULT,
  fetchTaxSetting,
  saveTaxSetting,
  calcOrderTotals,
  type TaxMode,
  type TaxSetting,
} from "@/lib/tax";
import { describeDbError } from "@/lib/dbError";

/** 例に使う金額。実際のメニュー1品ぶんに近い額 */
const SAMPLE = 1870;

const MODES: { value: TaxMode; title: string; desc: string }[] = [
  {
    value: "included",
    title: "内税",
    desc: "メニューに登録した価格が、消費税を含んだ金額です。お客様のお支払いはその価格のままで、消費税は内訳として表示します。",
  },
  {
    value: "excluded",
    title: "外税",
    desc: "メニューに登録した価格は税抜です。お会計のときに消費税を加算します。",
  },
];

export default function TaxSettingPage() {
  const [saved, setSaved]     = useState<TaxSetting | null>(null);
  const [draft, setDraft]     = useState<TaxSetting>(TAX_DEFAULT);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchTaxSetting();
        if (cancelled) return;
        setSaved(s);
        setDraft(s);
      } catch (err) {
        console.error("[TaxSettingPage] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<TaxSetting>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDone(false);
  }, []);

  const dirty = saved !== null && (
    draft.mode !== saved.mode ||
    draft.rateDineIn !== saved.rateDineIn ||
    draft.rateTakeout !== saved.rateTakeout
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTaxSetting(draft);
      setSaved(draft);
      setDone(true);
    } catch (err) {
      console.error("[TaxSettingPage] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  /* 設定を変えると金額がどう変わるかを、その場で見せる */
  const preview = (orderType: "dine_in" | "takeout") =>
    calcOrderTotals({ subtotal: SAMPLE, orderType, setting: draft });

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title="税の設定" count="内税 / 外税・税率" onMenuClick={openDrawer} />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-32)]">
            {saved === null && error === null ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-16)] max-w-[720px]">

                {/* ── 内税 / 外税 ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">メニューに登録した価格の扱い</h2>
                    <p className="type-jp-caption text-text-secondary">
                      メニュー管理で入力している価格が、税込か税抜かを選びます。
                    </p>
                  </div>
                  <div className="flex flex-col gap-[var(--space-8)]">
                    {MODES.map((m) => {
                      const on = draft.mode === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => update({ mode: m.value })}
                          aria-pressed={on}
                          className={`text-left rounded-[var(--radius-sm)] border px-[var(--space-16)] py-[var(--space-12)] transition-colors ${
                            on
                              ? "border-text-primary bg-bg-secondary"
                              : "border-border bg-surface-white hover:bg-bg-secondary"
                          }`}
                        >
                          <span className="flex items-center gap-[var(--space-8)]">
                            <span
                              className={`w-[18px] h-[18px] rounded-full border-2 grid place-items-center shrink-0 ${
                                on ? "border-text-primary" : "border-border"
                              }`}
                            >
                              {on && <span className="w-[8px] h-[8px] rounded-full bg-text-primary" />}
                            </span>
                            <span className="type-jp-body-bold text-text-primary">{m.title}</span>
                          </span>
                          <span className="block type-jp-caption text-text-secondary mt-[var(--space-4)] pl-[26px]">
                            {m.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* ── 税率 ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">税率</h2>
                    <p className="type-jp-caption text-text-secondary">
                      テイクアウトは軽減税率の8%、店内飲食は10%が標準です。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-[var(--space-16)]">
                    {([
                      ["店内飲食", "rateDineIn"],
                      ["テイクアウト", "rateTakeout"],
                    ] as const).map(([label, key]) => (
                      <div key={key} className="flex flex-col gap-[var(--space-4)]">
                        <label htmlFor={`tax-${key}`} className="type-jp-caption-bold text-text-primary">
                          {label}
                        </label>
                        <div className="flex items-center gap-[var(--space-8)]">
                          <input
                            id={`tax-${key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={draft[key]}
                            onChange={(e) =>
                              update({ [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } as Partial<TaxSetting>)
                            }
                            className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-en-price-m text-text-primary w-[100px]"
                          />
                          <span className="type-jp-body text-text-secondary">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── 例（設定を変えるとその場で変わる） ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">この設定だと、こうなります</h2>
                    <p className="type-jp-caption text-text-secondary">
                      メニューに <b>¥{SAMPLE.toLocaleString()}</b> と登録した商品を1つご注文いただいた場合。
                    </p>
                  </div>
                  <div className="flex flex-col gap-[var(--space-8)]">
                    {([
                      ["店内飲食", "dine_in"],
                      ["テイクアウト", "takeout"],
                    ] as const).map(([label, type]) => {
                      const p = preview(type);
                      return (
                        <div
                          key={type}
                          className="flex items-center justify-between gap-[var(--space-12)] bg-bg-secondary rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)]"
                        >
                          <span className="type-jp-caption-bold text-text-primary">{label}</span>
                          <span className="flex items-baseline gap-[var(--space-8)] flex-wrap justify-end">
                            <span className="type-jp-caption text-text-tertiary">
                              うち消費税 {p.rate}% ¥{p.tax.toLocaleString()}
                            </span>
                            <span className="type-en-price-m text-text-primary">
                              お支払い ¥{p.total.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="type-jp-caption text-text-tertiary">
                    内税では、登録した価格がそのままお支払い額になります。外税では、そこに消費税が加算されます。
                  </p>
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
                  {done && !dirty && (
                    <span className="type-jp-caption text-status-success">保存しました</span>
                  )}
                </div>

                <p className="type-jp-caption text-text-tertiary">
                  変更は、これから入るご注文に適用されます。すでに入っているご注文の金額は変わりません。
                </p>
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
