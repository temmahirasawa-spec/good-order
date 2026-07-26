"use client";

/**
 * 期間セレクター（Figma: SP Period Selector 438:2803 / PC Period Strip 297:1470）
 * 「期間：」ラベル＋横スクロールする期間チップ。
 *
 * 選択中の見た目は Figma PC が surface/ink、SP が accent/primary で食い違っていたので、
 * プロンプトに明記のあるSP側（accent/primary＋text/primary）へ寄せて統一している。
 * PCではTop Barのstripスロットに入るのでラベルは出さない（Figma PCにも無い）。
 */
import type { PeriodKey } from "@/lib/salesData";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today",         label: "今日" },
  { key: "yesterday",     label: "昨日" },
  { key: "this_week",     label: "今週" },
  { key: "last_week",     label: "先週" },
  { key: "this_month",    label: "今月" },
  { key: "last_month",    label: "先月" },
  { key: "past_3_months", label: "過去3ヶ月" },
  { key: "custom",        label: "カスタム" },
];

export default function PeriodSelector({
  period,
  onChange,
  showLabel = false,
  className = "",
}: {
  period: PeriodKey;
  onChange: (key: PeriodKey) => void;
  /** SPのみ「期間：」ラベルを出す */
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-[var(--space-8)] items-center overflow-x-auto ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {showLabel && (
        <p className="type-jp-caption-bold text-text-secondary shrink-0">期間：</p>
      )}
      {PERIOD_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          /* type-jp-* はカスタムクラスなので lg: バリアントが効かない。
             PCで1段小さくする分だけ生の任意値ユーティリティで上書きする */
          className={`shrink-0 px-[14px] py-[var(--space-8)] lg:py-[7px] rounded-[var(--radius-full)] type-jp-body lg:text-[12px] lg:leading-[1.5] lg:tracking-[0.12px] whitespace-nowrap ${
            period === key ? "bg-accent-primary" : "bg-bg-tertiary"
          } text-text-primary`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
