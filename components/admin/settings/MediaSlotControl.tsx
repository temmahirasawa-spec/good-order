"use client";

/**
 * 「サムネイル ＋ 最終更新 ＋ 差し替えボタン ＋ 進捗 ＋ 結果表示」だけを担う部品。
 *
 * もとは VideoSlotField の中に直接書かれていたもの。表示設定の2枚目のカードで
 * **画像にも同じ器が要る**ようになったため、動画/画像を kind で切り替えられる形に
 * 切り出した。見た目・寸法・文言は切り出す前と同じにしてある
 * （SP 80×80 / PC 16:9・幅240px、破線の全幅ボタン、下に注釈は置かない）。
 *
 * 圧縮とアップロードまでをここが担い、結果のURLだけ呼び出し元に返す。
 * 保存（DB書き込み）と旧オブジェクトの掃除は呼び出し元のページが行う。
 */
import { useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { compressImage, formatBytes, inspectImage } from "@/lib/imageCompression";
import { uploadMenuImage, uploadMenuVideo } from "@/lib/storage";
import {
  compressVideo,
  inspectVideo,
  isVideoCompressionSupported,
  validateVideo,
  type VideoFit,
} from "@/lib/videoCompression";

type Phase = "idle" | "inspecting" | "compressing" | "uploading";

const PHASE_LABEL: Record<Exclude<Phase, "idle">, Record<"video" | "image", string>> = {
  inspecting:  { video: "動画を確認しています…",     image: "画像を確認しています…" },
  compressing: { video: "圧縮しています…",           image: "圧縮しています…" },
  uploading:   { video: "アップロードしています…",   image: "アップロードしています…" },
};

/** 更新日時の表示（例: 2026/08/03 14:32） */
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MediaSlotControl({
  kind,
  storagePrefix,
  fit,
  url,
  posterUrl,
  updatedAt,
  disabled,
  onUploaded,
  onRequestDelete,
}: {
  kind: "video" | "image";
  /** Storage 上のファイル名の接頭辞（例: top/landing_background） */
  storagePrefix: string;
  /** 動画のときだけ使う。画像は常に長辺1440pxへ縮めるだけ */
  fit?: VideoFit;
  url: string | null;
  posterUrl?: string | null;
  updatedAt: string | null;
  disabled?: boolean;
  onUploaded: (next: { url: string; posterUrl: string | null }) => void;
  onRequestDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = phase !== "idle" || !!disabled;
  const has = !!url;
  const noun = kind === "video" ? "動画" : "画像";

  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleVideo = async (file: File) => {
    if (!isVideoCompressionSupported()) {
      setError("このブラウザでは動画を圧縮できません。Chrome または Safari の最新版でお試しください。");
      return;
    }
    setPhase("inspecting");
    const info = await inspectVideo(file);
    const invalid = validateVideo(info);
    if (invalid) {
      setError(invalid);
      setPhase("idle");
      return;
    }

    setPhase("compressing");
    const result = await compressVideo(file, { fit: fit ?? "keep-aspect", onProgress: setProgress });
    setProgress(1);

    setPhase("uploading");
    const s = stamp();
    const videoUrl = await uploadMenuVideo(result.file, `${storagePrefix}-${s}.mp4`);

    let poster: string | null = null;
    if (result.poster) {
      // compressImage は WebP を書き出せない環境で JPEG に落ちるので、拡張子はファイル名から取る
      const ext = result.poster.name.split(".").pop() || "webp";
      poster = await uploadMenuImage(result.poster, `${storagePrefix}-${s}.${ext}`);
    }

    onUploaded({ url: videoUrl, posterUrl: poster });
    setNotice(
      result.usedOriginal
        ? `元のファイル（${formatBytes(result.before.size)}）が十分に軽いため、そのまま使用します。`
        : `${result.before.width}×${result.before.height} → ${result.after.width}×${result.after.height} ／ ` +
          `${formatBytes(result.before.size)} → ${formatBytes(result.after.size)}` +
          `（−${Math.max(0, Math.round((1 - result.after.size / Math.max(result.before.size, 1)) * 100))}%）に圧縮しました。`
    );
    setPhase("idle");
  };

  const handleImage = async (file: File) => {
    setPhase("inspecting");
    const info = await inspectImage(file);

    setPhase("compressing");
    /* 商品画像と同じ既定値（長辺1440px以内・300KB目標・WebP）。
       着地画面は端末いっぱいに引き伸ばされるが、上に暗幕が乗るので
       商品画像より高い解像度は要らない。 */
    const result = await compressImage(file);
    setProgress(1);

    setPhase("uploading");
    const ext = result.file.name.split(".").pop() || "webp";
    const imageUrl = await uploadMenuImage(result.file, `${storagePrefix}-${stamp()}.${ext}`);

    onUploaded({ url: imageUrl, posterUrl: null });
    setNotice(
      `${info.width}×${info.height} → ${result.after.width}×${result.after.height} ／ ` +
        `${formatBytes(result.before.size)} → ${formatBytes(result.after.size)}` +
        `（−${Math.max(0, Math.round((1 - result.after.size / Math.max(result.before.size, 1)) * 100))}%）に圧縮しました。`
    );
    setPhase("idle");
  };

  const handleFile = async (file: File) => {
    setError(null);
    setNotice(null);
    setProgress(0);
    try {
      if (kind === "video") await handleVideo(file);
      else await handleImage(file);
    } catch (err) {
      // 圧縮に失敗したら止める。未圧縮のまま上げる逃げ道は用意しない
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-12)] items-start w-full">
      {/* ── サムネイル + 削除 ──
          SPは80角（MediaUploaderFieldと揃える）。PCは実際の見え方に近づけて16:9・幅240px。 */}
      {has && (
        <div className="relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 w-[80px] h-[80px] lg:w-[240px] lg:h-[135px]">
          {kind === "video" ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={url ?? undefined}
                poster={posterUrl ?? undefined}
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center justify-center rounded-full bg-black/40 size-[24px] lg:size-[36px]">
                  <div
                    className="w-0 h-0 ml-0.5"
                    style={{
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      // design-qa-allow: 三角形を border で描くための指定。CSS変数では表現できない
                      borderLeft: "8px solid white",
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <Image src={url ?? ""} alt="" fill className="object-cover" unoptimized />
          )}
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={busy}
            aria-label={`${noun}を削除`}
            className="absolute flex items-center justify-center bg-black/55 rounded-full right-[4px] top-[4px] size-[18px] lg:size-[24px] disabled:opacity-40"
          >
            <Icon name="close" className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-text-inverse" />
          </button>
        </div>
      )}

      {/* ── 最終更新 ──
          有無にかかわらず常に出す。「一度も差し替えていない」ことも運用上の情報。 */}
      <p className="type-jp-label text-text-tertiary">
        最終更新: {updatedAt ? formatUpdatedAt(updatedAt) : "まだ変更されていません"}
      </p>

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
            {has ? `${noun}を差し替える` : `＋ ${noun}を追加`}
          </p>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={kind === "video" ? "video/mp4,video/quicktime,video/webm" : "image/*"}
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
            <span className="type-jp-label text-text-secondary">{PHASE_LABEL[phase][kind]}</span>
            {phase === "compressing" && kind === "video" && (
              <span className="font-en font-semibold text-[12px] leading-[1.2] text-text-secondary tabular-nums">
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          <div className="bg-bg-tertiary h-[4px] rounded-[var(--radius-full)] w-full overflow-hidden">
            <div
              className={`bg-accent-primary h-full rounded-[var(--radius-full)] transition-all ${
                phase === "compressing" && kind === "video" ? "" : "animate-pulse"
              }`}
              style={{
                width: phase === "compressing" && kind === "video" ? `${Math.round(progress * 100)}%` : "100%",
              }}
            />
          </div>
          {phase === "compressing" && kind === "video" && (
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
    </div>
  );
}
