/**
 * 二次元コードの生成とURL組み立て（Step3-O）。
 *
 * ライブラリは `qrcode`（MIT / v1.5.4）。**SVG出力が必須**という条件で選定した。
 * PNG（toDataURL）とSVG文字列（toString type:"svg"）の両方を1つのAPIで出せて、
 * ブラウザ単体で完結し、依存も軽い。印刷業者に渡す・メニュー表に埋め込む用途で
 * 拡大しても劣化しないSVGが必要になる。
 *
 * 注意: UI表記は「二次元コード」で統一する（QRコードは登録商標）。
 * この関数名など内部識別子は qr のままで構わない。
 */

import QRCode from "qrcode";
import { basePath } from "@/lib/siteConfig";

/** 二次元コードの誤り訂正レベル。卓上カードは汚れ・光の反射があるので M ではなく Q にしている */
const ERROR_CORRECTION: "L" | "M" | "Q" | "H" = "Q";

/** 余白（モジュール数）。Figmaのカードは枠ぎりぎりなので最小の1にする */
const MARGIN = 1;

/**
 * 卓の注文URLを組み立てる。
 *
 * - 卓あり: `<origin><basePath>/?t=<short_code>`
 * - テイクアウト: `<origin><basePath>/`
 *   （パラメータなし。既存の「?table が無ければテイクアウト」判定に乗る）
 *
 * `basePath` をここで足しているのは、呼び出し側が渡す `window.location.origin` が
 * ドメインまでしか含まないため。ここを忘れると、刷った紙の二次元コードが
 * 店舗の接頭辞を持たないURLを指し、読み取っても 404 になる。
 * **紙に焼き付いてしまうと直せないので、この関数を必ず通すこと。**
 *
 * ラベル（?table=A1）は**埋めない**。カテゴリーのコードを変えた瞬間に
 * 印刷済みカードが全部無効になり、しかも画面にはエラーが出ないため発覚が遅れる。
 */
export function tableOrderUrl(origin: string, shortCode: string | null): string {
  const base = origin.replace(/\/$/, "") + basePath;
  return shortCode ? `${base}/?t=${shortCode}` : `${base}/`;
}

/** カードに併記する短い表示用URL（スキームを落としたもの） */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export async function toSvgString(url: string, size: number): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    width: size,
    margin: MARGIN,
    errorCorrectionLevel: ERROR_CORRECTION,
    // design-qa-allow: QR生成ライブラリに渡す値。CSS変数は解決されない
    color: { dark: "#1A1A1A", light: "#FFFFFF" },
  });
}

export async function toPngDataUrl(url: string, size: number): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: MARGIN,
    errorCorrectionLevel: ERROR_CORRECTION,
    // design-qa-allow: QR生成ライブラリに渡す値。CSS変数は解決されない
    color: { dark: "#1A1A1A", light: "#FFFFFF" },
  });
}

/** ブラウザにファイルを保存させる（同一オリジンのdata:/blob:のみ想定） */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}
