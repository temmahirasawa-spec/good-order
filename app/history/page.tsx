"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { AddToCartButton } from "@/components/ui/Buttons";
import { fetchFeatureToggles, FEATURES_DEFAULT, type FeatureToggles } from "@/lib/features";
import FloatingStaffCall from "@/components/FloatingStaffCall";
import { supabase } from "@/lib/supabase";
import { loadHistory, updateHistoryStatus, updateHistoryPickupNo, type HistoryEntry } from "@/lib/history";
import { MENU_ITEM_COLUMNS, fetchCategories, fetchMenuItemOptions, fetchOrderStatuses, rowToMenuItem, type ApiMenuItem } from "@/lib/api";
import { defaultServingTimingFor } from "@/lib/servingTiming";
import { formatSelectedOptions, type SelectedOption } from "@/lib/menuOptions";
import { PICKUP_NO_LABEL, formatPickupNo } from "@/lib/pickupNo";
import { useCartStore, type CartItem } from "@/lib/store";
import type { MenuItem } from "@/lib/menu";

/* ── お客様側の表示は「調理中」か「提供済み」の 2 状態のみ ── */
type DisplayStatus = "cooking" | "served";

function toDisplayStatus(s: HistoryEntry["status"]): DisplayStatus {
  return s === "served" || s === "picked_up" || s === "paid" ? "served" : "cooking";
}

const DISPLAY_LABEL: Record<DisplayStatus, string> = {
  cooking: "調理中",
  served:  "提供済み",
};

function displayBadgeStyle(d: DisplayStatus): React.CSSProperties {
  if (d === "cooking") {
    return { background: "var(--status-pending-bg)", color: "var(--status-pending)" };
  }
  return { background: "var(--status-served-bg)", color: "var(--status-served)" };
}

function jstYmd(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function todayYmd(): string {
  return jstYmd(new Date().toISOString());
}
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
  const [reorderPrompt, setReorderPrompt] = useState<HistoryEntry | null>(null);

  const addItems   = useCartStore((s) => s.addItems);
  const orderType  = useCartStore((s) => s.orderType);
  const clearCart  = useCartStore((s) => s.clearCart);
  const items      = useCartStore((s) => s.items);

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

  const today = todayYmd();
  const [todayOrders, pastOrders] = useMemo(() => {
    if (!entries) return [[], []] as [HistoryEntry[], HistoryEntry[]];
    const t: HistoryEntry[] = [];
    const p: HistoryEntry[] = [];
    entries.forEach((o) => (jstYmd(o.orderedAt) === today ? t : p).push(o));
    return [t, p];
  }, [entries, today]);

  const doReorder = async (entry: HistoryEntry) => {
    const ids = entry.items.map((i) => i.menuItemId).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const [{ data }, cats, currentOptions] = await Promise.all([
        supabase
          .from("menu_items")
          .select(MENU_ITEM_COLUMNS)
          .in("id", ids)
          .eq("is_available", true)
          // 売り切れは再注文に入れない（カートに入れても注文できないため）
          .eq("is_sold_out", false),
        fetchCategories(),
        // 履歴のオプションは、今も表示中のものだけ引き継ぐ（消えたものは落とす。価格は今の値）
        fetchMenuItemOptions().catch(() => []),
      ]);
      const optionById = new Map(currentOptions.map((o) => [o.id, o]));
      const catMap = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
      const menuById = new Map<string, ApiMenuItem>();
      ((data ?? []) as ApiMenuItem[]).forEach((r) => menuById.set(r.id, r));

      const cartItems: CartItem[] = [];
      for (const it of entry.items) {
        const row = menuById.get(it.menuItemId);
        if (!row) continue;
        // 以前は category / subcategory を "food" / "pancake" に決め打ちしていたため、
        // 再注文した商品のカテゴリタグが全部「パンケーキ」になり、提供タイミングの
        // 対象判定もできなかった。一覧と同じ変換（rowToMenuItem）を通す
        const m: MenuItem = rowToMenuItem(row, catMap);
        if (!m.image && it.image) m.image = it.image;
        cartItems.push({
          item: m,
          quantity: it.quantity,
          // 履歴に残した提供タイミングを引き継ぐ。無ければ今の区分の初期値（選べない商品は null）
          servingTiming: it.servingTiming ?? defaultServingTimingFor(cats, m, orderType),
          options: (it.options ?? [])
            .map((o): SelectedOption | null => {
              const cur = optionById.get(o.optionId);
              return cur && cur.menu_item_id === m.id
                ? { optionId: cur.id, name: cur.name, price: cur.price }
                : null;
            })
            .filter((o): o is SelectedOption => o !== null),
        });
      }
      if (cartItems.length === 0) {
        alert("再注文できる商品が見つかりませんでした（販売終了の可能性）");
        return;
      }
      addItems(cartItems);
      setReorderPrompt(null);
      router.push("/cart");
    } catch (err) {
      alert("再注文の準備に失敗しました: " + String(err));
    }
  };

  const handleReorderClick = (entry: HistoryEntry) => {
    if (entry.orderType !== orderType || items.length > 0) {
      setReorderPrompt(entry);
      return;
    }
    doReorder(entry);
  };

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

            {todayOrders.length > 0 && (
              <section className="mb-[var(--space-24)]">
                <h2 className="type-jp-caption-bold text-text-primary mb-[var(--space-12)]">今日の注文</h2>
                <div className="flex flex-col gap-[var(--space-12)]">
                  {todayOrders.map((o) => (
                    <OrderCard key={o.orderId} entry={o} onReorder={() => handleReorderClick(o)} />
                  ))}
                </div>
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h2 className="type-jp-caption-bold text-text-secondary mb-[var(--space-12)]">過去の注文</h2>
                <div className="flex flex-col gap-[var(--space-12)]">
                  {pastOrders.map((o) => (
                    <OrderCard key={o.orderId} entry={o} onReorder={() => handleReorderClick(o)} />
                  ))}
                </div>
              </section>
            )}

            <p className="type-jp-caption text-text-tertiary text-center mt-[var(--space-24)]">
              ※ 履歴はこの端末にのみ保存されます
            </p>
          </>
        )}
      </main>

      {reorderPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40"
          onClick={() => setReorderPrompt(null)}
        >
          <div className="relative bg-surface-white rounded-[var(--radius-xl)] px-[var(--space-24)] py-[var(--space-24)] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="type-jp-heading-s text-text-primary mb-[var(--space-8)]">同じ内容で注文しますか？</h3>
            <p className="type-jp-body text-text-secondary mb-[var(--space-4)]">
              この注文の {reorderPrompt.items.length} 品をカートに追加します。
            </p>
            {items.length > 0 && (
              <p className="type-jp-caption text-accent-deep mt-[var(--space-8)]">
                ※ 現在のカートに既に {items.length} 件の商品があります
              </p>
            )}
            {reorderPrompt.orderType !== orderType && (
              <p className="type-jp-caption text-accent-deep mt-[var(--space-8)]">
                ※ モードが「{reorderPrompt.orderType === "takeout" ? "テイクアウト" : "店内"}」の注文です
              </p>
            )}
            <div className="flex gap-[var(--space-12)] mt-[var(--space-20)]">
              <button
                onClick={() => setReorderPrompt(null)}
                className="flex-1 h-[48px] rounded-full border border-border type-jp-caption-bold text-text-secondary"
              >
                キャンセル
              </button>
              {items.length > 0 && (
                <button
                  onClick={() => { clearCart(); doReorder(reorderPrompt); }}
                  className="flex-1 h-[48px] rounded-full bg-surface-white border border-text-secondary type-jp-caption-bold text-text-secondary"
                >
                  置き換え
                </button>
              )}
              <button
                onClick={() => doReorder(reorderPrompt)}
                className="flex-1 h-[48px] rounded-full bg-surface-ink type-jp-caption-bold text-text-inverse"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使わない設定のときは出さない（lib/features.ts） */}
      {features.staffCall && <FloatingStaffCall />}
      <BottomViewCartBar />
    </div>
  );
}

function OrderCard({
  entry,
  onReorder,
}: {
  entry: HistoryEntry;
  onReorder: () => void;
}) {
  const sample = entry.items.slice(0, 2);
  const extra  = entry.items.length - sample.length;
  return (
    <div className="bg-surface-white rounded-[var(--radius-md)] border border-border px-[var(--space-16)] py-[var(--space-16)]">
      <div className="flex items-start justify-between gap-[var(--space-12)] mb-[var(--space-8)]">
        <div className="min-w-0">
          {/* 受渡番号はテイクアウト注文のみ（店内は配膳なので出さない。/complete と同じ方針） */}
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
        {(() => {
          const d = toDisplayStatus(entry.status);
          return (
            <span
              className="type-jp-caption-bold px-[var(--space-12)] py-[3px] rounded-full shrink-0 whitespace-nowrap"
              style={displayBadgeStyle(d)}
            >
              {DISPLAY_LABEL[d]}
            </span>
          );
        })()}
      </div>

      <div className="type-jp-caption text-text-secondary leading-relaxed mb-[var(--space-12)]">
        {sample.map((it, i) => (
          <span key={i}>
            {it.name}
            {it.options && it.options.length > 0 && `（${formatSelectedOptions(it.options)}）`}
            {it.servingTiming === "after_meal" && "（食後）"}
            {" × "}
            {it.quantity}
            {i < sample.length - 1 ? "、" : ""}
          </span>
        ))}
        {extra > 0 && <span className="text-text-tertiary"> 他{extra}品</span>}
      </div>

      <div className="flex items-center justify-between gap-[var(--space-12)] pt-[var(--space-12)] border-t border-border-divider">
        <div className="min-w-0">
          <p className="type-jp-caption text-text-tertiary">合計（税込）</p>
          <p className="type-en-price-m text-text-primary">
            ¥{entry.totalAmount.toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onReorder}
          className="shrink-0 bg-surface-white border border-text-secondary rounded-full h-[40px] px-[var(--space-16)] type-jp-caption-bold text-text-secondary whitespace-nowrap"
        >
          同じ内容で注文
        </button>
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
