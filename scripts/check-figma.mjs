#!/usr/bin/env node
/**
 * Figma デザイン検品スクリプト
 *
 *   npm run design:figma                    検品する
 *   npm run design:figma -- --update-baseline   今の違反を「既存分」として記録し直す
 *
 * 前提:
 *   環境変数 FIGMA_TOKEN に Figma のパーソナルアクセストークン（file_content:read）を入れる。
 *   ~/.zshrc に  export FIGMA_TOKEN="figd_..."  と書く。リポジトリには絶対に置かない。
 *
 * 考え方:
 *   既存のデザイン資産には、すでに大量の「生フレームのボタン」などがある。
 *   それを毎回赤で出しても直せないので、初回の違反は scripts/figma-check-baseline.json に
 *   「既存分」として記録し、**それ以降に増えた違反だけ**を落とす。
 *   構造とパディングだけは既存分も含めて必ず落とす（今きれいな状態なので維持できる）。
 */

import fs from "node:fs";
import path from "node:path";

const FILE_KEY = "KGPuY4YVRQW6BMRrulBaFN";
const TARGET_PAGES = ["MobileOrder"];
const PAIR_EXEMPT = ["注文"]; // PC / SP の対を要求しないセクション
const PAD = 100;
const TOL = 2;
const TAP_MIN = 44; // SP のみ適用

const BASELINE_PATH = path.join(process.cwd(), "scripts", "figma-check-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error("FIGMA_TOKEN が設定されていません。");
  console.error('~/.zshrc に  export FIGMA_TOKEN="figd_..."  を追加して、ターミナルを開き直してください。');
  process.exit(1);
}

/** 構造・パディング違反（既存分も必ず落とす） */
const hard = [];
/** 資産の質の違反（ベースラインに無いものだけ落とす） */
const soft = [];
/** 参考情報（落とさない） */
const info = [];

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

// ── 構造とパディング ────────────────────────────────────
function checkPage(page) {
  const sections = (page.children || []).filter((c) => c.type === "SECTION");
  for (const s of (page.children || []).filter((c) => c.type === "FRAME")) {
    H(page.name, `セクションに入っていないフレームがあります: 「${s.name}」`);
  }
  const sorted = sections.slice().sort((a, b) => box(a).y - box(b).y);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const b = box(s);
    if (!near(b.x, 0)) H(s.name, `セクションの x が 0 ではありません（${Math.round(b.x)}）`);
    if (i > 0) {
      const p = box(sorted[i - 1]);
      const gap = b.y - (p.y + p.height);
      if (!near(gap, PAD)) H(s.name, `前のセクションとの間隔が ${Math.round(gap)}px です（${PAD}px にしてください）`);
    }
    checkSection(s);
  }
}

function checkSection(sec) {
  const subs = (sec.children || []).filter((c) => c.type === "SECTION");
  const loose = (sec.children || []).filter((c) => c.type !== "SECTION");
  if (loose.length) {
    H(sec.name, `PC / SP セクションの外に直接置かれた要素があります: ${loose.map((f) => `「${f.name}」`).join(" ")}`);
  }
  if (!PAIR_EXEMPT.includes(sec.name)) {
    const names = subs.map((s) => s.name);
    if (!names.includes("PC")) H(sec.name, "PC セクションがありません（PC を作るときは SP も対で作る）");
    if (!names.includes("SP")) H(sec.name, "SP セクションがありません（PC を作るときは SP も対で作る）");
  }
  const sb = box(sec);
  const ordered = subs.slice().sort((a, b) => box(a).x - box(b).x);
  let expectX = sb.x + PAD;
  let maxBottom = sb.y + PAD;
  for (const sub of ordered) {
    const ub = box(sub);
    if (!near(ub.x, expectX)) H(sec.name, `「${sub.name}」の左の間隔が ${Math.round(ub.x - (expectX - PAD))}px です（${PAD}px）`);
    if (!near(ub.y, sb.y + PAD)) H(sec.name, `「${sub.name}」の上パディングが ${Math.round(ub.y - sb.y)}px です（${PAD}px）`);
    expectX = ub.x + ub.width + PAD;
    maxBottom = Math.max(maxBottom, ub.y + ub.height);
    checkSubSection(sec.name, sub);
  }
  if (ordered.length) {
    const rp = sb.x + sb.width - (expectX - PAD);
    if (!near(rp, PAD)) H(sec.name, `セクションの右パディングが ${Math.round(rp)}px です（${PAD}px）`);
    const bp = sb.y + sb.height - maxBottom;
    if (!near(bp, PAD)) H(sec.name, `セクションの下パディングが ${Math.round(bp)}px です（${PAD}px）`);
  }
}

function checkSubSection(secName, sub) {
  const label = `${secName} / ${sub.name}`;
  const kids = (sub.children || []).slice().sort((a, b) => box(a).x - box(b).x);
  if (!kids.length) { I(label, "中身が空です"); return; }
  const ub = box(sub);
  let expectX = ub.x + PAD;
  let maxBottom = ub.y + PAD;
  for (const k of kids) {
    const kb = box(k);
    if (!near(kb.x, expectX)) H(label, `「${k.name}」の左の間隔が ${Math.round(kb.x - (expectX - PAD))}px です（${PAD}px）`);
    if (!near(kb.y, ub.y + PAD)) H(label, `「${k.name}」の上パディングが ${Math.round(kb.y - ub.y)}px です（${PAD}px）`);
    expectX = kb.x + kb.width + PAD;
    maxBottom = Math.max(maxBottom, kb.y + kb.height);
  }
  const rp = ub.x + ub.width - (expectX - PAD);
  if (!near(rp, PAD)) H(label, `右パディングが ${Math.round(rp)}px です（${PAD}px）`);
  const bp = ub.y + ub.height - maxBottom;
  if (!near(bp, PAD)) H(label, `下パディングが ${Math.round(bp)}px です（${PAD}px）`);
}

// ── ノード単位 ─────────────────────────────────────────
// \b で囲むこと。囲まないと "Rectangle" の中の "cta" に誤反応する
const BUTTONISH = /\b(button|btn|chip|cta|tab)s?\b/i;

function walk(node, secLabel, isSP, insideInstance) {
  stats.nodes++;
  const isInstance = node.type === "INSTANCE";
  const inInst = insideInstance || isInstance;
  const b = box(node);
  const looksTappable = BUTTONISH.test(node.name || "");

  if (!inInst && node.type === "FRAME" && looksTappable) {
    S(secLabel, `「${node.name}」が生のフレームで作られています。既存のコンポーネントを使ってください`);
  }
  // タップ領域は SP だけ。PC はマウス操作なので対象外
  if (isSP && !insideInstance && looksTappable && b.height > 0 && b.height < TAP_MIN) {
    S(secLabel, `「${node.name}」の高さが ${Math.round(b.height)}px です（SPのタップ領域は${TAP_MIN}px以上）`);
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
const pages = (file.document.children || []).filter((p) => TARGET_PAGES.includes(p.name));
if (!pages.length) {
  console.error(`対象ページが見つかりません: ${TARGET_PAGES.join(", ")}`);
  process.exit(1);
}

for (const page of pages) {
  checkPage(page);
  for (const sec of page.children || []) {
    if (sec.type !== "SECTION") continue;
    for (const sub of sec.children || []) {
      const isSP = sub.name === "SP" || PAIR_EXEMPT.includes(sec.name);
      walk(sub, `${sec.name} / ${sub.name}`, isSP, false);
    }
  }
}

// ── ベースライン ───────────────────────────────────────
const key = (v) => `${v.sec}||${v.msg}`;
const softKeys = soft.map(key);

if (UPDATE) {
  const uniq = Array.from(new Set(softKeys)).sort();
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ updatedAt: null, count: uniq.length, allowed: uniq }, null, 2) + "\n");
  console.log(`\n既存分 ${uniq.length} 件を scripts/figma-check-baseline.json に記録しました。`);
  console.log("以降はここに無い違反だけが赤で出ます。\n");
  process.exit(0);
}

let baseline = { allowed: [] };
if (fs.existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")); } catch (e) {}
}
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
    for (const m of Object.keys(counts)) {
      console.log(`    ${color}・${X}${m}${counts[m] > 1 ? ` ${D}×${counts[m]}${X}` : ""}`);
    }
  }
  console.log("");
}

console.log("");
console.log(`${D}対象: ${TARGET_PAGES.join(", ")} / ノード数 ${stats.nodes}${X}\n`);

if (hard.length) print(hard, R, `✗ 構造・パディング（${hard.length}件） — 必ず直してください`);
else console.log(`${G}✓ 構造・パディング: 問題なし${X}\n`);

if (newSoft.length) print(newSoft, R, `✗ 今回増えた違反（${newSoft.length}件）`);
else console.log(`${G}✓ 新しい違反なし${X}\n`);

if (info.length) print(info, Y, `△ 確認したほうがよいもの（${info.length}件）`);

console.log(`${D}既存分（ベースラインで見逃している分）: ${carried}件${X}`);
console.log(`${D}未バインドの塗り: ${stats.unboundFills} / テキストスタイル未適用: ${stats.noTextStyle}${X}\n`);

process.exit(hard.length || newSoft.length ? 1 : 0);
