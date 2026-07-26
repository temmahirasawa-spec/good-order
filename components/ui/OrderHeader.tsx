"use client";

/**
 * 新デザインのヘッダー（Figma: Header / Open 338:2267・Header / Close 176:1509）
 * 高さ68px。左に Header Icon Button（絶対配置 x16 y12）、ロゴは常に画面中央。
 *
 * - variant="open"（デフォルト）: 左ボタン=☰、タップで /order/menu（Menuページ）へ
 * - variant="close": 左ボタン=×、タップで前の画面に戻る（履歴が無ければ /order へ）
 *   Menuページ自身のヘッダーとして使用する
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import HeaderIconButton from "@/components/ui/HeaderIconButton";

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
          className="absolute left-[16px] top-[12px]"
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/images/logo/logoSmallBlack.png"
            alt="YORKYS BRUNCH"
            width={109}
            height={38}
            className="object-contain"
            priority
          />
        </div>
      </div>
    </header>
  );
}
