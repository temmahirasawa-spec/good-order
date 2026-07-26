/**
 * クライアントサイド画像圧縮（Canvas API）
 *
 * 仕様：
 *  - 横 ≤ 1200px かつ 縦 ≤ 800px かつ ファイルサイズ ≤ 100KB なら圧縮不要
 *  - 超える場合は、16:9 目安（1200×800 内に収まるよう）にリサイズ後、
 *    JPEG の品質を反復調整して 100KB 以下を目指す
 */

export const COMPRESS_MAX_WIDTH  = 1200;
export const COMPRESS_MAX_HEIGHT = 800;
export const COMPRESS_MAX_BYTES  = 100 * 1024; // 100KB

export interface ImageInfo {
  width: number;
  height: number;
  size: number;
}

export interface CompressionResult {
  file: File;
  before: ImageInfo;
  after: ImageInfo;
}

/* ── HTMLImageElement 経由で寸法を取得 ── */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error("画像を読み込めませんでした"));
      img.src     = url;
    });
    return img;
  } finally {
    // 画像デコードが終わっているので revoke して問題ない（ブラウザはデコード済みビットマップを保持）
    URL.revokeObjectURL(url);
  }
}

/* ── 圧縮が必要かを判定 ── */
export async function inspectImage(file: File): Promise<ImageInfo & { needsCompression: boolean }> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const s = file.size;
  const fitsDim  = w <= COMPRESS_MAX_WIDTH && h <= COMPRESS_MAX_HEIGHT;
  const fitsSize = s <= COMPRESS_MAX_BYTES;
  return {
    width: w,
    height: h,
    size: s,
    needsCompression: !(fitsDim && fitsSize),
  };
}

/* ── 実際の圧縮処理 ── */
export async function compressImage(file: File): Promise<CompressionResult> {
  const img = await loadImage(file);
  const before: ImageInfo = {
    width: img.naturalWidth,
    height: img.naturalHeight,
    size: file.size,
  };

  // 1200×800 に収まるよう縮小（アスペクト比は維持）
  const scale = Math.min(
    COMPRESS_MAX_WIDTH  / img.naturalWidth,
    COMPRESS_MAX_HEIGHT / img.naturalHeight,
    1
  );
  const targetW = Math.max(1, Math.round(img.naturalWidth  * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas コンテキストを取得できませんでした");
  // 少しでも綺麗に
  ctx.imageSmoothingEnabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx as any).imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // JPEG で書き出し、品質を段階的に下げて 100KB 以下を狙う
  let quality = 0.85;
  let blob: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (blob && blob.size <= COMPRESS_MAX_BYTES) break;
    quality -= 0.1;
    if (quality < 0.3) break;
  }
  if (!blob) throw new Error("圧縮に失敗しました");

  const base = file.name.replace(/\.[^.]+$/, "");
  const outFile = new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    file: outFile,
    before,
    after: { width: targetW, height: targetH, size: blob.size },
  };
}

/* ── UI 用ヘルパー：KB 表記 ── */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
