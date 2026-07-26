"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * お客様画面に適用するページトランジション。
 *   - /admin / /api はラップせずそのまま返す（管理画面は触らない方針）
 *   - 通常遷移: opacity フェードイン（220ms ease-breath）
 *   - 商品詳細（/order/item/*）: 下から上に出現するフルモーダル風スライド
 *
 * 実装メモ: 以前は framer-motion のJS駆動アニメだったが、アニメが中断されると
 * 祖先に transform が残留し、子孫の position:fixed（下部固定バー等）が
 * ビューポート基準でなくなる問題があった。CSSアニメーション
 * （fill-mode なし = 完了後にスタイルが自動で消える）に切り替え、さらに
 * バックグラウンドタブ等でアニメーションが進まないケースに備えて
 * 一定時間後に getAnimations().finish() で強制完了させる保険を入れている。
 * keyframes は app/globals.css の .page-fade-in / .page-slide-up を参照。
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
    }, 600); // 最長アニメ 380ms + 余裕
    return () => clearTimeout(t);
  }, [pathname, isCustomerRoute]);

  if (!isCustomerRoute) {
    return <>{children}</>;
  }

  const isModalRoute = pathname.startsWith("/order/item/");

  return (
    // key=pathname で遷移ごとに再マウントし、入場アニメーションを再生する
    <div
      ref={wrapperRef}
      key={pathname}
      className={isModalRoute ? "page-slide-up" : "page-fade-in"}
    >
      {children}
    </div>
  );
}
