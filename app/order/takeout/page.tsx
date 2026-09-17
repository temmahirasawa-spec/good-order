"use client";

/**
 * テイクアウトメニュー（ハンバーガーメニュー ＞ テイクアウト）
 *
 * **2026-09-15 に新デザインへ作り替えた。** それまでこの画面だけ旧デザイン
 * （Header / CartButton / FloatingStaffCall / 自前のカード）のまま取り残されていて、
 * 他の一覧と見た目がまるで違った（洋輔さんの指摘）。
 * いまはカテゴリー一覧（app/order/[category]/page.tsx）と同じ器を使う。
 *
 * 空のときの扱い:
 *   テイクアウト対象の商品が1つも無いときは、そもそもハンバーガーメニュー側の導線を
 *   「テイクアウト（準備中）」にして押せなくしてある（app/order/menu/page.tsx）。
 *   それでも直接この URL に来られるので、ここでも**次にどうすればいいかが分かる**
 *   空の画面を出す。以前は「現在、テイクアウトメニューはありません」の1行だけだった。
 */
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { defaultSelection, normalizeSelectMode } from "@/lib/menuOptions";
import { openItemDetail } from "@/lib/itemOverlay";
import { useDraftQuantities } from "@/hooks/useDraftQuantities";
import OrderHeader from "@/components/ui/OrderHeader";
import { MenuCard } from "@/components/ui/MenuCard";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { AddToCartButton } from "@/components/ui/Buttons";
import type { MenuItem } from "@/lib/menu";

/* ── ローディング（カテゴリー一覧と同じ2カラム4セル） ── */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 justify-items-center gap-x-[8px] gap-y-[16px] px-[var(--space-16)]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-full max-w-[175px]">
          <div className="aspect-square rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
          <div className="h-3 mt-[8px] rounded bg-bg-tertiary animate-pulse" />
          <div className="h-3 mt-[6px] w-1/2 rounded bg-bg-tertiary animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function TakeoutMenuPage() {
  const router        = useRouter();
  const addItem       = useCartStore((s) => s.addItem);
  const orderType     = useCartStore((s) => s.orderType);
  const isTakeoutMode = useCartStore((s) => s.isTakeoutMode);
  const setTakeoutMode = useCartStore((s) => s.setTakeoutMode);


  const allMenuItems  = useMenuDataStore((s) => s.menuItems);
  const menuOptions   = useMenuDataStore((s) => s.menuOptions);
  const storeLoading  = useMenuDataStore((s) => s.loading);
  const storeLoaded   = useMenuDataStore((s) => s.loadedAt);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime  = useMenuDataStore((s) => s.stopRealtime);

  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () => allMenuItems.filter((m) => m.isTakeout),
    [allMenuItems]
  );
  const loading = storeLoading && !storeLoaded;

  /* カテゴリー一覧と同じ操作にそろえる。
     ステッパーは**下書きの数量**で、カートに入るのは「カートに入れる」を押したときだけ */
  const { draftOf, bump: bumpDraft, reset: resetDraft } = useDraftQuantities();
  const addToCart = (item: MenuItem) => {
    /* **一覧の「カートに入れる」はその場で入れる**（2026-09-17、天真の決定）。
       以前はオプション（HOT/ICED 等）のある商品だけ詳細シートを開いてもう一度押させていたが、
       「押したのに入らない」とお客様が戸惑う。オプションは既定値（1つ選ぶ型は1番目＝HOT、
       複数選ぶ型は無し）、提供タイミングは区分の既定値で入れる。変えたい人は商品をタップして詳細から */
    const options = defaultSelection(normalizeSelectMode(item.optionsSelectMode), menuOptions[item.id] ?? []);
    addItem(item, draftOf(item.id), undefined, options);
    resetDraft(item.id);
  };
  const cardHandlers = (item: MenuItem) => ({
    quantity: draftOf(item.id),
    onIncrement: () => bumpDraft(item.id, 1),
    onDecrement: () => bumpDraft(item.id, -1),
    onAddToCart: () => addToCart(item),
    onClick: () => openItemDetail(item.id),
  });

  /* 店内のお客様が店内メニューに戻るときは、テイクアウトの追加モードを解く。
     解かないと、次に足した店内商品までテイクアウト扱いに見えてしまう */
  const backToDineIn = () => {
    setTakeoutMode(false);
    router.push("/order");
  };

  /* 店内のお客様がテイクアウトメニューを見ている最中だけ、いま何をしているかを出す */
  const showMixBanner = orderType === "dine_in" && isTakeoutMode;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col gap-[var(--space-20)]">
      <div className="sticky top-0 z-30 flex flex-col">
        <OrderHeader variant="close" />
        {showMixBanner && (
          <div className="bg-accent-subtle border-b border-border-divider px-[var(--space-16)] py-[var(--space-8)]">
            <p className="type-jp-caption-bold text-accent-deep text-center">
              テイクアウトの商品をカートに追加しています
            </p>
          </div>
        )}
      </div>

      {/* ── 見出し ── */}
      <div className="flex flex-col gap-[var(--space-4)] pt-[4px] px-[var(--space-24)]">
        <p className="type-en-display-l text-text-primary">TAKEOUT</p>
        <p className="type-jp-body-small text-text-primary">テイクアウト</p>
      </div>

      <main className="pb-[96px]">
        {loading ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          /* 空。**行き止まりにしない。** 次にどうすればいいかを出す */
          <div className="flex flex-col items-center gap-[var(--space-16)] px-[var(--space-24)] py-[var(--space-48)]">
            <p className="type-jp-heading-s text-text-primary text-center">
              ただいま準備中です
            </p>
            <p className="type-jp-body text-text-secondary text-center">
              お持ち帰りいただけるメニューは、いまご用意がありません。
              店内でお召し上がりいただけるメニューからお選びください。
            </p>
            <div className="w-full max-w-[280px] mt-[var(--space-8)]">
              <AddToCartButton label="店内メニューを見る" onClick={backToDineIn} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 justify-items-center gap-x-[8px] gap-y-[16px] px-[var(--space-16)]">
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                {...cardHandlers(item)}
                imageLoading="lazy"
                hideTag
              />
            ))}
          </div>
        )}
      </main>

      <BottomViewCartBar />
    </div>
  );
}
