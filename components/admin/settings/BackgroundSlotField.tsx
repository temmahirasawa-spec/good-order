"use client";

/**
 * 二次元コード着地画面の背景（表示設定 > 動画設定 の2枚目のカード）。
 *
 * 動画だけだった枠に「色 / 画像 / 動画」の切り替えを足したもの。
 * 選んだタイプによって下の中身が入れ替わる。
 *
 * 文字色の自動切り替えは lib/backgroundColor.ts の1実装だけを通す。
 * ここのプレビューとお客様側（components/top/TopScreen.tsx）が同じ関数を使うので、
 * 「管理画面では白文字に見えたのに本番は黒文字」というズレが起きない。
 */
import Image from "next/image";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import MediaSlotControl from "@/components/admin/settings/MediaSlotControl";
import BackgroundColorPicker from "@/components/admin/settings/BackgroundColorPicker";
import { DEFAULT_BACKGROUND_COLOR, foregroundToneFor, normalizeHex } from "@/lib/backgroundColor";
import type { BackgroundType, StoreMedia, StoreMediaSlot } from "@/lib/storeMedia";
import type { VideoFit } from "@/lib/videoCompression";

const TYPE_TABS: { type: BackgroundType; label: string }[] = [
  { type: "color", label: "色" },
  { type: "image", label: "画像" },
  { type: "video", label: "動画" },
];

/**
 * 色を選んだときのプレビュー。
 * 「文字とロゴが自動で切り替わる」ことを、保存する前に目で確認できるようにするためのもの。
 * 寸法は動画・画像のサムネイル（SP80角 / PC 16:9・幅240px）と揃えてある。
 */
function ColorPreview({ hex }: { hex: string }) {
  const tone = foregroundToneFor(hex);
  return (
    <div
      className="relative flex flex-col gap-[var(--space-4)] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] shrink-0 w-[80px] h-[80px] lg:w-[240px] lg:h-[135px]"
      style={{ backgroundColor: hex }}
    >
      <Image
        src={tone === "dark" ? "/images/logo/logoSmallBlack.webp" : "/images/logo/logo.webp"}
        alt=""
        width={96}
        height={52}
        className="h-auto w-[48px] lg:w-[96px] object-contain"
        unoptimized
      />
      <span
        className="type-jp-label"
        style={{
          color: `var(${tone === "dark" ? "--color-text-primary" : "--color-text-inverse"})`,
        }}
      >
        TABLE A-1
      </span>
    </div>
  );
}

export default function BackgroundSlotField({
  slot,
  toggleLabel,
  notes,
  fit,
  media,
  disabled,
  onToggle,
  onChangeType,
  onChangeColor,
  onUploadedVideo,
  onUploadedImage,
  onRequestDeleteVideo,
  onRequestDeleteImage,
}: {
  slot: StoreMediaSlot;
  toggleLabel: string;
  /** 背景タイプごとの注釈。切り取られ方も注意点も違うので共通化しない */
  notes: Record<BackgroundType, string[]>;
  fit: VideoFit;
  media: StoreMedia;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onChangeType: (type: BackgroundType) => void;
  onChangeColor: (hex: string) => void;
  onUploadedVideo: (next: { url: string; posterUrl: string | null }) => void;
  onUploadedImage: (next: { url: string }) => void;
  onRequestDeleteVideo: () => void;
  onRequestDeleteImage: () => void;
}) {
  const type = media.backgroundType;
  const color = normalizeHex(media.backgroundColor ?? "") ?? DEFAULT_BACKGROUND_COLOR;

  return (
    /* 枠の名前と説明は SettingsSection のヘッダーが持っているので、ここでは繰り返さない */
    <div className="flex flex-col gap-[var(--space-12)] items-start w-full">
      {/* ── 表示ON/OFF ── */}
      <div className="bg-bg-secondary flex items-center justify-between gap-[var(--space-12)] px-[var(--space-16)] py-[var(--space-12)] rounded-[var(--radius-sm)] w-full">
        <span className="type-jp-body text-text-primary">{toggleLabel}</span>
        <ToggleSwitch
          on={media.enabled}
          onClick={() => onToggle(!media.enabled)}
          disabled={disabled}
          ariaLabel={toggleLabel}
        />
      </div>

      {/* ── 背景タイプ（セグメント） ── */}
      <div className="flex flex-col gap-[var(--space-8)] w-full">
        <p className="type-jp-caption-bold text-text-primary">背景に使うもの</p>
        <div
          role="tablist"
          aria-label="背景に使うもの"
          className="bg-bg-tertiary flex gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-full)] w-full lg:w-[380px]"
        >
          {TYPE_TABS.map((t) => {
            const active = t.type === type;
            return (
              <button
                key={t.type}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={disabled}
                onClick={() => onChangeType(t.type)}
                className={`flex-1 h-[40px] rounded-[var(--radius-full)] disabled:opacity-40 ${
                  active
                    ? "bg-surface-white type-jp-heading-s text-text-primary"
                    : "type-jp-body text-text-secondary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 選んだタイプの中身 ── */}
      {type === "color" && (
        <div className="flex flex-col gap-[var(--space-12)] w-full">
          <ColorPreview hex={color} />
          <BackgroundColorPicker value={color} disabled={disabled} onChange={onChangeColor} />
        </div>
      )}

      {type === "image" && (
        <MediaSlotControl
          kind="image"
          storagePrefix={`top/${slot}-bg`}
          url={media.imageUrl}
          updatedAt={media.updatedAt}
          disabled={disabled}
          onUploaded={({ url }) => onUploadedImage({ url })}
          onRequestDelete={onRequestDeleteImage}
        />
      )}

      {type === "video" && (
        <MediaSlotControl
          kind="video"
          storagePrefix={`top/${slot}`}
          fit={fit}
          url={media.url}
          posterUrl={media.posterUrl}
          updatedAt={media.updatedAt}
          disabled={disabled}
          onUploaded={onUploadedVideo}
          onRequestDelete={onRequestDeleteVideo}
        />
      )}

      {/* ── 注釈（タイプごとに文言が違う） ── */}
      <ul className="type-jp-label text-text-tertiary w-full list-disc pl-[1.25em] flex flex-col gap-[var(--space-2)]">
        {notes[type].map((n) => (
          <li key={n} className="leading-[1.4]">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
