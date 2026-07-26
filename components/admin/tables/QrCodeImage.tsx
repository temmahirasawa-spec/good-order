"use client";

/**
 * 二次元コードのSVGをインラインで描画する。
 *
 * `qrcode` はブラウザでしか動かない（Canvas/DOM前提の分岐がある）ので、生成は
 * マウント後の useEffect で行う。生成中はサイズだけ確保したプレースホルダーを出し、
 * カード全体のレイアウトが後からガタつかないようにしている。
 *
 * インラインSVGにしているのは、印刷ビューで <img src="data:..."> だと
 * ブラウザによっては印刷時に画像が抜けることがあるため。
 */
import { useEffect, useState } from "react";
import { toSvgString } from "@/lib/qrCode";

export default function QrCodeImage({
  url,
  size,
  cssSize,
  className = "",
}: {
  url: string;
  /** 生成解像度（px） */
  size: number;
  /** 実際に描画する箱のサイズ。印刷ビューは mm 指定にしたいので分けている */
  cssSize?: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    toSvgString(url, size)
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch((e) => { console.error("[QrCodeImage] generate failed:", e); });
    return () => { cancelled = true; };
  }, [url, size]);

  const box = { width: cssSize ?? `${size}px`, height: cssSize ?? `${size}px` };

  if (!svg) {
    return (
      <div
        className={`bg-bg-tertiary rounded-[var(--radius-xs)] shrink-0 ${className}`}
        style={box}
        aria-hidden
      />
    );
  }
  return (
    <div
      className={`shrink-0 [&>svg]:block [&>svg]:w-full [&>svg]:h-full ${className}`}
      style={box}
      role="img"
      aria-label="注文用の二次元コード"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
