"use client";

/**
 * カテゴリーコード（A〜Z）の選択UI
 * （Figma: Popover / コード選択 — PC 543:793 / Half Modal / コード選択 — SP 543:848）
 *
 * コード欄を自由入力にしない理由: 自由入力だと「小文字が入る」「2文字打てる」
 * 「他カテゴリーと重複する」の3つが必ず起きて、後からバリデーションで弾くことになる。
 * 選択式にすれば入力の時点で全部防げる。
 * 他カテゴリーが使用中のコードは押せない状態にする（押してからエラーを出すより親切）。
 *
 * PCはコード欄直下のポップオーバー（7列×4行・セル36px）、
 * SPはハーフモーダル（6列・セル51px＝タップ推奨最小44pxを上回る）。
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export default function CodePicker({
  open,
  value,
  usedCodes,
  anchorRef,
  onSelect,
  onClose,
}: {
  open: boolean;
  value: string;
  /** 他のカテゴリーが使用中のコード（自分自身のコードは含めない） */
  usedCodes: string[];
  /** PCのポップオーバーを開く基準になるコード欄 */
  anchorRef: React.RefObject<HTMLElement>;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const pcRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  /* モーダル本体は overflow-y-auto なので、ポップオーバーを普通に絶対配置すると
     下半分が切られる。トリガーの実測位置から position:fixed で置く。 */
  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const width = 364;
      const height = 240;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      // 下に入り切らないときは上側に出す
      const below = r.bottom + 4;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 4) : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (pcRef.current && !pcRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const cell = (code: string, size: string) => {
    const disabled = usedCodes.includes(code);
    const active = code === value;
    return (
      <button
        key={code}
        type="button"
        disabled={disabled}
        onClick={() => { onSelect(code); onClose(); }}
        className={`${size} rounded-[var(--radius-sm)] flex items-center justify-center type-en-data-m ${
          active
            ? "bg-surface-ink text-text-inverse"
            : disabled
              ? "bg-bg-tertiary text-text-disabled opacity-45 cursor-not-allowed"
              : "bg-surface-white border border-border-divider text-text-primary"
        }`}
      >
        {code}
      </button>
    );
  };

  return (
    <>
      {/* ── PC: コード欄直下のポップオーバー ── */}
      <div
        ref={pcRef}
        className="hidden lg:block fixed z-[80] bg-surface-white rounded-[var(--radius-md)] p-[var(--space-16)] w-[364px]"
        style={{ boxShadow: "var(--shadow-float)", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      >
        <p className="type-jp-micro-label text-text-secondary mb-[var(--space-12)]">
          コードを選択（使用済みは選べません）
        </p>
        <div className="grid grid-cols-7 gap-[var(--space-8)]">
          {LETTERS.map((c) => cell(c, "w-[36px] h-[36px]"))}
        </div>
      </div>

      {/* ── SP: ハーフモーダル ── */}
      <div className="lg:hidden fixed inset-0 z-[70] flex items-end bg-black/50" onClick={onClose}>
        <div
          className="w-full bg-surface-white rounded-t-[var(--radius-xl)] px-[var(--space-20)] pt-[var(--space-24)] pb-[var(--space-32)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="type-jp-heading-s text-text-primary mb-[var(--space-4)]">コードを選択</p>
          <p className="type-jp-caption text-text-secondary mb-[var(--space-16)]">
            他のカテゴリーで使用済みのコードは選べません
          </p>
          <div className="grid grid-cols-6 gap-[var(--space-8)]">
            {LETTERS.map((c) => cell(c, "w-full h-[51px]"))}
          </div>
        </div>
      </div>
    </>
  );
}
