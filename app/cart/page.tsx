"use client";

/**
 * カート画面（Step3-F、Figma: Cart 364:2216）
 * ヘッダー・Bottom Summary Barは常に固定表示、中央のアイテム一覧だけがスクロールする
 * 構造。position:fixedは使わず、flexコンテナ（header/main flex-1 overflow-y-auto/footer）
 * のみで実現している（Step3-D以来のtransform残留バグを構造的に避けるため）。
 *
 * カートの中身・数量変更・削除・注文確定のロジックは旧実装のまま。今回は見た目のみ差し替え。
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import { AddToCartButton, BackButton } from "@/components/ui/Buttons";
import CartItemRow from "@/components/ui/CartItemRow";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { SUBCATEGORY_LABEL, resolveTagColor } from "@/lib/categoryLabels";
import {
  canChooseServingTiming,
  cartLineKey,
  defaultServingTiming,
  servingCategoryType,
  servingTimingOptions,
} from "@/lib/servingTiming";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setServingTiming = useCartStore((s) => s.setServingTiming);
  const orderType = useCartStore((s) => s.orderType);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const placeOrder = useCartStore((s) => s.placeOrder);

  const categories = useMenuDataStore((s) => s.categories);
  const fetchAll = useMenuDataStore((s) => s.fetchAll);

  const [confirming, setConfirming] = useState(false);
  // 同一タップ内の連打を弾く。state は反映が1拍遅れるので ref と併用する
  const submittingRef = useRef(false);
  const [screenFlash, setScreenFlash] = useState(false);

  useEffect(() => {
    fetchAll();
    // 完了画面の JS を先に落としておく。モバイル回線では、注文が保存できた後の
    // 画面遷移でチャンクを取りに行く時間が体感の大半を占めていた。
    // カートを見ている間に済ませておけば、遷移が一瞬になる。
    router.prefetch("/complete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 提供タイミングを持たない行（移行前に保存されたカートや、カテゴリー読み込み前に
     入れた商品）に初期値を入れる。選べる商品なのに値が無いと、画面には初期値が出るのに
     注文には null が乗って伝票に何も印字されない、というズレが起きるため。 */
  useEffect(() => {
    if (categories.length === 0) return;
    for (const ci of items) {
      if (ci.servingTiming == null && canChooseServingTiming(categories, ci.item, orderType)) {
        setServingTiming(
          ci.item.id,
          null,
          defaultServingTiming(servingCategoryType(categories, ci.item))
        );
      }
    }
  }, [categories, items, orderType, setServingTiming]);

  const NOT_ACCEPTING_MESSAGE =
    "現在、ご注文の受付を一時停止しています。しばらくしてから再度お試しください。";

  const handleOrder = async () => {
    // 二度押し防止は**必ず最初に**行う。
    //   以前は先に isAcceptingOrders()（ネットワーク往復）を待ってから
    //   setConfirming(true) していたため、往復中はボタンが押せたままだった。
    //   店の Wi-Fi が重いと「押したのに反応しない」と感じた客が二度押しし、
    //   注文IDは押すたびに新規採番されるので**別の注文として2件入る**
    //   （伝票2枚・料理2人前・レジで2件請求）。2026-08-26 の監査で判明。
    //
    //   React の state 更新は1拍遅れるので、同一タップ内の連打には効かない。
    //   そのため useRef のフラグと併用する。
    if (submittingRef.current || confirming) return;
    submittingRef.current = true;
    setConfirming(true);

    // 通信は**ここで即座に始める**。
    //   以前はこの手前で isAcceptingOrders() を1回叩いていたが、それは
    //   placeOrder の中でしている確認とまったく同じ問い合わせで、モバイル回線
    //   では丸ごと1往復（0.3〜0.8秒）が待ち時間になっていた。受付停止の判定は
    //   書き込み直前の placeOrder 側に一本化する（停止中は "closed" が返る）。
    //   placeOrder が例外を投げた場合も UI が固まらないよう、ここで受け止める。
    const pending = placeOrder().catch(
      () => ({ ok: false, reason: "failed" }) as const
    );

    // 視覚演出のウェイト（ボタン沈み込み → ゴールドの光）。
    // この 300ms は通信と**並行**に流す。直列に待つと演出の分だけ完了が遅れる。
    await new Promise((r) => setTimeout(r, 300));
    setScreenFlash(true);
    const result = await pending;
    if (!result.ok) {
      setScreenFlash(false);
      setConfirming(false);
      submittingRef.current = false;
      if (result.reason === "closed") {
        alert(NOT_ACCEPTING_MESSAGE);
      } else if (result.reason === "failed") {
        // 送信できなかった。カートは残っているので、そのまま再送できる。
        // ここで黙って完了画面に進むと、厨房に届かない注文をお客様が
        // 待ち続けることになる（実店舗で最も起きてはいけない事故）。
        alert(
          "通信エラーのため、ご注文を送信できませんでした。\n" +
          "お手数ですが、もう一度「注文を確定する」を押してください。\n" +
          "繰り返し失敗する場合は、店員にお声がけください。"
        );
      }
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
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
                <path
                  d="M6 4h20l-2 16H8L6 4z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="28" r="2" fill="currentColor" />
                <circle cx="22" cy="28" r="2" fill="currentColor" />
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
            {items.map((ci) => {
              /* 行の同一性は「商品ID ＋ 提供タイミング」（docs/specs/serving-timing.md 3-3）。
                 同じ商品でも「でき次第」と「食後」は別の行になる */
              const timing = ci.servingTiming ?? null;
              const selectable = canChooseServingTiming(categories, ci.item, orderType);
              const type = servingCategoryType(categories, ci.item);
              return (
                <CartItemRow
                  key={cartLineKey(ci.item.id, timing)}
                  image={ci.item.image}
                  categoryLabel={SUBCATEGORY_LABEL[ci.item.subcategory] ?? ci.item.subcategory}
                  categoryColor={resolveTagColor(categories, ci.item.subcategory)}
                  name={ci.item.name}
                  price={ci.item.price}
                  quantity={ci.quantity}
                  onIncrement={() => updateQuantity(ci.item.id, ci.quantity + 1, timing)}
                  onDecrement={() => updateQuantity(ci.item.id, ci.quantity - 1, timing)}
                  onRemove={() => removeItem(ci.item.id, timing)}
                  servingTiming={
                    selectable
                      ? {
                          value: timing ?? defaultServingTiming(type),
                          options: servingTimingOptions(type).map((o) => ({
                            value: o.value,
                            label: o.label,
                          })),
                          onChange: (next) => setServingTiming(ci.item.id, timing, next),
                        }
                      : undefined
                  }
                />
              );
            })}
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

          {/* 商品詳細・カルーセルと同じボタンコンポーネントを使い回す。
              個別にスタイルを書くと高さが潰れる等の同種のズレが再発するため */}
          <AddToCartButton
            label={confirming ? "送信中…" : "注文を確定する"}
            onClick={handleOrder}
            disabled={confirming}
          />
        </footer>
      )}

      {/* 注文確定 → /complete 遷移時の白フラッシュ */}
      {screenFlash && <div className="screen-flash" />}
    </div>
  );
}
