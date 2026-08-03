#!/usr/bin/env node
/**
 * Figma デザイン検品スクリプト
 *
 *   npm run design:figma                        検品する
 *   npm run design:figma -- --update-baseline   今の違反を「既存分」として記録し直す
 *
 * 前提:
 *   環境変数 FIGMA_TOKEN に Figma のパーソナルアクセストークン（file_content:read）を入れる。
 *   ~/.zshrc に  export FIGMA_TOKEN="figd_..."  と書く。リポジトリには絶対に置かない。
 *
 * 対象: ファイル内の全ページ。
 *   セクションを使っていないページは構造チェックをスキップする（作りかけ・素材置き場のため）。
 *
 * 考え方:
 *   既存のデザイン資産には、すでに大量の「生フレームのボタン」などがある。
 *   それは scripts/figma-check-baseline.json に「既存分」として記録し、
 *   **それ以降に増えた違反だけ**を落とす。
 *   構造・パディングだけは既存分も含めて必ず落とす。
 */

import fs from "node:fs";
import path from "node:path";

const FILE_KEY = "KGPuY4YVRQW6BMRrulBaFN";

/** 検品しないページ（素材置き場・アーカイブなど） */
const SKIP_PAGES = ["---", "_Archive", "参考サイト"];

/**
 * 全セクションに PC / SP の対を要求するページ（画面制作のページ）。
 * ここに無いページでも、サブセクションを作った時点で PC / SP の対が必須になる。
 * 既存ページを PC / SP 構造に作り替えたら、このリストに足す。
 */
const SCREEN_PAGES = ["MobileOrder"];

/** PC / SP の対を要求しないセクション（お客様側など） */
const PAIR_EXEMPT_SECTIONS = ["注文"];

const PAD = 100;
const TOL = 2;
const TAP_MIN = 44;

const BASELINE_PATH = path.join(process.cwd(), "scripts", "figma-check-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error("FIGMA_TOKEN が設定されていません。");
  console.error('~/.zshrc に  export FIGMA_TOKEN="figd_..."  を追加して、ターミナルを開き直してください。');
  process.exit(1);
}

const hard = [];  // 構造・パディング（既存分も必ず落とす）
const soft = [];  // 資産の質（ベースラインに無いものだけ落とす）
const info = [];  // 参考
const skipped = [];
const stats = { unboundFills: 0, noTextStyle: 0, nodes: 0 };

const box = (n) => n.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
const near = (a, b) => Math.abs(a - b) <= TOL;
const H = (sec, msg) => hard.push({ sec, msg });
const S = (sec, msg) => soft.push({ sec, msg });
const I = (sec, msg) => info.push({ sec, msg });

async function fetchFile() {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    console.error(`Figma API エラー: ${res.status} ${res.statusText}`);
    if (res.status === 403) console.error("トークンが無効か期限切れ、またはこのファイルへの権限がありません。");
    process.exit(1);
  }
  return res.json();
}

// ── ページ ────────────────────────────────────────────
function checkPage(page) {
  const sections = (page.children || []).filter((c) => c.type === "SECTION");
  const loose = (page.children || []).filter((c) => c.type !== "SECTION");

  if (!sections.length) {
    skipped.push(`${page.name}（セクション未使用）`);
    return;
  }
  for (const l of loose) {
    H(page.name, `セクションに入っていない要素があります: 「${l.name}」（${l.type}）`);
  }

  const sorted = sections.slice().sort((a, b) => box(a).y - box(b).y);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const b = box(s);
    if (!near(b.x, 0)) H(`${page.name} / ${s.name}`, `セクションの x が 0 ではありません（${Math.round(b.x)}）`);
    if (i > 0) {
      const p = box(sorted[i - 1]);
      const gap = b.y - (p.y + p.height);
      if (gap < -TOL) H(`${page.name} / ${s.name}`, `前のセクションと重なっています（${Math.round(-gap)}px）`);
      else if (!near(gap, PAD)) H(`${page.name} / ${s.name}`, `前のセクションとの間隔が ${Math.round(gap)}px です（${PAD}px にしてください）`);
    }
    checkSection(page, s);
  }
}

// ── セクション ────────────────────────────────────────
function checkSection(page, sec, depth = 0) {
  const label = `${page.name} / ${sec.name}`;
  const kids = sec.children || [];
  const subs = kids.filter((c) => c.type === "SECTION");

  // 入れ子の検出。今回まさにこれで 03 Navigation が 02 に飲み込まれた
  if (depth > 0) {
    H(label, "セクションの中にセクションが入り込んでいます。切り出してください");
    return;
  }
  // 「99 〜」で始まるセクションは素材置き場・メモ置き場。構造は問わない
  const isUtility = /^\s*99/.test(sec.name);
  // 画面制作ページの通常セクションは、PC / SP を必ず持つ
  const requirePair =
    !isUtility &&
    SCREEN_PAGES.includes(page.name) &&
    !PAIR_EXEMPT_SECTIONS.includes(sec.name);

  // サブセクションを作った時点で、それは PC / SP 以外あってはならない
  for (const b of subs.filter((s) => s.name !== "PC" && s.name !== "SP")) {
    H(label, `「${b.name}」は PC / SP ではありません。セクションの直下には PC と SP だけを置いてください`);
  }

  if (!isUtility && (subs.length || requirePair)) {
    const names = subs.map((s) => s.name);
    // 除外セクション（お客様側など、片側しか存在しない画面）は対を要求しない
    if (!PAIR_EXEMPT_SECTIONS.includes(sec.name)) {
      if (!names.includes("PC")) H(label, "PC セクションがありません（PC を作るときは SP も対で作る）");
      if (!names.includes("SP")) H(label, "SP セクションがありません（PC を作るときは SP も対で作る）");
    }
    const loose = kids.filter((c) => c.type !== "SECTION");
    if (loose.length) H(label, `PC / SP の外に直接置かれた要素があります: ${loose.map((f) => `「${f.name}」`).join(" ")}`);
    for (const sub of subs) checkFit(`${label} / ${sub.name}`, sub, true);
  }

  checkFit(label, sec, false);
}

/** 中身の外接矩形が、ちょうど100pxの余白で収まっているか */
function checkFit(label, node, spaceChildren) {
  const kids = node.children || [];
  if (!kids.length) { I(label, "中身が空です"); return; }
  const nb = box(node);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of kids) {
    const kb = box(k);
    minX = Math.min(minX, kb.x); minY = Math.min(minY, kb.y);
    maxX = Math.max(maxX, kb.x + kb.width); maxY = Math.max(maxY, kb.y + kb.height);
  }
  const l = minX - nb.x, t = minY - nb.y;
  const r = nb.x + nb.width - maxX, b2 = nb.y + nb.height - maxY;
  if (!near(l, PAD)) H(label, `左パディングが ${Math.round(l)}px です（${PAD}px）`);
  if (!near(t, PAD)) H(label, `上パディングが ${Math.round(t)}px です（${PAD}px）`);
  if (!near(r, PAD)) H(label, `右パディングが ${Math.round(r)}px です（${PAD}px）`);
  if (!near(b2, PAD)) H(label, `下パディングが ${Math.round(b2)}px です（${PAD}px）`);

  if (spaceChildren) {
    const ordered = kids.slice().sort((a, b) => box(a).x - box(b).x);
    for (let i = 1; i < ordered.length; i++) {
      const p = box(ordered[i - 1]), c = box(ordered[i]);
      const gap = c.x - (p.x + p.width);
      if (gap < -TOL) H(label, `「${ordered[i].name}」が前のフレームと重なっています`);
      else if (!near(gap, PAD)) H(label, `「${ordered[i].name}」の左の間隔が ${Math.round(gap)}px です（${PAD}px）`);
    }
  }
}

// ── ノード単位 ─────────────────────────────────────────
// \b で囲まないと "Rectangle" の中の "cta" に誤反応する
const BUTTONISH = /\b(button|btn|chip|cta|tab)s?\b/i;
// 入れ物は対象外。Button Row / Tab Nav / Table Chip Strip など
const CONTAINERISH = /\b(row|strip|nav|bar|group|list|wrap|wrapper|content|container|area|section|stack)s?$/i;

function walk(node, secLabel, isSP, insideInstance) {
  stats.nodes++;
  const inInst = insideInstance || node.type === "INSTANCE";
  const b = box(node);
  const name = node.name || "";
  const tappable = BUTTONISH.test(name) && !CONTAINERISH.test(name.trim());

  if (!inInst && node.type === "FRAME" && tappable) {
    S(secLabel, `「${name}」が生のフレームで作られています。既存のコンポーネントを使ってください`);
  }
  if (isSP && !insideInstance && tappable && b.height > 0 && b.height < TAP_MIN) {
    S(secLabel, `「${name}」の高さが ${Math.round(b.height)}px です（SPのタップ領域は${TAP_MIN}px以上）`);
  }
  if (!inInst) {
    for (const p of [].concat(node.fills || [], node.strokes || [])) {
      if (p && p.type === "SOLID" && p.visible !== false) {
        const bound = node.boundVariables && node.boundVariables.fills;
        if (!bound && !node.styles) stats.unboundFills++;
      }
    }
    if (node.type === "TEXT" && !(node.styles && node.styles.text)) stats.noTextStyle++;
  }
  for (const c of node.children || []) walk(c, secLabel, isSP, inInst);
}

// ── 実行 ──────────────────────────────────────────────
const file = await fetchFile();
const pages = (file.document.children || []).filter((p) => !SKIP_PAGES.includes(p.name));

for (const page of pages) {
  checkPage(page);
  for (const sec of page.children || []) {
    if (sec.type !== "SECTION") continue;
    const subs = (sec.children || []).filter((c) => c.type === "SECTION");
    if (subs.length) {
      for (const sub of subs) walk(sub, `${page.name} / ${sec.name} / ${sub.name}`, sub.name === "SP" || PAIR_EXEMPT_SECTIONS.includes(sec.name), false);
    } else {
      walk(sec, `${page.name} / ${sec.name}`, false, false);
    }
  }
}

// ── ベースライン ───────────────────────────────────────
const key = (v) => `${v.sec}||${v.msg}`;
if (UPDATE) {
  const uniq = Array.from(new Set(soft.map(key))).sort();
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ count: uniq.length, allowed: uniq }, null, 2) + "\n");
  console.log(`\n既存分 ${uniq.length} 件を scripts/figma-check-baseline.json に記録しました。\n`);
  process.exit(0);
}
let baseline = { allowed: [] };
if (fs.existsSync(BASELINE_PATH)) { try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")); } catch (e) {} }
const allowed = new Set(baseline.allowed || []);
const newSoft = soft.filter((v) => !allowed.has(key(v)));
const carried = soft.length - newSoft.length;

// ── 出力 ──────────────────────────────────────────────
const R = "\x1b[31m", Y = "\x1b[33m", G = "\x1b[32m", D = "\x1b[2m", X = "\x1b[0m";
function print(list, color, head) {
  console.log(`${color}${head}${X}`);
  const g = {};
  for (const v of list) (g[v.sec] = g[v.sec] || []).push(v.msg);
  for (const k of Object.keys(g)) {
    const counts = {};
    for (const m of g[k]) counts[m] = (counts[m] || 0) + 1;
    console.log(`\n  ${k}`);
    for (const m of Object.keys(counts)) console.log(`    ${color}・${X}${m}${counts[m] > 1 ? ` ${D}×${counts[m]}${X}` : ""}`);
  }
  console.log("");
}

console.log("");
console.log(`${D}対象ページ: ${pages.map((p) => p.name).join(", ")}${X}`);
console.log(`${D}ノード数 ${stats.nodes}${X}\n`);

if (hard.length) print(hard, R, `✗ 構造・パディング（${hard.length}件） — 必ず直してください`);
else console.log(`${G}✓ 構造・パディング: 全ページ問題なし${X}\n`);

if (newSoft.length) print(newSoft, R, `✗ 今回増えた違反（${newSoft.length}件）`);
else console.log(`${G}✓ 新しい違反なし${X}\n`);

if (info.length) print(info, Y, `△ 確認したほうがよいもの（${info.length}件）`);
if (skipped.length) console.log(`${D}スキップ: ${skipped.join(" / ")}${X}`);

console.log(`${D}既存分（ベースラインで見逃している分）: ${carried}件${X}`);
console.log(`${D}未バインドの塗り: ${stats.unboundFills} / テキストスタイル未適用: ${stats.noTextStyle}${X}\n`);

process.exit(hard.length || newSoft.length ? 1 : 0);
