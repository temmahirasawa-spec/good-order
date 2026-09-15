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
import { Icon } from "@/components/Icon";
import {
  STORE_INFO_DEFAULT,
  STORE_INFO_ICONS,
  fetchStoreInfo,
  saveStoreInfo,
  searchPlaces,
  mapUrlForPlace,
  type StoreInfo,
  type StoreInfoRow,
  type PlaceCandidate,
} from "@/lib/storeInfo";
import { uploadMenuImage, deleteUploadedMedia } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import { describeDbError } from "@/lib/dbError";

/** 「項目を追加」で出す候補。よく使うものを先に並べる */
const PRESETS: StoreInfoRow[] = [
  { label: "住所",       value: "", icon: "map-pin" },
  { label: "営業時間",   value: "", icon: "clock" },
  { label: "定休日",     value: "", icon: "clock" },
  { label: "電話番号",   value: "", icon: "phone" },
  { label: "お支払い方法", value: "", icon: "card" },
];
const MAX_ROWS = 12;

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

  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  /* ── 項目の追加・削除・並べ替え（天真の指示 2026-09-15）──
     それまで4項目が固定で、空にすると既定値に戻る＝「載せない」ができなかった */
  const patchRow = (i: number, p: Partial<StoreInfoRow>) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, ...p } : r)) }));
  const moveRow = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.rows.length) return;
    setDraft((d) => {
      const rows = [...d.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...d, rows };
    });
    setDone(false);
  };
  const removeRow = (i: number) =>
    setDraft((d) => ({ ...d, rows: d.rows.filter((_, k) => k !== i) }));
  const addRow = (preset?: StoreInfoRow) =>
    setDraft((d) =>
      d.rows.length >= MAX_ROWS
        ? d
        : { ...d, rows: [...d.rows, preset ?? { label: "", value: "", icon: "list" }] }
    );

  /* ── 店名から Google の候補を探す（lib/storeInfo.ts の searchPlaces）── */
  const [candidates, setCandidates] = useState<PlaceCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [placesOff, setPlacesOff] = useState(false);

  const runSearch = async () => {
    const q = draft.name.trim();
    if (!q) return;
    setSearching(true); setError(null);
    try {
      const list = await searchPlaces(q);
      if (list === null) { setPlacesOff(true); setCandidates(null); return; }
      setCandidates(list);
    } catch (err) {
      console.error("[StoreInfoSettingPage] places search failed:", err);
      setError("店舗の検索に失敗しました。時間をおいて試すか、手で入力してください。");
    } finally {
      setSearching(false);
    }
  };

  /** 候補を選ぶと、地図のURLと住所を入れる */
  const applyCandidate = (c: PlaceCandidate) => {
    setDraft((d) => {
      const rows = [...d.rows];
      const i = rows.findIndex((r) => r.label.includes("住所"));
      if (i >= 0) rows[i] = { ...rows[i], value: c.address };
      else rows.unshift({ label: "住所", value: c.address, icon: "map-pin" });
      return { ...d, name: c.name || d.name, mapUrl: mapUrlForPlace(c.placeId), rows };
    });
    setCandidates(null);
    setDone(false);
  };

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

                {/* ── 店舗名（ここから地図のURLが自動で入る） ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">店舗名</h2>
                    <p className="type-jp-caption text-text-secondary">
                      店舗名を入れて「Googleで探す」を押すと、候補から<b>住所と地図のURLが自動で入ります</b>。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-[var(--space-12)]">
                    <div className="flex flex-col gap-[var(--space-4)] flex-1 min-w-[220px]">
                      <label htmlFor="store-name" className="type-jp-caption-bold text-text-primary">店舗名</label>
                      <input
                        id="store-name"
                        type="text"
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={runSearch}
                      disabled={searching || !draft.name.trim()}
                      className="bg-surface-white border border-border rounded-full h-[44px] px-[var(--space-20)] type-jp-caption-bold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                    >
                      {searching ? "探しています…" : "Googleで探す"}
                    </button>
                  </div>

                  {placesOff && (
                    <p className="type-jp-caption text-text-tertiary">
                      この機能はまだ設定されていません。地図のURLは下の欄に直接入力できます。
                    </p>
                  )}
                  {candidates !== null && candidates.length === 0 && (
                    <p className="type-jp-caption text-text-tertiary">見つかりませんでした。店舗名を変えて試してください。</p>
                  )}
                  {candidates !== null && candidates.length > 0 && (
                    <div className="flex flex-col gap-[var(--space-8)]">
                      <p className="type-jp-caption-bold text-text-primary">候補（選ぶと住所と地図が入ります）</p>
                      {candidates.map((c) => (
                        <button
                          key={c.placeId}
                          type="button"
                          onClick={() => applyCandidate(c)}
                          className="text-left bg-bg-secondary border border-border rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] hover:bg-bg-tertiary"
                        >
                          <span className="block type-jp-body-bold text-text-primary">{c.name}</span>
                          <span className="block type-jp-caption text-text-secondary">{c.address}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-[var(--space-4)]">
                    <label htmlFor="store-map" className="type-jp-caption-bold text-text-primary">地図のURL</label>
                    <input
                      id="store-map"
                      type="text"
                      value={draft.mapUrl}
                      onChange={(e) => update({ mapUrl: e.target.value })}
                      className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary w-full"
                    />
                    <p className="type-jp-caption text-text-tertiary">「地図で見る」を押したときに開きます。上の検索で自動で入ります。</p>
                  </div>
                </section>

                {/* ── 載せる項目（追加・削除・並べ替え） ── */}
                <section className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] lg:px-[var(--space-20)] py-[var(--space-16)] flex flex-col gap-[var(--space-12)]">
                  <div className="flex flex-col gap-[var(--space-4)]">
                    <h2 className="type-jp-body-bold text-text-primary">載せる項目</h2>
                    <p className="type-jp-caption text-text-secondary">
                      お客様の「店舗情報」に、この順番で並びます。<b>使わない項目は削除してください。</b>
                    </p>
                  </div>

                  {draft.rows.length === 0 && (
                    <p className="type-jp-caption text-text-tertiary">
                      項目がありません。下から追加できます（何も載せない、という選び方もできます）。
                    </p>
                  )}

                  {draft.rows.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-[var(--space-12)] bg-bg-secondary rounded-[var(--radius-sm)] border border-border px-[var(--space-12)] py-[var(--space-12)]"
                    >
                      <div className="flex flex-col gap-[var(--space-4)] shrink-0">
                        <button
                          type="button" onClick={() => moveRow(i, -1)} disabled={i === 0}
                          aria-label="1つ上へ"
                          className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface-white grid place-items-center disabled:opacity-30"
                        >
                          <Icon name="chevron-up" className="w-4 h-4 text-text-secondary" />
                        </button>
                        <button
                          type="button" onClick={() => moveRow(i, 1)} disabled={i === draft.rows.length - 1}
                          aria-label="1つ下へ"
                          className="w-[32px] h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface-white grid place-items-center disabled:opacity-30"
                        >
                          <Icon name="chevron-down" className="w-4 h-4 text-text-secondary" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-8)]">
                        <div className="flex flex-wrap gap-[var(--space-8)]">
                          <input
                            type="text"
                            value={row.label}
                            maxLength={20}
                            placeholder="項目名（例: 営業時間）"
                            onChange={(e) => { patchRow(i, { label: e.target.value }); setDone(false); }}
                            className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary w-[180px]"
                          />
                          <input
                            type="text"
                            value={row.value}
                            maxLength={200}
                            placeholder="内容"
                            onChange={(e) => { patchRow(i, { value: e.target.value }); setDone(false); }}
                            className="bg-surface-white border border-border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary flex-1 min-w-[180px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-[var(--space-8)]">
                          {STORE_INFO_ICONS.map((ic) => {
                            const on = row.icon === ic.value;
                            return (
                              <button
                                key={ic.value}
                                type="button"
                                onClick={() => { patchRow(i, { icon: ic.value }); setDone(false); }}
                                aria-pressed={on}
                                aria-label={ic.label}
                                className={`w-[40px] h-[40px] rounded-[var(--radius-sm)] border grid place-items-center bg-surface-white ${
                                  on ? "border-text-primary" : "border-border"
                                }`}
                              >
                                <Icon name={ic.value} className={`w-5 h-5 ${on ? "text-text-primary" : "text-text-secondary"}`} />
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => { removeRow(i); setDone(false); }}
                            className="ml-auto type-jp-caption text-status-urgent"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-[var(--space-8)]">
                    {PRESETS.filter((p) => !draft.rows.some((r) => r.label === p.label)).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { addRow(p); setDone(false); }}
                        disabled={draft.rows.length >= MAX_ROWS}
                        className="bg-surface-white border border-border rounded-full h-[40px] px-[var(--space-16)] type-jp-caption-bold text-text-primary hover:bg-bg-secondary disabled:opacity-40"
                      >
                        ＋ {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { addRow(); setDone(false); }}
                      disabled={draft.rows.length >= MAX_ROWS}
                      className="bg-surface-white border border-border border-dashed rounded-full h-[40px] px-[var(--space-16)] type-jp-caption-bold text-text-secondary hover:bg-bg-secondary disabled:opacity-40"
                    >
                      ＋ 自由に追加
                    </button>
                  </div>
                  {draft.rows.length >= MAX_ROWS && (
                    <p className="type-jp-caption text-text-tertiary">項目は{MAX_ROWS}個までです。</p>
                  )}
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
