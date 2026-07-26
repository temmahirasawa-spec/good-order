"use client";

/**
 * テイクアウト受渡カード（Figma: Pickup Card 462:2923）
 * Header=受渡番号＋経過時間／Items=商品名＋数量（個別ステータスバッジ無し。
 * 調理完了済みの注文しかこの画面に出ないため）／Footer=受渡完了ボタン。
 *
 * Figma実測（Template / Takeout Pickup 1180x820 462:2942 と突き合わせ済み）:
 * - カード: 幅400（PC）/ 角丸12 / surface/white / 影 y1・blur6・6%
 * - Header: 左右20・上16・下10・上端揃え。
 *   左は縦2段（要素間2px）: 上段=ラベル「受渡番号」（JP/Chip Label 13px Bold・text/secondary）、
 *   下段=Bagアイコン16 + 番号（EN/Data/L = Barlow SemiBold 20px・tracking 0.4px・text/primary、要素間6px）。
 *   右=経過時間（JP/Caption・text/secondary）
 *   ※Figmaのヘッダーフレームは高さ48px固定のままで番号が見切れているため、
 *     実装では高さを固定せずパディングだけで組んでいる（差分としてユーザーに報告済み）
 * - Items: 左右20、各行 上下10。品名 JP/Body、数量 EN/Data/XS（Barlow SemiBold 11px）で
 *   `× N`。行間に border/divider の1px、最終行の下には入れない
 * - Footer: 左右20・上12・下16の右寄せ。ボタンは radius-full / surface-ink /
 *   左右20・上下10 / JP/Heading/S の text/inverse
 *
 * Figmaとの意図的な差分:
 * - ボタン文言は幅の都合で「受渡完了」（Figmaは「受け渡し完了」）。ユーザー了承済み。
 * - 品名は2行までの折り返しを許容している（Figmaは1行想定。省略記号だと厨房・受渡での
 *   読み違いが起きるため、点数が多い場合はカードが縦に伸びる方を選んでいる）。
 */
import { Icon } from "@/components/Icon";
import { PICKUP_NO_LABEL } from "@/lib/pickupNo";

export interface PickupItem {
  id: string;
  name: string;
  quantity: number;
}

export default function PickupCard({
  pickupNumber,
  elapsed,
  items,
  completing,
  onComplete,
}: {
  /** 受渡番号（例: "#a1b2c3"） */
  pickupNumber: string;
  /** 経過時間ラベル（例: "8分経過"） */
  elapsed: string;
  items: PickupItem[];
  completing: boolean;
  onComplete: () => void;
}) {
  return (
    <div
      className="bg-surface-white flex flex-col items-start rounded-[var(--radius-md)] w-full"
      style={{ boxShadow: "0 1px 6px rgba(0, 0, 0, 0.06)" }}
    >
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-[var(--space-8)] pb-[10px] pt-[var(--space-16)] px-[var(--space-20)] w-full">
        <div className="flex flex-col gap-[var(--space-2)] items-start min-w-0">
          <p className="type-jp-chip-label text-text-secondary whitespace-nowrap">
            {PICKUP_NO_LABEL}
          </p>
          <div className="flex gap-[6px] items-center min-w-0">
            <Icon name="bag" className="shrink-0 w-4 h-4 text-text-primary" />
            <p className="type-en-data-l text-text-primary whitespace-nowrap">
              {pickupNumber}
            </p>
          </div>
        </div>
        <p className="type-jp-caption text-text-secondary shrink-0 whitespace-nowrap">
          {elapsed}
        </p>
      </div>

      {/* ── 品目 ──
          品名は長くても2行までで折り返す（省略記号だと厨房・受渡での読み違いが
          起きるため、点数が多い場合はカードが縦に伸びる方を選んでいる）。 */}
      <div className="flex flex-col items-start px-[var(--space-20)] w-full">
        {items.map((item, idx) => (
          <div key={item.id} className="w-full">
            <div className="flex min-h-[44px] items-center justify-between gap-[var(--space-12)] py-[10px] w-full">
              <p
                className="type-jp-body text-text-primary min-w-0 flex-1 overflow-hidden"
                style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
              >
                {item.name}
              </p>
              <p className="type-en-data-xs text-text-secondary shrink-0 whitespace-nowrap">
                × {item.quantity}
              </p>
            </div>
            {idx < items.length - 1 && <div className="bg-border-divider h-px w-full" />}
          </div>
        ))}
      </div>

      {/* ── フッター ── */}
      <div className="flex h-[58px] items-center justify-end pb-[var(--space-16)] pt-[var(--space-12)] px-[var(--space-20)] w-full">
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          className="bg-surface-ink disabled:opacity-60 flex items-center px-[var(--space-20)] py-[10px] rounded-[var(--radius-full)] shrink-0"
        >
          <span className="type-jp-heading-s text-text-inverse whitespace-nowrap">
            {completing ? "処理中…" : "受渡完了"}
          </span>
        </button>
      </div>
    </div>
  );
}
