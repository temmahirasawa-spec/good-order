/**
 * 席カテゴリー・卓（Step3-O）のデータアクセス層。
 *
 * UI表記は一貫して「二次元コード」。QRコードは株式会社デンソーウェーブの登録商標のため、
 * **画面に出る文字列に「QR」を含めない**。コード内部の識別子（qr〜）はそのままで構わない。
 *
 * 卓の表示ラベルは「カテゴリー名 ＋ コード-番号」で "カウンター C-1" のように組み立てる。
 * URLに埋めるのは不変の `short_code` であってラベルではない（supabase/tables_qr.sql の設計メモ参照）。
 */

import { supabase } from "./supabase";

export interface TableCategory {
  id: string;
  code: string;          // 英大文字1文字
  name: string;
  display_order: number;
}

export interface TableRow {
  id: string;
  category_id: string;
  number: number;
  short_code: string;
  display_order: number;
  legacy_number: number | null;
}

/** カテゴリーと、それに属する卓をまとめた表示用の形 */
export interface TableGroup {
  category: TableCategory;
  tables: TableRow[];
}

/**
 * 卓の短いラベル。"C-1"
 * ハイフンを入れるのは "A11" が「A-1の1」なのか「A-11」なのか読み違えないため
 * （2桁以上の卓番号で実際に起きる）。
 */
export function tableShortLabel(code: string, number: number): string {
  return `${code}-${number}`;
}

/**
 * 卓の表示ラベル。"カウンター C-1"
 * 現場のスタッフが「Aってどの席だっけ」を覚えていなくても読めるよう、
 * 設定したカテゴリー名をそのまま頭に付ける。
 * **orders.table_label / staff_calls.table_label にはこの形で保存する**。
 */
export function tableFullLabel(categoryName: string, code: string, number: number): string {
  return `${categoryName} ${tableShortLabel(code, number)}`;
}

/**
 * フルラベル（"カウンター C-1"）をカテゴリー名と短縮ラベルに分ける。
 * 厨房のOrder Cardのように、カテゴリー名を小さく・卓番号を大きく出す箇所で使う。
 * 短縮部分に空白は入らないので、最後の空白で切れば必ず正しく分かれる。
 * 移行前の古いラベル（"5"）は category が空になる。
 */
export function splitTableLabel(full: string): { category: string; code: string } {
  const i = full.lastIndexOf(" ");
  if (i < 0) return { category: "", code: full };
  return { category: full.slice(0, i), code: full.slice(i + 1) };
}

/**
 * フルラベルから短縮部分（"C-1"）だけ取り出す。
 * ダッシュボードの棒グラフのように幅が20〜32pxしかない場所で使う。
 */
export function shortenTableLabel(full: string): string {
  return splitTableLabel(full).code;
}

/* ────────────── 読み取り（スタッフ用・要ログイン） ────────────── */

export async function fetchTableGroups(): Promise<TableGroup[]> {
  const [{ data: cats, error: catErr }, { data: tbls, error: tblErr }] = await Promise.all([
    supabase
      .from("table_categories")
      .select("id, code, name, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("tables")
      .select("id, category_id, number, short_code, display_order, legacy_number")
      .order("display_order", { ascending: true }),
  ]);
  if (catErr) throw catErr;
  if (tblErr) throw tblErr;

  const byCategory = new Map<string, TableRow[]>();
  for (const t of (tbls ?? []) as TableRow[]) {
    const list = byCategory.get(t.category_id);
    if (list) list.push(t);
    else byCategory.set(t.category_id, [t]);
  }
  return ((cats ?? []) as TableCategory[]).map((category) => ({
    category,
    tables: (byCategory.get(category.id) ?? []).sort(
      (a, b) => a.display_order - b.display_order || a.number - b.number
    ),
  }));
}

/* ────────────── 書き込み（manager のみ） ────────────── */

export interface LayoutCategoryInput {
  /** 既存カテゴリーは id あり、新規は null */
  id: string | null;
  code: string;
  name: string;
  display_order: number;
  tables: { id: string | null; number: number; display_order: number }[];
}

/**
 * 席カテゴリーと卓のレイアウトを丸ごと保存する。
 * 一覧に無いカテゴリー・卓は削除される。
 *
 * 1回の保存でカテゴリーと卓を同時に作り直すため、個別のINSERT/UPDATE/DELETEを
 * 並べると途中で失敗したときに半分だけ反映された状態が残る。
 * サーバー側の1関数にまとめてトランザクションで包んでいる。
 */
export async function saveTableLayout(categories: LayoutCategoryInput[]): Promise<void> {
  const { error } = await supabase.rpc("save_table_layout", { p_categories: categories });
  if (error) throw error;
}

/** 卓を1つだけ削除する（一覧カードの⋯メニューから）。レイアウト保存と同じ関数を通す */
export async function deleteTable(groups: TableGroup[], tableId: string): Promise<void> {
  await saveTableLayout(
    groups.map((g, gi) => ({
      id: g.category.id,
      code: g.category.code,
      name: g.category.name,
      display_order: gi + 1,
      tables: g.tables
        .filter((t) => t.id !== tableId)
        .map((t, ti) => ({ id: t.id, number: t.number, display_order: ti + 1 })),
    }))
  );
}

/* ────────────── お客様側の入口（anon 可） ────────────── */

export interface ResolvedTable {
  id: string;
  /** "カウンター C-1"。注文時のスナップショットに使う */
  label: string;
  /** "C-1"。お客様側TOPのように幅が無い場所で使う */
  shortLabel: string;
  legacyNumber: number | null;
}

/**
 * 二次元コードのURLから卓を解決する。
 * `?t=<short_code>`（新形式）と `?table=<数値>`（既存の印刷済みカード）の両方を受ける。
 *
 * anon には tables の生SELECTを開けていない（全卓を列挙できてしまうため）。
 * 1件だけ返す SECURITY DEFINER 関数を経由する。
 */
export async function resolveTable(
  shortCode: string | null,
  legacyNumber: number | null
): Promise<ResolvedTable | null> {
  if (!shortCode && legacyNumber === null) return null;
  const { data, error } = await supabase.rpc("resolve_table", {
    p_short_code: shortCode,
    p_legacy_number: legacyNumber,
  });
  if (error) {
    console.error("[resolveTable] failed:", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    shortLabel: row.short_label ?? row.label,
    legacyNumber: row.legacy_number ?? null,
  };
}

/**
 * 卓ラベルの表示用フォールバック。
 * 移行前の古い注文は table_label が空なので、その場合だけ元の数値を出す。
 * 厨房・レジは営業中に開きっぱなしの画面なので、ここが空欄になると事故になる。
 */
export function displayTableLabel(
  label: string | null | undefined,
  fallbackNumber: number | null | undefined
): string {
  if (label) return label;
  if (fallbackNumber !== null && fallbackNumber !== undefined && fallbackNumber > 0) {
    return String(fallbackNumber);
  }
  return "—";
}
