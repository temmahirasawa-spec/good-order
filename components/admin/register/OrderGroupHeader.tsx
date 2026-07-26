/**
 * レジ明細のグループ見出し（Figma: Order Group Header 268:1378）
 * 店内=グレーピル+お椀アイコン、テイクアウト=イエロー系ピル+バッグアイコンで明確に色分け。
 */
import { Icon } from "@/components/Icon";

export default function OrderGroupHeader({ type }: { type: "dine-in" | "takeout" }) {
  const isTakeout = type === "takeout";
  return (
    <span
      className={`inline-flex gap-[var(--space-4)] items-center px-[var(--space-8)] py-[var(--space-4)] rounded-[var(--radius-full)] ${
        isTakeout ? "bg-accent-subtle" : "bg-bg-tertiary"
      }`}
    >
      <Icon
        name={isTakeout ? "bag" : "bowl"}
        className={`shrink-0 w-4 h-4 ${isTakeout ? "text-accent-deep" : "text-text-primary"}`}
      />
      <span
        className={`type-jp-caption-bold whitespace-nowrap ${
          isTakeout ? "text-accent-deep" : "text-text-secondary"
        }`}
      >
        {isTakeout ? "テイクアウト" : "店内"}
      </span>
    </span>
  );
}
