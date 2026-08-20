"use client";

/**
 * 印刷状況（厨房プリンタの監視と伝票の刷り直し）
 *
 * 営業中にプリンタが止まっても誰も気づけない、という状態を無くすための画面。
 * 上から「プリンタは生きているか」→「まだ出ていない伝票」→「最近出た伝票」の順。
 *
 * - プリンタの生存は printer_status.last_seen_at（supabase/printer_status.sql）。
 *   プリンタが問い合わせに来るたびにサーバー側で更新される
 * - 刷り直しは requeue_print_job RPC。print_jobs には authenticated 向けの
 *   UPDATE ポリシーを置いていないので、必ずこの関数を通す
 * - 3秒ごとに再取得する。厨房・テイクアウト画面と同じ間隔に揃えてある
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import PrinterHealthCard from "@/components/admin/print/PrinterHealthCard";
import PrintJobRowCard from "@/components/admin/print/PrintJobRowCard";
import {
  describePrinterHealth,
  type PrintJobRow,
  type PrinterStatusRow,
} from "@/lib/printStatus";

/** 「最近出た伝票」に出す件数。全部出しても使わないので直近だけ */
const RECENT_LIMIT = 20;

export default function PrintStatusPage() {
  const [jobs, setJobs]         = useState<PrintJobRow[]>([]);
  const [printer, setPrinter]   = useState<PrinterStatusRow | null>(null);
  const [loading, setLoading]   = useState(true);
  const [requeueing, setRequeueing] = useState<string | null>(null);
  const [now, setNow]           = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const [jobRes, printerRes] = await Promise.all([
        supabase
          .from("print_jobs")
          .select("id, status, seq, attempts, last_error, created_at, orders(table_label, pickup_no, order_type)")
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT + 30),
        supabase
          .from("printer_status")
          .select("last_seen_at, last_status_at, status_note")
          .maybeSingle(),
      ]);

      if (jobRes.error) throw jobRes.error;
      if (printerRes.error) throw printerRes.error;

      type JoinedRow = {
        id: string;
        status: PrintJobRow["status"];
        seq: number;
        attempts: number;
        last_error: string | null;
        created_at: string;
        // PostgREST の埋め込みは1対1でもオブジェクト/配列どちらでも返りうる
        orders: { table_label: string | null; pickup_no: number | null; order_type: "dine_in" | "takeout" }
              | Array<{ table_label: string | null; pickup_no: number | null; order_type: "dine_in" | "takeout" }>
              | null;
      };

      setJobs(
        ((jobRes.data ?? []) as JoinedRow[]).map((r) => {
          const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
          return {
            id: r.id,
            status: r.status,
            seq: r.seq,
            attempts: r.attempts,
            lastError: r.last_error,
            createdAt: r.created_at,
            tableLabel: order?.table_label ?? null,
            pickupNo: order?.pickup_no ?? null,
            orderType: order?.order_type ?? "dine_in",
          };
        })
      );

      const p = printerRes.data as
        | { last_seen_at: string | null; last_status_at: string | null; status_note: string | null }
        | null;
      setPrinter(
        p ? { lastSeenAt: p.last_seen_at, lastStatusAt: p.last_status_at, statusNote: p.status_note } : null
      );
    } catch (err) {
      console.error("[PrintStatusPage] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) void load(); };
    run();
    const dataInterval = setInterval(run, 3000);
    // 「◯分前」の表記だけを進めるための別タイマー
    const tickInterval = setInterval(() => { if (!cancelled) setNow(Date.now()); }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, [load]);

  /* ── 刷り直し ── */
  const handleRequeue = async (jobId: string) => {
    const prev = jobs;
    setRequeueing(jobId);
    // 楽観：先に「未印刷」へ戻す。プリンタは次の問い合わせで取りに来る
    setJobs((js) =>
      js.map((j) => (j.id === jobId ? { ...j, status: "pending", attempts: 0, lastError: null } : j))
    );
    try {
      const { error } = await supabase.rpc("requeue_print_job", { p_job_id: jobId });
      if (error) throw error;
      await load();
    } catch (err) {
      console.error("[PrintStatusPage] handleRequeue failed:", err);
      setJobs(prev);
    } finally {
      setRequeueing(null);
    }
  };

  const health   = describePrinterHealth(printer, now);
  const waiting  = jobs.filter((j) => j.status !== "done");
  const recent   = jobs.filter((j) => j.status === "done").slice(0, RECENT_LIMIT);

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="印刷状況"
            count={waiting.length > 0 ? `未印刷 ${waiting.length}件` : "未印刷なし"}
            onMenuClick={openDrawer}
          />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-16)] lg:pb-[var(--space-32)]">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-24)] max-w-[840px]">
                <PrinterHealthCard view={health} />

                <section>
                  <h2 className="type-jp-body-bold text-text-primary mb-[var(--space-12)]">
                    出ていない伝票
                  </h2>
                  {waiting.length === 0 ? (
                    <p className="bg-surface-white rounded-[var(--radius-md)] border border-border py-[var(--space-32)] text-center type-jp-body text-text-tertiary">
                      すべて印刷済みです
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-[var(--space-8)]">
                      {waiting.map((job) => (
                        <PrintJobRowCard
                          key={job.id}
                          job={job}
                          now={now}
                          requeueing={requeueing === job.id}
                          onRequeue={() => handleRequeue(job.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h2 className="type-jp-body-bold text-text-primary mb-[var(--space-12)]">
                    最近印刷した伝票
                  </h2>
                  {recent.length === 0 ? (
                    <p className="bg-surface-white rounded-[var(--radius-md)] border border-border py-[var(--space-32)] text-center type-jp-body text-text-tertiary">
                      まだ印刷した伝票はありません
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-[var(--space-8)]">
                      {recent.map((job) => (
                        <PrintJobRowCard
                          key={job.id}
                          job={job}
                          now={now}
                          requeueing={requeueing === job.id}
                          onRequeue={() => handleRequeue(job.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
