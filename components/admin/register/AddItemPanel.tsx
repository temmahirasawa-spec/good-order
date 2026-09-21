"use client";

/**
 * レジから商品を足すための商品選び（2026-09-21）
 *
 * 選んだ商品は**新しい注文として place_order に渡す**（lib/api.ts の addItemsFromRegister）。
 * 自前で order_items に入れないのは、そうすると
 *   - 厨房に伝票が出ない（伝票は orders の INSERT で作られる）
 *   - 売り切れの確認・オプションの価格・セットドリンク割引・消費税が全部抜ける
 * ため。既存の「同じ卓への追加注文」とまったく同じ道を通す。
 *
 * 提供タイミングはレジからは選ばない（足すのは大抵もう出ているもの）。
 */
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import type { MenuItem } from "@/lib/menu";
import type { ApiCategory } from "@/lib/api";
import { type MenuOption, normalizeSelectMode } from "@/lib/menuOptions";

const ALL = "__all__";

export default function AddItemPanel({
  open,
  categories,
  items,
  optionsOf,
  busy,
  onCancel,
  onAdd,
}: {
  open: boolean;
  categories: ApiCategory[];
  items: MenuItem[];
  optionsOf: (menuItemId: string) => MenuOption[];
  busy: boolean;
  onCancel: () => void;
  onAdd: (args: { item: MenuItem; quantity: number; optionIds: string[] }) => void;
}) {
  const [catSlug, setCatSlug] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const options = selected ? optionsOf(selected.id) : [];
  const mode = normalizeSelectMode(selected?.optionsSelectMode);

  const shown = useMemo(() => {
    const q = query.trim();
    return items.filter(
      (i) =>
        (catSlug === ALL || i.subcategory === catSlug) &&
        (q === "" || i.name.includes(q))
    );
  }, [items, catSlug, query]);

  if (!open) return null;

  const pick = (item: MenuItem) => {
    setSelectedId(item.id);
    setQty(1);
    /* 「1つ選ぶ」型は先頭を選んだ状態で開く（お客様側の詳細シートと同じ）。
       HOT/ICED のように必ず1つ要るものを、選ばないまま追加できてしまわないように */
    const opts = optionsOf(item.id);
    setOptionIds(
      normalizeSelectMode(item.optionsSelectMode) === "single" && opts.length > 0
        ? [opts[0].id]
        : []
    );
  };

  const toggleOption = (id: string) => {
    if (mode === "single") {
      setOptionIds([id]);
      return;
    }
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const unitPrice =
    (selected?.price ?? 0) +
    options.filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + o.price, 0);

  const reset = () => {
    setSelectedId(null);
    setOptionIds([]);
    setQty(1);
    setQuery("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40"
      onClick={() => {
        reset();
        onCancel();
      }}
    >
      <div
        className="bg-surface-white w-full lg:w-[560px] max-h-[90vh] rounded-t-[var(--radius-xl)] lg:rounded-[var(--radius-xl)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[var(--space-24)] pt-[var(--space-20)] pb-[var(--space-12)] shrink-0">
          <p className="type-jp-heading-m text-text-primary">商品を追加</p>
          <ModalCloseButton
            onClick={() => {
              reset();
              onCancel();
            }}
          />
        </div>

        <div className="flex flex-col gap-[var(--space-12)] overflow-y-auto px-[var(--space-24)] pb-[var(--space-16)]">
          {/* 絞り込み */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="品名で探す"
            className="bg-surface-white border border-border h-[44px] px-[var(--space-12)] rounded-[var(--radius-sm)] type-jp-body text-text-primary w-full"
          />
          <div className="flex gap-[var(--space-8)] overflow-x-auto pb-[var(--space-4)]">
            {[{ slug: ALL, name: "すべて" }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))].map(
              (c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCatSlug(c.slug)}
                  className={`shrink-0 px-[var(--space-12)] py-[var(--space-4)] rounded-[var(--radius-full)] type-jp-caption-bold border ${
                    catSlug === c.slug
                      ? "bg-surface-ink border-surface-ink text-text-inverse"
                      : "bg-surface-white border-border text-text-secondary"
                  }`}
                >
                  {c.name}
                </button>
              )
            )}
          </div>

          {/* 商品 */}
          <div className="flex flex-col divide-y divide-border-divider border border-border rounded-[var(--radius-sm)]">
            {shown.length === 0 ? (
              <p className="type-jp-body text-text-tertiary px-[var(--space-12)] py-[var(--space-16)]">
                商品が見つかりません
              </p>
            ) : (
              shown.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => pick(i)}
                  disabled={i.isSoldOut === true}
                  className={`flex items-center gap-[var(--space-12)] px-[var(--space-12)] py-[var(--space-12)] text-left disabled:opacity-40 ${
                    selectedId === i.id ? "bg-accent-subtle" : "bg-surface-white"
                  }`}
                >
                  <span className="flex-1 min-w-0 type-jp-body text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                    {i.name}
                    {i.isSoldOut === true && "（売り切れ）"}
                  </span>
                  <span className="shrink-0 type-en-data-s text-text-secondary">
                    ¥{i.price.toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* 選んだ商品のオプションと数量 */}
          {selected && (
            <div className="flex flex-col gap-[var(--space-12)] bg-bg-secondary p-[var(--space-16)] rounded-[var(--radius-md)]">
              <p className="type-jp-body-bold text-text-primary">{selected.name}</p>

              {options.length > 0 && (
                <div className="flex flex-col gap-[var(--space-8)]">
                  <p className="type-jp-caption-bold text-text-secondary">
                    {selected.optionsHeading || "オプション"}
                    <span className="type-jp-caption text-text-tertiary">
                      {mode === "single" ? "（1つ選ぶ）" : "（いくつでも）"}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-[var(--space-8)]">
                    {options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleOption(o.id)}
                        className={`px-[var(--space-12)] py-[var(--space-8)] rounded-[var(--radius-full)] type-jp-caption-bold border ${
                          optionIds.includes(o.id)
                            ? "bg-accent-primary border-accent-primary text-accent-contrast"
                            : "bg-surface-white border-border text-text-secondary"
                        }`}
                      >
                        {o.name}
                        {o.price > 0 && ` +¥${o.price.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-[var(--space-16)]">
                <span className="type-jp-caption-bold text-text-secondary">数量</span>
                <div className="flex items-center gap-[var(--space-12)]">
                  <button
                    type="button"
                    aria-label="数量を減らす"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="bg-surface-white border border-border flex items-center justify-center rounded-full size-[36px] type-jp-heading-s text-text-primary"
                  >
                    −
                  </button>
                  <span className="type-en-data-l text-text-primary w-[24px] text-center">{qty}</span>
                  <button
                    type="button"
                    aria-label="数量を増やす"
                    onClick={() => setQty((q) => q + 1)}
                    className="bg-surface-white border border-border flex items-center justify-center rounded-full size-[36px] type-jp-heading-s text-text-primary"
                  >
                    ＋
                  </button>
                </div>
                <span className="ml-auto type-en-data-l text-text-primary">
                  ¥{(unitPrice * qty).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-[var(--space-12)] px-[var(--space-24)] pb-[var(--space-24)] pt-[var(--space-12)] shrink-0">
          <button
            type="button"
            onClick={() => {
              reset();
              onCancel();
            }}
            className="flex-1 bg-surface-white border border-border h-[48px] rounded-[var(--radius-full)] type-jp-heading-s text-text-primary"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => {
              if (!selected) return;
              onAdd({ item: selected, quantity: qty, optionIds });
              reset();
            }}
            className="flex-1 bg-surface-ink disabled:opacity-50 h-[48px] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse flex items-center justify-center gap-[var(--space-4)]"
          >
            {busy ? (
              "追加中…"
            ) : (
              <>
                <Icon name="plus" className="w-4 h-4 text-text-inverse" />
                追加する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
