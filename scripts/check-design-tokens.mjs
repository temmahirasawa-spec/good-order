#!/usr/bin/env node
/**
 * デザイントークンQA
 *
 * CLAUDE.md 4章の「生の色コードを直接書かない」を、機械が判定できる制約にする。
 * app/ components/ lib/ hooks/ の .ts / .tsx を走査し、
 * ハードコードされた色（#RRGGBB など）を検出する。
 *
 * 検出したものは2種類に分けて報告する:
 *   1. システム外の色 … design-tokens.css のどのトークンとも一致しない。
 *                        業態を切り替えたときにここだけ取り残される。
 *   2. 直書き        … 値はトークンと同じだが変数を経由していない。
 *                        Figmaで値を変えても追従しない。
 *
 * 例外の書き方:
 *   その行、または直前のコメント行に `design-qa-allow: 理由` と書く。
 *   （PWAのmetaタグやQR生成ライブラリなど、CSS変数が原理的に使えない箇所用）
 *
 * 対象は .ts / .tsx のみ。CSSファイルは旧デザインシステムの定義が残っているため
 * 現時点では対象外（admin側のリデザインが進んだ段階で広げる）。
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "lib", "hooks"];
const TOKEN_FILE = "app/design-tokens.css";
const EXT = /\.(ts|tsx)$/;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOW = "design-qa-allow";

// ── 1. トークンの実定義だけを読む ────────────────────────────
//    コメント行に書かれた「別モード用の候補値」を実値と取り違えないよう、
//    `--name: #value;` の形をした宣言行だけを対象にする。
const tokens = new Map(); // "#RRGGBB"(大文字) → "--token-name"
for (const line of readFileSync(join(ROOT, TOKEN_FILE), "utf8").split("\n")) {
  const m = /^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(line);
  if (m) tokens.set(m[2].toUpperCase(), m[1]);
}
if (tokens.size === 0) {
  console.error(`✗ ${TOKEN_FILE} からトークンを読み取れませんでした`);
  process.exit(1);
}

// ── 2. 対象ファイルを集める ──────────────────────────────────
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.test(name)) files.push(p);
  }
}
for (const d of TARGET_DIRS) {
  try { walk(join(ROOT, d)); } catch { /* ディレクトリが無ければ飛ばす */ }
}

// ── 3. 走査 ──────────────────────────────────────────────
const outside = [];  // システム外の色
const inline  = [];  // 直書き（トークンと同値）

// JSX の {/* ... */} も含めてコメント行とみなす
const isComment = (s) => {
  const t = s.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
};

/**
 * その行に対して除外指定が効いているかを判定する。
 *
 * 同じ行だけでなく、直前に続くコメント行（JSDocブロック全体を含む）まで遡って探す。
 * 「なぜ変数が使えないのか」の説明は宣言の上のコメントに書くのが自然なので、
 * そこに書いた design-qa-allow が届かないと、理由を書く場所が不自然になる。
 * 空行を挟んだら別のコメントとみなして打ち切る。
 */
const isAllowed = (lines, i) => {
  if (lines[i].includes(ALLOW)) return true;
  for (let j = i - 1; j >= 0; j--) {
    const t = lines[j].trim();
    if (t === "") return false;
    if (!isComment(t)) return false;
    if (lines[j].includes(ALLOW)) return true;
  }
  return false;
};

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (isAllowed(lines, i)) return;

    for (const hex of line.match(HEX) ?? []) {
      const key = hex.toUpperCase();
      const where = { file: relative(ROOT, file), line: i + 1, hex, code: line.trim().slice(0, 90) };
      if (tokens.has(key)) inline.push({ ...where, token: tokens.get(key) });
      else outside.push(where);
    }
  });
}

// ── 4. 報告 ──────────────────────────────────────────────
const total = outside.length + inline.length;
if (total === 0) {
  console.log(`✔ デザイントークンQA: 生の色コードは見つかりませんでした（${files.length} ファイル / ${tokens.size} トークン）`);
  process.exit(0);
}

console.error("");
console.error("=".repeat(70));
console.error(" デザイントークンQA — 生の色コードが見つかりました");
console.error("=".repeat(70));

if (outside.length) {
  console.error("");
  console.error(`■ デザインシステム外の色（${outside.length}件）`);
  console.error("  トークンのどれとも一致しません。業態を切り替えたとき、ここだけ取り残されます。");
  console.error("  → design-tokens.css に追加するか、既存トークンに寄せてください。");
  console.error("  → 判断が要る内容なので、勝手に決めず天真に確認すること（CLAUDE.md 3章）。");
  console.error("");
  for (const v of outside) console.error(`    ${v.file}:${v.line}  ${v.hex}\n      ${v.code}`);
}

if (inline.length) {
  console.error("");
  console.error(`■ トークンと同じ値の直書き（${inline.length}件）`);
  console.error("  値は正しいですが変数を経由していないため、Figmaで値を変えても追従しません。");
  console.error("");
  for (const v of inline) console.error(`    ${v.file}:${v.line}  ${v.hex} → var(${v.token})\n      ${v.code}`);
}

console.error("");
console.error("─".repeat(70));
console.error(" 書き換え方");
console.error("   CSSの中     : color: \"var(--color-text-primary)\"");
console.error("   SVGの線・塗り: <svg style={{ color: \"var(--...)\" }}> ＋ stroke=\"currentColor\"");
console.error("                 （SVGの属性に var() を直接書いても解決されません）");
console.error("");
console.error(" どうしても変数が使えない場合（PWAのmeta、QR生成など）は、");
console.error(" その行、または直前のコメント行に  design-qa-allow: 理由  と書いてください。");
console.error("=".repeat(70));
console.error("");

process.exit(1);
