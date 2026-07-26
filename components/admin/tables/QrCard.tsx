"use client";

/**
 * 二次元コードカード（Figma: QR Card 528:465 / 一覧内インスタンス 534:7618）
 * チェックボックス＋卓ラベル＋⋯メニュー / 二次元コード120px / URL / コピー・DLボタン。
 * テイクアウトのカードだけ accent/primary の2px枠で区別する。
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import QrCodeImage from "@/components/admin/tables/QrCodeImage";
import { displayUrl, downloadDataUrl, downloadSvg, toPngDataUrl, toSvgString } from "@/lib/qrCode";

/** DLは印刷業者入稿やメニュー表への埋め込みを想定してSVGも選べるようにする */
const PNG_EXPORT_SIZE = 1024;
const SVG_EXPORT_SIZE = 512;

export default function QrCard({
  label,
  url,
  selected,
  onToggleSelected,
  onDelete,
  accent = false,
}: {
  label: string;
  url: string;
  selected: boolean;
  onToggleSelected: () => void;
  /** テイクアウトのカードは削除できないので undefined を渡す */
  onDelete?: () => void;
  accent?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* カード外をクリックしたらポップオーバーを閉じる。
     どちらか一方だけ開く運用なので1つのハンドラでまとめて畳む */
  useEffect(() => {
    if (!menuOpen && !dlOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDlOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen, dlOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("[QrCard] copy failed:", e);
    }
  };

  const fileBase = `good-order_${label}`;

  const handleDownloadPng = async () => {
    setDlOpen(false);
    try {
      downloadDataUrl(await toPngDataUrl(url, PNG_EXPORT_SIZE), `${fileBase}.png`);
    } catch (e) {
      console.error("[QrCard] png export failed:", e);
    }
  };

  const handleDownloadSvg = async () => {
    setDlOpen(false);
    try {
      downloadSvg(await toSvgString(url, SVG_EXPORT_SIZE), `${fileBase}.svg`);
    } catch (e) {
      console.error("[QrCard] svg export failed:", e);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`bg-surface-white rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-12)] items-center px-[var(--space-16)] py-[14px] relative w-full ${
        accent ? "border-2 border-accent-primary" : "border border-border-divider"
      }`}
    >
      <div className="flex h-[24px] items-center justify-between w-full min-w-0">
        <button
          type="button"
          onClick={onToggleSelected}
          aria-pressed={selected}
          className="flex gap-[var(--space-8)] items-center min-w-0 text-left"
        >
          <span
            className={`w-[18px] h-[18px] rounded-[5px] shrink-0 flex items-center justify-center ${
              selected ? "bg-surface-ink" : "border border-border bg-surface-white"
            }`}
          >
            {selected && <Icon name="check" className="w-3 h-3 text-text-inverse" />}
          </span>
          <span className="type-jp-heading-s text-text-primary truncate">{label}</span>
        </button>

        {onDelete && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setDlOpen(false); setMenuOpen((v) => !v); }}
              aria-label={`${label} の操作`}
              className="flex items-center justify-center rounded-full w-[24px] h-[24px]"
            >
              <Icon name="more" className="w-4 h-4 text-text-primary" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-[28px] z-20 bg-surface-white rounded-[var(--radius-md)] border border-border-divider py-[var(--space-4)] w-[168px]"
                style={{ boxShadow: "var(--shadow-float)" }}
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="block px-[var(--space-16)] py-[10px] type-jp-body text-text-primary"
                >
                  リンクを開く
                </a>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="block w-full text-left px-[var(--space-16)] py-[10px] type-jp-body text-status-urgent"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <QrCodeImage url={url} size={120} />

      <p className="type-jp-micro-label text-text-secondary text-center truncate w-full" title={url}>
        {displayUrl(url)}
      </p>

      <div className="flex gap-[var(--space-8)] items-start w-full">
        <button
          type="button"
          onClick={handleCopy}
          className="bg-bg-tertiary flex flex-1 gap-[6px] h-[34px] items-center justify-center min-w-0 rounded-[var(--radius-full)]"
        >
          <Icon name="copy" className="w-4 h-4 text-text-primary shrink-0" />
          <span className="type-jp-micro-label text-text-primary whitespace-nowrap">
            {copied ? "コピーしました" : "コピー"}
          </span>
        </button>

        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setDlOpen((v) => !v); }}
            className="bg-bg-tertiary flex w-full gap-[6px] h-[34px] items-center justify-center rounded-[var(--radius-full)]"
          >
            <Icon name="download" className="w-4 h-4 text-text-primary shrink-0" />
            <span className="type-jp-micro-label text-text-primary whitespace-nowrap">DL</span>
          </button>
          {dlOpen && (
            <div
              className="absolute right-0 bottom-[40px] z-20 bg-surface-white rounded-[var(--radius-md)] border border-border-divider py-[var(--space-4)] w-[168px]"
              style={{ boxShadow: "var(--shadow-float)" }}
            >
              <button
                type="button"
                onClick={handleDownloadPng}
                className="block w-full text-left px-[var(--space-16)] py-[10px] type-jp-body text-text-primary"
              >
                PNG で保存
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="block w-full text-left px-[var(--space-16)] py-[10px] type-jp-body text-text-primary"
              >
                SVG で保存
              </button>
              <p className="px-[var(--space-16)] pt-[var(--space-4)] pb-[var(--space-8)] type-jp-micro-label text-text-tertiary leading-[1.5]">
                拡大しても劣化しないSVGは、印刷業者への入稿やメニュー表への埋め込み向け
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
