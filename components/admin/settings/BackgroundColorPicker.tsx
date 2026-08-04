"use client";

/**
 * 着地画面の背景色を選ぶパレット（表示設定 > 動画設定 > 背景に使うもの＝色）。
 *
 * 20色のスウォッチ ＋ カスタムHEX入力。既存の components/admin/category/ColorSwatchPicker は
 * カテゴリのタグ色（tag/* の10色から選ぶ）専用で、カスタム入力も暗い色の選択リングも
 * 持っていないため、そのままでは使えない。**見た目の作法（丸角の四角を並べ、選択中を
 * 内側のリングで示す）はそちらに合わせている。**
 *
 * 色そのものと文字色の判定式は lib/backgroundColor.ts にある（お客様側と共有）。
 */
import { useEffect, useState } from "react";
import {
  BACKGROUND_SWATCHES,
  foregroundToneFor,
  isValidHex,
  normalizeHex,
} from "@/lib/backgroundColor";

/* 入力形式を示すための例示。**色として描画される値ではない**ので、
   デザイントークンではなくリテラルで持つ。 */
const HEX_EXAMPLE = "#2C2A28"; // design-qa-allow: 入力形式の例示テキスト。色としては使われない
const HEX_ERROR = `#RRGGBB の形式で入力してください（例: ${HEX_EXAMPLE}）。正しい形になるまで背景色は変わりません。`;

/** 選択中のスウォッチに引く内側リング。明るい色の上では墨、暗い色の上では白 */
function selectedRing(hex: string): string {
  const tone = foregroundToneFor(hex);
  return `inset 0 0 0 2.5px var(${tone === "dark" ? "--color-text-primary" : "--color-surface-white"})`;
}

export default function BackgroundColorPicker({
  value,
  disabled,
  onChange,
}: {
  /** 現在の色（#RRGGBB） */
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const isPreset = BACKGROUND_SWATCHES.some((s) => s.hex === value);

  /* 入力欄はローカル状態で持つ。打っている途中は必ず不正な値を経由する（"#2" など）ので、
     1文字ごとに保存すると着地画面の色が壊れる。**正しい形になったときだけ onChange を呼ぶ。** */
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);

  // 親（＝スウォッチ選択）で色が変わったら入力欄も追従させる
  useEffect(() => {
    setDraft(value);
    setTouched(false);
  }, [value]);

  const draftValid = isValidHex(draft);
  const showError = touched && !draftValid;
  // プレビュー用。不正な間は最後に確定した色を出しておく（枠が黒く割れないように）
  const customPreview = draftValid ? (normalizeHex(draft) as string) : value;

  const commit = (raw: string) => {
    setDraft(raw);
    setTouched(true);
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)] w-full">
      <p className="type-jp-caption-bold text-text-primary">色を選ぶ</p>

      {/* SP 5列 / PC 10列。高さ44pxはタップ領域の下限（--size-touch-min）に合わせている */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-[var(--space-8)] w-full">
        {BACKGROUND_SWATCHES.map((sw) => {
          const selected = sw.hex === value;
          return (
            <button
              key={sw.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(sw.hex)}
              aria-label={sw.label}
              aria-pressed={selected}
              className="h-[44px] rounded-[var(--radius-sm)] w-full disabled:opacity-40"
              style={{
                backgroundColor: sw.hex,
                boxShadow: selected
                  ? selectedRing(sw.hex)
                  : "inset 0 0 0 1px var(--color-border-divider)",
              }}
            />
          );
        })}
      </div>

      {/* ── カスタム ── */}
      <div className="flex gap-[var(--space-8)] items-center w-full">
        <span
          aria-hidden
          className="h-[44px] rounded-[var(--radius-sm)] shrink-0 w-[44px]"
          style={{
            backgroundColor: customPreview,
            boxShadow: !isPreset
              ? selectedRing(customPreview)
              : "inset 0 0 0 1px var(--color-border-divider)",
          }}
        />
        <input
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            // 不正なまま離れたら、最後に確定している色に戻す（中途半端な文字列を残さない）
            if (!isValidHex(draft)) {
              setDraft(value);
              setTouched(false);
            }
          }}
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={HEX_EXAMPLE}
          aria-label="背景色（HEX）"
          aria-invalid={showError || undefined}
          className={`bg-surface-white border rounded-[var(--radius-sm)] flex-1 h-[44px] min-w-0 px-[var(--space-12)] type-jp-body text-text-primary disabled:opacity-40 ${
            showError ? "border-status-urgent" : "border-border"
          }`}
        />
      </div>

      {showError ? (
        <p className="type-jp-label text-status-urgent">{HEX_ERROR}</p>
      ) : (
        <p className="type-jp-label text-text-tertiary">カスタム（HEXで指定）</p>
      )}
    </div>
  );
}
