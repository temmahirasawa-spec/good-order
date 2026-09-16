"use client";

/**
 * 関連おすすめカード（Figma: Recommend Card 86:538）
 * 黒1px外線・白地・角丸なし・幅300・画像4:3（300×225）。
 * カテゴリタグ + タイトル + 短い説明文 + 価格。アレルギー/kcal 表記は無し。
 *
 * ── 写真が無い商品の見せ方（2026-09-16、天真が決定）──
 * ドリンクは19件中13件に写真が無い。**写真ありと無しは常に混在する前提**で作る。
 * 写真が無いときは画像の枠を残したまま、**そのカテゴリのタグ色を地にして商品名を大きく置く**。
 *   - 枠を残すので、写真ありのカードと**高さが必ず揃う**（カルーセルの下端が揃う）
 *   - 灰色の空箱に見えない。地の色はタグと同じトークン（bg-tag-*）なので新しい色を作っていない
 *   - あとで写真を設定すれば、何もしなくても自動で写真に切り替わる
 * 「1件も写真が無いときだけ別の形にする」といった分岐は入れない。
 * どちらの場合も同じカードで成立するので、**場合分けが要らないのが正しい**。
 *
 * 価格は写真の有無にかかわらず**必ず出す**（天真の指示 2026-09-16）。
 * それまでカードに価格が無く、お客様は開くまで値段が分からなかった。
 */
import type { MenuItem } from "@/lib/menu";
import CategoryTag, { TAG_BG } from "@/components/ui/CategoryTag";
import { resolveCategoryLabel, resolveTagColor } from "@/lib/categoryLabels";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { SoldOutBand } from "@/components/ui/SoldOut";

export default function RecommendCard({
  item,
  onClick,
  className = "",
}: {
  item: MenuItem;
  onClick?: () => void;
  className?: string;
}) {
  const categories = useMenuDataStore((s) => s.categories);
  const cover = item.media?.[0];
  const src = (cover?.type === "image" ? cover.url : undefined) ?? item.image;
  /* DB のカテゴリー名を先に見る。固定辞書だけだと slug（drink / hamburger …）がそのまま出る（2026-09-16 C4） */
  const label = resolveCategoryLabel(categories, item.subcategory);
  const color = resolveTagColor(categories, item.subcategory);
  const soldOut = item.isSoldOut === true;
  return (
    <div
      className={`menu-card ${onClick ? "pressable cursor-pointer" : ""} bg-surface-white border border-text-primary flex flex-col items-start overflow-hidden w-[300px] shrink-0 ${className}`}
      onClick={onClick}
    >
      <div
        className={`relative w-[300px] h-[225px] shrink-0 ${src ? "bg-bg-tertiary" : TAG_BG[color]}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.name}
            className={`menu-card__img absolute inset-0 w-full h-full object-cover ${soldOut ? "sold-out-photo" : ""}`}
          />
        ) : (
          /* 写真の代わりに商品名。長い名前（「ほうじ茶バニラクリームラテ」）でも
             枠から出ないよう3行で止める */
          <div className="absolute inset-0 flex items-center justify-center px-[var(--space-24)]">
            <p
              className={`type-jp-heading-l text-text-primary text-center line-clamp-3 break-words ${
                soldOut ? "opacity-40" : ""
              }`}
            >
              {item.name}
            </p>
          </div>
        )}
        {/* 写真が無いカードも地の色が付いているので、帯を出しても「画像なし」には見えない。
            出さないと売り切れのドリンクが売れるように見えてしまう（2026-09-16 に修正） */}
        {soldOut && <SoldOutBand />}
      </div>
      {/* カルーセルは全カードを一番高いカードに合わせて伸ばす。
          flex-1 を持たせないと、説明文の短いカードは下に余白が残り、
          価格がカードごとにバラバラの高さに浮いてしまう（2026-09-16） */}
      <div className="flex flex-1 flex-col gap-[6px] items-start pt-[14px] pb-[var(--space-16)] px-[var(--space-16)] w-full">
        <CategoryTag label={label} color={color} />
        <p className="type-jp-heading-s text-text-primary w-full">
          {item.name}
        </p>
        {item.description && (
          <p className="type-jp-caption text-text-secondary w-full">
            {item.description}
          </p>
        )}
        {/* mt-auto で必ず下端。カードをまたいで価格の高さが揃う */}
        <p className="type-en-price-m text-text-primary whitespace-nowrap w-full text-right mt-auto pt-[var(--space-8)]">
          ¥{item.price.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
