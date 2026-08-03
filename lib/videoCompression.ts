/**
 * クライアントサイド動画圧縮（WebCodecs + mp4-muxer）
 *
 * 仕様（docs/specs/video-management.md の D）：
 *  - 出力は **H.264 / mp4**。お客様の主端末は iPhone で、`<video>` タグ直再生（HLS等の
 *    再生ライブラリは持っていない）。MediaRecorder だと Chrome の出力が webm になり
 *    iOS で再生できないため、WebCodecs で H.264 を直接吐く。
 *  - ビットレートは 1.2 Mbps（軽さ優先）。音声は破棄する
 *    （components/ui/VideoBlock.tsx も TopScreen も常に muted で、持っても再生されない）。
 *  - **圧縮後が元より大きければ元をそのまま使う。**現行の background.mp4 は 695KB で、
 *    どのビットレートで再エンコードしても重くなる。この場合に再エンコードすると
 *    転送量が増えるだけで何も得しない。
 *  - 圧縮できない環境では**エラーで止める。**未圧縮のまま上げる逃げ道は作らない
 *    （上限を超えた素材が客席に出るため）。
 *
 * アップロード経路は変えない。ここで作った File を既存の lib/storage.ts に渡すだけ。
 */

import { compressImage } from "./imageCompression";

/** 出力の枠。スロットによって切り取られ方が違うので呼び出し側が指定する */
export type VideoFit =
  /** /order の16:9ヒーロー。16:9に中央基準でトリミングして焼き込む */
  | "cover-16x9"
  /** / の全画面背景。縦横比は元のまま（端末側で上下左右が切れる） */
  | "keep-aspect";

/** ビットレート（bps）。F-4 の決定により 1.2 Mbps */
export const VIDEO_BITRATE = 1_200_000;
/** フレームレートの上限。元がこれ未満ならそのまま */
export const VIDEO_MAX_FPS = 30;
/** 長辺の上限（px） */
export const VIDEO_MAX_LONG_EDGE = 1280;
/**
 * 総画素数の上限。H.264 Level 3.1 の上限（1280×720）に合わせている。
 * 縦動画 720×1280 もちょうどこの値に収まる。
 */
export const VIDEO_MAX_PIXELS = 1280 * 720;
/** 入力ファイルサイズの上限 */
export const VIDEO_MAX_INPUT_BYTES = 200 * 1024 * 1024;
/** 入力の長さの上限（秒）。圧縮時間が長さに比例するため */
export const VIDEO_MAX_DURATION_SEC = 30;
/** キーフレーム間隔（秒）。ループ再生の巻き戻しを軽くする */
const KEYFRAME_INTERVAL_SEC = 2;
/** Constrained Baseline / Level 3.1。1280×720@30 まで。iOS/Android/PC で確実に再生できる */
const VIDEO_CODEC = "avc1.42E01F";
/** エンコードキューがこれを超えたらフレームを間引く（低速機でのメモリ枯渇よけ） */
const MAX_ENCODE_QUEUE = 60;

export interface VideoInfo {
  width: number;
  height: number;
  /** 秒 */
  duration: number;
  size: number;
}

export interface VideoCompressionResult {
  /** アップロードする動画。usedOriginal のときは入力そのもの */
  file: File;
  /** 1フレーム目から起こしたポスター画像（WebP） */
  poster: File | null;
  before: VideoInfo;
  after: { width: number; height: number; size: number };
  /** true = 圧縮後の方が大きかったので元ファイルを採用した */
  usedOriginal: boolean;
}

/* ── 環境判定 ────────────────────────────────────────────── */

/**
 * この環境で圧縮できるか。
 * VideoEncoder（WebCodecs）と requestVideoFrameCallback の両方が要る。
 */
export function isVideoCompressionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.VideoEncoder !== "undefined" &&
    typeof window.VideoFrame !== "undefined" &&
    typeof HTMLVideoElement !== "undefined" &&
    "requestVideoFrameCallback" in HTMLVideoElement.prototype
  );
}

/* ── 寸法の計算 ──────────────────────────────────────────── */

/** H.264 の 4:2:0 は偶数寸法しか扱えない。切り下げで偶数に丸める */
function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

/**
 * 出力寸法を決める。**拡大はしない。**
 * cover-16x9 は 16:9 に、keep-aspect は元の比のまま、長辺と総画素数の上限に収める。
 */
export function computeOutputSize(
  srcW: number,
  srcH: number,
  fit: VideoFit
): { width: number; height: number } {
  let w: number;
  let h: number;

  if (fit === "cover-16x9") {
    // 幅は元の幅と上限の小さい方。高さはそこから 16:9 で決まる
    w = Math.min(VIDEO_MAX_LONG_EDGE, srcW);
    h = (w * 9) / 16;
  } else {
    const scale = Math.min(VIDEO_MAX_LONG_EDGE / Math.max(srcW, srcH), 1);
    w = srcW * scale;
    h = srcH * scale;
  }

  // 総画素数の上限（H.264 Level 3.1）に収める
  const pixels = w * h;
  if (pixels > VIDEO_MAX_PIXELS) {
    const s = Math.sqrt(VIDEO_MAX_PIXELS / pixels);
    w *= s;
    h *= s;
  }

  return { width: even(w), height: even(h) };
}

/* ── 入力の検査 ──────────────────────────────────────────── */

function createProbeVideo(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  return v;
}

/**
 * 寸法・長さ・サイズを読む。エンコードを始める前にこれで弾く
 * （lib/imageCompression.ts の inspectImage と同じ「まず検査する」作法）。
 */
export async function inspectVideo(file: File): Promise<VideoInfo> {
  const url = URL.createObjectURL(file);
  const video = createProbeVideo(url);
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("動画を読み込めませんでした。mp4 / mov / webm のファイルを選んでください。"));
    });
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
      size: file.size,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** 上限に当たっていれば理由を返す。問題なければ null */
export function validateVideo(info: VideoInfo): string | null {
  if (info.size > VIDEO_MAX_INPUT_BYTES) {
    return `動画ファイルが ${Math.round(VIDEO_MAX_INPUT_BYTES / 1024 / 1024)}MB を超えています。短い動画にするか、書き出し設定を軽くしてください。`;
  }
  if (!isFinite(info.duration) || info.duration <= 0) {
    return "動画の長さを読み取れませんでした。別のファイルでお試しください。";
  }
  if (info.duration > VIDEO_MAX_DURATION_SEC) {
    return `この動画は${Math.round(info.duration)}秒です。${VIDEO_MAX_DURATION_SEC}秒以内の動画をアップロードしてください。`;
  }
  if (info.width < 2 || info.height < 2) {
    return "動画の寸法を読み取れませんでした。別のファイルでお試しください。";
  }
  return null;
}

/* ── 圧縮本体 ────────────────────────────────────────────── */

/**
 * 動画を H.264 / mp4 に再エンコードし、1フレーム目からポスター画像も作る。
 *
 * デコードは**再生速度に律速される**（15秒の動画なら15秒前後かかる）ので、
 * 呼び出し側は onProgress を必ず画面に出すこと。
 */
export async function compressVideo(
  file: File,
  opts: { fit: VideoFit; onProgress?: (ratio: number) => void }
): Promise<VideoCompressionResult> {
  if (!isVideoCompressionSupported()) {
    throw new Error(
      "このブラウザでは動画を圧縮できません。Chrome または Safari の最新版でお試しください。"
    );
  }

  const before = await inspectVideo(file);
  const invalid = validateVideo(before);
  if (invalid) throw new Error(invalid);

  const { width, height } = computeOutputSize(before.width, before.height, opts.fit);

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    // moov を先頭に置く。末尾のままだと再生開始前に全体をダウンロードすることになる
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({
    codec: VIDEO_CODEC,
    width,
    height,
    bitrate: VIDEO_BITRATE,
    framerate: VIDEO_MAX_FPS,
    latencyMode: "quality",
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas コンテキストを取得できませんでした");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1フレーム目の控え（ポスター用）。エンコード中の canvas は次々上書きされるため別に取る
  const posterCanvas = document.createElement("canvas");
  posterCanvas.width = width;
  posterCanvas.height = height;
  const posterCtx = posterCanvas.getContext("2d", { alpha: false });

  /* cover 方式で描く位置とサイズ。keep-aspect のときは縦横比が一致するので
     結果的に等倍配置になり、同じ計算で両方まかなえる */
  const scale = Math.max(width / before.width, height / before.height);
  const drawW = before.width * scale;
  const drawH = before.height * scale;
  const drawX = (width - drawW) / 2;
  const drawY = (height - drawH) / 2;

  const url = URL.createObjectURL(file);
  const video = createProbeVideo(url);
  /* 画面外だが DOM には入れる。detached / display:none の <video> は
     ブラウザによってフレーム供給が止まり、requestVideoFrameCallback が呼ばれなくなる */
  video.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;pointer-events:none;";
  document.body.appendChild(video);

  const minFrameGap = 1 / VIDEO_MAX_FPS;
  let frameCount = 0;
  let droppedFrames = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let lastTs = -Infinity;
      let lastKeyTs = -Infinity;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      const step = (_now: number, meta: VideoFrameCallbackMetadata) => {
        if (finished) return;
        if (encoderError) {
          finished = true;
          reject(encoderError);
          return;
        }

        const t = meta.mediaTime;
        // fps 上限。60fps 素材は1枚おきに落ちる
        if (t - lastTs >= minFrameGap - 1e-4) {
          if (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
            // 低速機でキューが詰まったときだけ間引く（メモリ枯渇より欠けフレームの方がまし）
            droppedFrames++;
          } else {
            ctx.drawImage(video, drawX, drawY, drawW, drawH);
            if (frameCount === 0) posterCtx?.drawImage(canvas, 0, 0);

            const keyFrame = lastKeyTs < 0 || t - lastKeyTs >= KEYFRAME_INTERVAL_SEC;
            if (keyFrame) lastKeyTs = t;

            const frame = new VideoFrame(canvas, {
              timestamp: Math.round(t * 1_000_000),
              duration: Math.round(minFrameGap * 1_000_000),
            });
            encoder.encode(frame, { keyFrame });
            frame.close();

            frameCount++;
            lastTs = t;
          }
        }

        opts.onProgress?.(Math.min(0.99, t / before.duration));
        video.requestVideoFrameCallback(step);
      };

      video.onended = finish;
      video.onerror = () => reject(new Error("動画を再生できませんでした。別のファイルでお試しください。"));
      video.requestVideoFrameCallback(step);
      video.play().catch(() =>
        reject(new Error("動画を再生できませんでした。別のファイルでお試しください。"))
      );
    });

    await encoder.flush();
    if (encoderError) throw encoderError;
    if (frameCount === 0) {
      throw new Error("動画からフレームを取り出せませんでした。別のファイルでお試しください。");
    }
    muxer.finalize();

    if (droppedFrames > 0) {
      console.warn(`[videoCompression] エンコードが追いつかず ${droppedFrames} フレームを間引きました`);
    }

    const buffer = muxer.target.buffer;
    if (!buffer) throw new Error("動画を書き出せませんでした。");

    const base = file.name.replace(/\.[^.]+$/, "") || "video";
    const encoded = new File([buffer], `${base}.mp4`, { type: "video/mp4" });

    const poster = posterCtx ? await canvasToPoster(posterCanvas, base) : null;

    /* 圧縮後の方が大きいなら元をそのまま使う。
       ただし**元が mp4 のときだけ。**mov / webm を素通しすると、軽くはなっても
       iOS Safari で再生できない動画が客席に出る（webm）ので、そこは必ず再エンコードする。 */
    const originalIsMp4 =
      file.type === "video/mp4" || /\.mp4$/i.test(file.name);
    if (originalIsMp4 && encoded.size >= file.size) {
      return {
        file,
        poster,
        before,
        after: { width: before.width, height: before.height, size: file.size },
        usedOriginal: true,
      };
    }

    return {
      file: encoded,
      poster,
      before,
      after: { width, height, size: encoded.size },
      usedOriginal: false,
    };
  } finally {
    if (encoder.state !== "closed") encoder.close();
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * 1フレーム目をポスター画像にする。
 * 既存の compressImage（長辺1440px / 300KB以内 / WebP）にそのまま通して、
 * 画像側と同じ出力ルールに揃える。canvas は最大1280pxなので拡大は起きない。
 */
async function canvasToPoster(canvas: HTMLCanvasElement, base: string): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) return null;
  try {
    const src = new File([blob], `${base}-poster.png`, { type: "image/png" });
    const result = await compressImage(src);
    return result.file;
  } catch (err) {
    // ポスターが作れなくても動画自体は使える（poster 無しで少し地味になるだけ）
    console.warn("[videoCompression] ポスター画像の生成に失敗（無視）:", err);
    return null;
  }
}
