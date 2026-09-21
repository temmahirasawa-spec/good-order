"use client";

/**
 * レジの伝票編集モード（2026-09-21、洋輔さん経由の店舗の要望）
 *
 * 会計待ちの画面では、明細は「店内／テイクアウト」でまとめて出している（BillCard）。
 * 編集のときだけ**伝票（注文1回ぶん）ごと**に並べ替える。
 * 「伝票ごと消す」を押すとき、どの行がその伝票に属しているかが見えていないと危ないため。
 *
 * 金額は出さない。編集中は DB を書き換えるたびにサーバーが計算し直すので、
 * 途中の数字を画面で足し引きすると必ず食い違う（2026-09-15 の反省）。
 * 合計は編集を終えて BillCard に戻ったときに、DB の値で出す。
 */
import { Icon } from "@/components/Icon";
import { PICKUP_NO_LABEL, formatPickupNo } from "@/lib/pickupNo";

export interface BillEditorItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BillEditorOrder {
  id: string;
  pickupNo: number | null;
  /** "16:09" */
  timeLabel: string;
  isTakeout: boolean;
  items: BillEditorItem[];
}

export default function BillEditor({
  orders,
  busy,
  onDeleteItem,
  onDeleteOrder,
  onAdd,
}: {
  orders: BillEditorOrder[];
  /** 何か書き込み中。二重で押せないようにする */
  busy: boolean;
  onDeleteItem: (orderId: string, item: BillEditorItem) => void;
  onDeleteOrder: (order: BillEditorOrder) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="bg-surface-white flex flex-col gap-[var(--space-16)] lg:gap-[var(--space-20)] items-start p-[var(--space-20)] lg:p-[var(--space-24)] rounded-[var(--radius-lg)] w-full"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {orders.map((o, i) => (
        <div key={o.id} className="flex flex-col gap-[var(--space-8)] items-start w-full">
          <div className="flex items-center gap-[var(--space-8)] w-full">
            <span className="type-jp-caption-bold text-text-secondary shrink-0">
              {i + 1}回目
            </span>
            <span className="type-jp-caption text-text-tertiary shrink-0">
              {o.isTakeout ? "🛍 " : ""}
              {PICKUP_NO_LABEL} {formatPickupNo(o.pickupNo)} ・ {o.timeLabel}
            </span>
            <button
              type="button"
              onClick={() => onDeleteOrder(o)}
              disabled={busy}
              className="ml-auto shrink-0 flex items-center gap-[var(--space-4)] border border-status-urgent disabled:opacity-40 px-[var(--space-12)] py-[var(--space-4)] rounded-[var(--radius-full)] type-jp-caption-bold text-status-urgent"
            >
              <Icon name="trash" className="w-4 h-4 text-status-urgent" />
              この伝票を削除
            </button>
          </div>

          <div className="flex flex-col gap-[var(--space-2)] items-start w-full">
            {o.items.map((it) => (
              <div
                key={it.id}
                className="flex gap-[var(--space-12)] items-center py-[var(--space-4)] w-full"
              >
                <p className="flex-1 min-w-0 type-jp-body text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                  {it.name}
                </p>
                <p className="shrink-0 w-[32px] type-en-data-s text-text-tertiary text-right">
                  ×{it.quantity}
                </p>
                <p className="shrink-0 w-[76px] font-en font-semibold text-[14px] leading-[1.2] text-text-primary text-right">
                  ¥{(it.unitPrice * it.quantity).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => onDeleteItem(o.id, it)}
                  disabled={busy}
                  aria-label={`${it.name} を削除`}
                  className="shrink-0 flex items-center justify-center rounded-full bg-status-urgent-subtle disabled:opacity-40 size-[32px]"
                >
                  <Icon name="trash" className="w-4 h-4 text-status-urgent" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="flex items-center justify-center gap-[var(--space-4)] border border-dashed border-border disabled:opacity-40 py-[var(--space-12)] rounded-[var(--radius-md)] type-jp-body-bold text-text-primary w-full"
      >
        <Icon name="plus" className="w-4 h-4 text-text-primary" />
        商品を追加
      </button>

      <p className="type-jp-caption text-text-tertiary">
        消した分・足した分に合わせて、割引と消費税を含めた金額はサーバーが計算し直します。
        追加すると厨房に伝票が出ます。
      </p>
    </div>
  );
}
