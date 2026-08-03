"use client";

/**
 * TOPページ（Step3-C、Figma: TOP 32:4）
 * Header → TabNav（scrollspy）→ FilterBar → ヒーロー動画 →
 * Best Seller（MenuCardWide カルーセル）→ Menu Section ×11（MenuCardM カルーセル＋ドット）
 *
 * カテゴリごとの表示は「2×2グリッド4件＋もっと見る」から
 * **そのカテゴリの全商品を横スワイプで見るカルーセル**に変更した。
 * 件数制限が無くなったので SeeMoreButton はこのページから外している
 * （カテゴリ一覧ページ /order/[category] 自体はMenuページから引き続き辿れる）。
 *
 * カートへの導線は右下のフローティングカートボタン1つに集約している
 * （下部の「カートを見る」バーは遷移先が同じで冗長だったため廃止）。
 */
import { useEffect, useRef, useState, Suspense } from "react";
import OrderHeader from "@/components/ui/OrderHeader";
import FloatingCartButton from "@/components/ui/FloatingCartButton";
import { TabNav } from "@/components/ui/Tab";
import { FilterBar } from "@/components/ui/FilterBar";
import { Video16x9 } from "@/components/ui/VideoBlock";
import { MenuCardM, MenuCardWide } from "@/components/ui/MenuCard";
import { MenuCarouselM, MenuCarouselWide } from "@/components/ui/MenuCarousel";
import FilterPlaceholderSheet from "@/components/ui/FilterPlaceholderSheet";
import { ENABLE_MENU_FILTER } from "@/lib/siteConfig";
import { useCartStore } from "@/lib/store";
import { openItemDetail } from "@/lib/itemOverlay";
import { useOrderPageData } from "@/hooks/useOrderPageData";
import type { MenuItem, MediaItem } from "@/lib/menu";

/* ── セクション構成（フード7 → ドリンク4） ── */
const SECTION_ORDER = [
  "pancake", "french_toast", "eggs_benedict", "sandwich",
  "fritter", "burger", "lunch",
  "coffee", "tea", "soft", "alcohol",
] as const;

/* ── 見出しコピー（eyebrow / EN / JP）。pancake は確定、他はドラフト承認済み文言 ── */
const SECTION_COPY: Record<string, { eyebrow: string; en: string; jp: string }> = {
  pancake:       { eyebrow: "これがYORKYSの原点！看板メニュー",       en: "PANCAKE",       jp: "パンケーキ" },
  french_toast:  { eyebrow: "外はさくっ、中はとろける贅沢な一皿",     en: "FRENCH TOAST",  jp: "フレンチトースト" },
  eggs_benedict: { eyebrow: "とろ〜りソースが自慢の、休日の主役",     en: "EGG BENEDICT",  jp: "エッグベネディクト" },
  sandwich:      { eyebrow: "片手で頬張る、忙しい朝のご褒美",         en: "SANDWICH",      jp: "サンドイッチ" },
  fritter:       { eyebrow: "サクッと軽い、箸が止まらない一品",       en: "FRITTER",       jp: "フリッター" },
  burger:        { eyebrow: "ボリューム満点、がっつり派に人気",       en: "BURGER",        jp: "バーガー" },
  lunch:         { eyebrow: "お腹も心も満たす、しっかりごはん",       en: "LUNCH",         jp: "ランチ" },
  coffee:        { eyebrow: "豆から届ける、香り高い一杯",             en: "COFFEE",        jp: "コーヒー" },
  tea:           { eyebrow: "ゆったり時間のお供に、香り豊かな一杯",   en: "TEA",           jp: "紅茶" },
  soft:          { eyebrow: "食事と一緒に、すっきり爽やかに",         en: "SOFT DRINK",    jp: "ソフトドリンク" },
  alcohol:       { eyebrow: "乾杯はここから、大人のひととき",         en: "ALCOHOL",       jp: "アルコール" },
};

const BEST_SELLER = {
  id: "best-seller",
  eyebrow: "人気ランキング殿堂入り！長く愛されるメニュー",
  en: "Best Seller",
  jp: "ベストセラー",
};

const TABS = [
  { id: BEST_SELLER.id, label: "おすすめ" },
  ...SECTION_ORDER.map((slug) => ({ id: slug, label: SECTION_COPY[slug].jp })),
];

/* ── ヒーロー動画（既存アセット。差し替えは この配列を変更するだけ） ── */
const HERO_MEDIA: MediaItem[] = [
  { type: "image", url: "/images/pancake/p1.webp" },
  { type: "video", url: "/images/hero/background.mp4" },
];

const FILTER_CHIPS = [
  { id: "allergy", label: "アレルギー" },
  { id: "dislike", label: "ニガテな食材" },
  { id: "pickup",  label: "受け取り方法" },
];

/* Header(68px) + sticky TabNav(50px) の下にセクション先頭が来るようにする */
const SCROLL_OFFSET = 118;

/* ── セクション見出し（Figma 54:556 実測: gap4 / jp-label + en-display-xl + jp-caption-bold） ── */
function SectionHeading({ eyebrow, en, jp }: { eyebrow: string; en: string; jp: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-16)]">
      <p className="type-jp-label text-text-secondary">{eyebrow}</p>
      <p className="type-en-display-xl text-text-primary">{en}</p>
      <p className="type-jp-caption-bold text-text-secondary">{jp}</p>
    </div>
  );
}

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
  const cartItems      = useCartStore((s) => s.items);
  const addItem        = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const { loading, bestSellerItems, bestSellerEnabled, categorySections } = useOrderPageData();

  const [activeSection, setActiveSection] = useState<string>(BEST_SELLER.id);
  const [filterOpen, setFilterOpen] = useState(false);
  const visibleSectionsRef = useRef<Set<string>>(new Set());

  /* ── scrollspy: ビューポート上部の帯に入っているセクションのうち最上位を active に ──
     Best Seller がOFFのときはセクション自体が無いので監視対象からも外す ── */
  useEffect(() => {
    if (loading) return;
    const ids = [...(bestSellerEnabled ? [BEST_SELLER.id] : []), ...SECTION_ORDER];
    const els = ids
      .map((id) => document.getElementById(`section-${id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^section-/, "");
          if (e.isIntersecting) visibleSectionsRef.current.add(id);
          else visibleSectionsRef.current.delete(id);
        }
        const current = ids.find((id) => visibleSectionsRef.current.has(id));
        if (current) setActiveSection(current);
      },
      // 上端: ヘッダー+タブナビ分をオフセット / 下端: 画面の上半分だけを判定帯にする
      { rootMargin: `-${SCROLL_OFFSET}px 0px -50% 0px`, threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, bestSellerEnabled]);

  const handleTabSelect = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const top = Math.max(
      0,
      el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
    );
    const startY = window.scrollY;
    window.scrollTo({ top, behavior: "smooth" });
    // 一部環境（reduced-motion 設定や自動化ブラウザ等）では smooth 指定が
    // 無視されて一切スクロールしないことがある。少し待って開始位置から
    // 動いていなければ即時ジャンプにフォールバックする。
    window.setTimeout(() => {
      if (Math.abs(window.scrollY - top) > 4 && Math.abs(window.scrollY - startY) < 4) {
        window.scrollTo(0, top);
      }
    }, 250);
  };

  /* ── カート連携（既存 zustand ストアにそのまま反映） ── */
  const qtyOf = (id: string) =>
    cartItems.find((ci) => ci.item.id === id)?.quantity ?? 0;
  const cardHandlers = (item: MenuItem) => ({
    quantity: qtyOf(item.id),
    onIncrement: () => addItem(item, 1),
    onDecrement: () => updateQuantity(item.id, qtyOf(item.id) - 1),
    onClick: () => openItemDetail(item.id),
  });

  const sectionItems = (slug: string): MenuItem[] =>
    categorySections.find((s) => s.category.slug === slug)?.items ?? [];

  /* ── カルーセルカードのステッパーは「何個入れるか」の下書き ──
     カートの現在数量を直接いじる従来のグリッドと違い、
     ステッパーで数を決めて「カートに入れる」で確定する（商品詳細の下部バーと同じ操作感）。
     0個追加は意味がないので下限は1。 */
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  const draftOf = (id: string) => draftQty[id] ?? 1;
  const bumpDraft = (id: string, delta: number) =>
    setDraftQty((d) => ({ ...d, [id]: Math.max(1, (d[id] ?? 1) + delta) }));

  const carouselCardHandlers = (item: MenuItem) => ({
    quantity: draftOf(item.id),
    onIncrement: () => bumpDraft(item.id, 1),
    onDecrement: () => bumpDraft(item.id, -1),
    onAddToCart: () => addItem(item, draftOf(item.id)),
    onClick: () => openItemDetail(item.id),
  });

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
      <div className="sticky top-[68px] z-30">
        <TabNav
          tabs={bestSellerEnabled ? TABS : TABS.filter((t) => t.id !== BEST_SELLER.id)}
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
            <Video16x9 media={HERO_MEDIA} />

            {/* ── Best Seller（カテゴリ横断・横カルーセル）──
                管理画面の設定でOFFにされたら、見出しごと描画しない（空の枠を残さない） ── */}
            {bestSellerEnabled && bestSellerItems.length > 0 && (
            <section
              id={`section-${BEST_SELLER.id}`}
              style={{ scrollMarginTop: SCROLL_OFFSET }}
              className="pt-[40px] pb-[40px]"
            >
              <SectionHeading
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

            {/* ── Menu Section ×11（フード7 → ドリンク4） ── */}
            {SECTION_ORDER.map((slug) => {
              const copy = SECTION_COPY[slug];
              const items = sectionItems(slug);
              return (
                <section
                  key={slug}
                  id={`section-${slug}`}
                  style={{ scrollMarginTop: SCROLL_OFFSET }}
                  className="pt-[40px] pb-[40px]"
                >
                  <SectionHeading eyebrow={copy.eyebrow} en={copy.en} jp={copy.jp} />
                  {items.length > 0 && (
                    <MenuCarouselM count={items.length} className="mt-[16px]">
                      {items.map((item) => (
                        <MenuCardM
                          key={item.id}
                          item={item}
                          {...carouselCardHandlers(item)}
                          imageLoading="lazy"
                        />
                      ))}
                    </MenuCarouselM>
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
      <FloatingCartButton />
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
