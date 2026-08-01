/**
 * クライアントサイド画像圧縮（Canvas API）
 *
 * 仕様：
 *  - 出力は WebP。同じ見た目なら JPEG より 3〜4 割軽く、iOS/Android の
 *    現行ブラウザはすべて表示できる。生成できないブラウザ（Safari 13 以前）
 *    でだけ JPEG に落ちる。
 *  - リサイズは「長辺 ≤ 1440px」で判定する。以前は 1200×800 の箱に収める
 *    実装だったが、それだと縦長写真が 600×800 まで縮み、DPR3 のスマホで
 *    全幅表示したときに目に見えて甘くなっていた。長辺基準なら縦横どちらの
 *    写真も同じ密度で残る。
 *  - 1440px の WebP は品質 0.85 で概ね 200〜260KB に収まるので、上限は
 *    300KB。ここを下回るまで品質を段階的に落とす。
 */

/** リサイズ後の長辺の上限（px） */
export const COMPRESS_MAX_EDGE = 1440;
/** 目標ファイルサイズ */
export const COMPRESS_MAX_BYTES = 300 * 1024;
/** 品質の開始値。ここから下げながら COMPRESS_MAX_BYTES を狙う */
const QUALITY_START = 0.85;
const QUALITY_FLOOR = 0.5;
const QUALITY_STEP  = 0.07;

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
  const fitsDim  = Math.max(w, h) <= COMPRESS_MAX_EDGE;
  const fitsSize = s <= COMPRESS_MAX_BYTES;
  return {
    width: w,
    height: h,
    size: s,
    needsCompression: !(fitsDim && fitsSize),
  };
}

/* ── canvas を指定 MIME で書き出す（品質を下げながら目標サイズを狙う）── */
async function encode(canvas: HTMLCanvasElement, mime: string): Promise<Blob | null> {
  let quality = QUALITY_START;
  let last: Blob | null = null;
  while (quality >= QUALITY_FLOOR) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality)
    );
    // 要求した形式で書き出せないブラウザは PNG などを返してくる。呼び出し元で判定させる
    if (!blob || blob.type !== mime) return blob;
    last = blob;
    if (blob.size <= COMPRESS_MAX_BYTES) break;
    quality -= QUALITY_STEP;
  }
  return last;
}

/**
 * 画像を WebP に変換する。
 * @param opts.resize false なら寸法は変えず、形式変換と品質調整だけ行う。
 *   管理画面の「そのまま」は "縮めたくない" という意思表示なので、寸法は
 *   尊重したうえで WebP 化の恩恵だけ受けさせる用途。
 */
export async function compressImage(
  file: File,
  opts: { resize?: boolean } = {}
): Promise<CompressionResult> {
  const { resize = true } = opts;
  const img = await loadImage(file);
  const before: ImageInfo = {
    width: img.naturalWidth,
    height: img.naturalHeight,
    size: file.size,
  };

  // 長辺を COMPRESS_MAX_EDGE に収める（アスペクト比は維持。拡大はしない）
  const scale = resize
    ? Math.min(COMPRESS_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight), 1)
    : 1;
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

  let blob = await encode(canvas, "image/webp");
  let ext  = "webp";
  if (!blob || blob.type !== "image/webp") {
    // WebP を書き出せない環境（Safari 13 以前など）は JPEG に落とす
    blob = await encode(canvas, "image/jpeg");
    ext  = "jpg";
  }
  if (!blob) throw new Error("圧縮に失敗しました");

  const base = file.name.replace(/\.[^.]+$/, "");
  const outFile = new File([blob], `${base}.${ext}`, {
    type: blob.type,
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
