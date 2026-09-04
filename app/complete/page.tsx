"use client";

/**
 * 「ご注文を承りました」画面（Step3-G、Figma: Order Confirmed 388:2335）
 * ヘッダー・下部バーは常に固定表示、中央のコンテンツエリアだけが独立スクロールする
 * 構造（Cart画面・Step3-Fと同じ考え方。position:fixedではなくflexコンテナで実現）。
 *
 * 注文データの受け渡し・遷移タイミング等のロジックは既存のまま。見た目のみ差し替え。
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import ChefSmileIllustration from "@/components/ChefSmileIllustration";
import { AddToCartButton } from "@/components/ui/Buttons";
import ServingTimingBadge from "@/components/ui/ServingTimingBadge";
import { cartLineKey } from "@/lib/servingTiming";
import { formatSelectedOptions, optionsKey, optionsTotal } from "@/lib/menuOptions";
import { useCartStore, lineUnitPrice } from "@/lib/store";
import { fetchOrderStatuses } from "@/lib/api";
import { loadHistory, updateHistoryPickupNo } from "@/lib/history";
import { PICKUP_NO_LABEL, formatPickupNo } from "@/lib/pickupNo";

/* 受渡番号はサーバー側のトリガーが採番するため、注文直後は少し遅れて確定する。
   この画面に来た時点で注文の保存自体は完了している（placeOrder が保存を待つ）。
   番号だけが数秒遅れるので、その間は「発行中…」を出したまま数秒ポーリングする。
   取れなくても注文は成立しているので画面は壊さない。

   受渡番号を出すのはテイクアウト注文のときだけ。店内注文は配膳なので
   番号で呼び出す場面がなく、行ごと出さない（採番自体は全注文で行われる）。 */
const PICKUP_NO_POLL_MS    = 1000;
const PICKUP_NO_MAX_TRIES  = 20;

export default function CompletePage() {
  const router       = useRouter();
  const tableNumber  = useCartStore((s) => s.tableNumber);
  const orderHistory = useCartStore((s) => s.orderHistory);
  const lastOrderId  = useCartStore((s) => s.lastOrderId);

  const [pickupNo, setPickupNo] = useState<number | null>(null);
  // 注文種別は「その注文のスナップショット」から取る（カート側の orderType は
  // 画面遷移で変わりうるため、確定した注文の値を使う）
  const [isTakeoutOrder, setIsTakeoutOrder] = useState(false);

  const lastOrder  = orderHistory[orderHistory.length - 1] ?? [];
  const totalItems = lastOrder.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = lastOrder.reduce((s, i) => s + lineUnitPrice(i) * i.quantity, 0);

  useEffect(() => {
    if (!lastOrderId) return;
    const entry = loadHistory().find((e) => e.orderId === lastOrderId);
    setIsTakeoutOrder(entry?.orderType === "takeout");
  }, [lastOrderId]);

  useEffect(() => {
    // 店内注文では受渡番号を表示しないので取得もしない
    if (!lastOrderId || !isTakeoutOrder) return;
    let cancelled = false;
    let tries = 0;

    const poll = async () => {
      tries += 1;
      try {
        const rows = await fetchOrderStatuses([lastOrderId]);
        const no = rows[0]?.pickup_no ?? null;
        if (!cancelled && no !== null) {
          setPickupNo(no);
          updateHistoryPickupNo(lastOrderId, no);
          return;
        }
      } catch {
        // ネットワーク不調・RPC未適用等は黙って再試行（注文自体は成立している）
      }
      if (!cancelled && tries < PICKUP_NO_MAX_TRIES) {
        window.setTimeout(poll, PICKUP_NO_POLL_MS);
      }
    };
    poll();

    return () => { cancelled = true; };
  }, [lastOrderId, isTakeoutOrder]);

  const handleAddMore = () => {
    router.push(tableNumber ? `/order?table=${tableNumber}` : "/order");
  };

  return (
    <div className="mx-auto max-w-md h-[100dvh] flex flex-col bg-surface-white">
      <OrderHeader />

      {/* ── コンテンツ（ここだけスクロール） ── */}
      <main className="flex-1 overflow-y-auto flex flex-col gap-[var(--space-48)] py-[var(--space-40)] px-[var(--space-24)]">
        <div className="flex flex-col items-center gap-[var(--space-8)] w-full">
          <ChefSmileIllustration size={72} />
          <div className="flex flex-col items-center gap-[var(--space-4)] w-full text-center">
            <h1 className="type-jp-heading-l text-text-primary w-full">
              ご注文を承りました
            </h1>
            <p className="type-jp-body text-text-secondary w-full">
              美味しいお料理を心を込めてお作りします
            </p>
          </div>
        </div>

        {/* ── 受渡番号（この画面で最も目立つ要素）。テイクアウト注文のみ ── */}
        {lastOrderId && isTakeoutOrder && (
          <div className="flex flex-col items-center gap-[var(--space-4)] w-full bg-bg-warm rounded-[var(--radius-lg)] px-[var(--space-24)] py-[var(--space-24)]">
            <p className="type-jp-caption-bold text-text-secondary">{PICKUP_NO_LABEL}</p>
            {pickupNo === null ? (
              <p className="type-en-display-l text-text-tertiary leading-none py-[6px]">発行中…</p>
            ) : (
              <p className="type-en-display-xl text-text-primary leading-none">
                {formatPickupNo(pickupNo)}
              </p>
            )}
            <p className="type-jp-caption text-text-tertiary text-center">
              お呼び出しの際にこの番号をお伝えします
            </p>
          </div>
        )}

        {/* Order Summary Card: カード自体はw-fullのみ（余白は各行が自前のpx-24で持つ。
            イントロ見出しより1段内側に文字が来るのはFigma実測どおり） */}
        {lastOrder.length > 0 && (
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between px-[var(--space-24)] pt-[var(--space-24)] pb-[var(--space-20)]">
              <h2 className="type-jp-heading-m text-text-primary">ご注文内容</h2>
              <span className="type-jp-caption text-text-secondary">{totalItems}点</span>
            </div>

            <div className="flex flex-col">
              {lastOrder.map(({ item, quantity, servingTiming, options }) => (
                <div
                  key={cartLineKey(item.id, servingTiming, optionsKey(options))}
                  className="flex items-center justify-between gap-[var(--space-8)] px-[var(--space-24)] py-[10px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="type-jp-body text-text-primary">
                      {item.name}
                      {/* 「食後」だけ添える。初期値（でき次第・先出し）は再掲しない（仕様 3-4） */}
                      <ServingTimingBadge
                        timing={servingTiming}
                        showDefault={false}
                        className="ml-[var(--space-8)] align-middle"
                      />
                    </p>
                    {options && options.length > 0 && (
                      <p className="type-jp-caption text-text-secondary">{formatSelectedOptions(options)}</p>
                    )}
                  </div>
                  <p className="shrink-0 w-[32px] type-jp-caption text-text-secondary text-right">
                    ×{quantity}
                  </p>
                  <p className="shrink-0 w-[70px] type-en-price-m !font-medium text-text-secondary text-right">
                    ¥{((item.price + optionsTotal(options)) * quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-bg-warm px-[var(--space-24)] py-[var(--space-16)]">
              <div className="flex items-end">
                <span className="type-jp-heading-m text-text-primary">合計</span>
                <span className="type-jp-caption text-text-secondary">（税込）</span>
              </div>
              <span className="type-en-price-l !font-medium text-text-primary">
                ¥{Math.floor(totalPrice * 1.1).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ── 下部バー（固定） ── */}
      <footer className="shrink-0 bg-surface-white flex items-center justify-center px-[var(--space-24)] py-[var(--space-20)]">
        {/* カート・商品詳細と同じボタンコンポーネント（52px）に統一 */}
        <AddToCartButton label="追加で注文する" onClick={handleAddMore} />
      </footer>
    </div>
  );
}
