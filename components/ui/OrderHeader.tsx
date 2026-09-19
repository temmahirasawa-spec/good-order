"use client";

/**
 * 新デザインのヘッダー（Figma: Header / Open 338:2267・Header / Close 176:1509）
 * 高さ68px。**ボタンは常に右上に1つだけ**（絶対配置 x326 y10）、ロゴは常に画面中央。
 * ロゴはトップ（/order）へのリンク。
 * ☰でも×でも位置を変えないことで、画面が変わってもボタンの場所を探さなくて済む。
 *
 * - variant="open"（デフォルト）: ボタン=☰、タップで /order/menu（Menuページ）へ
 * - variant="close": ボタン=×、タップで前の画面に戻る（履歴が無ければ /order へ）
 *
 * **× を出すのは Menu ページだけ**（2026-09-19、天真の指示）。
 * 中身のページ（カテゴリー一覧・テイクアウト・注文履歴）にも × を出していたため、
 * ☰ → パンケーキ一覧 → × と押すと Menu ページに戻り、
 * 「ハンバーガーメニューがまた開いた」ように見えていた。
 * 一般的なハンバーガーメニューと同じく、**中身のページは常に ☰**、
 * × は開いたメニューを閉じるときだけにする。
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import { asset } from "@/lib/siteConfig";

export default function OrderHeader({
  variant = "open",
}: {
  variant?: "open" | "close";
}) {
  const router = useRouter();
  const isClose = variant === "close";

  const handleClick = () => {
    if (isClose) {
      if (window.history.length > 1) router.back();
      else router.push("/order");
    } else {
      router.push("/order/menu");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-white h-[68px]">
      <div className="relative h-full">
        <HeaderIconButton
          icon={isClose ? "close" : "menu"}
          onClick={handleClick}
          label={isClose ? "メニューを閉じる" : "メニューを開く"}
          className="absolute right-[16px] top-[10px]"
        />
        {/* ロゴはどの画面でもトップ（/order）への入口（2026-09-19、天真の指示）。
            メニューページの「トップへ戻る」と同じ行き先にそろえている。
            p-4 はタップ領域を 38 → 46 にするためで、見た目は変わらない */}
        <Link
          href="/order"
          aria-label="トップへ戻る"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-[var(--space-4)]"
        >
          <Image
            src={asset("/images/logo/logoSmallBlack.webp")}
            alt="YORKYS BRUNCH"
            width={109}
            height={38}
            className="object-contain"
            priority
          />
        </Link>
      </div>
    </header>
  );
}
