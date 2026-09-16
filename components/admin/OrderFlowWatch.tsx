"use client";

/**
 * 注文が店に届いていないことに、レジ画面で気づけるようにする見張り（2026-09-16）
 *
 * 本番は厨房画面 OFF・スタッフ呼び出し OFF で、注文が店に届く経路は厨房プリンタの
 * 伝票1本しか無い。ところが
 *   - 伝票ジョブの作成に失敗しても注文は「成功」になる（enqueue_print_job は例外を握りつぶす）
 *   - 印刷に失敗しても、プリンタが止まっても、Sentry にも Slack にも何も飛ばない
 *   - レジ画面は通信が切れても古い一覧を出し続け、エラーを出さない
 * ため、「伝票が1枚出ないだけで、その注文は誰にも見えない」状態だった
 * （docs/preopen-verify-2026-09-16.md の I1 / I3 / O2 / P1）。
 *
 * ここでは印刷状況（/admin/print）と同じデータを5秒ごとに読み、異常があるときだけ
 * 赤い帯をレジ画面の上に出す。正常なときは細い1行で「見張りが動いている」ことだけ示す。
 * 判定の閾値は印刷まわりの既存の値（lib/printStatus.ts の60秒、reclaim の2分）に揃えている。
 *
 * 音は鳴らさない（レジの通知音は Figma 移行時に意図して外している。register/page.tsx 冒頭）。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { businessDateToday } from "@/lib/dateFormat";
import { PRINTER_OFFLINE_AFTER_MS, formatSince } from "@/lib/printStatus";

/** 読み直す間隔。レジ一覧の3秒より少し粗くして往復を増やしすぎない */
const POLL_MS = 5_000;
/** 未印刷（pending）がこの時間を超えたら「出ていない」とみなす。プリンタは約6秒おきに取りに来る */
const PENDING_TOO_LONG_MS = 45_000;
/** 渡したまま報告が無い（printing）。reclaim_stale_print_jobs の2分と同じ */
const PRINTING_TOO_LONG_MS = 120_000;
/** 注文からこの時間が経っても伝票ジョブが無ければ「作られていない」とみなす */
const NO_JOB_AFTER_MS = 20_000;
/** レジ一覧・この見張り自体が取れていない時間。3〜5秒間隔のポーリングが3回続けて失敗した長さ */
const CONNECTION_STALE_MS = 15_000;

export interface WatchAlert {
  tone: "urgent" | "warning";
  text: string;
}

interface WatchSummary {
  printedToday: number;
  printerSeenAt: string | null;
}

export default function OrderFlowWatch({
  /** レジ一覧を最後に取れた時刻（register/page.tsx）。null は初回読み込み前 */
  lastLoadedAt,
  /** /dev/ui 用。渡すと DB を読まずにこの内容を出す */
  preview,
}: {
  lastLoadedAt: number | null;
  preview?: { alerts: WatchAlert[]; summary?: WatchSummary };
}) {
  const [alerts, setAlerts] = useState<WatchAlert[]>(preview?.alerts ?? []);
  const [summary, setSummary] = useState<WatchSummary | null>(preview?.summary ?? null);
  /** この見張りの読み込みが最後に成功した時刻 */
  const [watchOkAt, setWatchOkAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (preview) return;
    let cancelled = false;

    const run = async () => {
      try {
        const today = businessDateToday();
        const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const [printerRes, jobsRes, ordersRes] = await Promise.all([
          supabase.from("printer_status").select("last_seen_at, status_note").maybeSingle(),
          supabase
            .from("print_jobs")
            .select("order_id, status, created_at, claimed_at")
            .gte("created_at", sinceIso),
          supabase.from("orders").select("id, created_at").eq("business_date", today),
        ]);
        if (printerRes.error) throw printerRes.error;
        if (jobsRes.error) throw jobsRes.error;
        if (ordersRes.error) throw ordersRes.error;
        if (cancelled) return;

        const t = Date.now();
        const next: WatchAlert[] = [];

        /* ── プリンタの生存と状態 ── */
        const printer = printerRes.data as { last_seen_at: string | null; status_note: string | null } | null;
        if (!printer?.last_seen_at) {
          next.push({ tone: "warning", text: "プリンタがまだ一度もつながっていません。伝票は出ません。" });
        } else if (t - new Date(printer.last_seen_at).getTime() > PRINTER_OFFLINE_AFTER_MS) {
          next.push({
            tone: "urgent",
            text: `プリンタが応答していません（最後の応答は${formatSince(printer.last_seen_at, t)}）。伝票が出ないので、電源とWi-Fiを確認してください。`,
          });
        }
        if (printer?.status_note) {
          next.push({ tone: "warning", text: `プリンタ: ${printer.status_note}。解消するまで伝票は出ません。` });
        }

        /* ── 伝票ジョブ ── */
        type Job = { order_id: string; status: string; created_at: string; claimed_at: string | null };
        const jobs = (jobsRes.data ?? []) as Job[];
        const orders = (ordersRes.data ?? []) as { id: string; created_at: string }[];
        const todayIds = new Set(orders.map((o) => o.id));
        const todayJobs = jobs.filter((j) => todayIds.has(j.order_id));

        const failed = todayJobs.filter((j) => j.status === "failed").length;
        const stuck = todayJobs.filter(
          (j) =>
            (j.status === "pending" && t - new Date(j.created_at).getTime() > PENDING_TOO_LONG_MS) ||
            (j.status === "printing" &&
              t - new Date(j.claimed_at ?? j.created_at).getTime() > PRINTING_TOO_LONG_MS)
        ).length;
        if (failed > 0) {
          next.push({
            tone: "urgent",
            text: `印刷に失敗した伝票が ${failed} 件あります。紙とカバーを確認してください。数分以内に自動でもう一度出しますが、急ぐときは「印刷状況」の「刷り直す」を押してください。`,
          });
        }
        if (stuck > 0) {
          next.push({
            tone: "urgent",
            text: `出ていない伝票が ${stuck} 件あります。プリンタを確認してください。`,
          });
        }

        /* ── ジョブが作られていない注文（＝厨房に一生届かない） ── */
        const jobOrderIds = new Set(jobs.map((j) => j.order_id));
        const noJob = orders.filter(
          (o) => !jobOrderIds.has(o.id) && t - new Date(o.created_at).getTime() > NO_JOB_AFTER_MS
        ).length;
        if (noJob > 0) {
          next.push({
            tone: "urgent",
            text: `伝票が作られていない注文が ${noJob} 件あります。厨房に届いていません。レジの明細を見て、厨房に口頭で伝えてください。`,
          });
        }

        setAlerts(next);
        setSummary({
          printedToday: todayJobs.filter((j) => j.status === "done").length,
          printerSeenAt: printer?.last_seen_at ?? null,
        });
        setWatchOkAt(t);
      } catch (err) {
        console.error("[OrderFlowWatch] load failed:", err);
      }
    };

    void run();
    const dataInterval = setInterval(() => { if (!cancelled) void run(); }, POLL_MS);
    const tick = setInterval(() => { if (!cancelled) setNow(Date.now()); }, 5_000);
    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(tick);
    };
    // preview は /dev/ui 専用の固定値なので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 接続が切れている（レジ一覧か、この見張り自体が取れていない） ── */
  const staleSince = [lastLoadedAt, watchOkAt]
    .filter((v): v is number => v !== null)
    .map((v) => now - v)
    .reduce((a, b) => Math.max(a, b), 0);
  const disconnected = (lastLoadedAt !== null || watchOkAt !== null) && staleSince > CONNECTION_STALE_MS;

  const shown: WatchAlert[] = disconnected
    ? [
        {
          tone: "urgent",
          text: `サーバーに接続できていません（最終更新 ${Math.floor(staleSince / 1000)} 秒前）。この画面の表示は古い可能性があります。Wi-Fiを確認し、直らなければ画面を再読み込みしてください。`,
        },
        ...alerts,
      ]
    : alerts;

  if (shown.length === 0) {
    return (
      <div className="shrink-0 bg-status-success-subtle border-b border-border-divider px-[var(--space-16)] lg:px-[var(--space-24)] py-[var(--space-8)] flex items-center gap-[var(--space-8)]">
        <span className="shrink-0 w-[6px] h-[6px] rounded-full bg-status-success" />
        <span className="type-jp-caption text-status-success">
          伝票・プリンタ 正常
          {summary && (
            <span className="text-text-tertiary">
              {`（今日の印刷 ${summary.printedToday} 件・プリンタの応答 ${formatSince(summary.printerSeenAt, now)}）`}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex flex-col" role="alert">
      {shown.map((a, i) => (
        <div
          key={i}
          className={`border-b border-border-divider px-[var(--space-16)] lg:px-[var(--space-24)] py-[var(--space-12)] flex items-start gap-[var(--space-12)] ${
            a.tone === "urgent" ? "bg-status-urgent-subtle" : "bg-status-warning-subtle"
          }`}
        >
          <span
            className={`shrink-0 mt-[6px] w-[8px] h-[8px] rounded-full ${
              a.tone === "urgent" ? "bg-status-urgent" : "bg-status-warning"
            }`}
          />
          <p
            className={`type-jp-body-bold flex-1 min-w-0 ${
              a.tone === "urgent" ? "text-status-urgent" : "text-status-warning"
            }`}
          >
            {a.text}
          </p>
          <Link
            href="/admin/print"
            className="shrink-0 px-[var(--space-12)] py-[var(--space-8)] rounded-[var(--radius-sm)] border border-border bg-surface-white type-jp-caption-bold text-text-primary"
          >
            印刷状況を見る
          </Link>
        </div>
      ))}
    </div>
  );
}
