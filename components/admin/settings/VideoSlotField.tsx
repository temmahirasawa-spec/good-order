"use client";

/**
 * 動画1枠ぶんの設定フィールド（表示設定 > 動画設定 の1枚目のカード＝注文ホームのヒーロー動画）。
 *
 * 見た目は components/admin/menu/MediaUploaderField.tsx（Figma: Form Field/Media Uploader
 * 306:1510）に合わせている。トグルは既存の components/ui/ToggleSwitch.tsx。
 * **新しい見た目は作っていない。**
 *
 * サムネイル・最終更新・差し替えボタン・進捗は MediaSlotControl に切り出した
 * （2枚目のカードで画像にも同じ器が要るため）。ここに残っているのは
 * 「枠の名前 ＋ 表示ON/OFF ＋ 注釈」だけ。
 */
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import MediaSlotControl from "@/components/admin/settings/MediaSlotControl";
import type { VideoFit } from "@/lib/videoCompression";
import type { StoreMedia, StoreMediaSlot } from "@/lib/storeMedia";

export default function VideoSlotField({
  slot,
  toggleLabel,
  notes,
  fit,
  media,
  disabled,
  onToggle,
  onUploaded,
  onRequestDelete,
}: {
  slot: StoreMediaSlot;
  /** トグル行の文言。どちらの画面の話かが分かるようスロットごとに変える */
  toggleLabel: string;
  /** 注釈テキスト（箇条書き）。スロットごとに切り取られ方が違うので文言を変える */
  notes: string[];
  fit: VideoFit;
  media: StoreMedia;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onUploaded: (next: { url: string; posterUrl: string | null }) => void;
  onRequestDelete: () => void;
}) {
  /* 枠の名前と説明は SettingsSection のヘッダー（「① 注文ホームのヒーロー動画」）が
     持っているので、ここでは繰り返さない。 */
  return (
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

      <MediaSlotControl
        kind="video"
        storagePrefix={`top/${slot}`}
        fit={fit}
        url={media.url}
        posterUrl={media.posterUrl}
        updatedAt={media.updatedAt}
        disabled={disabled}
        onUploaded={onUploaded}
        onRequestDelete={onRequestDelete}
      />

      {/* ── 注釈（スロットごとに文言が違う） ── */}
      <ul className="type-jp-label text-text-tertiary w-full list-disc pl-[1.25em] flex flex-col gap-[var(--space-2)]">
        {notes.map((n) => (
          <li key={n} className="leading-[1.4]">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
