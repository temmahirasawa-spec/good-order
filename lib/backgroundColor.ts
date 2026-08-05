/**
 * 二次元コード着地画面（`/`）の背景色パレットと、その上に乗せる文字色の自動判定。
 *
 * 管理画面（表示設定 > 動画設定 > 二次元コード着地画面の背景）とお客様側（TopScreen）の
 * **両方がここを参照する**。判定式が2か所に分かれると、管理画面のプレビューと実物が
 * ずれる（＝店舗が「白文字になるはず」と思って選んだ色が本番で黒文字になる）ため、
 * 必ずこのファイルだけを唯一の実装にすること。
 *
 * 色は design-tokens.css の変数を使わず**リテラルで持っている**。
 * ここは「デザインの色」ではなく「店舗がお客様に見せる背景として選ぶ値」であり、
 * ブランド切り替え（YORKYS / Izakaya）で中身が変わってはいけないため。
 * design-qa-allow: 店舗が選ぶ背景色の選択肢そのもの。テーマ変数に紐づけてはいけない
 */

/** 文字とロゴの色。'dark' = text/primary 相当、'light' = text/inverse 相当 */
export type ForegroundTone = "dark" | "light";

export interface BackgroundSwatch {
  /** 画面には出さない識別子（保存するのは hex の方） */
  id: string;
  label: string;
  hex: string;
}

/* 前半10色。**design-tokens.css の tag/* と同じ値**だが、変数を参照せずリテラルで持つ。
   理由は冒頭のとおり（店舗が選ぶ背景の選択肢であって、テーマの色ではない）。
   tag/* 側の値を変えても、こちらは追従させない。 */
export const BACKGROUND_TINTS: BackgroundSwatch[] = [
  { id: "yellow", label: "イエロー",   hex: "#FBEEC5" }, // design-qa-allow: 店舗が選ぶ背景色の選択肢。テーマ変数に紐づけない
  { id: "orange", label: "オレンジ",   hex: "#FCE8D8" }, // design-qa-allow: 同上
  { id: "pink",   label: "ピンク",     hex: "#FBE4EA" }, // design-qa-allow: 同上
  { id: "red",    label: "レッド",     hex: "#FBE0DC" }, // design-qa-allow: 同上
  { id: "green",  label: "グリーン",   hex: "#E3F2DF" }, // design-qa-allow: 同上
  { id: "teal",   label: "ティール",   hex: "#DEF1EC" }, // design-qa-allow: 同上
  { id: "blue",   label: "ブルー",     hex: "#E1EDF8" }, // design-qa-allow: 同上
  { id: "purple", label: "パープル",   hex: "#EBE5F6" }, // design-qa-allow: 同上
  { id: "brown",  label: "ブラウン",   hex: "#F0E8DC" }, // design-qa-allow: 同上
  { id: "gray",   label: "グレー",     hex: "#ECEDEF" }, // design-qa-allow: 同上
];

/* 後半10色。変数化していない固定値（天真の指定どおり）。 */
export const BACKGROUND_DEEPS: BackgroundSwatch[] = [
  { id: "sumi",       label: "墨",             hex: "#1A1A1A" }, // design-qa-allow: 店舗が選ぶ背景色の選択肢。テーマ変数に紐づけない
  { id: "charcoal",   label: "炭",             hex: "#2C2A28" }, // design-qa-allow: 同上
  { id: "darkbrown",  label: "ダークブラウン", hex: "#3A2E2A" }, // design-qa-allow: 同上
  { id: "bordeaux",   label: "ボルドー",       hex: "#4A2E2E" }, // design-qa-allow: 同上
  { id: "wine",       label: "ワイン",         hex: "#5A2B32" }, // design-qa-allow: 同上
  { id: "darkgreen",  label: "ダークグリーン", hex: "#2F3D34" }, // design-qa-allow: 同上
  { id: "navy",       label: "ネイビー",       hex: "#24384A" }, // design-qa-allow: 同上
  { id: "indigo",     label: "インディゴ",     hex: "#2B2F5A" }, // design-qa-allow: 同上
  { id: "darkpurple", label: "ダークパープル", hex: "#46305A" }, // design-qa-allow: 同上
  { id: "darkcamel",  label: "ダークキャメル", hex: "#5A4326" }, // design-qa-allow: 同上
];

export const BACKGROUND_SWATCHES: BackgroundSwatch[] = [
  ...BACKGROUND_TINTS,
  ...BACKGROUND_DEEPS,
];

/** 背景タイプ未設定（＝旧データ）のときに使う既定色。動画・画像が無いときの下地でもある。
 *  従来 TopScreen が敷いていた bg-black に相当する位置づけで、パレット先頭の「墨」と同値。 */
export const DEFAULT_BACKGROUND_COLOR = "#1A1A1A"; // design-qa-allow: 店舗が選ぶ背景色の既定値。テーマ変数に紐づけない

/* ── 文字色の判定 ────────────────────────────────────────────
 *
 * WCAG 2.x の相対輝度 L を使う。
 *   L = 0.2126·R + 0.7152·G + 0.0722·B
 *   各チャンネル c(0..1) は c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4
 *
 * しきい値は 0.2017。これは「黒文字(#1A1A1A)にしたときのコントラスト比」と
 * 「白文字(#FFFFFF)にしたときのコントラスト比」がちょうど等しくなる点で、
 * 　  (L+0.05)/(L_ink+0.05) = 1.05/(L+0.05)   ただし L_ink = L(#1A1A1A) = 0.010330
 * を解いて L = √(1.05 × 0.06033) − 0.05 = 0.201687 と求めた。
 * 「0.5」のような直感的な数字を置くのではなく、**どちらの文字色がより読みやすいかの
 * 分岐点そのもの**を使っているので、境目の色でも必ず読みやすい方に倒れる。
 */
const FOREGROUND_LUMINANCE_THRESHOLD = 0.201687;

function channelToLinear(value255: number): number {
  const c = value255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 相対輝度（0＝黒, 1＝白）。不正な hex は 0（＝暗い扱い）を返す */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) return 0;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/**
 * 背景色に対して読みやすい文字色を返す。
 * **背景が画像・動画のときはこれを使わない。**その2つは常に light（白）で固定する。
 */
export function foregroundToneFor(hex: string): ForegroundTone {
  return relativeLuminance(hex) > FOREGROUND_LUMINANCE_THRESHOLD ? "dark" : "light";
}

/**
 * tone に対応する文字色を rgba() で組み立てる。
 *
 * 着地画面は「白の50%」「白の75%」のように**同じ色を違う透明度で**何度も使う。
 * Tailwind の text-white/75 は色が固定なので tone で切り替えられず、
 * CSS変数（#RRGGBB）に `/75` を付けることもできない（色関数にならない）ため、
 * ここで数値から rgba を作る。値は design-tokens.css の
 * --color-text-primary / --color-text-inverse と同じ。
 */
const FOREGROUND_RGB: Record<ForegroundTone, string> = {
  dark: "26, 26, 26", // design-qa-allow: --color-text-primary と同値。透明度を掛けるため数値で持つ
  light: "255, 255, 255", // design-qa-allow: --color-text-inverse と同値。同上
};

export function foregroundColor(tone: ForegroundTone, alpha = 1): string {
  return `rgba(${FOREGROUND_RGB[tone]}, ${alpha})`;
}

/* ── HEX の正規化・検証 ──────────────────────────────────────
 * 店舗が手で打つ入口なので、次のゆらぎは吸収して受け入れる。
 *   - 先頭の # の有無
 *   - 大文字小文字
 *   - 3桁の短縮形（#abc → #AABBCC）
 *   - 前後の空白
 * それ以外（桁数違い・16進以外の文字）は**受け付けない**。
 */

/** 正規化して "#RRGGBB"（大文字）を返す。不正なら null */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}
