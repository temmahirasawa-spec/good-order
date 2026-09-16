"use client";

/**
 * レジ画面（Step3-J、Figma: Template / Register 1180x820 / Register — Mobile 390）
 * 会計処理・注文集計のロジックは既存のまま。見た目のみ新デザインに差し替え。
 *
 * Figmaの新テンプレートにはスタッフ呼び出しのCall Strip相当が無く（厨房側で
 * 対応する設計）、旧実装にあった呼び出し通知バー・通知音・タイトル点滅は
 * このページからは削除した（Nav Sidebar v2導入と合わせてStep3-Iのkitchenが
 * 呼び出し対応の主担当になったため、レジ側での重複表示は不要と判断）。
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { businessDateToday } from "@/lib/dateFormat";
import { updateOrderStatusIfUnchanged } from "@/lib/api";
import { formatJstHm } from "@/lib/dateFormat";
import { dineInTableKey } from "@/lib/kitchenGrouping";
import { describeDbError } from "@/lib/dbError";
import OrderFlowWatch from "@/components/admin/OrderFlowWatch";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { displayTableLabel, splitTableLabel } from "@/lib/tables";
import TopBar from "@/components/admin/TopBar";
import TableChip from "@/components/admin/register/TableChip";
import BillCard from "@/components/admin/register/BillCard";
import CheckoutConfirmAlert from "@/components/admin/register/CheckoutConfirmAlert";
import { PICKUP_NO_LABEL, formatPickupNo, internalOrderRef } from "@/lib/pickupNo";

type OrderStatus = "pending" | "preparing" | "served" | "picked_up" | "paid";

interface RegisterOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  menu_item_name: string;
  is_takeout: boolean;
}

interface RegisterOrder {
  id: string;
  /** サーバー採番の受渡番号（supabase/pickup_no.sql）。内部照合用IDとは別物 */
  pickup_no: number | null;
  table_number: number;
  table_id: string | null;
  /** "A1" のような注文時点の卓ラベル（Step3-O）。移行前の注文は null */
  table_label: string | null;
  status: OrderStatus;
  order_type: "dine_in" | "takeout";
  created_at: string;
  updated_at: string;
  total_amount: number;
  /** セットドリンク割引。place_order が保存した実際に引いた額 */
  discount_amount: number;
  /** 消費税額。内税なら total_amount に含まれている分 */
  tax_amount: number;
  /** 適用した税率（%） */
  tax_rate: number;
  items: RegisterOrderItem[];
}

/* 卓の束ね方は table_id 優先。移行前の注文（table_id が無い）は
   従来どおり table_number でまとめるので、key は文字列で持つ */
type Selection =
  | { kind: "table"; key: string }
  | { kind: "takeout"; orderId: string };

/**
 * ⚠ **table_id が無いときに table_number だけで束ねてはいけない。**
 * 席設定を作り直すと古い卓の行が消える（save_table_layout が DELETE する）。
 * そのとき place_order は注文を落とさず table_id を NULL にして通すが
 * （supabase/order_stale_table_id.sql）、いまの注文は table_number が
 * どれも 0 なので、`n0` で束ねると**別のお客様の伝票が合流してしまう**。
 * ラベル（"テーブル席 A-1"）を先に見て、席ごとに分かれるようにしている。
 * 規則は厨房画面と1か所（lib/kitchenGrouping.ts の dineInTableKey）にまとめた。
 * 片方だけ直すと、厨房とレジで「同じ卓」の判定が食い違う（2026-09-16）。
 */
const tableKey = dineInTableKey;

export default function RegisterPage() {
  const [orders, setOrders] = useState<RegisterOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  /* 最後に一覧を取れた時刻。取れない状態が続いたら OrderFlowWatch が
     「接続できていない」と出す。以前は取得に失敗しても古い一覧を出し続けるだけで、
     Wi-Fi 断・セッション切れに誰も気づけなかった（2026-09-16 の裏取り） */
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("id, pickup_no, table_number, table_id, table_label, status, order_type, created_at, updated_at, total_amount, discount_amount, tax_amount, tax_rate")
        .neq("status", "paid")
        /* **今日の営業日だけ**（2026-09-13 追加）。
           以前は日付で絞っておらず、会計されなかった注文が何日でも残り続けた
           （9月2日の検証注文が11日間レジに出ていた）。
           日をまたいだ会計が必要になったら、ここを「昨日まで含める」に広げる。 */
        .eq("business_date", businessDateToday())
        .order("created_at", { ascending: true });
      if (orderErr) throw orderErr;
      if (!orderRows || orderRows.length === 0) {
        setOrders([]);
        setLastLoadedAt(Date.now());
        setLoading(false);
        return;
      }

      const orderIds = orderRows.map((o) => o.id);
      const { data: itemRows, error: itemErr } = await supabase
        .from("order_items")
        .select("id, order_id, menu_item_id, quantity, unit_price, menu_items(name, is_takeout)")
        .in("order_id", orderIds);
      if (itemErr) throw itemErr;

      const itemsByOrder: Record<string, RegisterOrderItem[]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (itemRows ?? []).forEach((row: any) => {
        const oid = row.order_id;
        if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
        itemsByOrder[oid].push({
          id: row.id,
          order_id: row.order_id,
          menu_item_id: row.menu_item_id,
          quantity: row.quantity,
          unit_price: row.unit_price,
          menu_item_name: row.menu_items?.name ?? "(不明な商品)",
          is_takeout: Boolean(row.menu_items?.is_takeout),
        });
      });

      setOrders(
        orderRows.map((o) => ({
          id: o.id,
          pickup_no: o.pickup_no ?? null,
          table_number: o.table_number,
          table_id:     o.table_id ?? null,
          table_label:  o.table_label ?? null,
          status: o.status as OrderStatus,
          order_type: (o.order_type ?? "dine_in") as "dine_in" | "takeout",
          created_at: o.created_at,
          updated_at: o.updated_at,
          total_amount: o.total_amount,
          discount_amount: o.discount_amount ?? 0,
          tax_amount: o.tax_amount ?? 0,
          tax_rate: o.tax_rate ?? 10,
          items: itemsByOrder[o.id] ?? [],
        }))
      );
      setLastLoadedAt(Date.now());
    } catch (err) {
      console.error("[RegisterPage] loadOrders failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadOrders();
    const interval = setInterval(() => {
      if (!cancelled) loadOrders();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadOrders]);

  // 卓一覧（店内 = order_type dine_in のみ）。ラベル順で並べる
  const tableBills = useMemo(() => {
    const map = new Map<string, { key: string; full: string; category: string; code: string }>();
    orders
      .filter((o) => o.order_type === "dine_in")
      .forEach((o) => {
        const key = tableKey(o);
        if (!map.has(key)) {
          const full = displayTableLabel(o.table_label, o.table_number);
          map.set(key, { key, full, ...splitTableLabel(full) });
        }
      });
    return Array.from(map.values()).sort((a, b) =>
      a.full.localeCompare(b.full, "ja", { numeric: true })
    );
  }, [orders]);

  // テイクアウト注文（個別）
  const takeoutOrders = useMemo(
    () => orders.filter((o) => o.order_type === "takeout"),
    [orders]
  );

  // テーブルごとに「全注文 served か」を判定
  const allServedByTable = useMemo(() => {
    const map: Record<string, boolean> = {};
    tableBills.forEach(({ key }) => {
      const tableOrders = orders.filter(
        (o) => o.order_type === "dine_in" && tableKey(o) === key
      );
      map[key] =
        tableOrders.length > 0 &&
        tableOrders.every((o) => o.status === "served");
    });
    return map;
  }, [orders, tableBills]);

  // 選択中の注文を集計
  const selectedData = useMemo(() => {
    if (selected === null) return null;

    let targetOrders: RegisterOrder[] = [];
    if (selected.kind === "table") {
      targetOrders = orders.filter(
        (o) => o.order_type === "dine_in" && tableKey(o) === selected.key
      );
    } else {
      const t = orders.find((o) => o.id === selected.orderId);
      if (t) targetOrders = [t];
    }
    if (targetOrders.length === 0) return null;

    const allItems: RegisterOrderItem[] = [];
    targetOrders.forEach((o) => allItems.push(...o.items));

    const subtotal = allItems.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    );

    /* セットドリンク割引（docs/specs/set-drink-discount.md）。
       2026-09-15 まで、ここは明細から計算し直すだけで**割引を見ていなかった**ため、
       お客様の画面に出た金額より高い額をレジに出していた（洋輔さんの指摘）。

       **合計は orders.total_amount の合計をそのまま使う。** これは place_order が
       サーバー側で計算して保存した値＝お客様に提示した金額そのもので、ここが正。
       画面で足し引きし直すと、また食い違いが生まれる。
       消費税は「合計 −（小計 − 割引）」で逆算する。3つの行が必ず足して合うようにするため。 */
    const discount = targetOrders.reduce((sum, o) => sum + (o.discount_amount ?? 0), 0);
    const total = targetOrders.reduce((sum, o) => sum + o.total_amount, 0);
    /* 消費税は place_order が保存した値（orders.tax_amount）を使う。
       内税か外税か、税率がいくつかは注文した時点の設定で決まっているので、
       ここで計算し直さない（2026-09-15。画面で計算し直して食い違った反省）。 */
    const tax = targetOrders.reduce((sum, o) => sum + (o.tax_amount ?? 0), 0);
    /* 内税のときは「合計に税が含まれている」ので、足し算の行としては出さない。
       同じ注文の中で内税・外税が混ざることは無いので、先頭の注文で判定してよい */
    const taxIncluded = total <= Math.max(0, subtotal - discount);
    const taxRate = targetOrders[0]?.tax_rate ?? 10;
    const earliestCreatedAt = targetOrders
      .map((o) => o.created_at)
      .sort()[0];

    return {
      selection: selected,
      tableLabel:
        selected.kind === "table"
          ? displayTableLabel(targetOrders[0].table_label, targetOrders[0].table_number)
          : null,
      orderCount: targetOrders.length,
      checkInLabel: formatJstHm(earliestCreatedAt),
      orderRefs: targetOrders.map((o) => ({ id: o.id, updatedAt: o.updated_at })),
      // 受渡番号（テーブル会計で複数注文がまとまっている場合は全件並べる）と
      // 内部照合用ID（注文IDの先頭6桁）。両者は別物として扱う
      pickupNos: targetOrders.map((o) => o.pickup_no),
      internalRefs: targetOrders.map((o) => internalOrderRef(o.id)),
      items: allItems,
      subtotal,
      discount,
      tax,
      taxIncluded,
      taxRate,
      total,
    };
  }, [orders, selected]);

  // 選択中が消えたら選択解除
  useEffect(() => {
    if (!selected) return;
    if (selected.kind === "table" && !tableBills.some((t) => t.key === selected.key)) {
      setSelected(null);
    } else if (selected.kind === "takeout" && !takeoutOrders.find((o) => o.id === selected.orderId)) {
      setSelected(null);
    }
  }, [tableBills, takeoutOrders, selected]);

  const handleCloseOut = async () => {
    if (!selectedData) return;
    setClosing(true);
    try {
      // 各注文の取得時 updated_at と一致する場合のみ更新（同時操作の競合検知）
      const results = await Promise.all(
        selectedData.orderRefs.map((o) =>
          updateOrderStatusIfUnchanged(o.id, "paid", o.updatedAt)
        )
      );
      const conflicts = results.filter((r) => r.conflict).length;
      if (conflicts > 0) {
        console.warn(
          "[RegisterPage] close-out: 一部の注文で他端末による更新済み（競合）を検出。最新状態を再取得します。"
        );
      }
      setSelected(null);
      setConfirmOpen(false);
      await loadOrders();
      /* 0件更新（別の端末が先に触った／権限で弾かれた）は例外にならず、
         以前はダイアログが黙って閉じるだけだった。会計できていないのに
         できたように見えるので、取り直した後に必ず伝える（2026-09-16 の裏取り） */
      if (conflicts > 0) {
        alert(
          "会計済みにできなかった注文があります。\n" +
          "別の端末で先に操作されたか、権限が無い可能性があります。\n" +
          "画面を最新にしました。まだ会計待ちに残っていれば、もう一度お試しください。"
        );
      }
    } catch (err) {
      /* 通信断・セッション切れ・RLS 違反はここに来る。以前は console に落とすだけで、
         ダイアログが開いたままボタンだけ戻り、何が起きたか誰にも分からなかった */
      console.error("[RegisterPage] close-out failed:", err);
      alert("会計済みにできませんでした。\n" + describeDbError(err));
    } finally {
      setClosing(false);
    }
  };

  const totalBills = tableBills.length + takeoutOrders.length;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="レジ"
            subtitlePc="会計待ち"
            count={`${totalBills}件`}
            onMenuClick={openDrawer}
            strip={
              totalBills > 0 ? (
                <>
                  {tableBills.map((t) => (
                    <TableChip
                      key={`t-${t.key}`}
                      category={t.category || undefined}
                      label={t.code}
                      selected={selected?.kind === "table" && selected.key === t.key}
                      showServedDot={allServedByTable[t.key]}
                      onClick={() => setSelected({ kind: "table", key: t.key })}
                    />
                  ))}
                  {takeoutOrders.map((o) => (
                    <TableChip
                      key={`to-${o.id}`}
                      label={`🛍 ${formatPickupNo(o.pickup_no)}`}
                      selected={selected?.kind === "takeout" && selected.orderId === o.id}
                      onClick={() => setSelected({ kind: "takeout", orderId: o.id })}
                    />
                  ))}
                </>
              ) : undefined
            }
          />

          {/* 注文が店に届いていないこと（伝票が出ていない／プリンタ停止／接続断）を
              レジ画面の上に出す。厨房画面 OFF・プリンタ1本の運用では、ここが唯一の
              「気づく場所」になる（2026-09-16 の裏取り、監査の最優先項目） */}
          <OrderFlowWatch lastLoadedAt={lastLoadedAt} />

          <main className="flex-1 overflow-y-auto px-[var(--space-16)] lg:px-[var(--space-24)] pt-[var(--space-16)] pb-[var(--space-40)] lg:pb-[var(--space-24)]">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
              </div>
            ) : !selectedData ? (
              <div className="bg-surface-white rounded-[var(--radius-lg)] border border-border py-20 text-center type-jp-body text-text-tertiary">
                {totalBills === 0
                  ? "会計待ちのテーブルはありません"
                  : "上部からテーブルを選択してください"}
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-16)] max-w-[600px]">
                {/* ── 受渡番号（この会計で最も目立つ要素）＋内部照合用ID ── */}
                <div className="flex items-center gap-[var(--space-12)] bg-bg-warm rounded-[var(--radius-md)] px-[var(--space-20)] py-[var(--space-12)]">
                  <span className="type-jp-caption-bold text-text-secondary shrink-0">
                    {PICKUP_NO_LABEL}
                  </span>
                  <span className="type-en-display-s text-text-primary">
                    {selectedData.pickupNos.map((n) => formatPickupNo(n)).join(" / ")}
                  </span>
                  <span className="type-jp-label text-text-tertiary ml-auto text-right">
                    内部ID {selectedData.internalRefs.join(" / ")}
                  </span>
                </div>

                <p className="type-jp-body-small text-text-secondary">
                  {selectedData.selection.kind === "takeout" && "🛍 テイクアウト ・ "}
                  注文{selectedData.orderCount}回・入店 {selectedData.checkInLabel}
                </p>

                <BillCard
                  items={selectedData.items.map((it) => ({
                    id: it.id,
                    name: it.menu_item_name,
                    quantity: it.quantity,
                    unitPrice: it.unit_price,
                    isTakeout: it.is_takeout,
                  }))}
                  subtotal={selectedData.subtotal}
                  discount={selectedData.discount}
                  tax={selectedData.tax}
                  taxIncluded={selectedData.taxIncluded}
                  taxRate={selectedData.taxRate}
                  total={selectedData.total}
                />

                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="bg-accent-primary active:bg-accent-pressed py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-m text-accent-contrast w-full"
                >
                  会計済みにする
                </button>
              </div>
            )}
          </main>

          <CheckoutConfirmAlert
            open={confirmOpen}
            table={
              selectedData?.selection.kind === "table"
                ? String(selectedData.tableLabel)
                : `🛍 ${PICKUP_NO_LABEL} ${(selectedData?.pickupNos ?? []).map((n) => formatPickupNo(n)).join(" / ")}`
            }
            amount={selectedData?.total ?? 0}
            confirming={closing}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleCloseOut}
          />
        </>
      )}
    </AdminPageShell>
  );
}
