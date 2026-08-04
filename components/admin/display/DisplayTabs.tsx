"use client";

/**
 * 表示設定のタブ（動画設定 / ベストセラー）。
 *
 * タブ1つぶんの見た目は既存の components/ui/Tab.tsx をそのまま使う
 * （Active = Bold + 3px の下線、Inactive = Medium グレー）。
 * **下線の下に余白を入れない**＝タブの高さはラベル＋下線ちょうど、という規定は
 * Tab 側が既に満たしている（下線が最後の子で、下方向のパディングを持たない）。
 *
 * ここが足しているのは並べ方だけ。
 *   PC … 左寄せで横に並べる
 *   SP … 画面を等分（2つなので半分ずつ）。狭い幅でタブが左に寄ると押し間違えるため
 * お客様側の TabNav は横スクロール前提（カテゴリ数が可変）なので使っていない。
 */
import { Tab } from "@/components/ui/Tab";

export type DisplayTabId = "video" | "bestseller";

export const DISPLAY_TABS: { id: DisplayTabId; label: string }[] = [
  { id: "video", label: "動画設定" },
  { id: "bestseller", label: "ベストセラー" },
];

export default function DisplayTabs({
  active,
  onSelect,
}: {
  active: DisplayTabId;
  onSelect: (id: DisplayTabId) => void;
}) {
  return (
    <nav
      aria-label="表示設定の切り替え"
      className="bg-surface-white border-b border-border-divider shrink-0"
    >
      <div className="flex lg:gap-[var(--space-24)] lg:px-[var(--space-24)]">
        {DISPLAY_TABS.map((t) => (
          <div
            key={t.id}
            className="flex flex-1 justify-center lg:flex-none lg:justify-start"
          >
            <Tab label={t.label} active={t.id === active} onClick={() => onSelect(t.id)} />
          </div>
        ))}
      </div>
    </nav>
  );
}
