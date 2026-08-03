"use client";

/**
 * トップページ動画1枠ぶんの設定フィールド。
 *
 * 見た目は components/admin/menu/MediaUploaderField.tsx（Figma: Form Field/Media Uploader
 * 306:1510）に合わせている ── 80×80のタイル・右上の×・破線の追加ボタン・
 * 下に置く type-jp-label の注釈。トグルは既存の components/ui/ToggleSwitch.tsx。
 * **新しい見た目は作っていない。**
 *
 * MediaUploaderField をそのまま使わないのは、あちらがラベル（「メディア（画像5枚・動画1本まで）」）と
 * 注釈を商品編集向けに内側で固定しており、スロットごとに文言を変える今回の要件に
 * 合わないため。共通コンポーネント側は変更していない。
 *
 * 圧縮 → アップロードまでをこのコンポーネントが担い、結果のURLだけ親に返す。
 * 保存（DB書き込み）と、差し替え前オブジェクトの掃除は親が行う。
 */
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { formatBytes } from "@/lib/imageCompression";
import { uploadMenuImage, uploadMenuVideo } from "@/lib/storage";
import {
  compressVideo,
  inspectVideo,
  isVideoCompressionSupported,
  validateVideo,
  type VideoFit,
} from "@/lib/videoCompression";
import type { StoreMedia, StoreMediaSlot } from "@/lib/storeMedia";

type Phase = "idle" | "inspecting" | "compressing" | "uploading";

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  inspecting: "動画を確認しています…",
  compressing: "圧縮しています…",
  uploading: "アップロードしています…",
};

/** 更新日時の表示（例: 2026/08/03 14:32） */
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function VideoSlotField({
  slot,
  label,
  hint,
  notes,
  fit,
  media,
  disabled,
  onToggle,
  onUploaded,
  onRequestDelete,
}: {
  slot: StoreMediaSlot;
  /** 枠の名前（例: 注文ホームのヒーロー動画） */
  label: string;
  /** どこに出るかの一言 */
  hint: string;
  /** 注釈テキスト。スロットごとに切り取られ方が違うので文言を変える */
  notes: string[];
  fit: VideoFit;
  media: StoreMedia;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onUploaded: (next: { url: string; posterUrl: string | null }) => void;
  onRequestDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = phase !== "idle" || !!disabled;

  const handleFile = async (file: File) => {
    setError(null);
    setNotice(null);
    setProgress(0);

    if (!isVideoCompressionSupported()) {
      setError("このブラウザでは動画を圧縮できません。Chrome または Safari の最新版でお試しください。");
      return;
    }

    try {
      setPhase("inspecting");
      const info = await inspectVideo(file);
      const invalid = validateVideo(info);
      if (invalid) {
        setError(invalid);
        setPhase("idle");
        return;
      }

      setPhase("compressing");
      const result = await compressVideo(file, {
        fit,
        onProgress: (r) => setProgress(r),
      });
      setProgress(1);

      setPhase("uploading");
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const videoUrl = await uploadMenuVideo(result.file, `top/${slot}-${stamp}.mp4`);

      let posterUrl: string | null = null;
      if (result.poster) {
        // compressImage は WebP を書き出せない環境で JPEG に落ちるので、拡張子はファイル名から取る
        const ext = result.poster.name.split(".").pop() || "webp";
        posterUrl = await uploadMenuImage(result.poster, `top/${slot}-${stamp}.${ext}`);
      }

      onUploaded({ url: videoUrl, posterUrl });

      setNotice(
        result.usedOriginal
          ? `元のファイル（${formatBytes(result.before.size)}）が十分に軽いため、そのまま使用します。`
          : `${result.before.width}×${result.before.height} → ${result.after.width}×${result.after.height} ／ ` +
            `${formatBytes(result.before.size)} → ${formatBytes(result.after.size)}` +
            `（−${Math.max(0, Math.round((1 - result.after.size / Math.max(result.before.size, 1)) * 100))}%）に圧縮しました。`
      );
      setPhase("idle");
    } catch (err) {
      // 圧縮に失敗したら止める。未圧縮のまま上げる逃げ道は用意しない
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  const hasVideo = !!media.url;

  return (
    <div className="flex flex-col gap-[var(--space-12)] items-start w-full">
      {/* ── 枠の名前 ── */}
      <div className="flex flex-col gap-[var(--space-2)] w-full">
        <p className="type-jp-caption-bold text-text-primary">{label}</p>
        <p className="type-jp-label text-text-tertiary">{hint}</p>
      </div>

      {/* ── 表示ON/OFF ── */}
      <div className="bg-bg-secondary flex items-center justify-between gap-[var(--space-12)] px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] w-full">
        <span className="type-jp-body text-text-primary">トップページに動画を表示する</span>
        <ToggleSwitch
          on={media.enabled}
          onClick={() => onToggle(!media.enabled)}
          disabled={busy}
          ariaLabel={`${label}を表示する`}
        />
      </div>

      {/* ── 動画（サムネイル + 削除） ── */}
      {hasVideo && (
        <div className="flex gap-[var(--space-8)] items-center flex-wrap">
          <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[80px]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={media.url ?? undefined}
              poster={media.posterUrl ?? undefined}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center justify-center rounded-full bg-black/40 size-[24px]">
                <div
                  className="w-0 h-0 ml-0.5"
                  style={{
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderLeft: "8px solid white",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={busy}
              aria-label="動画を削除"
              className="absolute flex items-center justify-center bg-black/55 rounded-full right-[4px] top-[4px] size-[18px] disabled:opacity-40"
            >
              <Icon name="close" className="w-2.5 h-2.5 text-white" />
            </button>
          </div>

          {media.updatedAt && (
            <p className="type-jp-label text-text-tertiary">
              最終更新: {formatUpdatedAt(media.updatedAt)}
            </p>
          )}
        </div>
      )}

      {/* ── 追加 / 差し替え ── */}
      <button
        type="button"
        onClick={() => !busy && fileRef.current?.click()}
        disabled={busy}
        className="border-[1.5px] border-border border-dashed flex flex-col h-[40px] items-center justify-center rounded-[var(--radius-sm)] w-full disabled:opacity-40"
      >
        {phase !== "idle" ? (
          <span className="w-3.5 h-3.5 border-2 border-border border-t-text-primary rounded-full animate-spin" />
        ) : (
          <p className="type-jp-caption-bold text-text-tertiary whitespace-nowrap">
            {hasVideo ? "動画を差し替える" : "＋ 動画を追加"}
          </p>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
        className="hidden"
      />

      {/* ── 進捗 ── */}
      {phase !== "idle" && (
        <div className="flex flex-col gap-[var(--space-4)] w-full">
          <div className="flex items-center justify-between">
            <span className="type-jp-label text-text-secondary">{PHASE_LABEL[phase]}</span>
            {phase === "compressing" && (
              <span className="font-en font-semibold text-[12px] leading-[1.2] text-text-secondary tabular-nums">
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          <div className="bg-bg-tertiary h-[4px] rounded-[var(--radius-full)] w-full overflow-hidden">
            <div
              className={`bg-accent-primary h-full rounded-[var(--radius-full)] transition-all ${
                phase === "compressing" ? "" : "animate-pulse"
              }`}
              style={{ width: phase === "compressing" ? `${Math.round(progress * 100)}%` : "100%" }}
            />
          </div>
          {phase === "compressing" && (
            <p className="type-jp-label text-text-tertiary">
              動画の長さと同じくらいの時間がかかります。この画面を閉じずにお待ちください。
            </p>
          )}
        </div>
      )}

      {/* ── エラー ── */}
      {error && (
        <div className="bg-status-urgent-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-urgent">{error}</p>
        </div>
      )}

      {/* ── 圧縮結果のお知らせ ── */}
      {notice && !error && (
        <div className="bg-status-success-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-success">{notice}</p>
        </div>
      )}

      {/* ── 注釈（スロットごとに文言が違う） ── */}
      <div className="type-jp-label text-text-tertiary w-full">
        {notes.map((n) => (
          <p key={n} className="leading-[1.4]">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}
