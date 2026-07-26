"use client";

/**
 * ② 人気メニュー（Figma: SP 438:2999）
 *
 * 旧PCの「人気メニュー TOP5」カードと「人気メニュー TOP10」カードは内容が重複していたため、
 * SPの設計に合わせて **1枚に統合** した（Step3-N 4章）。PC/SPとも同じコンポーネントで、
 * 既定はTOP5＋「もっと見る（TOP10）」で段階開示する。
 *
 * 行のレイアウトだけ breakpoint で変える：
 *   SP … [品名 …… 食数] / [バー]
 *   PC … [品名][バー][食数]
 */
import DashboardCard from "@/components/dashboard/DashboardCard";
import type { MenuRanking } from "@/lib/salesData";

export type MenuTab = "all" | "food" | "drink";

const TABS: { key: MenuTab; label: string }[] = [
  { key: "all",   label: "全体" },
  { key: "food",  label: "フード" },
  { key: "drink", label: "ドリンク" },
];

const COLLAPSED = 5;
const EXPANDED  = 10;

export default function PopularMenuCard({
  id,
  items,
  tab,
  onTabChange,
  expanded,
  onToggleExpanded,
  className,
}: {
  id?: string;
  /** すでにタブで絞り込み済みのランキング（多い順） */
  items: MenuRanking[];
  tab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  className?: string;
}) {
  const shown = items.slice(0, expanded ? EXPANDED : COLLAPSED);
  // 1位を100%としてバーの相対長さを決める
  const top = shown[0]?.quantity ?? 0;

  return (
    <DashboardCard id={id} title="人気メニュー" gap={16} className={className}>
      <div className="flex gap-[var(--space-8)] items-start">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={`px-[var(--space-12)] py-[6px] rounded-[var(--radius-full)] type-jp-caption-bold whitespace-nowrap ${
              tab === t.key ? "bg-accent-primary text-text-primary" : "bg-bg-tertiary text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="type-jp-caption text-text-tertiary text-center py-[var(--space-32)]">
          データなし
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-12)] w-full">
          {shown.map((m) => (
            <div
              key={m.name}
              className="flex flex-col gap-[var(--space-4)] w-full min-w-0 lg:flex-row lg:items-center lg:gap-[var(--space-12)]"
            >
              <div className="flex gap-[var(--space-8)] items-center justify-between w-full min-w-0 lg:w-[150px] lg:shrink-0">
                <p className="type-jp-body text-text-primary truncate">{m.name}</p>
                <p className="lg:hidden type-en-data-xs text-text-secondary shrink-0">
                  {m.quantity}食
                </p>
              </div>
              <div className="bg-bg-tertiary h-[8px] rounded-[4px] w-full lg:flex-1 min-w-0 overflow-hidden">
                <div
                  className="bg-accent-primary h-full rounded-[4px]"
                  style={{ width: `${top > 0 ? (m.quantity / top) * 100 : 0}%` }}
                />
              </div>
              <p className="hidden lg:block type-en-data-xs text-text-secondary shrink-0 w-[40px] text-right">
                {m.quantity}食
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 6件目以降が無いときに「もっと見る」を出しても何も起きないので隠す */}
      {items.length > COLLAPSED && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="type-jp-caption-bold text-text-secondary text-left w-fit"
        >
          {expanded ? "閉じる ‹" : `もっと見る（TOP${EXPANDED}） ›`}
        </button>
      )}
    </DashboardCard>
  );
}
