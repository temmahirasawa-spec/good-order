/**
 * /order 配下の共通レイアウト。
 *
 * 商品詳細をページ遷移ではなく**一覧に重ねるオーバーレイ**にしたので、
 * TOP・カテゴリ一覧・テイクアウトのどこから開いても同じ1つの
 * ItemDetailOverlay が使われるよう、ここに1回だけ置いている。
 * ページ側が入れ替わってもレイアウトは維持されるため、
 * オーバーレイの状態（?item=）も途切れない。
 */
import type { Metadata } from "next";
import ItemDetailOverlay from "@/components/order/ItemDetailOverlay";
import VisitClosedGate from "@/components/ui/VisitClosedGate";

/**
 * 注文フローは検索結果に出さない。カート状態や卓の二次元コードを前提にした画面で、
 * 検索から直接来ても注文が成立しないため。
 * （クロールは robots.txt で許可したままにして、この noindex を読ませる）
 */
export const metadata: Metadata = {
  title: "メニュー",
  alternates: { canonical: "/order" },
  robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 会計が済んだ端末では注文画面を出さない（lib/visitSession.ts）。
       ふだんは中身をそのまま通すので、この包みは見えない */
    <VisitClosedGate>
      {children}
      <ItemDetailOverlay />
    </VisitClosedGate>
  );
}
