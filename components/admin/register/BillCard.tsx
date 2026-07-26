/**
 * レジ画面の会計カード（Figma: Bill Card 268:1397 PC / 268:1432 SP）
 * 店内／テイクアウトのグループ分け（Order Group Header + Bill Item Row）+
 * Summary Block（小計/消費税/区切り線/合計）。PC/SPで余白・合計の文字サイズが
 * わずかに異なるため、Tailwindのlg:で出し分けている。
 */
import OrderGroupHeader from "@/components/admin/register/OrderGroupHeader";

export interface BillCardItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  isTakeout: boolean;
}

function BillItemRow({ item }: { item: BillCardItem }) {
  return (
    <div className="flex gap-[var(--space-12)] h-[22px] items-center py-[var(--space-4)] w-full">
      <p className="flex-1 min-w-0 type-jp-body text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
        {item.name}
      </p>
      <p className="shrink-0 w-[32px] type-en-data-s text-text-tertiary text-right">
        ×{item.quantity}
      </p>
      <p className="shrink-0 w-[76px] font-en font-semibold text-[14px] leading-[1.2] text-text-primary text-right">
        ¥{(item.unitPrice * item.quantity).toLocaleString()}
      </p>
    </div>
  );
}

export default function BillCard({
  items,
  subtotal,
  tax,
  total,
}: {
  items: BillCardItem[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const dineIn = items.filter((i) => !i.isTakeout);
  const takeout = items.filter((i) => i.isTakeout);

  return (
    <div
      className="bg-surface-white flex flex-col gap-[var(--space-16)] lg:gap-[var(--space-20)] items-start p-[var(--space-20)] lg:p-[var(--space-24)] rounded-[var(--radius-lg)] w-full"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {dineIn.length > 0 && (
        <div className="flex flex-col gap-[var(--space-8)] items-start w-full">
          <OrderGroupHeader type="dine-in" />
          <div className="flex flex-col gap-[var(--space-2)] items-start w-full">
            {dineIn.map((item) => (
              <BillItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {takeout.length > 0 && (
        <div className="flex flex-col gap-[var(--space-8)] items-start w-full">
          <OrderGroupHeader type="takeout" />
          <div className="flex flex-col gap-[var(--space-2)] items-start w-full">
            {takeout.map((item) => (
              <BillItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-bg-secondary flex flex-col gap-[var(--space-8)] items-start p-[var(--space-12)] lg:p-[var(--space-16)] rounded-[var(--radius-md)] w-full">
        <div className="flex items-center justify-between w-full">
          <span className="type-jp-caption text-text-secondary">小計（税抜）</span>
          <span className="font-en font-semibold text-[14px] leading-[1.2] text-text-primary">
            ¥{subtotal.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="type-jp-caption text-text-secondary">消費税（10%）</span>
          <span className="font-en font-semibold text-[14px] leading-[1.2] text-text-primary">
            ¥{tax.toLocaleString()}
          </span>
        </div>
        <div className="bg-border h-px w-full" />
        <div className="flex items-center justify-between w-full">
          <span className="font-jp font-bold text-[15px] lg:text-[17px] leading-[1.4] tracking-[0.01em] text-text-primary">
            合計
          </span>
          <span className="font-en font-semibold text-[20px] lg:text-[22px] leading-[1.2] text-text-primary tracking-[0.02em]">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
