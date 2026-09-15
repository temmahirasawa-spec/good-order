"use client";

/**
 * ご来店が終わったあとの画面（2026-09-15、洋輔さんの依頼）
 *
 * レジで「会計済みにする」が押されると、この端末からは注文できなくなる。
 * それまでは退店後でも無期限に注文できてしまっていた（lib/visitSession.ts）。
 *
 * 注文に関わる画面（トップ・カテゴリー一覧・カート・ハンバーガーメニュー）を
 * これで包む。終わっていなければ中身をそのまま出すので、ふだんは何も起きない。
 *
 * ⚠ **行き止まりにしない。** もう一度ご注文いただく道（二次元コードを読み直す）を
 * 必ず書く。テイクアウト画面の空の状態と同じ考え方。
 */
import { useEffect, useState } from "react";
import { isVisitClosed, refreshVisitClosed } from "@/lib/visitSession";

/** 会計が反映されるまでの間、少しだけ様子を見る間隔 */
const POLL_MS = 15_000;

export default function VisitClosedGate({ children }: { children: React.ReactNode }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* すでに締まっていれば即座に。まだなら問い合わせて確かめる */
    if (isVisitClosed()) setClosed(true);

    const check = async () => {
      const done = await refreshVisitClosed();
      if (!cancelled && done) setClosed(true);
    };
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (!closed) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-[var(--space-16)] px-[var(--space-24)] py-[var(--space-48)]">
      <p className="type-en-display-l text-text-primary">THANK YOU</p>
      <h1 className="type-jp-heading-m text-text-primary text-center">
        ご来店ありがとうございました
      </h1>
      <p className="type-jp-body text-text-secondary text-center">
        お会計が完了しました。
        追加でご注文される場合は、お手数ですがテーブルの二次元コードをもう一度読み取ってください。
      </p>
      <p className="type-jp-caption text-text-tertiary text-center mt-[var(--space-8)]">
        ご不明な点はスタッフまでお声がけください。
      </p>
    </div>
  );
}
