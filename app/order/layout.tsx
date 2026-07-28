/**
 * /order 配下の共通レイアウト。
 *
 * 商品詳細をページ遷移ではなく**一覧に重ねるオーバーレイ**にしたので、
 * TOP・カテゴリ一覧・テイクアウトのどこから開いても同じ1つの
 * ItemDetailOverlay が使われるよう、ここに1回だけ置いている。
 * ページ側が入れ替わってもレイアウトは維持されるため、
 * オーバーレイの状態（?item=）も途切れない。
 */
import ItemDetailOverlay from "@/components/order/ItemDetailOverlay";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ItemDetailOverlay />
    </>
  );
}
