"use client";

/**
 * 1杯ごとの選択（案B・表形式）
 *
 * Figma: Components / 04 Tags & Steppers / Per Cup Row（2026-09-16 追加）
 * 画面: 注文 / SP / Product Detail — 杯ごとの選択（数量2以上）
 *
 * 1杯＝1行（高さ 44）。左に「アメリカーノ 1」、右に SegmentedControl を最大2つ
 * （HOT/ICED、先出し/食後）。4杯でも1画面に収まるのがこの案の狙い。
 * 既定は全杯 HOT・先出し（天真の指定）。中身の状態は lib/perCup.ts。
 */
import SegmentedControl from "@/components/ui/SegmentedControl";
import type { CupDraft } from "@/lib/perCup";
import type { MenuOption } from "@/lib/menuOptions";
import type { ServingTiming, ServingTimingOption } from "@/lib/servingTiming";

export default function PerCupRows({
  heading,
  itemName,
  cups,
  singleOptions,
  timingOptions,
  onChange,
  className = "",
}: {
  heading: string;
  itemName: string;
  cups: CupDraft[];
  /** 1つ選ぶ型のオプション。選べない商品は空配列 */
  singleOptions: MenuOption[];
  /** 提供タイミングの選択肢。選べない商品は空配列 */
  timingOptions: ServingTimingOption[];
  onChange: (index: number, next: CupDraft) => void;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-[var(--space-8)] ${className}`}>
      <p className="type-jp-caption-bold text-text-secondary">{heading}</p>
      {cups.map((cup, i) => (
        <div key={i} className="flex items-center gap-[var(--space-8)] min-h-[var(--size-control-md)]">
          <p className="type-jp-body-bold text-text-primary flex-1 min-w-0 truncate">
            {itemName} {i + 1}
          </p>
          {singleOptions.length > 0 && (
            <SegmentedControl<string>
              ariaLabel={`${itemName} ${i + 1} のオプション`}
              className="w-[116px] shrink-0"
              options={singleOptions.map((o) => ({ value: o.id, label: o.name }))}
              value={cup.optionId ?? singleOptions[0].id}
              onChange={(optionId) => onChange(i, { ...cup, optionId })}
            />
          )}
          {timingOptions.length > 0 && (
            <SegmentedControl<ServingTiming>
              ariaLabel={`${itemName} ${i + 1} の提供タイミング`}
              className="w-[116px] shrink-0"
              options={timingOptions.map((o) => ({ value: o.value, label: o.label }))}
              value={cup.timing ?? timingOptions[0].value}
              onChange={(timing) => onChange(i, { ...cup, timing })}
            />
          )}
        </div>
      ))}
    </section>
  );
}
