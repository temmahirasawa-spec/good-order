"use client";

/**
 * 店舗設定。
 *
 * 今回入るのは「トップページ」セクション（お客様側2か所の動画）だけ。
 * 受注停止・営業時間などは未実装だが、SettingsSection を縦に足すだけで
 * 増やせる構造にしてある。
 *
 * 保存は操作のたびに即時（＝明示的な「保存」ボタンは置かない）。
 * トグルは楽観的更新で、失敗したときだけ元に戻す（CLAUDE.md 4章）。
 * 動画の差し替えは「アップロード完了 → RPC 1回」で切り替わるので、
 * 差し替え途中の状態がお客様側に出ることはない。
 */
import { useEffect, useState } from "react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import SettingsSection from "@/components/admin/settings/SettingsSection";
import VideoSlotField from "@/components/admin/settings/VideoSlotField";
import {
  fetchStoreMedia,
  saveStoreMedia,
  type StoreMedia,
  type StoreMediaMap,
  type StoreMediaSlot,
} from "@/lib/storeMedia";
import { deleteUploadedMedia, type UploadedMedia } from "@/lib/storage";
import type { VideoFit } from "@/lib/videoCompression";

/* ── スロットごとの見出しと注釈 ──────────────────────────────
   2か所で切り取られ方が違うので、注釈は同じ文言を使わない。
   /order は16:9の枠に object-cover（components/ui/VideoBlock.tsx）、
   / は画面全体に object-cover（components/top/TopScreen.tsx）。 */
const SLOT_CONFIG: {
  slot: StoreMediaSlot;
  label: string;
  hint: string;
  fit: VideoFit;
  notes: string[];
}[] = [
  {
    slot: "order_hero",
    label: "注文ホームのヒーロー動画",
    hint: "メニュー一覧の先頭に、横長の帯として出ます。",
    fit: "cover-16x9",
    notes: [
      "16:9（横長）に自動でトリミングされます。上下が切れないよう、16:9で書き出した動画をアップロードしてください。",
      "推奨: 1920×1080・15秒以内・mp4。音声は再生されません。",
      "アップロードした動画は自動的に圧縮されます（最大1280×720・mp4）。元のファイルは保存されません。",
    ],
  },
  {
    slot: "landing_background",
    label: "二次元コード着地画面の背景動画",
    hint: "お客様が二次元コードを読み取って最初に開く画面の、背景いっぱいに出ます。",
    fit: "keep-aspect",
    notes: [
      "お客様の端末の画面いっぱいに敷かれます。画面の縦横比に合わせて拡大されるため、上下または左右が大きく切れます。見せたいものは中央に寄せてください。",
      "推奨: 縦長（9:16）・15秒以内・mp4。上に白い文字とロゴが重なるので、暗めの映像が向いています。音声は再生されません。",
      "アップロードした動画は自動的に圧縮されます（長辺1280px以内・mp4）。縦横比は元のまま保たれます。元のファイルは保存されません。",
    ],
  },
];

export default function SettingsPage() {
  const [mediaMap, setMediaMap] = useState<StoreMediaMap | null>(null);
  const [savingSlot, setSavingSlot] = useState<StoreMediaSlot | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreMediaSlot | null>(null);

  useEffect(() => {
    void (async () => setMediaMap(await fetchStoreMedia()))();
  }, []);

  /**
   * 1スロットを保存する。
   * @param orphanOnFailure 保存に失敗したときに掃除する、直前にアップロードしたオブジェクト
   */
  const persist = async (
    slot: StoreMediaSlot,
    next: Pick<StoreMedia, "enabled" | "url" | "posterUrl">,
    orphanOnFailure: UploadedMedia[] = []
  ) => {
    if (!mediaMap) return;
    const prev = mediaMap[slot];

    // 楽観的更新：先にローカルを書き換える
    setSaveError(null);
    setMediaMap((m) =>
      m ? { ...m, [slot]: { ...next, updatedAt: new Date().toISOString() } } : m
    );
    setSavingSlot(slot);

    try {
      await saveStoreMedia(slot, next);

      /* 保存が通ってから、参照されなくなった旧オブジェクトを消す。
         先に消すと、保存に失敗したときお客様側が見ているURLが死ぬ。
         public/ 配下の相対パス（初期データ）は Storage に無いので
         deleteUploadedMedia 側で自動的に対象外になる。 */
      const stale: UploadedMedia[] = [];
      if (prev.url && prev.url !== next.url) stale.push({ type: "video", url: prev.url });
      if (prev.posterUrl && prev.posterUrl !== next.posterUrl) {
        stale.push({ type: "image", url: prev.posterUrl });
      }
      if (stale.length > 0) void deleteUploadedMedia(stale);
    } catch (err) {
      // ロールバック
      setMediaMap((m) => (m ? { ...m, [slot]: prev } : m));
      setSaveError(
        "保存できませんでした。通信環境をご確認のうえ、もう一度お試しください。"
      );
      console.error("[settings] save failed:", err);
      if (orphanOnFailure.length > 0) void deleteUploadedMedia(orphanOnFailure);
    } finally {
      setSavingSlot(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !mediaMap) return;
    const slot = deleteTarget;
    setDeleteTarget(null);
    await persist(slot, { enabled: mediaMap[slot].enabled, url: null, posterUrl: null });
  };

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title="店舗設定" onMenuClick={openDrawer} />

          <main className="flex-1 overflow-y-auto bg-bg-secondary">
            <div className="flex flex-col gap-[var(--space-16)] px-[var(--space-16)] lg:px-[var(--space-24)] py-[var(--space-20)] lg:py-[var(--space-24)] max-w-[720px]">
              {saveError && (
                <div className="bg-status-urgent-subtle rounded-[var(--radius-lg)] px-[var(--space-20)] py-[var(--space-16)] type-jp-body text-status-urgent">
                  {saveError}
                </div>
              )}

              <SettingsSection
                title="トップページ"
                description="お客様が最初に見る2つの画面の動画を差し替えます。動画を消したいだけのときは、削除ではなく表示のオフをお使いください。"
              >
                {!mediaMap ? (
                  <div className="flex flex-col gap-[var(--space-12)] w-full">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-[48px] w-full" />
                    <div className="skeleton h-[80px] w-[80px]" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-[var(--space-32)] w-full">
                    {SLOT_CONFIG.map((cfg) => (
                      <VideoSlotField
                        key={cfg.slot}
                        slot={cfg.slot}
                        label={cfg.label}
                        hint={cfg.hint}
                        notes={cfg.notes}
                        fit={cfg.fit}
                        media={mediaMap[cfg.slot]}
                        disabled={savingSlot !== null}
                        onToggle={(enabled) =>
                          void persist(cfg.slot, {
                            enabled,
                            url: mediaMap[cfg.slot].url,
                            posterUrl: mediaMap[cfg.slot].posterUrl,
                          })
                        }
                        onUploaded={({ url, posterUrl }) =>
                          void persist(
                            cfg.slot,
                            { enabled: mediaMap[cfg.slot].enabled, url, posterUrl },
                            [
                              { type: "video", url },
                              ...(posterUrl ? [{ type: "image" as const, url: posterUrl }] : []),
                            ]
                          )
                        }
                        onRequestDelete={() => setDeleteTarget(cfg.slot)}
                      />
                    ))}
                  </div>
                )}
              </SettingsSection>
            </div>
          </main>

          {/* ── 削除確認ダイアログ（メニュー管理の削除確認と同じ器） ── */}
          {deleteTarget && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[var(--space-16)]"
              onClick={() => setDeleteTarget(null)}
            >
              <div
                className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
                style={{ boxShadow: "var(--shadow-float)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
                  <p className="type-jp-heading-m text-text-primary w-full">動画を削除しますか？</p>
                  <p className="type-jp-body-small text-text-secondary w-full">
                    削除するとトップページから動画が消えます。この操作は取り消せません。
                    <br />
                    一時的に隠したいだけの場合は、「トップページに動画を表示する」をオフにしてください。
                  </p>
                </div>
                <div className="flex gap-[var(--space-12)] items-start w-full">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 border border-border py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-secondary"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={savingSlot !== null}
                    className="flex-1 bg-status-urgent disabled:opacity-50 py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
                  >
                    削除する
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AdminPageShell>
  );
}
