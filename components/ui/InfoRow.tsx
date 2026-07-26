/**
 * 店舗情報の行（Figma: Info Row 179:165）
 * アイコン + ラベル(12 グレー) + 値(14 黒)。gap 12px、ラベルと値の間 2px。
 */
import { Icon, type IconName } from "@/components/Icon";

export default function InfoRow({
  icon,
  label,
  value,
  className = "",
}: {
  icon: IconName;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-[var(--space-12)] items-start ${className}`}>
      <Icon name={icon} className="w-4 h-4 text-text-primary shrink-0 mt-[1px]" />
      <div className="flex flex-col gap-[2px] items-start">
        <p className="type-jp-caption text-text-secondary">
          {label}
        </p>
        <p className="type-jp-body text-text-primary">
          {value}
        </p>
      </div>
    </div>
  );
}
