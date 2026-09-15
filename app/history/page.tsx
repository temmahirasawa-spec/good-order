"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { AddToCartButton } from "@/components/ui/Buttons";
import { fetchFeatureToggles, FEATURES_DEFAULT, type FeatureToggles } from "@/lib/features";
import FloatingStaffCall from "@/components/FloatingStaffCall";
import { loadHistory, updateHistoryStatus, updateHistoryPickupNo, type HistoryEntry } from "@/lib/history";
import { fetchOrderStatuses } from "@/lib/api";
import { formatSelectedOptions } from "@/lib/menuOptions";
import { PICKUP_NO_LABEL, formatPickupNo } from "@/lib/pickupNo";

/* **お客様の画面に「調理中／提供済み」は出さない**（天真の指示 2026-09-15）。
   厨房の画面を使わない運用があり、その場合この状態は動かないまま残るので、
   出すとかえって誤解を招く。状態は取り込みだけ続ける（将来出すときのため）。 */

function formatDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  /* 使わない機能の導線は出さない（管理画面「表示設定 ＞ 使う機能」） */
  const [features, setFeatures] = useState<FeatureToggles>(FEATURES_DEFAULT);
  useEffect(() => {
    let cancelled = false;
    void fetchFeatureToggles()
      .then((f) => { if (!cancelled) setFeatures(f); })
      .catch((err) => console.warn("[history] fetchFeatureToggles failed:", err));
    return () => { cancelled = true; };
  }, []);

  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  /* ── 初期ロード：LocalStorage から読む ── */
  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  /* ── DB から最新ステータスを 5 秒毎に取得してマージ ── */
  useEffect(() => {
    const initial = loadHistory();
    if (initial.length === 0) return;
    const ids = initial.map((e) => e.orderId);

    let cancelled = false;
    const sync = async () => {
      try {
        // orders への直接SELECTはauthenticated限定のため、ステータスと受渡番号だけを
        // 返すRPC経由で取得する（supabase/orders_anon_lockdown.sql + pickup_no.sql）
        const rows = await fetchOrderStatuses(ids);
        if (cancelled) return;
        const rowMap = new Map(rows.map((r) => [r.id, r]));
        setEntries((prev) => {
          if (!prev) return prev;
          let changed = false;
          const next = prev.map((e) => {
            const r = rowMap.get(e.orderId);
            if (!r) return e;
            let merged = e;
            if (r.status !== e.status) {
              changed = true;
              updateHistoryStatus(e.orderId, r.status as HistoryEntry["status"]);
              merged = { ...merged, status: r.status as HistoryEntry["status"] };
            }
            if (r.pickup_no !== null && r.pickup_no !== e.pickupNo) {
              changed = true;
              updateHistoryPickupNo(e.orderId, r.pickup_no);
              merged = { ...merged, pickupNo: r.pickup_no };
            }
            return merged;
          });
          return changed ? next : prev;
        });
      } catch {
        // RLS 未緩和・ネットワーク不調 等は黙ってスキップ（LocalStorage のステータスを表示）
      }
    };
    sync();
    const t = setInterval(sync, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  /* **「今日」「過去」で分けない**（天真の指示 2026-09-15）。
     1人あたり1回のご来店ぶんしか入らないので、分けても意味が無く、
     見出しが2つ出るぶんかえって読みにくかった。新しい順に並べるだけにする。 */
  const orders = useMemo(
    () => (entries ?? []).slice().sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)),
    [entries]
  );

  /* **再注文ボタンは無くした**（天真の指示 2026-09-15）。
     同じ内容を頼み直すことはほとんど無く、カートの中身と混ざる確認まで出していて
     操作が重かった。もう一度頼むときはメニューから選んでもらう。 */

  const totalCount = entries?.length ?? 0;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col gap-[var(--space-20)]">
      <div className="sticky top-0 z-30 flex flex-col">
        <OrderHeader variant="close" />
      </div>

      {/* 見出し（カテゴリー一覧・テイクアウトと同じ形） */}
      <div className="flex flex-col gap-[var(--space-4)] pt-[4px] px-[var(--space-24)]">
        <p className="type-en-display-l text-text-primary">ORDER HISTORY</p>
        <p className="type-jp-body-small text-text-primary">注文履歴</p>
      </div>

      <main className="flex-1 px-[var(--space-16)] pb-[110px]">
        {entries === null ? (
          <div className="flex justify-center py-[var(--space-48)]">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
          </div>
        ) : totalCount === 0 ? (
          <EmptyState onBack={() => router.push("/order")} />
        ) : (
          <>
            <p className="type-jp-caption text-text-secondary mb-[var(--space-16)]">{totalCount} 件</p>

            <div className="flex flex-col gap-[var(--space-12)]">
              {orders.map((o) => (
                <OrderCard key={o.orderId} entry={o} />
              ))}
            </div>

            <p className="type-jp-caption text-text-tertiary text-center mt-[var(--space-24)]">
              ※ 履歴はこの端末にのみ保存されます
            </p>
          </>
        )}
      </main>

      {/* 使わない設定のときは出さない（lib/features.ts） */}
      {features.staffCall && <FloatingStaffCall />}
      <BottomViewCartBar />
    </div>
  );
}

function OrderCard({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="bg-surface-white rounded-[var(--radius-md)] border border-border overflow-hidden">
      {/* ── 見出し（日時と席） ── */}
      <div className="flex items-start justify-between gap-[var(--space-12)] px-[var(--space-16)] pt-[var(--space-16)] pb-[var(--space-12)]">
        <div className="min-w-0">
          {/* 受渡番号はテイクアウトのみ（店内は配膳なので出さない。/complete と同じ方針） */}
          {entry.orderType === "takeout" && entry.pickupNo != null && (
            <>
              <p className="type-jp-caption text-text-tertiary leading-none">{PICKUP_NO_LABEL}</p>
              <p className="type-en-display-s text-text-primary leading-tight">
                {formatPickupNo(entry.pickupNo)}
              </p>
            </>
          )}
          <p className="type-jp-body-bold text-text-primary">{formatDate(entry.orderedAt)}</p>
          <p className="type-jp-caption text-text-tertiary mt-[2px]">
            {entry.orderType === "takeout"
              ? "テイクアウト"
              /* 移行前の履歴には tableLabel が無いので元の数値にフォールバックする */
              : entry.tableLabel ?? String(entry.tableNumber)}
          </p>
        </div>
      </div>

      {/* ── 明細。**1行に1品**（天真の指示 2026-09-15）。
             それまで品名を「、」でつないだ1本の文章で、読みにくかった ── */}
      <div className="flex flex-col border-t border-border-divider">
        {entry.items.map((it, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-[var(--space-8)] px-[var(--space-16)] py-[var(--space-12)] border-b border-border-divider last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="type-jp-body text-text-primary">{it.name}</p>
              {/* オプションと「食後」は品名の下に小さく。行の中に混ぜると品名が読みにくい */}
              {((it.options && it.options.length > 0) || it.servingTiming === "after_meal") && (
                <p className="type-jp-caption text-text-tertiary mt-[2px]">
                  {[
                    it.options && it.options.length > 0 ? formatSelectedOptions(it.options) : null,
                    it.servingTiming === "after_meal" ? "食後" : null,
                  ].filter(Boolean).join(" / ")}
                </p>
              )}
            </div>
            <span className="type-jp-caption text-text-secondary shrink-0 w-[32px] text-right">
              ×{it.quantity}
            </span>
            <span className="type-en-price-s text-text-primary shrink-0 w-[72px] text-right">
              ¥{(it.unitPrice * it.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* ── 合計 ── */}
      <div className="flex items-center justify-between bg-bg-secondary px-[var(--space-16)] py-[var(--space-12)]">
        <span className="type-jp-caption-bold text-text-primary">合計（税込）</span>
        <span className="type-en-price-m text-text-primary">
          ¥{entry.totalAmount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-[var(--space-16)] px-[var(--space-24)] py-[var(--space-48)]">
      <p className="type-jp-heading-s text-text-primary text-center">
        まだご注文はありません
      </p>
      <p className="type-jp-body text-text-secondary text-center">
        ご注文が確定すると、ここに品名と金額が残ります。
      </p>
      <div className="w-full max-w-[280px] mt-[var(--space-8)]">
        <AddToCartButton label="メニューを見る" onClick={onBack} />
      </div>
      <p className="type-jp-caption text-text-tertiary text-center">
        ※ 履歴はこの端末にのみ保存されます
      </p>
    </div>
  );
}
