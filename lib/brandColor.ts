/**
 * ブランドカラー（お客様画面のアクセント色）。
 *
 * DB（stores.brand_accent、supabase/store_brand_accent.sql）に持つのは1色（#RRGGBB）だけ。
 * 押した時の色・濃い色・薄い地・墨の上の色と、アクセントの上に載せる文字色（白か墨か）は
 * ここで HEX から計算する。**管理画面のプレビューとお客様画面の両方がここを参照する**ので、
 * 計算式は必ずこのファイルだけに置く（2か所に分かれるとプレビューと実物がずれる）。
 *
 * 色そのものはデザイントークンではなく「店舗が選ぶ値」なのでリテラルで持つ
 * （lib/backgroundColor.ts と同じ考え方）。
 * design-qa-allow: 店舗が選ぶブランドカラーの選択肢と、その計算に使う定数。テーマ変数に紐づけない
 */
import { supabase } from "./supabase";
import { STORE_ID } from "./api";
import { normalizeHex, relativeLuminance } from "./backgroundColor";

/** 既定のブランドカラー（design-tokens.css の --color-accent-primary と同じ値）。
 *  DB が NULL のときはこれ。 */
export const DEFAULT_BRAND_ACCENT = "#5E6B4A"; // design-qa-allow: --color-accent-primary と同値。既定値として数値で持つ

export interface BrandPreset {
  id: string;
  label: string;
  hex: string;
}

/** 管理画面「表示設定 ＞ ブランドカラー」のプリセット */
export const BRAND_PRESETS: BrandPreset[] = [
  { id: "moss",   label: "オリーブモス",   hex: "#5E6B4A" }, // design-qa-allow: 店舗が選ぶブランドカラーの選択肢
  { id: "yellow", label: "YORKYS イエロー", hex: "#FAC03D" }, // design-qa-allow: 同上（2026-09-08 までの既定色）
  { id: "forest", label: "フォレスト",     hex: "#2E8A36" }, // design-qa-allow: 同上
  { id: "lime",   label: "ライム",         hex: "#CBFA3D" }, // design-qa-allow: 同上
  { id: "red",    label: "居酒屋レッド",   hex: "#C4302A" }, // design-qa-allow: 同上
  { id: "mint",   label: "ミント",         hex: "#35B37E" }, // design-qa-allow: 同上
];

/* ── 色の計算 ──────────────────────────────────────────────── */

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

function hexToRgb(hex: string): RGB {
  const n = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

function adjust(hex: string, dl: number, ds = 0): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: Math.min(1, Math.max(0, hsl.s + ds)),
      l: Math.min(1, Math.max(0, hsl.l + dl)),
    })
  );
}

/** 2色のコントラスト比（WCAG）。4.5 以上で AA */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const INK = "#1A1A1A";   // design-qa-allow: --color-text-primary と同値。コントラスト計算に使う
const WHITE = "#FFFFFF"; // design-qa-allow: --color-text-inverse と同値。同上

export interface BrandPalette {
  /** アクセント色そのもの（ボタン・選択中） */
  primary: string;
  /** 押した時 */
  pressed: string;
  /** 濃い文字色・バッジ */
  deep: string;
  /** 薄い地（合計の背景など） */
  subtle: string;
  /** 墨の上に置くときのアクセント */
  onInk: string;
  /** アクセントの上に載せる文字・アイコンの色（墨か白） */
  contrast: string;
  /** contrast が白なら true（画面の文言用。色の比較を UI 側に書かせない） */
  contrastIsLight: boolean;
  /** contrast と primary のコントラスト比 */
  contrastRatio: number;
}

/**
 * 1色から派生色一式を作る。
 * 文字色は「墨と白のどちらがより読みやすいか」で決める（lib/backgroundColor.ts と同じ境目）。
 */
export function derivePalette(hexInput: string): BrandPalette {
  const primary = normalizeHex(hexInput) ?? DEFAULT_BRAND_ACCENT;
  const dark = contrastRatio(primary, INK) >= contrastRatio(primary, WHITE);
  const contrast = dark ? INK : WHITE;
  const { l } = rgbToHsl(hexToRgb(primary));
  return {
    primary,
    pressed: adjust(primary, -0.08),
    deep: adjust(primary, l > 0.5 ? -0.32 : -0.12, 0.05),
    subtle: adjust(primary, Math.max(0, 0.9 - l), -0.25),
    // 墨の上で読めるように明るく寄せる（暗い色ほど大きく持ち上げる）
    onInk: l < 0.45 ? adjust(primary, 0.28, -0.1) : primary,
    contrast,
    contrastIsLight: !dark,
    contrastRatio: contrastRatio(primary, contrast),
  };
}

/** 読みやすさの判定。AA（4.5）を切ったら警告 */
export type Readability = "ok" | "warn";
export function readabilityOf(palette: BrandPalette): Readability {
  return palette.contrastRatio >= 4.5 ? "ok" : "warn";
}

/**
 * design-tokens.css の変数を上書きする CSS 文字列。
 * サーバー側（app/layout.tsx）で <style> に入れる。管理画面のプレビューでは
 * 同じ変数を style 属性で当てる（brandCssVarStyle）。
 */
export function brandCssVars(palette: BrandPalette): Record<string, string> {
  return {
    "--color-accent-primary": palette.primary,
    "--color-accent-pressed": palette.pressed,
    "--color-accent-deep": palette.deep,
    "--color-accent-subtle": palette.subtle,
    "--color-accent-on-ink": palette.onInk,
    "--color-accent-contrast": palette.contrast,
  };
}

export function brandCssText(palette: BrandPalette): string {
  return `:root{${Object.entries(brandCssVars(palette))
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/* ── データアクセス ──────────────────────────────────────────── */

/** 保存されているブランドカラー。NULL（未設定）なら null */
export async function fetchBrandAccent(): Promise<string | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("brand_accent")
    .eq("id", STORE_ID)
    .single();
  if (error) throw error;
  return (data?.brand_accent as string | null) ?? null;
}

/** manager 限定の RPC で保存する。null で既定色に戻す */
export async function saveBrandAccent(hex: string | null): Promise<void> {
  const normalized = hex === null ? null : normalizeHex(hex);
  if (hex !== null && !normalized) throw new Error("#RRGGBB の形式で指定してください");
  const { error } = await supabase.rpc("save_brand_accent", { p_hex: normalized });
  if (error) throw error;
}
