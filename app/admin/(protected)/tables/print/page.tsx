"use client";

/**
 * 卓上カードのA4面付け印刷ビュー（Step3-O）
 * Figma: Print Sheet A4 (名刺サイズ10面) 529:5209 / Print Card (91x55mm) 529:5037
 *
 * **別ルートにしている理由**: 管理画面のシェル（AdminPageShell）は
 * `h-screen` + `overflow:hidden` の固定レイアウトで、同じDOMに @media print を
 * 被せてもページ送りが効かず1ページ目しか出ない。印刷専用のページに分けて、
 * サイドバーもTop Barも無い素のドキュメントとして組む方が確実。
 *
 * 面付けは mm 指定（`@page { size: A4; margin: 0 }`）。96dpi換算のpxで組むと
 * ブラウザのスケーリング設定で実寸がずれ、名刺トレイに合わなくなる。
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import QrCodeImage from "@/components/admin/tables/QrCodeImage";
import { tableOrderUrl } from "@/lib/qrCode";
import { fetchTableGroups, tableFullLabel } from "@/lib/tables";

const TAKEOUT_KEY = "__takeout__";
/** A4に2列×5行＝10面 */
const PER_PAGE = 10;

interface PrintCard {
  key: string;
  label: string;
  url: string;
}

export default function TablesPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  );
}

function PrintContent() {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<PrintCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const codes = useMemo(
    () => (searchParams.get("codes") ?? "").split(",").filter(Boolean),
    [searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const origin = window.location.origin;
      const byShortCode = new Map<string, string>();
      try {
        for (const g of await fetchTableGroups()) {
          for (const t of g.tables) {
            byShortCode.set(t.short_code, tableFullLabel(g.category.name, g.category.code, t.number));
          }
        }
      } catch (e) {
        // ラベルが引けなくても二次元コード自体は short_code だけで作れる。
        // 印刷ジョブを丸ごと落とすより、卓名だけコード表記で刷れる方が実害が小さい
        console.error("[tables/print] label lookup failed:", e);
        if (!cancelled) setError("卓名を読み込めませんでした。卓名の代わりにコードを表示しています");
      }
      const list: PrintCard[] = codes.map((code) =>
        code === TAKEOUT_KEY
          ? { key: code, label: "テイクアウト", url: tableOrderUrl(origin, null) }
          : {
              key: code,
              label: byShortCode.get(code) ?? code,
              url: tableOrderUrl(origin, code),
            }
      );
      if (!cancelled) setCards(list);
    })();
    return () => { cancelled = true; };
  }, [codes]);

  const pages = useMemo(() => {
    if (!cards) return [];
    const out: PrintCard[][] = [];
    for (let i = 0; i < cards.length; i += PER_PAGE) out.push(cards.slice(i, i + PER_PAGE));
    return out;
  }, [cards]);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          .print-hide { display: none !important; }
          .print-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .print-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      <div className="min-h-screen bg-bg-secondary">
        {/* 画面上だけのツールバー。印刷時は消える */}
        <div className="print-hide sticky top-0 z-10 bg-surface-white border-b border-border-divider flex flex-wrap gap-[var(--space-12)] items-center justify-between px-[var(--space-24)] py-[var(--space-12)]">
          <div className="flex flex-col">
            <p className="type-jp-heading-s text-text-primary">卓上カードの印刷</p>
            <p className="type-jp-caption text-text-secondary">
              名刺サイズ（91×55mm）10面 / A4 ・ {cards?.length ?? 0}件 ・ {pages.length}ページ
            </p>
          </div>
          <div className="flex gap-[var(--space-12)] items-center">
            <button
              type="button"
              onClick={() => window.close()}
              className="bg-bg-tertiary rounded-[var(--radius-full)] px-[var(--space-16)] py-[9px] type-jp-body text-text-primary"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!cards || cards.length === 0}
              className="bg-surface-ink rounded-[var(--radius-full)] px-[var(--space-20)] py-[10px] type-jp-heading-s text-text-inverse disabled:opacity-40"
            >
              印刷する
            </button>
          </div>
        </div>

        {error && (
          <p className="print-hide px-[var(--space-24)] py-[var(--space-16)] type-jp-body text-status-urgent">
            {error}
          </p>
        )}

        <div className="flex flex-col items-center gap-[var(--space-24)] py-[var(--space-24)]">
          {pages.map((page, pi) => (
            <div
              key={pi}
              className="print-sheet bg-white"
              style={{
                width: "210mm",
                height: "297mm",
                paddingLeft: "14mm",
                paddingRight: "14mm",
                paddingTop: "11mm",
                paddingBottom: "11mm",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "91mm 91mm",
                  gridTemplateRows: "repeat(5, 55mm)",
                  justifyContent: "center",
                  alignContent: "center",
                  height: "100%",
                }}
              >
                {Array.from({ length: PER_PAGE }, (_, i) => {
                  const card = page[i];
                  return (
                    <div
                      key={i}
                      style={{
                        // カードの境界に沿った薄いグレーの切り取り線
                        border: "0.2mm solid #E6E6E6",
                        display: "flex",
                        alignItems: "center",
                        gap: "4mm",
                        padding: "6mm 6mm",
                        overflow: "hidden",
                      }}
                    >
                      {card && <PrintCardBody label={card.label} url={card.url} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * 卓上カード1枚の中身。
 * 二次元コードだけ置いても卓上では機能しないので、ロゴ・案内文・卓名を添える。
 * コードは実寸で約31mm。読み取り距離の目安は「コード幅の10倍」なので30cm離れても読める。
 */
function PrintCardBody({ label, url }: { label: string; url: string }) {
  return (
    <>
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "3mm" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6mm" }}>
          <span
            className="font-halis"
            style={{ fontFamily: "HalisR, sans-serif", fontSize: "5.2mm", lineHeight: 1.05, letterSpacing: "0.02em", color: "#1A1A1A" }}
          >
            YORKYS
          </span>
          <span
            className="font-halis"
            style={{ fontFamily: "HalisR, sans-serif", fontSize: "5.2mm", lineHeight: 1.05, letterSpacing: "0.02em", color: "#1A1A1A" }}
          >
            BRUNCH
          </span>
          <span
            className="font-halis"
            style={{ fontFamily: "HalisR, sans-serif", fontSize: "1.9mm", lineHeight: 1.2, letterSpacing: "0.14em", color: "#646464" }}
          >
            GOOD BRUNCH, GREAT DAY!
          </span>
        </div>

        <p className="type-jp-body" style={{ fontSize: "3.1mm", lineHeight: 1.5, color: "#1A1A1A" }}>
          スマホでご注文いただけます
        </p>

        <span
          style={{
            alignSelf: "flex-start",
            background: "#EFEFEF",
            borderRadius: "999px",
            padding: "1.4mm 3.2mm",
            fontSize: "3.4mm",
            lineHeight: 1.2,
            fontWeight: 700,
            color: "#1A1A1A",
          }}
        >
          {/* ラベル自体が「カウンター C-1」と自己説明的なので「テーブル」の接頭辞は付けない */}
          {label}
        </span>
      </div>

      {/* 実寸で約31mm。読み取り距離の目安「コード幅の10倍」＝30cm離れても読める */}
      <QrCodeImage url={url} size={512} cssSize="31mm" />
    </>
  );
}
