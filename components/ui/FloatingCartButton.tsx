"use client";

/**
 * TOPページ右下のフローティングカートボタン。
 *
 * 以前ここに置いていたスタッフ呼び出しのベルは廃止した（Menuページの
 * 「スタッフを呼ぶ」とドロワーから引き続き使えるので機能は失われない）。
 * 下部の「カートを見る」バーも廃止して、カートへの導線はこのボタンに一本化している。
 *
 * カートが空でも出しっぱなしにする（バッジだけ消える）。
 * 「カートはどこ？」を毎回探させないため、位置は常に固定。
 */
import { useRouter } from "next/navigation";
import CartIconButton from "@/components/ui/CartIconButton";
import { useCartStore } from "@/lib/store";
import { useUiStore } from "@/lib/uiStore";

export default function FloatingCartButton() {
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems());
  const activeOverlay = useUiStore((s) => s.activeOverlay);

  // シート/モーダルが開いている間は隠す（旧FloatingStaffCallと同じ挙動）
  if (activeOverlay) return null;

  return (
    <div
      className="fixed right-[16px] z-50 safe-bottom"
      style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
    >
      <CartIconButton count={totalItems} onClick={() => router.push("/cart")} />
    </div>
  );
}
