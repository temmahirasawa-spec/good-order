#!/usr/bin/env node
/**
 * ニセ・プリンタ — 実機が無くても厨房伝票の印刷を通しで確認するためのスクリプト
 *
 * EPSON TM-m30III-H のサーバーダイレクトプリントと同じ喋り方で
 * /api/print/<token> を叩き、返ってきた ePOS-Print XML を
 * 「紙に出たらこう見える」形にターミナルへ描いて、印刷結果を報告し返す。
 *
 * 実機が届く前にレイアウトと印刷の流れを確定させておくのが目的。
 * ここで通っていれば、実機で問題が出たときに疑う場所を「設定」に絞れる。
 *
 * 使い方（先に別のターミナルで `npm run dev` を起動しておくこと）:
 *   node scripts/fake-printer.mjs              … 3秒おきにポーリングし続ける
 *   node scripts/fake-printer.mjs --once       … 1回だけ取りに行って終了
 *   node scripts/fake-printer.mjs --fail       … 印刷失敗（用紙切れ）として報告する
 *   node scripts/fake-printer.mjs --xml        … 生のXMLも表示する
 *   node scripts/fake-printer.mjs --url http://localhost:3000/api/print/xxxx
 *
 * サーバーを立てずに、手元のXMLの見た目だけ確認したいとき:
 *   node scripts/fake-printer.mjs --render path/to/receipt.xml
 *
 * トークンは --token か、.env.local の PRINT_ENDPOINT_TOKEN から読む。
 */

import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

/* ── 引数 ─────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const ONCE = flag("once");
const FAIL = flag("fail");
const SHOW_XML = flag("xml");
const INTERVAL_SEC = Number(opt("interval", "3"));
const PRINTER_ID = opt("id", "");

/** .env.local から1つ読む。dotenv を足さずに済ませるための最小実装 */
function readEnvLocal(key) {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    /* .env.local が無くてもよい */
  }
  return "";
}

const RENDER_FILE = flag("render") ? opt("render", "") : "";
const TOKEN = opt("token", process.env.PRINT_ENDPOINT_TOKEN || readEnvLocal("PRINT_ENDPOINT_TOKEN"));
const URL_ = opt("url", `http://localhost:3000/api/print/${TOKEN}`);

if (!TOKEN && !flag("url") && !RENDER_FILE) {
  console.error(
    "PRINT_ENDPOINT_TOKEN が見つかりません。\n" +
      "  .env.local に PRINT_ENDPOINT_TOKEN=... を書くか、--token で渡してください。\n" +
      "  トークンは `openssl rand -hex 24` で作れます。"
  );
  process.exit(1);
}

/* ── 紙のシミュレーション ────────────────────────────── */

const PRINT_WIDTH_DOTS = 576;
/** font_a・width="1" の半角1文字 = 12ドット。ターミナルの1桁に対応させる */
const DOTS_PER_COL = 12;
const COLS = PRINT_WIDTH_DOTS / DOTS_PER_COL; // 48

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  reverse: "\x1b[7m",
  dim: "\x1b[2m",
};

const isHalfWidth = (ch) => /[ -~｡-ﾟ]/.test(ch);

/**
 * ePOS-Print XML を読んで紙の見た目に描く。
 *
 * 実機と完全に同じにはならないが、桁位置と折り返しは同じ計算で出しているので
 * 「はみ出す」「重なる」「行が詰まりすぎ」はここで見つけられる。
 */
function renderPaper(xml) {
  const lines = [];     // { text, cols } — cols は ANSI を除いた実際の桁数
  let cells = [];       // 現在の行（1要素 = 1桁）
  let cursor = 0;       // 桁位置
  let maxCursor = 0;    // その行が使った最大桁（はみ出し検出用）
  let width = 1;
  let em = false;
  let reverse = false;

  const flush = () => {
    // cells は歯抜け（x 指定で飛ばした桁）になりうる。map/join は穴を
    // 詰めてしまい桁位置が崩れるので、添字で舐めて空白を敷き直す
    const out = [];
    for (let i = 0; i < cells.length; i++) out.push(cells[i] ?? " ");
    lines.push({
      text: out.join("").replace(/\s+$/, ""),
      cols: maxCursor,
    });
    cells = [];
    cursor = 0;
    maxCursor = 0;
  };

  const put = (text) => {
    for (const ch of text) {
      const cols = (isHalfWidth(ch) ? 1 : 2) * width;
      let painted = ch;
      if (em) painted = ANSI.bold + painted + ANSI.reset;
      if (reverse) painted = ANSI.reverse + painted + ANSI.reset;
      cells[cursor] = painted;
      // own = その文字がターミナル上で自然に占める桁数（全角は2）。
      // その内側は空文字で埋めて二重に幅を取らせず、
      // 拡大ぶん（cols - own）だけ空白で占有を可視化する（重なりを見つけるため）
      const own = isHalfWidth(ch) ? 1 : 2;
      for (let k = 1; k < own; k++) cells[cursor + k] = "";
      for (let k = own; k < cols; k++) cells[cursor + k] = " ";
      cursor += cols;
      if (cursor > maxCursor) maxCursor = cursor;
    }
  };

  // 要素を出現順に処理する。
  // 開きタグだけを正規表現で拾い、閉じタグは自分で探す。
  // 1本の正規表現で「自己終了 or 開閉ペア」を兼ねさせると、
  // <text lang="ja"/> のような自己終了タグが後続の </text> まで飲み込んでしまう。
  const tagRe = /<(text|feed|hline|cut)\b([^>]*?)(\/)?>/g;
  let m;
  while ((m = tagRe.exec(xml)) !== null) {
    const [, tag, rawAttrs, selfClose] = m;
    let inner;
    if (!selfClose) {
      const close = xml.indexOf(`</${tag}>`, tagRe.lastIndex);
      if (close >= 0) {
        inner = xml.slice(tagRe.lastIndex, close);
        tagRe.lastIndex = close + tag.length + 3;
      }
    }
    const attr = (name) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(rawAttrs)?.[1];

    if (tag === "text") {
      const w = attr("width");
      if (w) width = Number(w);
      const e = attr("em");
      if (e) em = e === "true" || e === "1";
      const r = attr("reverse");
      if (r) reverse = r === "true" || r === "1";
      const x = attr("x");
      if (x) cursor = Math.round(Number(x) / DOTS_PER_COL);

      if (!selfClose && inner !== undefined) {
        // XML実体参照を戻す。&#10; が改行
        const text = inner
          .replace(/&#10;/g, "\n")
          .replace(/&#9;/g, "\t")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        for (const [i, seg] of text.split("\n").entries()) {
          if (i > 0) flush();
          put(seg);
        }
      }
    } else if (tag === "hline") {
      if (cells.length > 0) flush();
      const x1 = Math.round(Number(attr("x1") ?? 0) / DOTS_PER_COL);
      const x2 = Math.round(Number(attr("x2") ?? PRINT_WIDTH_DOTS) / DOTS_PER_COL);
      const style = attr("style") ?? "thin";
      const glyph = style.startsWith("thick") ? "━" : "─";
      const span = Math.max(0, Math.floor((x2 - x1) / 2));
      lines.push({ text: " ".repeat(x1) + glyph.repeat(span), cols: x2 });
    } else if (tag === "feed") {
      if (cells.length > 0) flush();
      const line = attr("line");
      if (line) for (let i = 0; i < Number(line); i++) lines.push({ text: "", cols: 0 });
      // unit（ドット単位）は行間の微調整なので紙の絵では省く
    } else if (tag === "cut") {
      if (cells.length > 0) flush();
      lines.push({ text: ANSI.dim + "- ".repeat(COLS / 2) + "✂" + ANSI.reset, cols: 0 });
    }
  }
  if (cells.length > 0) flush();
  return lines;
}

function printPaper(xml) {
  const lines = renderPaper(xml);
  const rule = "─".repeat(COLS + 2);
  console.log(`\n┌${rule}┐`);
  console.log(`│ ${ANSI.dim}80mm 紙・${COLS}桁${ANSI.reset}${" ".repeat(COLS - 10)} │`);
  console.log(`├${rule}┤`);
  for (const line of lines) console.log(`│ ${line.text}`);
  console.log(`└${rule}┘\n`);

  // 桁あふれの検出。ここで出たら実機でも確実に折り返される
  const over = lines.filter((l) => l.cols > COLS);
  if (over.length > 0) {
    console.warn(`⚠ ${COLS}桁を超えている行が ${over.length} 行あります（実機では折り返されます）`);
  }
}

/* ── プリンタの喋り方 ────────────────────────────────── */

async function post(params) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  return { status: res.status, text };
}

/** 実機が返す印刷結果XMLと同じ形を作る */
function buildResultXml(ok) {
  // status のビット: 0x00000002 = 印刷完了 / 0x00080000 = 用紙切れ
  const status = ok ? 0x00000002 : 0x00080000;
  const code = ok ? "" : "EPTR_REC_EMPTY";
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<PrintResponseInfo Version="1.00">` +
    `<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" ` +
    `success="${ok}" code="${code}" status="${status}" battery="0"/>` +
    `</PrintResponseInfo>`
  );
}

async function pollOnce() {
  const { status, text } = await post({ ConnectionType: "GetRequest", ID: PRINTER_ID });

  if (status === 404) {
    console.error("✗ 404 — トークンが違います。.env.local の PRINT_ENDPOINT_TOKEN を確認してください");
    process.exit(1);
  }
  if (status === 503) {
    console.error("✗ 503 — サーバー側の環境変数が未設定です（PRINT_ENDPOINT_TOKEN / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }
  if (status !== 200) {
    console.error(`✗ 想定外のステータス ${status}`);
    return false;
  }
  if (text.trim() === "") return false; // 印刷するものは無い

  console.log(`${ANSI.bold}▼ 伝票を受信しました${ANSI.reset}`);
  if (SHOW_XML) console.log(ANSI.dim + text + ANSI.reset);
  printPaper(text);

  const ok = !FAIL;
  await post({
    ConnectionType: "SetResponse",
    ID: PRINTER_ID,
    ResponseFile: buildResultXml(ok),
  });
  console.log(ok ? "→ 「印刷できた」と報告しました" : "→ 「用紙切れで印刷できなかった」と報告しました");
  return true;
}

/* ── 実行 ─────────────────────────────────────────────── */

// サーバーを立てずにXMLの見た目だけ見るモード
if (RENDER_FILE) {
  printPaper(readFileSync(RENDER_FILE, "utf8"));
  process.exit(0);
}

console.log(`ニセ・プリンタ起動  宛先: ${URL_.replace(TOKEN, TOKEN.slice(0, 6) + "…")}`);
if (ONCE) {
  const got = await pollOnce();
  if (!got) console.log("印刷するものはありませんでした。");
  process.exit(0);
}

console.log(`${INTERVAL_SEC}秒おきに問い合わせます。止めるときは Ctrl+C。\n`);
for (;;) {
  try {
    await pollOnce();
  } catch (err) {
    console.error("✗ 接続できません:", err.message);
    console.error("  別のターミナルで `npm run dev` が動いているか確認してください。");
  }
  await sleep(INTERVAL_SEC * 1000);
}
