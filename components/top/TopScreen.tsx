"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { resolveTable } from "@/lib/tables";
import { useStoreVideo } from "@/lib/useStoreMedia";

function TopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /* 二次元コードの新形式は ?t=<short_code>。
     既存の ?table=<数値> は店舗ですでに印刷・使用されている可能性があるので受け続ける。
     どちらも無い場合はテイクアウト、という既存の判定は変えない。 */
  const shortCode  = searchParams.get("t");
  const tableParam = searchParams.get("table");
  const legacyNumber = tableParam && /^\d+$/.test(tableParam) ? parseInt(tableParam, 10) : null;
  const isTakeoutOnly = !shortCode && legacyNumber === null;

  const setTable      = useCartStore((s) => s.setTable);
  const setTableRef   = useCartStore((s) => s.setTableRef);
  const setOrderType  = useCartStore((s) => s.setOrderType);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);
  const videoRef      = useRef<HTMLVideoElement>(null);

  /* 卓の解決はサーバー往復なので、表示は「解決できたラベル」→「旧形式の数値」の順で
     フォールバックする。読み込み中に卓名が空欄になるとお客様が不安になるため */
  /* 表示は短縮形（"C-1"）。上に "TABLE" のラベルが出ているうえ、
     6xlの大きな文字なので "カウンター C-1" だと390px幅に収まらない。
     ストアに入れる（＝注文に残す）のはフルラベルの方。 */
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [tableResolved, setTableResolved] = useState(false);
  const tableDisplay = resolvedLabel ?? (legacyNumber !== null ? String(legacyNumber) : null);

  useEffect(() => {
    if (isTakeoutOnly) return;
    let cancelled = false;
    (async () => {
      const t = await resolveTable(shortCode, legacyNumber);
      if (cancelled) return;
      if (t) {
        setResolvedLabel(t.shortLabel);
        setTableRef(t.id, t.label);
        // table_number 列は残っているので、旧番号が分かる場合はそのまま入れておく
        setTable(t.legacyNumber ?? legacyNumber ?? 0);
      } else if (legacyNumber !== null) {
        // 移行前のカードで、まだ tables に無い番号。数値のまま従来どおり動かす
        setTableRef(null, String(legacyNumber));
        setTable(legacyNumber);
      }
      // 解決できなかった（＝二次元コードが古い/DBに無い）場合もボタンは開ける。
      // 押せないまま詰まるより、卓名なしで注文が通る方がお客様の被害が小さい
      setTableResolved(true);
    })();
    return () => { cancelled = true; };
  }, [isTakeoutOnly, shortCode, legacyNumber, setTable, setTableRef]);

  /* ── 背景動画（管理画面「店舗設定 > トップページ」で差し替える） ──
     取得が終わるまでは描画しない。表示OFF・動画なしのときも同じで、
     背景は下に敷いた黒のままになる（白文字が読めなくならないようにする）。 */
  const bgVideo = useStoreVideo("landing_background");
  const bgUrl = bgVideo.loaded && bgVideo.media.enabled ? bgVideo.media.url : null;

  // iOS Safari では autoplay に playsinline が必須
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, [bgUrl]);

  const handleStart = () => {
    if (isTakeoutOnly) {
      setOrderType("takeout");
      setTakeoutMode(false);
      router.push("/order/takeout");
    } else {
      setOrderType("dine_in");
      setTakeoutMode(false);
      // /order 側は卓の識別に使っていない（ストアに入っている）ので、
      // 表示用のパラメータだけ引き継ぐ
      router.push(shortCode ? `/order?t=${shortCode}` : `/order?table=${legacyNumber}`);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden">

      {/* ── 背景 ────────────────────────────────────────── */}
      {/* 動画の下に敷く黒。動画が無い／表示OFFのときはこれだけが残る。
          Suspense の fallback と同じ色にしてあり、白文字の可読性を保つ。 */}
      <div className="absolute inset-0 bg-black" />

      {/* ── 背景動画 ────────────────────────────────────── */}
      {/* poster: 動画の1フレーム目（64KB）。動画本体のデコードが終わるまでの
          一瞬の黒画面を消すために置いている。LCPもこちらで先に確定する。 */}
      {bgUrl && (
        <video
          ref={videoRef}
          src={bgUrl}
          poster={bgVideo.media.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── オーバーレイ 30% ─────────────────────────────── */}
      <div className="absolute inset-0 bg-black/65" />

      {/* ── コンテンツ（動画・オーバーレイより手前） ──────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-between min-h-screen px-6 py-12">

        {/* 上部装飾 */}
        <div className="w-12 h-px bg-white/50" />

        {/* 中央ブロック */}
        <div className="flex flex-col items-center gap-10">

          {/* ロゴ */}
          <Image
            src="/images/logo/logo.webp"
            alt="YORKYS BRUNCH"
            width={220}
            height={120}
            className="object-contain drop-shadow-lg"
            priority
          />

          {/* ── テーブル番号 / テイクアウト表示 ── */}
          {isTakeoutOnly ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <p
                className="text-[10px] tracking-[0.35em] uppercase text-white/50"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                Takeout
              </p>
              <div className="flex items-center gap-4">
                <span className="text-4xl">🛍</span>
                <span
                  className="text-2xl font-light leading-none tracking-wide text-white"
                >
                  テイクアウト注文
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white">
              <p
                className="text-[10px] tracking-[0.35em] uppercase text-white/50"
                style={{ fontFamily: "HalisR, sans-serif" }}
              >
                Table
              </p>
              <div className="flex items-center gap-5">
                <div className="w-8 h-px bg-white/30" />
                <span
                  className="text-6xl font-light leading-none tracking-tight text-white"
                  style={{ fontFamily: "HalisR, sans-serif" }}
                >
                  {tableDisplay ?? "—"}
                </span>
                <div className="w-8 h-px bg-white/30" />
              </div>
            </div>
          )}

          {/* ── ウェルカムメッセージ ── */}
          <p className="text-sm text-white/75 text-center leading-[2] px-2 tracking-wide">
            この度はご来店いただき<br />
            誠にありがとうございます。<br />
            素敵な時間をお過ごしくださいませ。
          </p>

          {/* ── メニューを見るボタン ──
              卓の解決はサーバー往復なので、終わる前にタップされると
              卓が特定できないまま注文される（厨房に卓名が出ない）。
              店内注文のときだけ解決完了までボタンを止める。 */}
          <button
            onClick={handleStart}
            disabled={!isTakeoutOnly && !tableResolved}
            className="w-full max-w-xs border border-white/60 bg-white/10 backdrop-blur-sm text-white rounded-2xl py-4 text-sm font-medium tracking-wide active:bg-white/20 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100"
          >
            {isTakeoutOnly
              ? "テイクアウトメニューを見る"
              : tableResolved ? "メニューを見る" : "読み込み中…"}
          </button>
        </div>

        {/* 下部クレジット */}
        <p
          className="text-[10px] text-white/40 tracking-widest"
          style={{ fontFamily: "HalisR, sans-serif" }}
        >
          POWERED BY GOOD ORDER
        </p>
      </div>
    </main>
  );
}

export default function TopScreen() {
  return (
    <div className="mx-auto max-w-md min-h-screen relative overflow-hidden">
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <TopContent />
      </Suspense>
    </div>
  );
}
