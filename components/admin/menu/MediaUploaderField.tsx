"use client";

/**
 * メディア管理タイル型アップローダー（Figma: Form Field/Media Uploader 306:1510）
 * 画像最大5枚＋動画最大1本、先頭 = カバー。ドラッグハンドルの代わりにタイル自体を
 * ドラッグして並び替え（既存のドラッグ&ドロップ機能を踏襲）。タッチ端末向けに
 * 前後移動ボタンも残す（Figmaのモックには無いが、既存機能なので視覚差し替えでは
 * 削除しない）。
 *
 * 追加はFigma通り単一の「＋追加」タイルのみ。ファイル種別（image/video）は
 * 選択されたファイルのMIMEタイプから自動判別し、既存の画像/動画それぞれの
 * アップロード・圧縮確認フローへ振り分ける（呼び出し元の onAddFile が担当）。
 */
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ApiMediaItem } from "@/lib/api";

export default function MediaUploaderField({
  media,
  imageCount,
  videoCount,
  maxImages,
  maxVideos,
  uploading,
  onAddFile,
  onRemove,
  onMove,
}: {
  media: ApiMediaItem[];
  imageCount: number;
  videoCount: number;
  maxImages: number;
  maxVideos: number;
  uploading: boolean;
  onAddFile: (file: File) => void;
  onRemove: (idx: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const addDisabled = uploading || (imageCount >= maxImages && videoCount >= maxVideos);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onAddFile(file);
  };

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) setDragOverIdx(idx);
  };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    if (from === null || from === idx) return;
    onMove(from, idx);
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)] items-start w-full">
      <p className="type-jp-caption-bold text-text-primary whitespace-nowrap">
        メディア（画像{maxImages}枚・動画{maxVideos}本まで）
      </p>

      <div className="flex flex-col gap-[var(--space-8)] items-start w-full">
        <div className="flex gap-[var(--space-8)] items-center flex-wrap">
          {media.map((m, idx) => {
            const isCover = idx === 0;
            const isDragTarget = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
            return (
              <div
                key={`${m.type}-${m.url}-${idx}`}
                draggable
                onDragStart={onDragStart(idx)}
                onDragOver={onDragOver(idx)}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={onDrop(idx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`relative bg-bg-tertiary rounded-[var(--radius-sm)] overflow-hidden shrink-0 size-[80px] cursor-grab active:cursor-grabbing ${
                  dragIdx === idx ? "opacity-50" : ""
                } ${isDragTarget ? "ring-2 ring-accent-primary" : ""}`}
              >
                {m.type === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={m.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}

                {m.type === "video" && (
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
                )}

                {isCover && (
                  <div className="absolute bg-surface-ink flex items-start left-[4px] top-[4px] px-[var(--space-8)] py-[var(--space-2)] rounded-[var(--radius-xs)]">
                    <p className="type-jp-micro-label text-text-inverse whitespace-nowrap">
                      カバー
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  aria-label="削除"
                  className="absolute flex items-center justify-center bg-black/55 rounded-full right-[4px] top-[4px] size-[18px]"
                >
                  <Icon name="close" className="w-2.5 h-2.5 text-white" />
                </button>

                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onMove(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label="前へ移動"
                      className="absolute flex items-center justify-center bg-black/55 rounded-full left-[4px] bottom-[4px] size-[18px] disabled:opacity-0"
                    >
                      <Icon name="arrow-left" className="w-2.5 h-2.5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(idx, idx + 1)}
                      disabled={idx === media.length - 1}
                      aria-label="次へ移動"
                      className="absolute flex items-center justify-center bg-black/55 rounded-full right-[4px] bottom-[4px] size-[18px] disabled:opacity-0"
                    >
                      <Icon name="arrow-left" className="w-2.5 h-2.5 text-white rotate-180" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => !addDisabled && fileRef.current?.click()}
          disabled={addDisabled}
          className="border-[1.5px] border-border border-dashed flex flex-col h-[40px] items-center justify-center rounded-[var(--radius-sm)] w-full disabled:opacity-40"
        >
          {uploading ? (
            <span className="w-3.5 h-3.5 border-2 border-border border-t-text-primary rounded-full animate-spin" />
          ) : (
            <p className="type-jp-caption-bold text-text-tertiary whitespace-nowrap">＋追加</p>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="type-jp-label text-text-tertiary w-full">
        <p className="leading-[1.4]">画像は最大{maxImages}枚、動画は{maxVideos}本まで（mp4/mov/webm、50MBまで）。</p>
        <p className="leading-[1.4]">動画は16:9推奨・9:16の縦動画にも対応しています。</p>
      </div>
    </div>
  );
}
