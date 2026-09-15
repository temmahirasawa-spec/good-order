"use client";

/**
 * テイクアウト（受渡）画面（Step3-M、Figma: Takeout Pickup — Pickup Card 462:2923）
 * 画面名はサイドバー・Top Barとも「テイクアウト」。商品CRUDの /admin/takeout を
 * /admin/menu に統合して区別の必要が無くなったため Step3-N で短縮した。
 *
 * 受渡待ち（order_type=takeout で、まだ渡していない＝picked_up_at が空）の注文を
 * 一覧し、markOrderPickedUp() を呼ぶ。
 *
 * **「渡したかどうか」は status ではなく orders.picked_up_at で見る**
 * （2026-09-14 の修正。supabase/pickup_completed.sql）。
 * status は1つしかなく、会計すると 'served' が 'paid' に上書きされるため、
 * 以前の `status = 'served'` 完全一致では**まだ渡していないのに、会計した瞬間に
 * この画面から消えていた**（「お金は払ったのに受け取れない」）。
 *
 * - 受渡番号は orders.pickup_no（サーバー側トリガーの日次連番、01〜99循環。
 *   supabase/pickup_no.sql）。注文IDの先頭6桁は"内部照合用ID"であって
 *   受渡番号ではないので、この画面では使わない。
 * - 経過時間は orders.updated_at（最後に動きがあった時刻。staff_foundation.sql の
 *   トリガーで自動更新される）からの経過。厨房画面と同じ calcElapsed() を使う。
 *   先に会計を済ませた注文では「会計した時刻」からの経過になる。
 * - 「受渡完了」後は即座に一覧から消す（楽観的更新）。競合・RLSブロックで
 *   0件更新だった場合は再取得でカードが戻る。
 * - このページにアクセスできるのは counter / kitchen / manager
 *   （RLSで picked_up への更新を許可されているロール）。
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { markOrderPickedUp } from "@/lib/api";
import { calcElapsed } from "@/lib/kitchenGrouping";
import { formatPickupNo } from "@/lib/pickupNo";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import PickupCard, { type PickupItem } from "@/components/admin/takeout/PickupCard";

interface PickupOrder {
  id: string;
  pickupNo: number | null;
  /** 楽観ロック用。DBから取得した値をそのまま保持し、再フォーマットしないこと */
  updatedAt: string;
  items: PickupItem[];
}

export default function PickupPage() {
  const [orders, setOrders]       = useState<PickupOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [now, setNow]             = useState(() => Date.now());

  /* ── 受渡待ち（テイクアウト × served）の取得 ── */
  const loadOrders = useCallback(async () => {
    try {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("id, updated_at, pickup_no, status")
        .eq("order_type", "takeout")
        /* まだ渡していないものだけ。status ではなくこの欄で見る（上の注記） */
        .is("picked_up_at", null)
        /* served = 調理が終わって会計はまだ / paid = 先に会計を済ませた。
           paid は「まだ作っていない」ことがあるので、下で全品の調理完了を確かめる。 */
        .in("status", ["served", "paid"])
        .order("updated_at", { ascending: true });
      if (orderErr) throw orderErr;

      if (!orderRows || orderRows.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = orderRows.map((o) => o.id);
      const { data: itemRows, error: itemErr } = await supabase
        .from("order_items")
        .select("id, order_id, quantity, cooking_status, menu_items (name)")
        .in("order_id", orderIds);
      if (itemErr) throw itemErr;

      const itemsByOrder = new Map<string, PickupItem[]>();
      /* 全品の調理が終わっているか。先に会計だけ済ませた注文を、
         まだ作っていないうちに受渡画面へ出さないために使う */
      const allCooked = new Map<string, boolean>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (itemRows ?? []).forEach((row: any) => {
        const arr = itemsByOrder.get(row.order_id) ?? [];
        arr.push({
          id: row.id,
          name: row.menu_items?.name ?? "(不明な商品)",
          quantity: row.quantity ?? 0,
        });
        itemsByOrder.set(row.order_id, arr);
        allCooked.set(
          row.order_id,
          (allCooked.get(row.order_id) ?? true) && row.cooking_status === "done"
        );
      });

      setOrders(
        orderRows
          /* served は調理が終わっている印なのでそのまま。
             paid は会計だけ先に済ませた可能性があるので、全品の調理完了を確かめる。
             （厨房画面とちょうど裏返しの関係。あちらは「会計済み＋全品調理済み」を下げる） */
          .filter((o) => o.status !== "paid" || allCooked.get(o.id) === true)
          .map((o) => ({
            id: o.id,
            pickupNo: o.pickup_no ?? null,
            updatedAt: o.updated_at,
            items: itemsByOrder.get(o.id) ?? [],
          }))
      );
    } catch (err) {
      console.error("[PickupPage] loadOrders failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── ポーリング & 経過時間更新（厨房画面と同じ間隔） ── */
  useEffect(() => {
    let cancelled = false;
    loadOrders();

    const dataInterval = setInterval(() => {
      if (!cancelled) loadOrders();
    }, 3000);
    const tickInterval = setInterval(() => {
      if (!cancelled) setNow(Date.now());
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, [loadOrders]);

  /* ── 受渡完了（picked_up_at を入れる。会計済みなら status は触らない） ── */
  const handlePickedUp = async (order: PickupOrder) => {
    const prev = orders;
    // 楽観：一覧から即座に消す
    setCompleting(order.id);
    setOrders((os) => os.filter((o) => o.id !== order.id));
    try {
      // 取得時の updated_at が一致する場合のみ更新（同時操作の競合検知）。
      // 0件更新＝他端末が先に更新済み。RLS不備等の無音失敗もここに含まれる。
      const { conflict } = await markOrderPickedUp(order.id, order.updatedAt);
      if (conflict) {
        console.warn(
          "[PickupPage] handlePickedUp: 競合を検出（他端末が先に更新済み、またはRLSブロック）。最新状態を再取得します。"
        );
      }
      await loadOrders();
    } catch (err) {
      console.error("[PickupPage] handlePickedUp failed:", err);
      setOrders(prev);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="テイクアウト"
            count={`受渡待ち ${orders.length}件`}
            onMenuClick={openDrawer}
          />

          {/* Figma実測: PCのMainは左右32・下32、カード間24（縦横とも）のラップグリッド */}
          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[var(--space-16)] lg:pb-[var(--space-32)]">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-surface-white rounded-[var(--radius-md)] border border-border py-16 text-center type-jp-body text-text-tertiary">
                受渡待ちのテイクアウト注文はありません
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-16)] lg:gap-[var(--space-24)]">
                {orders.map((order) => (
                  <PickupCard
                    key={order.id}
                    pickupNumber={formatPickupNo(order.pickupNo)}
                    elapsed={calcElapsed(order.updatedAt, now).label}
                    items={order.items}
                    completing={completing === order.id}
                    onComplete={() => handlePickedUp(order)}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}
    </AdminPageShell>
  );
}
