"use client";

/**
 * 店舗情報の設定（サイドバー「店舗情報」）
 *
 * 2026-09-15、洋輔さんの依頼で追加。
 *   「店舗情報の画像がないが、それを設定する画面がないので、店舗情報の設定画面が必要」
 *
 * お客様の「店舗情報」モーダル（components/StoreInfoModal.tsx）に出る中身を、
 * ここから変える。空にした欄はコード側の既定値に戻る（lib/storeInfo.ts）。
 *
 * ⚠ 検索エンジン向けの構造化データ（JSON-LD）は lib/siteConfig.ts のままで、
 * ここを変えても連動しない。画面に出す情報とは別物として扱っている。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import {
  STORE_INFO_DEFAULT,
  fetchStoreInfo,
  saveStoreInfo,
  type StoreInfo,
} from "@/lib/storeInfo";
import { uploadMenuImage, deleteUploadedMedia } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import { describeDbError } from "@/lib/dbError";

const FIELDS: { key: keyof StoreInfo; label: string; hint?: string }[] = [
  { key: "name",    label: "店舗名" },
  { key: "address", label: "住所" },
  { key: "hours",   label: "営業時間", hint: "例: 11:00 - 21:00（L.O. 20:30）" },
  { key: "holiday", label: "定休日",   hint: "例: 不定休" },
  { key: "phone",   label: "電話番号" },
  { key: "mapUrl",  label: "地図のURL", hint: "「地図で見る」を押したときに開くURL" },
];

export default function StoreInfoSettingPage() {
  const [saved, setSaved]   = useState<StoreInfo | null>(null);
  const [draft, setDraft]   = useState<StoreInfo>(STORE_INFO_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /* このページで上げたが、まだ保存していない画像。保存されなければ孤児になるので消す */
  const sessionUpload = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const i = await fetchStoreInfo();
        if (cancelled) return;
        setSaved(i); setDraft(i);
      } catch (err) {
        console.error("[StoreInfoSettingPage] load failed:", err);
        if (!cancelled) setError(describeDbError(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<StoreInfo>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDone(false);
  }, []);

  const dirty = saved !== null && FIELDS.concat([{ key: "imageUrl", label: "" }])
    .some(({ key }) => draft[key] !== saved[key]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const upload = await compressImage(file).then((r) => r.file).catch(() => file);
      const ext = upload.name.split(".").pop() ?? "jpg";
      const url = await uploadMenuImage(upload, `store/${Date.now()}.${ext}`);
      const superseded = sessionUpload.current;
      sessionUpload.current = url;
      if (superseded && superseded !== url) {
        void deleteUploadedMedia([{ type: "image", url: superseded }]);
      }
      update({ imageUrl: url });
    } catch (err) {
      console.error("[StoreInfoSettingPage] upload failed:", err);
      setError(describeDbError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveStoreInfo(draft);
      setSaved(draft);
      sessionUpload.current = null;
      setDone(true);
    } catch (err) {
      console.error("[StoreInfoSettingPage] save failed:", err);
      setError(describeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title="店舗情報" count="お客様に見える店舗の案内" onMenuClick={openDrawer} />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-32)]">
            {saved === null && error === null ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-16)] max-w-[720px]">

                {/* ── 写真 ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">写真</h2>
                    <p className="type-jp-caption text-text-secondary">
                      お客様の「店舗情報」の一番上に出ます。横長（16:9 程度）がきれいに収まります。
                    </p>
                  </div>
                  <div className="relative w-full max-w-[420px] aspect-[16/9] rounded-[var(--radius-sm)] overflow-hidden bg-bg-tertiary">
                    {draft.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center type-jp-caption text-text-tertiary">
                        写真が設定されていません
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-[var(--space-12)]">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="bg-surface-white border border-border rounded-full h-[40px] px-[var(--space-20)] type-jp-caption-bold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                    >
                      {uploading ? "アップロード中…" : "写真を選ぶ"}
                    </button>
                    {draft.imageUrl !== STORE_INFO_DEFAULT.imageUrl && (
                      <button
                        type="button"
                        onClick={() => update({ imageUrl: STORE_INFO_DEFAULT.imageUrl })}
                        className="type-jp-caption text-text-secondary underline"
                      >
                        既定の写真に戻す
                      </button>
                    )}
                  </div>
                </section>

                {/* ── 文字の項目 ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-16)]">
                  {FIELDS.map(({ key, label, hint }) => (
                    <div key={key} className="flex flex-col gap-[var(--space-4)]">
                      <label htmlFor={`store-${key}`} className="type-jp-caption-bold text-text-primary">
                        {label}
                      </label>
                      <input
                        id={`store-${key}`}
                        type="text"
                        value={draft[key]}
                        onChange={(e) => update({ [key]: e.target.value } as Partial<StoreInfo>)}
                        className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary w-full"
                      />
                      {hint && <p className="type-jp-caption text-text-tertiary">{hint}</p>}
                    </div>
                  ))}
                  <p className="type-jp-caption text-text-tertiary">
                    空にすると、あらかじめ入っている内容に戻ります。
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
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
