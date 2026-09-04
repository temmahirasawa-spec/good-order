"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import FloatingStaffCall from "@/components/FloatingStaffCall";
import CartButton from "@/components/CartButton";
import { supabase } from "@/lib/supabase";
import { loadHistory, updateHistoryStatus, updateHistoryPickupNo, type HistoryEntry } from "@/lib/history";
import { MENU_ITEM_COLUMNS, fetchCategories, fetchMenuItemOptions, fetchOrderStatuses, rowToMenuItem, type ApiMenuItem } from "@/lib/api";
import { defaultServingTimingFor } from "@/lib/servingTiming";
import { formatSelectedOptions, type SelectedOption } from "@/lib/menuOptions";
import { PICKUP_NO_LABEL, formatPickupNo } from "@/lib/pickupNo";
import { useCartStore, type CartItem } from "@/lib/store";
import RippleButton from "@/components/RippleButton";
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
          .eq("is_available", true),
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
    <div className="mx-auto max-w-md min-h-screen bg-gray-50 flex flex-col">
      <Header mode="sub" title="注文履歴" />

      <main className="flex-1 px-4 py-5 pb-24">
        {entries === null ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-warm-300 border-t-warm-700 animate-spin" />
          </div>
        ) : totalCount === 0 ? (
          <EmptyState onBack={() => router.push("/order")} />
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">{totalCount} 件</p>

            {todayOrders.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-bold tracking-widest mb-3" style={{ color: "var(--ink)" }}>今日の注文</h2>
                <div className="space-y-3">
                  {todayOrders.map((o) => (
                    <OrderCard key={o.orderId} entry={o} onReorder={() => handleReorderClick(o)} />
                  ))}
                </div>
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h2 className="text-[11px] font-semibold tracking-widest mb-3" style={{ color: "var(--ink-sub)" }}>過去の注文</h2>
                <div className="space-y-3">
                  {pastOrders.map((o) => (
                    <OrderCard key={o.orderId} entry={o} onReorder={() => handleReorderClick(o)} />
                  ))}
                </div>
              </section>
            )}

            <p className="text-[10px] text-gray-400 text-center mt-6">
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
          <div className="relative bg-white rounded-3xl px-6 py-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">同じ内容で注文しますか？</h3>
            <p className="text-sm text-gray-500 mb-1">
              この注文の {reorderPrompt.items.length} 品をカートに追加します。
            </p>
            {items.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                ※ 現在のカートに既に {items.length} 件の商品があります
              </p>
            )}
            {reorderPrompt.orderType !== orderType && (
              <p className="text-xs text-amber-700 mt-2">
                ※ モードが「{reorderPrompt.orderType === "takeout" ? "テイクアウト" : "店内"}」の注文です
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setReorderPrompt(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              {items.length > 0 && (
                <button
                  onClick={() => { clearCart(); doReorder(reorderPrompt); }}
                  className="flex-1 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-800"
                >
                  置き換え
                </button>
              )}
              <button
                onClick={() => doReorder(reorderPrompt)}
                className="flex-1 py-3 rounded-xl bg-warm-700 text-white text-sm font-medium hover:bg-warm-800"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingStaffCall />
      <CartButton />
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
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          {/* 受渡番号はテイクアウト注文のみ（店内は配膳なので出さない。/complete と同じ方針） */}
          {entry.orderType === "takeout" && entry.pickupNo != null && (
            <>
              <p className="text-[10px] text-gray-400 leading-none">{PICKUP_NO_LABEL}</p>
              <p className="font-price text-2xl leading-tight" style={{ color: "var(--ink)" }}>
                {formatPickupNo(entry.pickupNo)}
              </p>
            </>
          )}
          <p className="text-sm font-semibold text-gray-800">{formatDate(entry.orderedAt)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {entry.orderType === "takeout"
              ? "🛍 テイクアウト"
              /* 移行前の履歴には tableLabel が無いので元の数値にフォールバックする */
              : `🪑 ${entry.tableLabel ?? entry.tableNumber}`}
          </p>
        </div>
        {(() => {
          const d = toDisplayStatus(entry.status);
          return (
            <span
              className="text-[11px] font-bold px-2.5 py-[3px] rounded-full"
              style={displayBadgeStyle(d)}
            >
              {DISPLAY_LABEL[d]}
            </span>
          );
        })()}
      </div>

      <div className="text-xs text-gray-600 leading-relaxed mb-3">
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
        {extra > 0 && <span className="text-gray-400"> 他{extra}品</span>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400">合計（税込）</p>
          <p className="font-price text-base" style={{ color: "var(--ink)" }}>
            ¥{entry.totalAmount.toLocaleString()}
          </p>
        </div>
        <RippleButton onClick={onReorder} className="btn-primary text-xs px-3.5">
          同じ内容で注文
        </RippleButton>
      </div>
    </div>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-20">
      <div className="text-5xl">📜</div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">まだ注文履歴がありません</p>
        <p className="text-xs text-gray-400 mt-1">注文が確定するとここに表示されます</p>
      </div>
      <button
        onClick={onBack}
        className="px-6 py-3 bg-warm-700 text-white rounded-2xl text-sm font-medium hover:bg-warm-800"
      >
        メニューを見る
      </button>
      <p className="text-[10px] text-gray-400">
        ※ 履歴はこの端末にのみ保存されます
      </p>
    </div>
  );
}
