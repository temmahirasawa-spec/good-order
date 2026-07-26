"use client";

/**
 * 公開ON/OFF等のトグルスイッチ（Figma: Toggle Switch 306:275）
 * On=アクセントイエロー地・ノブ右寄せ、Off=白地+枠線・ノブ左寄せ。40×22、ノブ18×18。
 */
export default function ToggleSwitch({
  on,
  onClick,
  disabled,
  ariaLabel,
  className = "",
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={on}
      className={`relative w-[40px] h-[22px] rounded-full shrink-0 transition-colors disabled:opacity-50 ${
        on ? "bg-accent-primary" : "bg-surface-white border border-border"
      } ${className}`}
    >
      <span
        className={`absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-all ${
          on ? "left-[20px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}
