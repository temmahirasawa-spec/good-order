"use client";

/**
 * 機能設定（表示設定 ＞ 機能設定）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「厨房にiPadを置かないことになったので、厨房の画面を一旦使わないようにできますか？」
 *   「それに伴い『スタッフを呼ぶ』も一旦なくしてもらって」
 *
 * **消すのではなく切る。** あとから戻せることが前提。lib/features.ts
 */
import { useCallback, useEffect, useState } from "react";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import StaffCallSettingsModal from "@/components/admin/display/StaffCallSettingsModal";
import {
  FEATURES_DEFAULT,
  fetchFeatureToggles,
  saveFeatureToggles,
  type FeatureToggles,
} from "@/lib/features";
import { describeDbError } from "@/lib/dbError";

const ROWS: { key: keyof FeatureToggles; title: string; desc: string }[] = [
  {
    key: "kitchen",
    title: "厨房の画面を使う",
    desc: "オフにすると、サイドバーから「厨房」が消えます。厨房伝票の印刷・レジ・テイクアウトの受渡は、オフでも今までどおり動きます。",
  },
  {
    key: "staffCall",
    title: "スタッフを呼ぶ（お客様側）",
    desc: "オフにすると、お客様の画面から「スタッフを呼ぶ」の入口がすべて消えます（メニュー内の項目と、画面右下のベル）。",
  },
];

export default function FeaturePanel() {
  const [saved, setSaved]   = useState<FeatureToggles | null>(null);
  const [draft, setDraft]   = useState<FeatureToggles>(FEATURES_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  /* 呼び出しの中身（文言・アイコン・並び）はポップアップで設定する。
     ON/OFF はここ、詳細はモーダル、と役割を分ける（天真の指示 2026-09-15） */
  const [staffCallModal, setStaffCallModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const f = await fetchFeatureToggles();
        if (cancelled) return;
        setSaved(f); setDraft(f);
      } catch (err) {
        console.error("[FeaturePanel] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((key: keyof FeatureToggles) => {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
    setDone(false);
  }, []);

  const dirty = saved !== null && ROWS.some(({ key }) => draft[key] !== saved[key]);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveFeatureToggles(draft);
      setSaved(draft);
      setDone(true);
    } catch (err) {
      console.error("[FeaturePanel] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  if (saved === null && error === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-16)]">
      {ROWS.map(({ key, title, desc }) => (
        <div
          key={key}
          className="flex flex-col gap-[var(--space-12)] bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)]"
        >
          <div className="flex items-center justify-between gap-[var(--space-16)]">
            <div className="flex flex-col gap-[var(--space-4)] min-w-0">
              <p className="type-jp-body-bold text-text-primary">{title}</p>
              <p className="type-jp-caption text-text-secondary">{desc}</p>
            </div>
            <ToggleSwitch on={draft[key]} onClick={() => toggle(key)} ariaLabel={title} />
          </div>

          {/* 使うときだけ、中身の設定へ入れるようにする。
              使わないのに設定だけできても迷うので、OFF のときは出さない */}
          {key === "staffCall" && draft.staffCall && (
            <button
              type="button"
              onClick={() => setStaffCallModal(true)}
              className="self-start bg-surface-white border border-border rounded-full h-[40px] px-[var(--space-20)] type-jp-caption-bold text-text-primary hover:bg-bg-secondary"
            >
              設定する
            </button>
          )}
        </div>
      ))}

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
        オフにしても設定や過去のデータは消えません。いつでも戻せます。
      </p>

      {staffCallModal && <StaffCallSettingsModal onClose={() => setStaffCallModal(false)} />}
    </div>
  );
}
