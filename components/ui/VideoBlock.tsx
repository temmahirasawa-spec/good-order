"use client";

/**
 * 動画ブロック（Figma: Video / 16:9 48:21、Video / 9:16 86:528）
 * - 16:9: 390×219 相当（w-full aspect-video、角丸なし）
 * - 9:16: 342×608 相当（画面幅390で左右24pxマージン、角丸12px）
 * 自動再生・ミュート・ループ（音声なし）。タップで一時停止/再開はできる
 * （一時停止中のみ中央に再生ボタンを表示）。
 */
import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/menu";

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VideoBlock({
  media,
  frameClassName,
  className = "",
}: {
  media: MediaItem[];
  frameClassName: string;
  className?: string;
}) {
  const video = media.find((m) => m.type === "video");
  const poster = media.find((m) => m.type === "image")?.url;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [duration, setDuration] = useState("");

  // Reactの`muted`属性は稀にDOM要素の muted プロパティへ確実に反映されず
  // （React DOM の既知の挙動）、ブラウザの自動再生ポリシーに弾かれることがある。
  // ref経由で明示的に muted を立ててから play() を呼び、宣言的な autoPlay に頼らない。
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.play().catch(() => {});
  }, [video?.url]);

  if (!video) return null;

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  return (
    <div
      className={`relative bg-bg-tertiary overflow-hidden cursor-pointer ${frameClassName} ${className}`}
      onClick={toggle}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={video.url}
        poster={poster}
        preload="auto"
        autoPlay
        playsInline
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedMetadata={(e) => setDuration(formatDuration(e.currentTarget.duration))}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* 一時停止中のみ中央に再生ボタンを表示 */}
      {!playing && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-[56px] h-[56px] rounded-full bg-surface-white"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 ml-[2px]">
            <path d="M4.5 2.5L13 8L4.5 13.5V2.5Z" fill="var(--color-text-primary)" />
          </svg>
        </span>
      )}

      {/* 右下: 再生時間バッジ（一時停止中のみ） */}
      {!playing && duration && (
        <span className="absolute right-[8px] bottom-[8px] bg-black/60 rounded-[4px] px-[6px] py-[2px] font-en font-medium text-[11px] leading-normal text-text-inverse tabular-nums">
          {duration}
        </span>
      )}
    </div>
  );
}

export function Video16x9({ media, className = "" }: { media: MediaItem[]; className?: string }) {
  return <VideoBlock media={media} frameClassName="w-full aspect-video" className={className} />;
}

export function Video9x16({ media, className = "" }: { media: MediaItem[]; className?: string }) {
  return (
    <VideoBlock
      media={media}
      frameClassName="w-full aspect-[9/16] rounded-[var(--radius-md)]"
      className={className}
    />
  );
}
