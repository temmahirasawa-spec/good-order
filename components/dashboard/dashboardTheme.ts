/**
 * ダッシュボードのグラフ配色・区分定義。
 *
 * Figma の PC テンプレート（289:1405）と SP テンプレート（438:2789）で
 * 配色が食い違っている箇所がいくつかあり、ここで1つに寄せている：
 *  - 店内/テイクアウトの色: PCは店内=accent/deep・テイクアウト=status/info、
 *    SPは逆。既存実装（AMBER=店内 / BLUE=テイクアウト）と一致するPC側を採用。
 *  - 選択中チップ: PCはsurface/ink、SPはaccent/primary。プロンプトに明記のあるSP側を採用。
 * 詳細は docs/handoff.md に記録。
 */

/** 数値グラフの基本色。CSS変数で持ち、style属性から参照する */
export const CHART = {
  /** 棒グラフ本体（売上・テーブル稼働・人気メニュー） */
  bar: "var(--color-accent-primary)",
  /** PC売上推移でピーク以外の棒を落とすときの色（折れ線を読みやすくするため） */
  barMuted: "var(--color-bg-tertiary)",
  /** 稼働が低いテーブル */
  low: "var(--color-status-urgent)",
  /** 客単価分布 */
  spend: "var(--color-status-info)",
  /** 店内 */
  dineIn: "var(--color-accent-deep)",
  /** テイクアウト */
  takeout: "var(--color-status-info)",
  /** PC売上推移に重ねる客単価の折れ線 */
  avgSpendLine: "var(--color-status-info)",
} as const;

/**
 * カテゴリ別売上の配色。PC（ドーナツ）とSP（積み上げバー）で**同一パレット**を使う。
 * 旧実装のPIE_COLORSはアンバー系6色＋青2色で隣接カテゴリの判別が付きにくかったため、
 * Figma SP の5色（色相がはっきり分かれる）を正とし、6色目以降を既存トークンで足している。
 */
export const CATEGORY_COLORS = [
  "var(--color-accent-primary)",
  "var(--color-status-info)",
  "var(--color-status-success)",
  "var(--color-accent-deep)",
  "var(--color-text-tertiary)",
  "var(--color-accent-pressed)",
  "var(--color-status-warning)",
  "var(--color-status-urgent)",
] as const;

export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

/**
 * ヒートマップのセル色。売上0はbg/tertiary、それ以外はアンバーの濃淡。
 * 下限を0にすると「わずかに売上がある」セルが空セルと見分けられないため0.15から始める。
 */
export function heatColor(revenue: number, max: number): string {
  if (revenue <= 0) return "var(--color-bg-tertiary)";
  const ratio = max > 0 ? Math.min(1, revenue / max) : 0;
  return `rgba(250, 192, 61, ${(0.15 + ratio * 0.85).toFixed(3)})`;
}

/** SPヒートマップの4区分。PCの15列（8〜22時）を潰さずに畳むため、24時間を隙間なく覆う */
export const DAY_PARTS: { label: string; hours: number[] }[] = [
  { label: "朝",   hours: [5, 6, 7, 8, 9, 10] },
  { label: "昼",   hours: [11, 12, 13, 14, 15] },
  { label: "夜",   hours: [16, 17, 18, 19, 20, 21] },
  { label: "深夜", hours: [22, 23, 0, 1, 2, 3, 4] },
];

/** PCヒートマップの時間軸（既存実装・Figma PCと同じ8〜22時） */
export const PC_HEATMAP_HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

/** 月曜始まり（JSのgetDayは0=日なのでこの順で引き直す） */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

/** 稼働低めと判定する比率（最大利用回数に対する割合）。旧実装と同じ */
export const LOW_UTILIZATION_RATIO = 0.3;
