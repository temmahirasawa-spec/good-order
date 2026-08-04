"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { resolveTable } from "@/lib/tables";
import { useStoreVideo } from "@/lib/useStoreMedia";
import { resolveLandingBackground } from "@/lib/storeMedia";
import { foregroundColor } from "@/lib/backgroundColor";

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

  /* ── 背景（管理画面「表示設定 > 動画設定」で差し替える） ──
     色 / 画像 / 動画 のどれかに解決する。判定は lib/storeMedia.ts の
     resolveLandingBackground() に集約していて、**管理画面のプレビューと同じ関数**を通る。
     取得が終わるまでは背景を描画しない（下に敷いた既定色だけが見える）。

     背景タイプは既定が "video" なので、何も設定していない店舗はここまでの挙動と同じ。 */
  const bgMedia = useStoreVideo("landing_background");
  const bg = resolveLandingBackground(bgMedia.media);
  const ready = bgMedia.loaded;
  const bgUrl = ready && bg.kind === "video" ? bg.videoUrl : null;

  /* 文字とロゴの色。画像・動画・未設定は常に白で、色のときだけ明るさで切り替わる。
     取得が終わるまでは白（＝従来どおり）にしておく。 */
  const tone = ready ? bg.tone : "light";
  const isDark = tone === "dark";

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
      {/* 背景タイプが「色」のときは、この1枚がそのまま背景になる。
          **それ以外（動画・画像・未設定・表示OFF）は従来どおり bg-black のまま。**
          ここを既定色に変えてしまうと、動画のままの店舗で地の色が変わってしまい、
          「見た目が1pxも変わらない」という前提が崩れるため、意図的に分けている。 */}
      {bg.kind === "color" ? (
        <div className="absolute inset-0" style={{ backgroundColor: bg.color }} />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}

      {/* ── 背景画像 ────────────────────────────────────── */}
      {ready && bg.kind === "image" && bg.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── 背景動画 ────────────────────────────────────── */}
      {/* poster: 動画の1フレーム目（64KB）。動画本体のデコードが終わるまでの
          一瞬の黒画面を消すために置いている。LCPもこちらで先に確定する。 */}
      {bgUrl && (
        <video
          ref={videoRef}
          src={bgUrl}
          poster={bg.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── 暗幕 65% ─────────────────────────────────────
          写真・動画の上の白文字を読ませるためのもの。
          **背景が「色」のときは敷かない。**敷くと選んだ色が黒く濁り、
          「画面全体がこの色一色で塗られます」という約束が守れなくなる。
          取得が終わるまでは従来どおり敷いておく（動画の店舗で一瞬明るくならないように）。 */}
      {(!ready || bg.overlay) && <div className="absolute inset-0 bg-black/65" />}

      {/* ── コンテンツ（動画・オーバーレイより手前） ──────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-between min-h-screen px-6 py-12">

        {/* 上部装飾 */}
        <div className="w-12 h-px" style={{ backgroundColor: foregroundColor(tone, 0.5) }} />

        {/* 中央ブロック */}
        <div className="flex flex-col items-center gap-10">

          {/* ロゴ。背景が明るいときは黒版に差し替える（白ロゴでは見えないため） */}
          <Image
            src={isDark ? "/images/logo/logoSmallBlack.webp" : "/images/logo/logo.webp"}
            alt="YORKYS BRUNCH"
            width={220}
            height={120}
            className={`object-contain ${isDark ? "" : "drop-shadow-lg"}`}
            priority
          />

          {/* ── テーブル番号 / テイクアウト表示 ── */}
          {isTakeoutOnly ? (
            <div
              className="flex flex-col items-center gap-3"
              style={{ color: foregroundColor(tone) }}
            >
              <p
                className="text-[10px] tracking-[0.35em] uppercase"
                style={{ fontFamily: "HalisR, sans-serif", color: foregroundColor(tone, 0.5) }}
              >
                Takeout
              </p>
              <div className="flex items-center gap-4">
                <span className="text-4xl">🛍</span>
                <span className="text-2xl font-light leading-none tracking-wide">
                  テイクアウト注文
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-3"
              style={{ color: foregroundColor(tone) }}
            >
              <p
                className="text-[10px] tracking-[0.35em] uppercase"
                style={{ fontFamily: "HalisR, sans-serif", color: foregroundColor(tone, 0.5) }}
              >
                Table
              </p>
              <div className="flex items-center gap-5">
                <div className="w-8 h-px" style={{ backgroundColor: foregroundColor(tone, 0.3) }} />
                <span
                  className="text-6xl font-light leading-none tracking-tight"
                  style={{ fontFamily: "HalisR, sans-serif" }}
                >
                  {tableDisplay ?? "—"}
                </span>
                <div className="w-8 h-px" style={{ backgroundColor: foregroundColor(tone, 0.3) }} />
              </div>
            </div>
          )}

          {/* ── ウェルカムメッセージ ── */}
          <p
            className="text-sm text-center leading-[2] px-2 tracking-wide"
            style={{ color: foregroundColor(tone, 0.75) }}
          >
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
            /* 色は CSS変数経由で渡す。インラインの backgroundColor にすると
               active: の指定に勝ってしまい、タップしたときの反応（bg-white/20 相当）が
               効かなくなるため。light のときの実効値は従来の
               border-white/60・bg-white/10・text-white・active:bg-white/20 と同じ。 */
            className="w-full max-w-xs border border-[var(--fg-line)] bg-[var(--fg-fill)] text-[var(--fg-text)] backdrop-blur-sm rounded-2xl py-4 text-sm font-medium tracking-wide active:bg-[var(--fg-fill-active)] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100"
            style={
              {
                "--fg-line": foregroundColor(tone, 0.6),
                "--fg-fill": foregroundColor(tone, 0.1),
                "--fg-fill-active": foregroundColor(tone, 0.2),
                "--fg-text": foregroundColor(tone),
              } as React.CSSProperties
            }
          >
            {isTakeoutOnly
              ? "テイクアウトメニューを見る"
              : tableResolved ? "メニューを見る" : "読み込み中…"}
          </button>
        </div>

        {/* 下部クレジット */}
        <p
          className="text-[10px] tracking-widest"
          style={{ fontFamily: "HalisR, sans-serif", color: foregroundColor(tone, 0.4) }}
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
