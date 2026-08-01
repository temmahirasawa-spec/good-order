"use client";

/**
 * 厨房画面（Step3-I、Figma: Template / Kitchen 1180x820 / Kitchen — Mobile 390）
 * データ取得・realtime購読・ステータス遷移ロジックは既存のまま。見た目のみ新デザインに差し替え。
 */
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  groupOrdersByTable,
  calcElapsed,
  type KitchenTableGroup,
  type KitchenItem,
  type CookingStatus,
  type OrderWithItems,
} from "@/lib/kitchenGrouping";
import { acknowledge, getAcknowledged, cleanupOldAcks } from "@/lib/kitchenAck";
import {
  updateOrderItemCookingStatusIfUnchanged,
  updateOrderStatusIfUnchanged,
  acknowledgeStaffCall,
  completeStaffCall,
  completeAllPendingStaffCalls,
  type StaffCallStatus,
} from "@/lib/api";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import StaffCallChip from "@/components/admin/StaffCallChip";
import { displayTableLabel, shortenTableLabel, splitTableLabel } from "@/lib/tables";
import OrderCard, { type OrderCardItem } from "@/components/admin/kitchen/OrderCard";

interface PendingCall {
  id: string;
  table_number: number;
  table_label: string | null;
  call_type: "water" | "bill" | "other";
  call_label: string;
  status: StaffCallStatus;
  created_at: string;
}

export default function KitchenPage() {
  const [groups, setGroups]     = useState<KitchenTableGroup[]>([]);
  const [pendingCalls, setPendingCalls] = useState<PendingCall[]>([]);
  const [loading, setLoading]   = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isFirstLoadRef = useRef(true);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  // 楽観更新でローカルに反映した変更を、ポーリング結果が上書きしないように保持する
  // key: orderItemId → 反映を期待しているステータスと、更新が通ったあとの updated_at
  // （updated_at も持たないと、ポーリングが追いつく前の2回目のクリックが
  //   古い基準値を投げてしまい、自分自身と競合してしまう）
  const pendingItemUpdates = useRef<
    Map<string, { status: CookingStatus; updatedAt?: string }>
  >(new Map());

  /* ── 音 ── */
  const playBeep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("[KitchenPage] beep failed:", e);
    }
  }, []);

  const enableSound = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") void ctx.resume();
      audioCtxRef.current = ctx;
      setSoundEnabled(true);
    } catch (e) {
      console.warn("[KitchenPage] enableSound failed:", e);
    }
  }, []);

  /* ── orders + order_items 取得 ── */
  const loadOrders = useCallback(async () => {
    try {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("id, table_number, table_id, table_label, status, order_type, created_at, updated_at")
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: true });
      if (orderErr) throw orderErr;

      if (!orderRows || orderRows.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const orderIds = orderRows.map((o) => o.id);
      const { data: itemRows, error: itemErr } = await supabase
        .from("order_items")
        .select(`
          id, order_id, menu_item_id, quantity,
          cooking_status, updated_at,
          menu_items (name, is_takeout)
        `)
        .in("order_id", orderIds);
      if (itemErr) throw itemErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsByOrder = new Map<string, any[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (itemRows ?? []).forEach((row: any) => {
        const arr = itemsByOrder.get(row.order_id) ?? [];
        arr.push(row);
        itemsByOrder.set(row.order_id, arr);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders: OrderWithItems[] = (orderRows ?? []).map((o: any) => ({
        id: o.id,
        table_number: o.table_number ?? null,
        table_id:     o.table_id ?? null,
        table_label:  o.table_label ?? null,
        order_type: (o.order_type ?? "dine_in") as "dine_in" | "takeout",
        created_at: o.created_at,
        updated_at: o.updated_at,
        order_items: itemsByOrder.get(o.id) ?? [],
      }));

      // 初回マウント時：表示中の注文をすべて確認済みに
      if (isFirstLoadRef.current) {
        acknowledge(orders.map((o) => o.id));
      }
      cleanupOldAcks(orders.map((o) => o.id));

      const acked = new Set(getAcknowledged());
      const grouped = groupOrdersByTable(orders, acked);

      // in-flight な楽観更新がある場合は、その値で上書きしてからセット
      // （DB に反映される前にポーリングが走っても巻き戻らないように）
      const pending = pendingItemUpdates.current;
      if (pending.size > 0) {
        const consume: string[] = [];
        grouped.forEach((g) => {
          g.rounds.forEach((r) => {
            r.items.forEach((i) => {
              const want = pending.get(i.orderItemId);
              if (!want) return;
              if (i.cookingStatus === want.status) {
                // DB が追いついた → pending から外す
                consume.push(i.orderItemId);
              } else {
                // まだ古い値が返ってきた → 上書きして整合性維持。
                // 楽観ロックの基準値（updated_at）も更新後の値に差し替えないと、
                // この状態でもう一度押したときに古い値を投げて競合になる
                i.cookingStatus = want.status;
                if (want.updatedAt) i.updatedAt = want.updatedAt;
              }
            });
          });
          // 上書き後に allItemsDone を再計算
          g.allItemsDone = g.rounds.every((r) =>
            r.items.every((i) => i.cookingStatus === "done")
          );
        });
        consume.forEach((id) => pending.delete(id));
      }

      setGroups(grouped);
    } catch (err) {
      console.error("[KitchenPage] loadOrders failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── staff_calls 取得（waiting・acknowledged の未対応分） ── */
  const loadPendingCalls = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("staff_calls")
        .select("id, table_number, table_label, call_type, call_label, status, created_at")
        .in("status", ["waiting", "acknowledged"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      setPendingCalls((data ?? []) as PendingCall[]);
    } catch (err) {
      console.error("[KitchenPage] loadPendingCalls failed:", err);
    }
  }, []);

  const markAllCallsDone = async () => {
    const prev = pendingCalls;
    setPendingCalls([]);
    try {
      await completeAllPendingStaffCalls();
    } catch (err) {
      console.error("[KitchenPage] markAllCallsDone failed:", err);
      setPendingCalls(prev);
    }
  };

  /* ── Staff Call Chip の個別アクション（Waiting→対応する→Acknowledged→完了にする） ── */
  const handleStaffCallAction = async (call: PendingCall) => {
    const prev = pendingCalls;
    try {
      if (call.status === "waiting") {
        setPendingCalls((cs) =>
          cs.map((c) => (c.id === call.id ? { ...c, status: "acknowledged" } : c))
        );
        await acknowledgeStaffCall(call.id);
      } else {
        setPendingCalls((cs) => cs.filter((c) => c.id !== call.id));
        await completeStaffCall(call.id);
      }
    } catch (err) {
      console.error("[KitchenPage] handleStaffCallAction failed:", err);
      setPendingCalls(prev);
    }
  };

  /* ── ポーリング & 経過時間更新 ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadOrders(), loadPendingCalls()]);
      isFirstLoadRef.current = false;
    })();

    const dataInterval = setInterval(() => {
      if (!cancelled) {
        loadOrders();
        loadPendingCalls();
      }
    }, 3000);

    const tickInterval = setInterval(() => {
      if (!cancelled) setNow(Date.now());
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, [loadOrders, loadPendingCalls]);

  /* ── 統計 ── */
  const urgentCount = useMemo(
    () => groups.filter(
      (g) => calcElapsed(g.oldestCreatedAt, now).urgency === "urgent"
    ).length,
    [groups, now]
  );

  // 未確認グループがあるか or スタッフ呼び出しが残っているか
  const hasUnacknowledged = groups.some((g) => g.hasUnacknowledged);
  const shouldAlert = hasUnacknowledged || pendingCalls.length > 0;

  /* ── タイトル点滅 + ビープ ── */
  useEffect(() => {
    if (!shouldAlert) {
      const urgentText = urgentCount > 0 ? `🚨 緊急${urgentCount} ` : "";
      document.title = `${urgentText}(${groups.length}) 厨房 — GOOD ORDER`;
      return;
    }
    let blink = true;
    const titleInterval = setInterval(() => {
      document.title = blink ? "🔔 新規注文！" : `(${groups.length}) 厨房 — GOOD ORDER`;
      blink = !blink;
    }, 600);

    let beepInterval: ReturnType<typeof setInterval> | null = null;
    if (soundEnabled) {
      playBeep();
      beepInterval = setInterval(() => playBeep(), 2000);
    }
    return () => {
      clearInterval(titleInterval);
      if (beepInterval) clearInterval(beepInterval);
    };
  }, [shouldAlert, soundEnabled, playBeep, urgentCount, groups.length]);

  /* ── アクション ── */
  const handleAcknowledge = (group: KitchenTableGroup) => {
    const ids = group.rounds.map((r) => r.orderId);
    acknowledge(ids);
    setGroups((prev) =>
      prev.map((g) => g.groupKey === group.groupKey ? { ...g, hasUnacknowledged: false } : g)
    );
  };

  const handleAllServed = async (group: KitchenTableGroup) => {
    const orderIds = group.rounds.map((r) => r.orderId);
    const items    = group.rounds.flatMap((r) => r.items);
    // 楽観：グループを除外
    const prev = groups;
    setGroups((g) => g.filter((x) => x.groupKey !== group.groupKey));
    try {
      // 各行が最後に取得した updated_at と一致する場合のみ更新（競合検知）
      const itemResults = await Promise.all(
        items.map((i) =>
          updateOrderItemCookingStatusIfUnchanged(i.orderItemId, "done", i.updatedAt)
        )
      );
      const orderResults = await Promise.all(
        group.rounds.map((r) =>
          updateOrderStatusIfUnchanged(r.orderId, "served", r.updatedAt)
        )
      );
      if (itemResults.some((r) => r.conflict) || orderResults.some((r) => r.conflict)) {
        console.warn(
          "[KitchenPage] handleAllServed: 一部の行で他端末による更新済み（競合）を検出。最新状態を再取得します。"
        );
      }
      acknowledge(orderIds);
      // 競合の有無にかかわらず最新状態を取り直して画面に反映する
      await loadOrders();
    } catch (err) {
      console.error("[KitchenPage] handleAllServed failed:", err);
      setGroups(prev);
    }
  };

  const cycleItemStatus = async (item: KitchenItem) => {
    const next: Record<CookingStatus, CookingStatus> = {
      pending: "cooking",
      cooking: "done",
      done: "pending",
    };
    const newStatus = next[item.cookingStatus];

    // 楽観更新 + ポーリングからの巻き戻り防止
    pendingItemUpdates.current.set(item.orderItemId, { status: newStatus });
    setGroups((prev) => updateItemInGroups(prev, item.orderItemId, newStatus));

    try {
      // 取得時の updated_at が一致する場合のみ更新（同時操作の競合検知）。
      // 0件更新＝他端末が先に更新済み。RLS不備等の無音失敗もここに含まれる。
      const { conflict, updatedAt } = await updateOrderItemCookingStatusIfUnchanged(
        item.orderItemId,
        newStatus,
        item.updatedAt
      );
      if (conflict) {
        console.warn(
          "[KitchenPage] cycleItemStatus: 競合を検出（他端末が先に更新済み、またはRLSブロック）。最新状態を再取得します。"
        );
        pendingItemUpdates.current.delete(item.orderItemId);
        await loadOrders();
        return;
      }
      // 更新が通ったら、DBが返した新しい updated_at をローカルへ書き戻す。
      // order_items には BEFORE UPDATE トリガー（trg_order_items_set_updated_at）が
      // 効いていて、更新のたびに値が変わる。書き戻さないと、ポーリング（3秒）が
      // 来る前の2回目のクリックが古い基準値を投げ、自分の直前の更新と競合する。
      // 応答を待つ間にさらに押されていた場合は、そちらの楽観更新を巻き戻さない
      // （まだ飛んでいる後続のリクエストが正しい値で決着させる）。
      if (pendingItemUpdates.current.get(item.orderItemId)?.status === newStatus) {
        pendingItemUpdates.current.set(item.orderItemId, { status: newStatus, updatedAt });
        setGroups((prev) =>
          updateItemInGroups(prev, item.orderItemId, newStatus, updatedAt)
        );
      }
      // 次の loadOrders で同じ値が返ってきたら自動で pending から外れる。
      // 念のためタイムアウトでも掃除しておく（ポーリング間隔より長め）。
      window.setTimeout(() => {
        if (pendingItemUpdates.current.get(item.orderItemId)?.status === newStatus) {
          pendingItemUpdates.current.delete(item.orderItemId);
        }
      }, 10_000);
    } catch (err) {
      console.error("[KitchenPage] cycleItemStatus failed:", err);
      pendingItemUpdates.current.delete(item.orderItemId);
      setGroups((prev) => updateItemInGroups(prev, item.orderItemId, item.cookingStatus));
    }
  };

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="厨房"
            subtitlePc="対応中"
            count={`${groups.length}卓`}
            onMenuClick={openDrawer}
            strip={
              pendingCalls.length > 0 ? (
                <>
                  {pendingCalls.map((c) => (
                    <StaffCallChip
                      key={c.id}
                      table={shortenTableLabel(displayTableLabel(c.table_label, c.table_number))}
                      message={c.call_label}
                      elapsed={calcElapsed(c.created_at, now).label.replace("経過", "")}
                      state={c.status === "waiting" ? "waiting" : "acknowledged"}
                      onAction={() => handleStaffCallAction(c)}
                    />
                  ))}
                </>
              ) : undefined
            }
          />

          <main
            onClick={!soundEnabled ? enableSound : undefined}
            className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-24)] py-[var(--space-16)] lg:py-[var(--space-20)]"
          >
            {!soundEnabled && (
              <button
                type="button"
                onClick={enableSound}
                className="mb-[var(--space-16)] px-4 py-2 bg-surface-ink text-text-inverse type-jp-caption-bold rounded-[var(--radius-sm)]"
              >
                🔔 通知音を有効化
              </button>
            )}
            {pendingCalls.length > 1 && (
              <button
                type="button"
                onClick={markAllCallsDone}
                className="mb-[var(--space-16)] ml-[var(--space-8)] px-4 py-2 border border-border type-jp-caption-bold text-text-primary rounded-[var(--radius-sm)]"
              >
                すべて対応済みにする
              </button>
            )}

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="bg-surface-white rounded-[var(--radius-md)] border border-border py-16 text-center type-jp-body text-text-tertiary">
                現在処理中の注文はありません
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-16)]">
                {groups.map((group) => {
                  const elapsed = calcElapsed(group.oldestCreatedAt, now);
                  const flatItems: KitchenItem[] = group.rounds.flatMap((r) => r.items);
                  const cardItems: OrderCardItem[] = flatItems.map((i) => ({
                    orderItemId: i.orderItemId,
                    name: i.name,
                    quantity: i.quantity,
                    cookingStatus: i.cookingStatus,
                    isTakeoutItem: i.isTakeoutItem,
                  }));
                  return (
                    <OrderCard
                      key={group.groupKey}
                      tableCategory={
                        group.orderType === "takeout"
                          ? undefined
                          : splitTableLabel(displayTableLabel(group.tableLabel, group.tableNumber)).category
                      }
                      table={
                        group.orderType === "takeout"
                          ? "TAKEOUT"
                          : splitTableLabel(displayTableLabel(group.tableLabel, group.tableNumber)).code
                      }
                      elapsed={elapsed.label}
                      isTakeout={group.orderType === "takeout"}
                      urgency={elapsed.urgency}
                      items={cardItems}
                      allDone={group.allItemsDone}
                      hasUnacknowledged={group.hasUnacknowledged}
                      onAcknowledge={() => handleAcknowledge(group)}
                      onItemClick={(item) => {
                        const original = flatItems.find((i) => i.orderItemId === item.orderItemId);
                        if (original) cycleItemStatus(original);
                      }}
                      onComplete={() => handleAllServed(group)}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}

/* ────────────────────────────── helpers ────────────────────────────── */

function updateItemInGroups(
  prev: KitchenTableGroup[],
  orderItemId: string,
  newStatus: CookingStatus,
  /** 更新が通ったときだけ渡す。楽観ロックの基準値をDBの最新に合わせるため */
  newUpdatedAt?: string
): KitchenTableGroup[] {
  return prev.map((g) => ({
    ...g,
    rounds: g.rounds.map((r) => ({
      ...r,
      items: r.items.map((i) =>
        i.orderItemId === orderItemId
          ? { ...i, cookingStatus: newStatus, updatedAt: newUpdatedAt ?? i.updatedAt }
          : i
      ),
    })),
    allItemsDone: g.rounds.every((r) =>
      r.items.every((i) =>
        i.orderItemId === orderItemId ? newStatus === "done" : i.cookingStatus === "done"
      )
    ),
  }));
}
