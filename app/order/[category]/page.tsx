"use client";

/**
 * カテゴリ一覧ページ（Step3-H、Figma: Category Listing 173:612 /
 * Category Listing — ドリンク（サブカテゴリー） 1494:11038、docs/specs/home-layout.md 4章）
 * TOPページの見出し右「すべてを見る」の遷移先。
 *
 * ヘッダー（×右上）→ サブカテゴリーの下線タブ（あるときだけ。トップの上部タブと
 * 同じ器で、押すとその区分の見出しへ縦スクロールで移動する。絞り込みではない）
 * → カテゴリタイトル（EN/JP。DB から）→ 本文 → Bottom View Cart Bar。
 *
 * 本文は「一覧の見せ方」で切り替わる（docs/specs/menu-text-rows.md）:
 *   photo … 2列の写真グリッド（従来どおり）
 *   list  … 文字の行（Menu List Row）の縦並び
 * サブカテゴリーがあるときは、区分ごとの見出し（List Sub Heading）で区切る。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import OrderHeader from "@/components/ui/OrderHeader";
import { TabNav } from "@/components/ui/Tab";
import { MenuCard } from "@/components/ui/MenuCard";
import MenuListRow from "@/components/ui/MenuListRow";
import ListSubHeading from "@/components/ui/ListSubHeading";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { useCartStore } from "@/lib/store";
import { openItemDetail } from "@/lib/itemOverlay";
import { useMenuDataStore } from "@/lib/menuDataStore";
import { hasSelectableOptions } from "@/lib/menuOptions";
import { childCategories, itemsOfCategory, resolveListStyle, hasImage } from "@/lib/orderHome";
import { SUBCATEGORY_LABEL, SUBCATEGORY_EN_LABEL } from "@/lib/categoryLabels";
import type { ApiCategory } from "@/lib/api";
import type { MenuItem, Subcategory } from "@/lib/menu";

/* Header(68px) + sticky TabNav(50px) */
const SCROLL_OFFSET = 118;

/* ── ローディングスケルトン（2カラム4セル） ── */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[171px]">
          <div className="skeleton w-[171px] h-[171px]" style={{ borderRadius: 8 }} />
          <div className="skeleton h-4 w-3/4 mt-2" />
          <div className="skeleton h-4 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

interface Group {
  id: string;
  /** null = 見出しを出さない（サブカテゴリーの無いカテゴリー） */
  title: string | null;
  items: MenuItem[];
}

export default function CategoryListingPage() {
  const { category } = useParams<{ category: string }>();

  const categories    = useMenuDataStore((s) => s.categories);
  const allMenuItems  = useMenuDataStore((s) => s.menuItems);
  const storeLoading  = useMenuDataStore((s) => s.loading);
  const loadedAt      = useMenuDataStore((s) => s.loadedAt);
  const fetchAll      = useMenuDataStore((s) => s.fetchAll);
  const startRealtime = useMenuDataStore((s) => s.startRealtime);
  const stopRealtime  = useMenuDataStore((s) => s.stopRealtime);

  const cartItems      = useCartStore((s) => s.items);
  const addItem        = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const menuOptions    = useMenuDataStore((s) => s.menuOptions);
  /* オプション（トッピング）を選べる商品は、黙って入れずに商品詳細で選ばせる */
  const needsDetail = (item: MenuItem) => hasSelectableOptions(item, menuOptions[item.id] ?? []);

  useEffect(() => {
    fetchAll();
    startRealtime();
    return () => stopRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = storeLoading && !loadedAt;

  const cat: ApiCategory | undefined = useMemo(
    () => categories.find((c) => c.slug === category),
    [categories, category]
  );
  const children = useMemo(
    () => (cat ? childCategories(categories, cat.id) : []),
    [categories, cat]
  );

  // useMenuDataStore の menuItems は取得クエリの時点で display_order 順のため、
  // ここでは絞り込むだけで並び順はそのまま維持される
  const items = useMemo<MenuItem[]>(() => {
    const base = allMenuItems.filter((m) => !m.isTakeout);
    if (!cat) return base.filter((m) => m.subcategory === category);
    return itemsOfCategory(base, cat, children);
  }, [allMenuItems, cat, children, category]);

  const listStyle = cat ? resolveListStyle(cat, items) : (items.some(hasImage) ? "photo" : "list");
  const showThumb = listStyle === "list" && items.some(hasImage);

  /* ── サブカテゴリーごとの区切り。商品の無い区分は出さない。
        親に直接ぶら下がる商品はサブカテゴリーの後に「その他」でまとめる ── */
  const groups = useMemo<Group[]>(() => {
    if (children.length === 0) return [{ id: category, title: null, items }];
    const out: Group[] = children
      .map((c) => ({ id: c.slug, title: c.name, items: items.filter((i) => i.subcategory === c.slug) }))
      .filter((g) => g.items.length > 0);
    const direct = items.filter((i) => cat && i.subcategory === cat.slug);
    if (direct.length > 0) out.push({ id: `${category}__other`, title: "その他", items: direct });
    return out;
  }, [children, items, cat, category]);

  const tabs = groups.length >= 2 ? groups.map((g) => ({ id: g.id, label: g.title ?? "" })) : [];

  /* ── タブ: トップと同じ scrollspy ＋ スクロール移動 ── */
  const [activeGroup, setActiveGroup] = useState<string>("");
  const visibleRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tabs.length === 0) return;
    const ids = tabs.map((t) => t.id);
    setActiveGroup((cur) => (ids.includes(cur) ? cur : ids[0]));
    const els = ids
      .map((id) => document.getElementById(`section-${id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^section-/, "");
          if (e.isIntersecting) visibleRef.current.add(id);
          else visibleRef.current.delete(id);
        }
        const current = ids.find((id) => visibleRef.current.has(id));
        if (current) setActiveGroup(current);
      },
      { rootMargin: `-${SCROLL_OFFSET}px 0px -50% 0px`, threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.id).join("|"), loading]);

  const handleTabSelect = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET);
    const startY = window.scrollY;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      if (Math.abs(window.scrollY - top) > 4 && Math.abs(window.scrollY - startY) < 4) {
        window.scrollTo(0, top);
      }
    }, 250);
  };

  /* 見出しは DB（categories）から。旧データ用に辞書へフォールバック */
  const enLabel = cat?.caption ?? SUBCATEGORY_EN_LABEL[category as Subcategory] ?? category?.toUpperCase() ?? "";
  const jpLabel = cat?.name ?? SUBCATEGORY_LABEL[category] ?? category;

  const qtyOf = (id: string) => cartItems.find((ci) => ci.item.id === id)?.quantity ?? 0;
  const cardHandlers = (item: MenuItem) => ({
    quantity: qtyOf(item.id),
    onIncrement: () => (needsDetail(item) ? openItemDetail(item.id) : addItem(item, 1)),
    onDecrement: () => updateQuantity(item.id, qtyOf(item.id) - 1),
    onClick: () => openItemDetail(item.id),
  });

  const renderItems = (groupItems: MenuItem[]) =>
    listStyle === "list" ? (
      <div className="flex flex-col px-[var(--space-16)]">
        {groupItems.map((item) => (
          <MenuListRow
            key={item.id}
            item={item}
            quantity={qtyOf(item.id)}
            showThumb={showThumb}
            onAdd={() => (needsDetail(item) ? openItemDetail(item.id) : addItem(item, 1))}
            onIncrement={() => addItem(item, 1)}
            onDecrement={() => updateQuantity(item.id, qtyOf(item.id) - 1)}
            onClick={() => openItemDetail(item.id)}
          />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)]">
        {groupItems.map((item) => (
          <MenuCard
            key={item.id}
            item={item}
            {...cardHandlers(item)}
            imageLoading="lazy"
            hideTag
          />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary flex flex-col gap-[var(--space-20)]">
      <div className="sticky top-0 z-30 flex flex-col">
        <OrderHeader variant="close" />
        {tabs.length > 0 && (
          <TabNav tabs={tabs} activeId={activeGroup} onSelect={handleTabSelect} />
        )}
      </div>

      {/* ── カテゴリタイトル ── */}
      <div className="flex flex-col gap-[var(--space-4)] pt-[4px] px-[var(--space-24)]">
        {enLabel && <p className="type-en-display-l text-text-primary">{enLabel}</p>}
        <p className="type-jp-body-small text-text-primary">{jpLabel}</p>
      </div>

      {/* ── 本文（全件・display_order順） ── */}
      <main className="pb-[96px]">
        {loading ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <p className="type-jp-body text-text-secondary text-center py-[64px]">
            このカテゴリーにはメニューがありません
          </p>
        ) : (
          groups.map((g) => (
            <section
              key={g.id}
              id={`section-${g.id}`}
              style={{ scrollMarginTop: SCROLL_OFFSET }}
            >
              {g.title && (
                <ListSubHeading title={g.title} count={g.items.length} className="px-[var(--space-16)]" />
              )}
              {renderItems(g.items)}
            </section>
          ))
        )}
      </main>

      <BottomViewCartBar />
    </div>
  );
}
