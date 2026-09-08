"use client";

/**
 * ブランドカラー設定（表示設定 > ブランドカラー タブ。Figma: 表示設定（ブランドカラー） 1505:12052 / SP 1505:12254）
 * docs/specs/brand-color.md 案A「色を選ぶ → 下でプレビュー」（2026-09-08 天真の決定）。
 *
 * 上から順に:
 *   プリセット（6色の丸） → カスタム（色の四角＝タップでカラーピッカー ＋ HEX 入力）
 *   → 読みやすさの判定 → プレビュー（この色で実際にどう見えるか） → 元に戻す / 保存する
 *
 * プレビューは本物の部品（Filter Chip・カートに入れるボタン）に、選んだ色の派生一式を
 * CSS 変数で当てて描く。判定式も派生色の計算も lib/brandColor.ts の1か所。
 * **読みにくい色を選んだときも、警告だけでなく実際の見え方をそのまま出す**（天真のメモ）。
 *
 * 保存は「保存する」でまとめて（ベストセラーと同じ）。色を1回ごとに保存すると、
 * 試している最中の色がお客様の画面に出てしまうため。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FilterChip } from "@/components/ui/FilterBar";
import { AddToCartButton } from "@/components/ui/Buttons";
import { isValidHex, normalizeHex } from "@/lib/backgroundColor";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_ACCENT,
  brandCssVars,
  derivePalette,
  readabilityOf,
} from "@/lib/brandColor";

const HEX_EXAMPLE = "#5E6B4A"; // design-qa-allow: 入力形式の例示テキスト。色としては使われない
const HEX_ERROR = `#RRGGBB の形式で入力してください（例: ${HEX_EXAMPLE}）。`;

export default function BrandColorPanel({
  saved,
  onSave,
}: {
  /** 保存されている色。null = 未設定（既定色）。undefined = 読み込み中 */
  saved: string | null | undefined;
  onSave: (hex: string | null) => Promise<void>;
}) {
  const [hex, setHex] = useState<string>(DEFAULT_BRAND_ACCENT);
  const [draft, setDraft] = useState<string>(DEFAULT_BRAND_ACCENT);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // サーバーから届いた内容で初期化する
  useEffect(() => {
    if (saved === undefined) return;
    const initial = saved ?? DEFAULT_BRAND_ACCENT;
    setHex(initial);
    setDraft(initial);
    setTouched(false);
  }, [saved]);

  const palette = useMemo(() => derivePalette(hex), [hex]);
  const readability = readabilityOf(palette);
  const dirty = (saved ?? DEFAULT_BRAND_ACCENT) !== hex;

  const choose = (next: string) => {
    setHex(next);
    setDraft(next);
    setTouched(false);
    setDone(false);
  };

  /* 入力欄はローカル状態で持つ。打っている途中は必ず不正な値を経由する（"#5" など）ので、
     正しい形になったときだけ色として採用する。 */
  const commitDraft = (raw: string) => {
    setDraft(raw);
    setTouched(true);
    const normalized = normalizeHex(raw);
    if (normalized) {
      setHex(normalized);
      setDone(false);
    }
  };
  const showError = touched && !isValidHex(draft);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(hex === DEFAULT_BRAND_ACCENT ? null : hex);
      setDone(true);
    } catch (e) {
      console.error("[BrandColorPanel] save failed:", e);
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  if (saved === undefined) {
    return (
      <div className="flex flex-col gap-[var(--space-12)] w-full">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-[44px] w-full" />
        <div className="skeleton h-[120px] w-full" />
      </div>
    );
  }

  const previewVars = brandCssVars(palette) as React.CSSProperties;

  return (
    <div className="flex flex-col gap-[var(--space-16)] w-full">
      {/* ── プリセット ── */}
      <div className="flex flex-col gap-[var(--space-8)]">
        <p className="type-jp-caption-bold text-text-primary">プリセット</p>
        <div className="flex flex-wrap gap-x-[var(--space-12)] gap-y-[var(--space-8)]">
          {BRAND_PRESETS.map((p) => {
            const selected = p.hex === hex;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(p.hex)}
                aria-pressed={selected}
                className="flex flex-col items-center gap-[var(--space-4)] w-[64px]"
              >
                <span
                  className="block w-[44px] h-[44px] rounded-full"
                  style={{
                    backgroundColor: p.hex,
                    boxShadow: selected
                      ? "0 0 0 2px var(--color-surface-white), 0 0 0 4px var(--color-text-primary)"
                      : "inset 0 0 0 1px var(--color-border-divider)",
                  }}
                />
                <span className="type-jp-label text-text-secondary text-center leading-[1.3]">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── カスタム（四角をタップするとカラーピッカー。HEX を直接入れてもOK） ── */}
      <div className="flex flex-col gap-[var(--space-8)]">
        <p className="type-jp-caption-bold text-text-primary">カスタム</p>
        <div className="flex gap-[var(--space-12)] items-end">
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            aria-label="カラーピッカーを開く"
            className="relative w-[44px] h-[44px] rounded-[var(--radius-sm)] border border-border shrink-0"
            style={{ backgroundColor: palette.primary }}
          >
            <input
              ref={pickerRef}
              type="color"
              value={palette.primary}
              onChange={(e) => choose(normalizeHex(e.target.value) ?? palette.primary)}
              aria-label="ブランドカラー（カラーピッカー）"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </button>
          <label className="flex flex-col gap-[var(--space-4)] w-[200px]">
            <span className="type-jp-label text-text-secondary">HEX</span>
            <input
              type="text"
              value={draft}
              onChange={(e) => commitDraft(e.target.value)}
              onBlur={() => {
                if (!isValidHex(draft)) { setDraft(hex); setTouched(false); }
              }}
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={HEX_EXAMPLE}
              aria-label="ブランドカラー（HEX）"
              aria-invalid={showError || undefined}
              className={`bg-surface-white border rounded-[var(--radius-sm)] h-[44px] px-[var(--space-12)] type-jp-body text-text-primary ${
                showError ? "border-status-urgent" : "border-border"
              }`}
            />
          </label>
        </div>
        <p className={`type-jp-caption ${showError ? "text-status-urgent" : "text-text-tertiary"}`}>
          {showError ? HEX_ERROR : "四角をタップするとカラーピッカーが開きます。HEX を直接入れてもOK。"}
        </p>
      </div>

      {/* ── 読みやすさ ── */}
      {readability === "ok" ? (
        <div className="bg-status-success-subtle border border-status-success rounded-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-12)]">
          <p className="type-jp-caption text-text-primary">
            ✓ {palette.contrastIsLight ? "白い" : "黒い"}文字で読みやすい色です（コントラスト {palette.contrastRatio.toFixed(1)}）
          </p>
        </div>
      ) : (
        <div className="bg-status-warning-subtle border border-status-warning rounded-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-12)]">
          <p className="type-jp-caption text-text-primary">
            ⚠ この色は文字が読みにくくなります（コントラスト {palette.contrastRatio.toFixed(1)}。目安は 4.5 以上）。下のプレビューで実際の見え方を確認してください。
          </p>
        </div>
      )}

      {/* ── プレビュー（本物の部品に、選んだ色の派生一式を当てる） ── */}
      <div
        className="bg-bg-primary border border-border rounded-[var(--radius-md)] flex flex-col gap-[var(--space-12)] p-[var(--space-12)]"
        style={previewVars}
      >
        <p className="type-jp-label text-text-tertiary">プレビュー（この色で実際にどう見えるか）</p>
        <div className="flex gap-[var(--space-8)] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <FilterChip label="すべて" selected showIcon={false} size="md" />
          <FilterChip label="カフェ" selected={false} showIcon={false} size="md" />
          <FilterChip label="ソフトドリンク" selected={false} showIcon={false} size="md" />
        </div>
        <div className="flex items-center justify-between gap-[var(--space-8)]">
          <p className="type-jp-caption-bold text-text-primary">パンケーキ プレーン　¥1,540</p>
          <AddToCartButton label="カートに入れる" onClick={() => {}} className="!w-auto px-[var(--space-20)]" />
        </div>
        <div className="bg-accent-subtle rounded-[var(--radius-sm)] flex items-center justify-between px-[var(--space-12)] py-[var(--space-8)]">
          <span className="type-jp-caption text-text-primary">合計（税込）</span>
          <span className="type-en-price-s text-text-primary">¥3,190</span>
        </div>
      </div>

      {error && (
        <div className="bg-status-urgent-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-urgent">{error}</p>
        </div>
      )}
      {done && !error && (
        <div className="bg-status-success-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full">
          <p className="type-jp-body-small text-status-success">保存しました。お客様の画面には1分ほどで反映されます。</p>
        </div>
      )}

      {/* ── 元に戻す / 保存する（PCは右寄せ、SPは横並び） ── */}
      <div className="flex gap-[var(--space-12)] justify-end w-full">
        <button
          type="button"
          onClick={() => choose(saved ?? DEFAULT_BRAND_ACCENT)}
          disabled={!dirty || saving}
          className="bg-surface-white border border-border h-[48px] rounded-[var(--radius-full)] flex-1 lg:flex-none lg:px-[var(--space-24)] type-jp-heading-s text-text-secondary disabled:opacity-40"
        >
          元に戻す
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="bg-surface-ink h-[48px] rounded-[var(--radius-full)] flex-1 lg:flex-none lg:px-[var(--space-40)] type-jp-heading-s text-text-inverse disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}
