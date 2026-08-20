/**
 * 厨房伝票の ePOS-Print XML を組み立てる
 *
 * 出力先は EPSON TM-m30III-H（サーバーダイレクトプリント）。
 * 仕様の根拠:
 *   - Server Direct Print User's Manual (M00062910 Rev.K)
 *   - ePOS-Print XML User's Manual (M00048218 Rev.S)
 *
 * ePOS-Print XML の考え方（ここを外すと読めない）:
 *   `<text>` は「属性だけの空要素で状態を切り替え、中身入りの要素で印字する」
 *   というスタイル指定モデル。`<text em="true"/>` 以降がずっと太字になるので、
 *   使い終わったら必ず戻す。改行は要素の区切りではなく `&#10;` を本文に入れる。
 *
 * 伝票の内容は天真の決定（2026-08-20）に従う:
 *   - キッチン用1枚のみ（お客様控えなし）
 *   - 品名は日本語のみ
 *   - 新規は「新規」、2回目以降は「追加(2)」
 *   - 金額は刷らない（点数のみ）
 *   - 店内は卓ラベルが主役、テイクアウトは受渡番号が主役（2バリエーション）
 */

import { formatJstMdHm } from "./dateFormat";

export interface ReceiptItem {
  name: string;
  quantity: number;
}

/** supabase の claim_print_job() が返す JSON と同じ形 */
export interface ReceiptJob {
  jobId: string;
  seq: number;
  orderType: "dine_in" | "takeout";
  tableLabel: string | null;
  pickupNo: number | null;
  createdAt: string;
  items: ReceiptItem[];
  itemCount: number;
}

/**
 * 80mm 紙の印字可能幅（ドット）。TM-m30III-H は 80mm 紙で 72mm = 576 ドット。
 * 以下の座標は全てこの 576 を基準にしている。
 */
const PRINT_WIDTH = 576;

/** font_a・width="1" の半角1文字ぶんのドット数 */
const HALF_WIDTH_DOTS = 12;

/** 1行に入る半角文字数（576 / 12 = 48） */
const COLS = PRINT_WIDTH / HALF_WIDTH_DOTS;

/**
 * 右カラム（受付時刻）の開始位置。
 * 「MM/DD HH:MM」の11文字ぶんを右端から逆算して、ラベルと値を右揃えで縦に揃える。
 */
const RIGHT_COL_X = (COLS - "MM/DD HH:MM".length) * HALF_WIDTH_DOTS;

/** 明細の品名を書き始める位置。数量ぶんを空ける */
const ITEM_NAME_X = 96;

/**
 * 品名に使える幅（半角換算の文字数）。
 * font_a・width="1" は半角1文字 = 12ドット。(576 - 96) / 12 = 40。
 */
const ITEM_NAME_HALF_WIDTHS = Math.floor((PRINT_WIDTH - ITEM_NAME_X) / 12);

/** XML の特殊文字を実体参照に置き換える。品名に & や < が入っていても壊さないため */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 半角=1・全角=2 として数えた表示幅。日本語の折り返し判定に使う */
function halfWidthLength(s: string): number {
  let n = 0;
  for (const ch of s) {
    // 半角英数記号・半角カナはカラム1つ、それ以外（かな漢字全角記号）は2つ
    n += /[ -~｡-ﾟ]/.test(ch) ? 1 : 2;
  }
  return n;
}

/**
 * 表示幅で折り返す。プリンタ任せの自動折り返しだと継続行が左端に戻ってしまい、
 * 数量の列と重なって読みにくいので、こちら側で行に割ってから字下げする。
 */
function wrapByWidth(s: string, maxHalfWidths: number): string[] {
  const lines: string[] = [];
  let cur = "";
  let curW = 0;
  for (const ch of s) {
    const w = halfWidthLength(ch);
    if (curW + w > maxHalfWidths && cur !== "") {
      lines.push(cur);
      cur = "";
      curW = 0;
    }
    cur += ch;
    curW += w;
  }
  if (cur !== "") lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/** 「新規」「追加(2)」のバッジ文言 */
export function seqLabel(seq: number): string {
  return seq <= 1 ? "新規" : `追加(${seq})`;
}

/**
 * 伝票の見出しブロック（主役になる識別子）を決める。
 *
 * 店内 = 卓ラベル、テイクアウト = 受渡番号。
 * 「受渡番号は店内注文では出さない」は既存の画面側の決定（docs/handoff.md）に
 * 揃えたもので、伝票でも同じ扱いにする。
 *
 * 卓ラベルが無い店内注文（QRが解決できなかった移行前の経路）は、
 * 伝票に識別子が1つも載らないと厨房が照合できなくなるため、
 * 常に採番されている受渡番号にフォールバックする。
 */
function headline(job: ReceiptJob): { label: string; value: string } {
  const pickup = { label: "受渡番号", value: `#${String(job.pickupNo ?? 0).padStart(2, "0")}` };
  if (job.orderType === "takeout") return pickup;
  if (!job.tableLabel) return pickup;

  // orders.table_label は「テーブル A-1」「カウンター L-1」のように
  // 「カテゴリー名 + 空白 + 短縮ラベル」で保存されている
  // （lib/tables.ts の resolveTable が返す label をそのままスナップショットしている）。
  //
  // 小さいラベルに「テーブル」を決め打ちで出すと「テーブル / テーブル A-1」と
  // 二重になるので、最後の空白で割って前半をラベル、後半を主役の値にする。
  // カウンター席なら小さいラベルが「カウンター」になり、席種も伝わる。
  const sep = job.tableLabel.lastIndexOf(" ");
  if (sep > 0 && sep < job.tableLabel.length - 1) {
    return {
      label: job.tableLabel.slice(0, sep),
      value: job.tableLabel.slice(sep + 1),
    };
  }
  // 空白が無い形（移行前の数値だけのラベル等）はそのまま主役に置く
  return { label: "テーブル", value: job.tableLabel };
}

/**
 * 厨房伝票の中身（<epos-print> 要素）を組み立てる。
 * サーバーダイレクトプリントの封筒は buildPrintRequest() が被せる。
 */
export function buildReceiptXml(job: ReceiptJob): string {
  const x: string[] = [];
  const head = headline(job);

  x.push(`<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`);

  // 日本語を印字するので国際文字セットを日本語に切り替える。
  // これは印字前に一度だけでよい（以降ずっと有効）。
  x.push(`<text lang="ja"/>`);
  x.push(`<text font="font_a" align="left"/>`);

  // ── 1. 「新規 / 追加(N)」バッジ ＋ 右上に「厨房伝票」 ──
  // reverse="true" が黒地に白抜き。前後に全角空白を入れて帯に見せる
  x.push(`<text width="2" height="2" em="true" reverse="true"/>`);
  x.push(`<text>${esc(`　${seqLabel(job.seq)}　`)}</text>`);
  x.push(`<text reverse="false" width="1" height="1"/>`);
  x.push(`<text x="${PRINT_WIDTH - 4 * 2 * HALF_WIDTH_DOTS}"/>`); // 全角4文字ぶんを右端に寄せる
  x.push(`<text>厨房伝票&#10;</text>`);
  x.push(`<text em="false"/>`);

  x.push(`<feed unit="8"/>`);
  x.push(`<hline x1="0" x2="${PRINT_WIDTH}" style="thick"/>`);
  x.push(`<feed unit="10"/>`);

  // ── 2. 見出し（卓 or 受渡番号）＋ 受付時刻 ──
  // 小さいラベル行 → 大きい値の行、の2段。左右2カラムは x 指定で作る
  x.push(`<text>${esc(head.label)}</text>`);
  x.push(`<text x="${RIGHT_COL_X}"/>`);
  x.push(`<text>受付&#10;</text>`);

  x.push(`<text width="3" height="3" em="true"/>`);
  x.push(`<text>${esc(head.value)}</text>`);
  x.push(`<text width="1" height="1" em="false"/>`);
  x.push(`<text x="${RIGHT_COL_X}"/>`);
  x.push(`<text em="true">${esc(formatJstMdHm(job.createdAt))}&#10;</text>`);
  x.push(`<text em="false"/>`);

  x.push(`<feed unit="10"/>`);
  x.push(`<hline x1="0" x2="${PRINT_WIDTH}" style="thick"/>`);
  x.push(`<feed unit="10"/>`);

  // ── 3. 明細 ──
  // 数量は特大、品名は倍高。厨房で少し離れていても読めるサイズにしてある
  job.items.forEach((item, i) => {
    if (i > 0) {
      x.push(`<feed unit="6"/>`);
      x.push(`<hline x1="0" x2="${PRINT_WIDTH}" style="thin"/>`);
      x.push(`<feed unit="6"/>`);
    }

    x.push(`<text width="2" height="2" em="true"/>`);
    x.push(`<text>${esc(String(item.quantity))}</text>`);

    const nameLines = wrapByWidth(item.name, ITEM_NAME_HALF_WIDTHS);
    x.push(`<text width="1" height="2" em="true"/>`);
    nameLines.forEach((line, li) => {
      // 1行目は数量と同じ行、2行目以降は品名の左端に字下げして続ける
      if (li > 0) x.push(`<text/>`);
      x.push(`<text x="${ITEM_NAME_X}"/>`);
      x.push(`<text>${esc(line)}&#10;</text>`);
    });
    x.push(`<text width="1" height="1" em="false"/>`);
  });

  x.push(`<feed unit="10"/>`);
  x.push(`<hline x1="0" x2="${PRINT_WIDTH}" style="thick"/>`);
  x.push(`<feed unit="8"/>`);

  // ── 4. 合計点数（金額は刷らない） ──
  // 「12点」を右端で揃える。数量は倍幅なので桁数×2、「点」は全角で2桁ぶん
  const countText = String(job.itemCount);
  const totalCols = countText.length * 2 + 2;
  x.push(`<text>合計</text>`);
  x.push(`<text x="${(COLS - totalCols) * HALF_WIDTH_DOTS}"/>`);
  x.push(`<text width="2" height="2" em="true"/>`);
  x.push(`<text>${esc(countText)}</text>`);
  x.push(`<text width="1" height="1" em="false"/>`);
  x.push(`<text>点&#10;</text>`);

  // カット位置まで送ってから切る
  x.push(`<feed line="2"/>`);
  x.push(`<cut type="feed"/>`);

  x.push(`</epos-print>`);
  return x.join("");
}

/**
 * サーバーダイレクトプリントのレスポンス封筒を被せる。
 *
 * Version="1.00" を使う。1.00 / 2.00 / 3.00 に互換性は無く、1.00 だけが
 * 全機種・全ファームウェアで「バージョン指定なし」と同じ扱いになる。
 * 2.00 で増えるのは printjobid だけで今は使わないため、選ぶ理由が無い。
 *
 * 但し書き: 参照できた Server Direct Print User's Manual は Rev.K(2016年版)で、
 * TM-m30III-H はこれより後（Rev.R / 2023年）に追記された機種のため、
 * 本機がどの Version まで対応するかは公式資料で確認できていない。
 * 1.00 はその中で最も保守的な選択にあたる。実機での最終確認はフェーズ6で行う。
 * SDP 対応そのものは本機の Technical Reference Guide Rev.F に明記がある。
 *
 * devid の "local_printer" はプリンタ本体自身を指す既定のデバイスID。
 */
export function buildPrintRequest(eposPrintXml: string, timeoutMs = 10000): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<PrintRequestInfo Version="1.00">` +
    `<ePOSPrint>` +
    `<Parameter>` +
    `<devid>local_printer</devid>` +
    `<timeout>${timeoutMs}</timeout>` +
    `</Parameter>` +
    `<PrintData>${eposPrintXml}</PrintData>` +
    `</ePOSPrint>` +
    `</PrintRequestInfo>`
  );
}

/** 印刷結果の解析結果 */
export interface PrintResult {
  success: boolean;
  code: string | null;
  /** プリンタのステータスビット（10進）。紙切れ等の判定に使う */
  status: number | null;
}

/** status のビット定義（ePOS-Print XML User's Manual Rev.S）のうち店舗で意味があるもの */
const STATUS_BITS: Array<{ bit: number; label: string }> = [
  { bit: 0x00000008, label: "オフライン" },
  { bit: 0x00000020, label: "カバーが開いています" },
  { bit: 0x00000400, label: "メカ異常" },
  { bit: 0x00000800, label: "オートカッター異常" },
  { bit: 0x00002000, label: "復帰不能エラー" },
  { bit: 0x00020000, label: "用紙残りわずか" },
  { bit: 0x00080000, label: "用紙切れ" },
];

/**
 * プリンタが送ってくる印刷結果XMLを読む。
 *
 * 正規表現で属性を拾っている。XMLパーサを足さないのは、この応答が
 * `<response success="..." code="..." status="..."/>` の1要素で形が固定されており、
 * 依存を1つ増やすより読み取り箇所を1つに閉じ込めるほうが安全なため。
 */
export function parsePrintResult(responseFile: string): PrintResult {
  const successRaw = /\bsuccess\s*=\s*"([^"]*)"/i.exec(responseFile)?.[1] ?? "";
  const code = /\bcode\s*=\s*"([^"]*)"/i.exec(responseFile)?.[1] ?? "";
  const statusRaw = /\bstatus\s*=\s*"([^"]*)"/i.exec(responseFile)?.[1] ?? "";

  const status = statusRaw === "" ? null : Number(statusRaw);
  return {
    success: successRaw.toLowerCase() === "true" || successRaw === "1",
    code: code === "" ? null : code,
    status: Number.isFinite(status) ? status : null,
  };
}

/** status のビットを日本語の並びにする。異常が無ければ空配列 */
function statusReasons(status: number | null): string[] {
  if (status === null || !Number.isFinite(status)) return [];
  return STATUS_BITS.filter(({ bit }) => (status & bit) !== 0).map(({ label }) => label);
}

/** 印刷失敗の理由を、店舗のスタッフが読んで動ける日本語にする */
export function describePrintFailure(result: PrintResult): string {
  const reasons = statusReasons(result.status);
  if (reasons.length === 0 && result.code) reasons.push(result.code);
  if (reasons.length === 0) reasons.push("原因不明の印刷エラー");
  return reasons.join(" / ");
}

/**
 * 状態通知から、いま困っていることを日本語で返す。
 * **異常が無ければ null**。管理画面が「異常なし」と出し分けるために
 * describePrintFailure（必ず文字列を返す）とは別にしてある。
 */
export function describePrinterStatus(result: PrintResult): string | null {
  const reasons = statusReasons(result.status);
  return reasons.length === 0 ? null : reasons.join(" / ");
}
