"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * お客様画面に適用するページトランジション。
 *   - /admin / /api はラップせずそのまま返す（管理画面は触らない方針）
 *   - opacity フェードイン（220ms ease-breath）のみ
 *
 * 商品詳細はページ遷移をやめ、一覧に重ねるオーバーレイ
 * （components/order/ItemDetailOverlay.tsx）にしたので、
 * ここで扱う特別扱いのルートは無くなった。
 * 左右スライドのアニメーションはオーバーレイ側が持っている。
 *
 * 実装メモ: 以前は framer-motion のJS駆動アニメだったが、アニメが中断されると
 * 祖先に transform が残留し、子孫の position:fixed（下部固定バー等）が
 * ビューポート基準でなくなる問題があった。CSSアニメーション
 * （fill-mode なし = 完了後にスタイルが自動で消える）に切り替え、さらに
 * バックグラウンドタブ等でアニメーションが進まないケースに備えて
 * 一定時間後に getAnimations().finish() で強制完了させる保険を入れている。
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isCustomerRoute =
    !!pathname && !pathname.startsWith("/admin") && !pathname.startsWith("/api");

  useEffect(() => {
    if (!isCustomerRoute) return;
    const el = wrapperRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      try {
        el.getAnimations().forEach((a) => a.finish());
      } catch {
        // getAnimations 未対応環境では何もしない（アニメは通常どおり終わる）
      }
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, isCustomerRoute]);

  if (!isCustomerRoute) {
    return <>{children}</>;
  }

  return (
    // key=pathname で遷移ごとに再マウントし、入場アニメーションを再生する
    <div ref={wrapperRef} key={pathname} className="page-fade-in">
      {children}
    </div>
  );
}
