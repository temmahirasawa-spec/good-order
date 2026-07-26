"use client";

/**
 * カート画面（Step3-F、Figma: Cart 364:2216）
 * ヘッダー・Bottom Summary Barは常に固定表示、中央のアイテム一覧だけがスクロールする
 * 構造。position:fixedは使わず、flexコンテナ（header/main flex-1 overflow-y-auto/footer）
 * のみで実現している（Step3-D以来のtransform残留バグを構造的に避けるため）。
 *
 * カートの中身・数量変更・削除・注文確定のロジックは旧実装のまま。今回は見た目のみ差し替え。
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import { BackButton } from "@/components/ui/Buttons";
import CartItemRow from "@/components/ui/CartItemRow";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import { isAcceptingOrders } from "@/lib/api";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const placeOrder = useCartStore((s) => s.placeOrder);

  const categories = useMenuDataStore((s) => s.categories);
  const fetchAll = useMenuDataStore((s) => s.fetchAll);

  const [confirming, setConfirming] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const NOT_ACCEPTING_MESSAGE =
    "現在、ご注文の受付を一時停止しています。しばらくしてから再度お試しください。";

  const handleOrder = async () => {
    if (confirming) return;

    // 事前チェック（受付停止中ならアニメーションを始めずに即座に知らせる）
    let accepting = true;
    try {
      accepting = await isAcceptingOrders();
    } catch {
      accepting = true; // fail-open
    }
    if (!accepting) {
      alert(NOT_ACCEPTING_MESSAGE);
      return;
    }

    setConfirming(true);
    // 視覚演出のウェイト（ボタン沈み込み → ゴールドの光）
    await new Promise((r) => setTimeout(r, 300));
    setScreenFlash(true);
    const result = await placeOrder();
    if (!result.ok) {
      // 事前チェック後に受付停止へ切り替わった等の稀なケース
      setScreenFlash(false);
      setConfirming(false);
      if (result.reason === "closed") alert(NOT_ACCEPTING_MESSAGE);
      return;
    }
    // 白フェードの途中で遷移
    window.setTimeout(() => router.push("/complete"), 200);
  };

  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const hasTakeout = items.some((i) => i.item.isTakeout);

  return (
    <div className="mx-auto max-w-md h-[100dvh] flex flex-col bg-bg-warm">
      {/* ── ヘッダー（高さ68px固定） ── */}
      <header className="shrink-0 bg-surface-white h-[68px] relative">
        <BackButton
          icon="arrow-left"
          onClick={() => router.push("/order")}
          className="absolute left-[16px] top-[8px]"
        />
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 type-jp-heading-m text-text-primary whitespace-nowrap">
          カート
        </p>
        <HeaderIconButton
          icon="menu"
          onClick={() => router.push("/order/menu")}
          className="absolute right-[16px] top-[12px]"
        />
      </header>

      {/* ── コンテンツ（ここだけスクロール） ── */}
      <main className="flex-1 overflow-y-auto px-[var(--space-24)] pt-[var(--space-24)] pb-[var(--space-24)]">
        <h1 className="type-jp-heading-l text-text-primary">ご注文内容</h1>
        <p className="type-jp-caption text-accent-deep mt-[var(--space-4)] mb-[var(--space-16)]">
          {items.length === 0 ? "カートに商品がありません" : `${totalQuantity}点`}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-[var(--space-24)] py-[var(--space-48)]">
            <div className="w-20 h-20 rounded-full bg-bg-tertiary flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M6 4h20l-2 16H8L6 4z"
                  stroke="#969696"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="28" r="2" fill="#969696" />
                <circle cx="22" cy="28" r="2" fill="#969696" />
              </svg>
            </div>
            <div className="text-center">
              <p className="type-jp-body-bold text-text-primary mb-[var(--space-4)]">
                カートは空です
              </p>
              <p className="type-jp-body text-text-secondary">
                メニューからお好きな商品をお選びください
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/order")}
              className="type-jp-body-bold text-text-primary underline"
            >
              メニューに戻る
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-16)]">
            {items.map((ci) => (
              <CartItemRow
                key={ci.item.id}
                image={ci.item.image}
                categoryLabel={SUBCATEGORY_LABEL[ci.item.subcategory] ?? ci.item.subcategory}
                categoryColor={resolveTagColor(categories, ci.item.subcategory)}
                name={ci.item.name}
                price={ci.item.price}
                quantity={ci.quantity}
                onIncrement={() => updateQuantity(ci.item.id, ci.quantity + 1)}
                onDecrement={() => updateQuantity(ci.item.id, ci.quantity - 1)}
                onRemove={() => removeItem(ci.item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom Summary Bar（固定） ── */}
      {items.length > 0 && (
        <footer
          className="shrink-0 bg-bg-warm border-t border-border-divider px-[var(--space-24)] pt-[var(--space-20)]"
          style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center justify-between type-jp-body text-text-secondary">
            <span>小計</span>
            <span className="type-en-price-s text-text-secondary">
              ¥{totalPrice.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between type-jp-body text-text-secondary mt-[var(--space-8)]">
            <span>消費税 (10%)</span>
            <span className="type-en-price-s text-text-secondary">
              ¥{Math.floor(totalPrice * 0.1).toLocaleString()}
            </span>
          </div>
          <div className="h-px bg-border-divider my-[var(--space-12)]" />
          <div className="flex items-center justify-between">
            <span className="type-jp-heading-s text-text-primary">合計（税込）</span>
            <span className="type-en-price-l text-text-primary">
              ¥{Math.floor(totalPrice * 1.1).toLocaleString()}
            </span>
          </div>

          <p className="type-jp-caption text-text-secondary text-center mt-[var(--space-12)] mb-[var(--space-12)]">
            {hasTakeout
              ? "テイクアウト商品はお帰りの際にスタッフへお声がけください"
              : "お会計はスタッフまでお声がけください"}
          </p>

          <button
            type="button"
            onClick={handleOrder}
            disabled={confirming}
            className={`btn-confirm confirm-btn w-full tracking-wide disabled:opacity-100 !rounded-[var(--radius-full)] ${
              confirming ? "confirming" : ""
            }`}
          >
            {confirming ? "送信中…" : "注文を確定する"}
          </button>
        </footer>
      )}

      {/* 注文確定 → /complete 遷移時の白フラッシュ */}
      {screenFlash && <div className="screen-flash" />}
    </div>
  );
}
