"use client";

/**
 * TOPページ（Step3-C、Figma: TOP 32:4）
 * Header → TabNav（scrollspy）→ FilterBar → ヒーロー動画 →
 * Best Seller（MenuCardWide カルーセル）→ Menu Section ×11（2×2 MenuCard + SeeMore）
 *
 * Figma 実測（32:4 metadata）:
 * - 各セクション: pt-40 / 見出し(eyebrow=jp-label, EN=en-display-xl, JP=jp-caption-bold, gap4, px-16)
 *   / 16 / コンテンツ（グリッド gap16・カルーセル）/ 24 / SeeMoreButton / pb-40
 */
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import FloatingStaffCall from "@/components/FloatingStaffCall";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { TabNav } from "@/components/ui/Tab";
import { FilterBar } from "@/components/ui/FilterBar";
import { Video16x9 } from "@/components/ui/VideoBlock";
import { MenuCard, MenuCardWide } from "@/components/ui/MenuCard";
import { MenuCarouselWide } from "@/components/ui/MenuCarousel";
import SeeMoreButton from "@/components/ui/SeeMoreButton";
import FilterPlaceholderSheet from "@/components/ui/FilterPlaceholderSheet";
import { useCartStore } from "@/lib/store";
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
  { type: "image", url: "/images/pancake/p1.png" },
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
  const router = useRouter();
  const orderType     = useCartStore((s) => s.orderType);
  const isTakeoutMode = useCartStore((s) => s.isTakeoutMode);
  const cartItems      = useCartStore((s) => s.items);
  const addItem        = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const { loading, bestSellerItems, categorySections } = useOrderPageData();

  const [activeSection, setActiveSection] = useState<string>(BEST_SELLER.id);
  const [filterOpen, setFilterOpen] = useState(false);
  const visibleSectionsRef = useRef<Set<string>>(new Set());

  /* ── scrollspy: ビューポート上部の帯に入っているセクションのうち最上位を active に ── */
  useEffect(() => {
    if (loading) return;
    const ids = [BEST_SELLER.id, ...SECTION_ORDER];
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
  }, [loading]);

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
    onClick: () => router.push(`/order/item/${item.id}`),
  });

  const sectionItems = (slug: string): MenuItem[] =>
    categorySections.find((s) => s.category.slug === slug)?.items ?? [];

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
        <TabNav tabs={TABS} activeId={activeSection} onSelect={handleTabSelect} />
      </div>

      {/* ── 絞り込みバー（見た目のみ。タップでプレースホルダーを開く） ── */}
      <FilterBar
        chips={FILTER_CHIPS}
        selectedIds={[]}
        onToggle={() => setFilterOpen(true)}
        onCustomize={() => setFilterOpen(true)}
      />

      <main className="flex-1 pb-24">
        {loading ? (
          <TopSkeleton />
        ) : (
          <>
            {/* ── ヒーロー動画（16:9・タップ再生） ── */}
            <Video16x9 media={HERO_MEDIA} />

            {/* ── Best Seller（カテゴリ横断・横カルーセル） ── */}
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
                    <div className="grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)] mt-[16px]">
                      {items.map((item) => (
                        <MenuCard
                          key={item.id}
                          item={item}
                          {...cardHandlers(item)}
                          imageLoading="lazy"
                        />
                      ))}
                    </div>
                  )}
                  <div className="px-[var(--space-16)] mt-[24px]">
                    <SeeMoreButton
                      label={`${copy.jp}をもっと見る`}
                      href={`/order/${slug}`}
                    />
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* ── 絞り込みプレースホルダー ── */}
      <FilterPlaceholderSheet open={filterOpen} onClose={() => setFilterOpen(false)} />

      {/* ── フローティング ── */}
      <FloatingStaffCall />
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
