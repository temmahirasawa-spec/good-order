"use client";

/**
 * TOPページ（Step3-C、Figma: TOP — 新構成 1494:10980、docs/specs/home-layout.md）
 * Header → TabNav（scrollspy）→ FilterBar → ヒーロー動画 →
 * Best Seller（MenuCardWide カルーセル）→ カテゴリーの区画（管理画面の並び順）
 *
 * 各区画は「上位 top_limit 件（既定5）＋ 見出し右の『すべてを見る』」。
 * 残りは縦一覧の /order/[category] へ送る（2026-09-08 天真の決定。
 * 2026-09-07 の「全件をカルーセル」は、ユーザーのメンタルモデルに合わないので取り下げ）。
 *
 * 区画の中身は2種類:
 *   写真カード … MenuCardM の横スワイプ（フード）
 *   文字の行   … MenuListRow の縦並び（写真の無いドリンクなど。docs/specs/menu-text-rows.md）
 * サブカテゴリーがある区画は、見出しの下にチップ（すべて／カフェ／…）が並び、
 * 押すとその区分の上位 N 件に入れ替わる。
 *
 * カートへの導線は右下のフローティングカートボタン1つに集約している
 * （下部の「カートを見る」バーは遷移先が同じで冗長だったため廃止）。
 */
import { useMemo, useRef, useState, Suspense } from "react";
import OrderHeader from "@/components/ui/OrderHeader";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { TabNav } from "@/components/ui/Tab";
import { useSectionSpy } from "@/hooks/useSectionSpy";
import { FilterBar } from "@/components/ui/FilterBar";
import { Video16x9 } from "@/components/ui/VideoBlock";
import { MenuCardM, MenuCardWide } from "@/components/ui/MenuCard";
import { MenuCarouselM, MenuCarouselWide } from "@/components/ui/MenuCarousel";
import MenuSectionHeader from "@/components/ui/MenuSectionHeader";
import MenuListRow from "@/components/ui/MenuListRow";
import SubcategoryChips, { ALL_CHIP_ID } from "@/components/ui/SubcategoryChips";
import FilterPlaceholderSheet from "@/components/ui/FilterPlaceholderSheet";
import { ENABLE_MENU_FILTER } from "@/lib/siteConfig";
import { useCartStore } from "@/lib/store";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { defaultSelection, normalizeSelectMode } from "@/lib/menuOptions";
import { openItemDetail } from "@/lib/itemOverlay";
import { listActionLabel, opensDetailFromList } from "@/lib/listAction";
import { useDraftQuantities } from "@/hooks/useDraftQuantities";
import { applyTopLimit, hasImage } from "@/lib/orderHome";
import { useOrderPageData, type CategorySection } from "@/hooks/useOrderPageData";
import { useStoreVideo } from "@/lib/useStoreMedia";
import { toMediaItems } from "@/lib/storeMedia";
import type { MenuItem } from "@/lib/menu";

const BEST_SELLER = {
  id: "best-seller",
  eyebrow: "人気ランキング殿堂入り！長く愛されるメニュー",
  en: "Best Seller",
  jp: "ベストセラー",
};

const FILTER_CHIPS = [
  { id: "allergy", label: "アレルギー" },
  { id: "dislike", label: "ニガテな食材" },
  { id: "pickup",  label: "受け取り方法" },
];

/* Header(68px) + sticky TabNav(50px) の下にセクション先頭が来るようにする */
/* ヘッダー(68) + タブナビ(50)。**実際の貼り付き位置は DOM から測る**ので、
   これは測れなかったときの保険（hooks/useSectionSpy.ts） */
const SCROLL_OFFSET = 118;

/* ── ローディングスケルトン ── */
function TopSkeleton() {
  return (
    <div>
      <div className="skeleton w-full" style={{ aspectRatio: "16/9", borderRadius: 0 }} />
      <div className="px-[16px] pt-[40px] space-y-[12px]">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-10 w-1/2" />
        <div className="flex flex-wrap justify-center gap-[16px] pt-[16px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[171px]">
              <div className="skeleton w-[171px] h-[171px]" style={{ borderRadius: 8 }} />
              <div className="skeleton h-4 w-3/4 mt-2" />
              <div className="skeleton h-4 w-1/3 mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderContent() {
  const orderType     = useCartStore((s) => s.orderType);
  const isTakeoutMode = useCartStore((s) => s.isTakeoutMode);
  const addItem        = useCartStore((s) => s.addItem);
  const menuOptions    = useMenuDataStore((s) => s.menuOptions);
  const categories     = useMenuDataStore((s) => s.categories);

  const { loading, bestSellerItems, bestSellerEnabled, categorySections } = useOrderPageData();

  /* ── ヒーロー動画（管理画面「店舗設定 > トップページ」で差し替える） ──
     取得が終わるまでは空配列＝描画しない。表示OFF・動画なしのときも空配列になり、
     Video16x9 が枠ごと消える。メニュー本体の取得の方が重いので、実際には
     この下の loading スケルトンが解けるより先に決まる。 */
  const heroVideo = useStoreVideo("order_hero");
  const heroMedia = heroVideo.loaded ? toMediaItems(heroVideo.media) : [];

  const tabNavRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  /* ── サブカテゴリーの絞り込み（区画ごと）。未選択 = すべて ── */
  const [chipSelection, setChipSelection] = useState<Record<string, string>>({});
  const chipOf = (slug: string) => chipSelection[slug] ?? ALL_CHIP_ID;

  /* ── タブの現在地とジャンプ（hooks/useSectionSpy.ts）──
     貼り付き位置を DOM から測り、「上端が境界線を越えた最後の区画」を現在地にする。
     決め打ちの帯で判定していた頃は、押した区画に着いてもタブが前の区画のままだった。 */
  const sectionIds = useMemo(
    () => [
      ...(bestSellerEnabled ? [BEST_SELLER.id] : []),
      ...categorySections.map((sec) => sec.category.slug),
    ],
    [bestSellerEnabled, categorySections]
  );
  const { active: activeSection, jumpTo: handleTabSelect } = useSectionSpy({
    ids: sectionIds,
    navRef: tabNavRef,
    enabled: !loading,
    fallbackOffset: SCROLL_OFFSET,
  });

  /* ── カート連携 ──
     ステッパーは**下書きの数量**で、カートに入るのは「カートに入れる」を押したときだけ。
     カルーセル（MenuCardM）が先にこの形だったのを、2026-09-16 に
     カード・行のすべてへ広げた（天真の指示）。hooks/useDraftQuantities.ts */
  const { draftOf, bump: bumpDraft, reset: resetDraft } = useDraftQuantities();
  const addToCart = (item: MenuItem) => {
    /* **ドリンクは一覧から直接入れず、詳細シートを開く**（2026-09-19、天真の決定）。
       HOT / ICED を選べないまま既定値で入ってしまうのを防ぐ。lib/listAction.ts */
    if (opensDetailFromList(categories, item)) {
      openItemDetail(item.id, { qty: draftOf(item.id) });
      resetDraft(item.id);
      return;
    }
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
    addLabel: listActionLabel(categories, item),
    onClick: () => openItemDetail(item.id),
  });

  /* ── タブ。DB のカテゴリー（親のみ・トップと同じ並び）から作る ── */
  const tabs = [
    ...(bestSellerEnabled ? [{ id: BEST_SELLER.id, label: "おすすめ" }] : []),
    ...categorySections.map((sec) => ({ id: sec.category.slug, label: sec.category.name })),
  ];


  /* ── 区画に出す商品: チップで絞ってから上位 N 件 ── */
  const itemsFor = (sec: CategorySection) => {
    const chip = chipOf(sec.category.slug);
    const base = chip === ALL_CHIP_ID
      ? sec.allItems
      : sec.allItems.filter((i) => i.subcategory === chip);
    return applyTopLimit(base, sec.topLimit);
  };
  /* 文字の行の2行目: サブカテゴリーがある区画は区分名、無ければ商品の説明文 */
  const rowDescription = (sec: CategorySection, item: MenuItem) =>
    sec.children.length > 0
      ? (sec.children.find((c) => c.slug === item.subcategory)?.name ?? null)
      : item.description;

  /* ── モードバナー（テイクアウト混入時、既存挙動を踏襲） ── */
  const showMixBanner = orderType === "dine_in" && isTakeoutMode;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col">
      <OrderHeader />

      {showMixBanner && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 text-center tracking-wide">
          🛍 テイクアウトメニューをカートに追加中
        </div>
      )}

      {/* ── ジャンプナビ（sticky・scrollspy） ── */}
      <div ref={tabNavRef} className="sticky top-[68px] z-30">
        <TabNav
          tabs={tabs}
          activeId={activeSection}
          onSelect={handleTabSelect}
        />
      </div>

      {/* ── 絞り込みバー（見た目のみ。タップでプレースホルダーを開く） ── */}
      {ENABLE_MENU_FILTER && (
        <FilterBar
          chips={FILTER_CHIPS}
          selectedIds={[]}
          onToggle={() => setFilterOpen(true)}
          onCustomize={() => setFilterOpen(true)}
        />
      )}

      <main className="flex-1 pb-24">
        {loading ? (
          <TopSkeleton />
        ) : (
          <>
            {/* ── ヒーロー動画（16:9・タップ再生） ── */}
            <Video16x9 media={heroMedia} />

            {/* ── Best Seller（カテゴリ横断・横カルーセル）──
                管理画面の設定でOFFにされたら、見出しごと描画しない（空の枠を残さない） ── */}
            {bestSellerEnabled && bestSellerItems.length > 0 && (
            <section
              id={`section-${BEST_SELLER.id}`}
              style={{ scrollMarginTop: SCROLL_OFFSET }}
              className="pt-[40px] pb-[40px] bg-accent-subtle"
            >
              <MenuSectionHeader
                eyebrow={BEST_SELLER.eyebrow}
                en={BEST_SELLER.en}
                jp={BEST_SELLER.jp}
              />
              <div className="mt-[16px]">
                <MenuCarouselWide>
                  {bestSellerItems.map((item) => (
                    <MenuCardWide
                      key={item.id}
                      item={item}
                      {...cardHandlers(item)}
                      imageLoading="eager"
                      className="shrink-0"
                    />
                  ))}
                </MenuCarouselWide>
              </div>
            </section>
            )}

            {/* ── カテゴリーの区画（管理画面「カテゴリ管理」の並び順） ── */}
            {categorySections.map((sec) => {
              const { category, listStyle, chips } = sec;
              const slug = category.slug;
              const items = itemsFor(sec);
              const showThumb = listStyle === "list" && sec.allItems.some(hasImage);
              return (
                <section
                  key={slug}
                  id={`section-${slug}`}
                  style={{ scrollMarginTop: SCROLL_OFFSET }}
                  className="pt-[40px] pb-[40px]"
                >
                  <MenuSectionHeader
                    eyebrow={category.description}
                    en={category.caption}
                    jp={category.name}
                    enSize={category.en_size}
                    jpSize={category.jp_size}
                    seeAllHref={`/order/${slug}`}
                  />

                  {chips.length > 0 && (
                    <SubcategoryChips
                      chips={chips}
                      selectedId={chipOf(slug)}
                      onSelect={(id) => setChipSelection((s) => ({ ...s, [slug]: id }))}
                      className="mt-[var(--space-16)]"
                    />
                  )}

                  {listStyle === "list" ? (
                    <div className="flex flex-col px-[var(--space-16)] mt-[var(--space-8)]">
                      {items.map((item) => (
                        <MenuListRow
                          key={item.id}
                          item={item}
                          quantity={draftOf(item.id)}
                          description={rowDescription(sec, item)}
                          showThumb={showThumb}
                          onAdd={() => addToCart(item)}
                          addLabel={listActionLabel(categories, item)}
                          onIncrement={() => bumpDraft(item.id, 1)}
                          onDecrement={() => bumpDraft(item.id, -1)}
                          onClick={() => openItemDetail(item.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    items.length > 0 && (
                      <MenuCarouselM className="mt-[16px]">
                        {items.map((item) => (
                          <MenuCardM
                            key={item.id}
                            item={item}
                            {...cardHandlers(item)}
                            imageLoading="lazy"
                          />
                        ))}
                      </MenuCarouselM>
                    )
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* ── 絞り込みプレースホルダー ── */}
      {ENABLE_MENU_FILTER && (
        <FilterPlaceholderSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      )}

      {/* ── フローティング（カートへの導線はこれ1つ） ── */}
      {/* 左下に小さくアイコンを置くのをやめ、他のページと同じ下部固定バーにそろえた
          （2026-09-16、天真の指示） */}
      <BottomViewCartBar />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <OrderContent />
    </Suspense>
  );
}
