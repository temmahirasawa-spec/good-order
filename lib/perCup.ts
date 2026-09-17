/**
 * 1杯ごとの選択（docs/specs/menu-options.md の 11 / serving-timing.md）
 *
 * 商品詳細で数量を2以上にしたとき、HOT/ICED（1つ選ぶ型のオプション）と
 * 提供タイミング（先出し/食後）を**杯ごと**に選べるようにする（2026-09-16、天真の決定・案B）。
 * 以前は「4杯全部 HOT・全部先出し」しか選べず、初日に HOT と ICED を混ぜたい卓で困った。
 *
 * カートには**同じ組み合わせごとにまとめた行**で入れる（天真の決定）。
 * 「HOT・先出し ×3」「ICED・食後 ×1」のように、カートの行の仕組み（cartLineKey）そのまま。
 * 伝票・レジもその行単位で出るので、伝票が杯の数だけ長くなることはない。
 */
import type { ServingTiming } from "@/lib/servingTiming";

/** 1杯ぶんの下書き。null は「その項目は選べない商品」 */
export interface CupDraft {
  /** 1つ選ぶ型のオプション（HOT/ICED）の id。選べない商品は null */
  optionId: string | null;
  /** 提供タイミング。選べない商品は null */
  timing: ServingTiming | null;
}

/** 同じ組み合わせの杯をまとめた1グループ（= カートの1行になる） */
export interface CupGroup extends CupDraft {
  quantity: number;
}

/**
 * 1杯ごとの選択を使うかどうか。
 * 数量が2以上で、かつ「1つ選ぶ型のオプション」か「提供タイミング」のどちらかを選べる商品のとき。
 * 複数選べる型のオプション（トッピング）は杯ごとに分けない（全杯共通のまま）。
 */
export function usesPerCup(qty: number, singleOptionSelectable: boolean, timingSelectable: boolean): boolean {
  return qty >= 2 && (singleOptionSelectable || timingSelectable);
}

/**
 * 杯の数を数量に合わせる。増えた分は既定値（HOT・先出し）で足し、減った分は末尾から消す。
 * 既に選んであった杯はそのまま残す。
 */
export function resizeCups(cups: CupDraft[], qty: number, defaults: CupDraft): CupDraft[] {
  if (cups.length === qty) return cups;
  if (cups.length > qty) return cups.slice(0, qty);
  return [...cups, ...Array.from({ length: qty - cups.length }, () => ({ ...defaults }))];
}

/** 同じ組み合わせ（オプション × 提供タイミング）の杯をまとめる。並びは最初に出てきた順 */
export function groupCups(cups: CupDraft[]): CupGroup[] {
  const groups: CupGroup[] = [];
  for (const cup of cups) {
    const g = groups.find((x) => x.optionId === cup.optionId && x.timing === cup.timing);
    if (g) g.quantity += 1;
    else groups.push({ ...cup, quantity: 1 });
  }
  return groups;
}

/** 見出し「1杯ごとに選ぶ（4杯）」。フードにも使うので「杯」ではなく数だけ変える */
export function perCupHeading(qty: number, unit: "杯" | "個"): string {
  return `1${unit}ごとに選ぶ（${qty}${unit}）`;
}
