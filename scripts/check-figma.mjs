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
// **ここに語を足す方向で誤検知を解こうとしないこと。**「CTA Block」「Hero CTAs」のように
// 末尾が容器の語でない入れ物はいくらでも作れるので、語リストは永久に足り続ける。
// 名前ではなく「中身」と「大きさ」で判断する（下の2条件）。
const CONTAINERISH = /\b(row|strip|nav|bar|group|list|wrap|wrapper|content|container|area|section|stack)s?$/i;

/**
 * ボタンとして現実的な高さの上限。これを超えるものはセクション帯や大きなカード。
 * **幅では判定しない。**PC管理画面には横幅864pxの全幅ボタンが実在するため、
 * 幅を条件に入れると本物の生フレームボタンを見逃す。
 */
const RAW_BUTTON_MAX_HEIGHT = 120;

/**
 * 「入れ物」とみなすのに必要な、子孫の INSTANCE / COMPONENT の数。
 *
 * **1個ではダメ。** 生フレームのボタンはたいてい中に Icon インスタンスを1個持っている
 * （`Delete Button` 32×32 の中に `Icon` 1個、など）。1個で除外すると、
 * **本物の生フレームボタンをまとめて見逃す**（実測で11件が消えた）。
 * ボタンを2個以上並べているものは、それ自体がボタンではなく入れ物である。
 */
const CONTAINER_MIN_COMPONENTS = 2;

/** 子孫の INSTANCE / COMPONENT の数を数える（上限に達したら打ち切る） */
function countComponentDescendants(node, limit) {
  let n = 0;
  for (const c of node.children || []) {
    if (c.type === "INSTANCE" || c.type === "COMPONENT") n++;
    if (n >= limit) return n;
    n += countComponentDescendants(c, limit - n);
    if (n >= limit) return n;
  }
  return n;
}

/**
 * 枠に対してこの割合以上の大きさの子は、「その枠が包んでいるだけ」の証拠とみなす。
 *
 * 個数だけでは容器と本物を区別できない。どちらもインスタンス1個だからである。
 *   GOOD LOOP の CTA Block … 342×77 の枠に、342×52 の Loop/Button が1個 → 幅が100%一致。容器
 *   GOOD ORDER の Delete Button … 32×32 の枠に、16×16 の Icon が1個 → 幅は50%。本物のボタン
 * 区別できるのは**大きさの比率**。枠とほぼ同じ大きさのコンポーネントを持つなら、
 * その枠はそれを包んでいるだけである。
 */
const WRAPPED_CHILD_RATIO = 0.9;

/**
 * **直接の子**に、枠とほぼ同じ大きさの INSTANCE / COMPONENT があるか。
 *
 * 子孫まで見てはいけない。深い階層のインスタンスが偶然大きいだけで除外されてしまう。
 */
function wrapsFullSizeComponent(node) {
  const b = box(node);
  if (!(b.width > 0 && b.height > 0)) return false;
  for (const c of node.children || []) {
    if (c.type !== "INSTANCE" && c.type !== "COMPONENT") continue;
    const cb = box(c);
    if (cb.width >= b.width * WRAPPED_CHILD_RATIO) return true;
    if (cb.height >= b.height * WRAPPED_CHILD_RATIO) return true;
  }
  return false;
}

function walk(node, secLabel, isSP, insideInstance) {
  stats.nodes++;
  const inInst = insideInstance || node.type === "INSTANCE";
  const b = box(node);
  const name = node.name || "";
  const tappable = BUTTONISH.test(name) && !CONTAINERISH.test(name.trim());

  /* 「生フレームのボタン」判定。名前だけで決めると入れ物まで落とすので、3つ除外する。
       1. 子孫に INSTANCE / COMPONENT が2個以上ある → ボタンを並べている入れ物
       2. 高さが RAW_BUTTON_MAX_HEIGHT を超える → ボタンではない（セクション帯・大きなカード）
       3. 直接の子に、枠とほぼ同じ大きさの INSTANCE / COMPONENT がある
          → そのコンポーネントを包んでいるだけの容器（個数では 1 と区別できない）
     SPのタップ領域の判定（下）はこの除外を通していない。あちらは高さ44px未満が対象で、
     2 とは排他だし、1 で緩めると本物の小さすぎるボタンを見逃す可能性があるため。 */
  if (!inInst && node.type === "FRAME" && tappable) {
    const manyComponents =
      countComponentDescendants(node, CONTAINER_MIN_COMPONENTS) >= CONTAINER_MIN_COMPONENTS;
    const tooTall = b.height > RAW_BUTTON_MAX_HEIGHT;
    const wrapsOne = wrapsFullSizeComponent(node);
    if (!manyComponents && !tooTall && !wrapsOne) {
      S(secLabel, `「${name}」が生のフレームで作られています。既存のコンポーネントを使ってください`);
    }
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
//
// **件数つきで記録する。** キーだけを覚えると「同じ違反が増えたこと」を見逃す。
// 例: 生フレームのボタンが3個あるセクションに、あと10個足しても
//     キーは同じなので、キーだけの台帳では緑のまま通ってしまう。
//
// 判定:
//   キーが台帳に無い          → 落とす（新しい種類の違反）
//   今回の件数 ≤ 台帳の件数    → 通す
//   今回の件数 > 台帳の件数    → 落とす（増えた分だけ落ちる）
//   今回の件数 < 台帳の件数    → 通す。ただし「返済が進んだ」ものとして報告する
//
// 件数が減っても台帳は自動で書き換えない。書き換わるのは --update-baseline を
// 明示的に叩いたときだけ。勝手に基準線が下がると、返済したことに気づけない。
const key = (v) => `${v.sec} :: ${v.msg}`;

/** 今回の検出結果を キー → 件数 にまとめる */
const tally = (list) => {
  const m = new Map();
  for (const v of list) m.set(key(v), (m.get(key(v)) || 0) + 1);
  return m;
};
const current = tally(soft);

if (UPDATE) {
  const counts = {};
  for (const k of Array.from(current.keys()).sort()) counts[k] = current.get(k);
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ total: soft.length, keys: current.size, counts }, null, 2) + "\n"
  );
  console.log(`\n既存分 ${soft.length} 件（${current.size} 種類）を scripts/figma-check-baseline.json に記録しました。\n`);
  process.exit(0);
}

// 台帳がまだ無い＝新規プロジェクトの初回。出力の最後に案内を出すために覚えておく
const baselineExists = fs.existsSync(BASELINE_PATH);

let baseline = { counts: {} };
if (baselineExists) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")); } catch (e) { /* 壊れていたら空として扱う */ }
}
// 旧形式（キーの配列）は件数を持たないので、黙って読み替えない。
// 読み替えると「全部1件ずつ」と誤解して、いきなり大量に落ちる
if (Array.isArray(baseline.allowed)) {
  console.error("scripts/figma-check-baseline.json が旧形式（キーの配列）です。");
  console.error("件数つきの形式に作り直してください:  npm run design:figma -- --update-baseline");
  console.error("※ 作り直す前に、構造・パディングの違反が0件であることを必ず確認すること。");
  process.exit(1);
}
const allowedCounts = new Map(Object.entries(baseline.counts || {}));

/** 台帳との差分。落とすのは「新種」と「増加」だけ */
const fresh = [];     // 台帳に無いキー
const grown = [];     // 増えたキー
const repaid = [];    // 減ったキー（落とさない）
for (const [k, n] of current) {
  if (!allowedCounts.has(k)) { fresh.push({ k, n }); continue; }
  const was = allowedCounts.get(k);
  if (n > was) grown.push({ k, was, n });
  else if (n < was) repaid.push({ k, was, n });
}
// 台帳にあるのに今回1件も出なかった＝全部返済された
for (const [k, was] of allowedCounts) if (!current.has(k)) repaid.push({ k, was, n: 0 });

const freshCount = fresh.reduce((a, v) => a + v.n, 0);
const grownCount = grown.reduce((a, v) => a + (v.n - v.was), 0);
const carried = soft.length - freshCount - grownCount;

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

/** キーを「セクション」と「メッセージ」に割り戻して表示する */
const printKeys = (list, color, head, format) => {
  console.log(`${color}${head}${X}`);
  const g = {};
  for (const v of list) {
    const [sec, msg] = v.k.split(" :: ");
    (g[sec] = g[sec] || []).push(format(v, msg));
  }
  for (const sec of Object.keys(g).sort()) {
    console.log(`\n  ${sec}`);
    for (const line of g[sec]) console.log(`    ${color}・${X}${line}`);
  }
  console.log("");
};

if (fresh.length) {
  printKeys(fresh, R, `✗ 新しい種類の違反（${freshCount}件 / ${fresh.length}種類）`,
    (v, msg) => `${msg}${v.n > 1 ? ` ${D}×${v.n}${X}` : ""}`);
}
if (grown.length) {
  printKeys(grown, R, `✗ 増えた違反（+${grownCount}件 / ${grown.length}種類）`,
    (v, msg) => `${msg} ${D}——${X} ${v.was}件で登録されていたものが ${v.n}件に増えています（${R}+${v.n - v.was}${X}）`);
}
if (!fresh.length && !grown.length) console.log(`${G}✓ 新しい違反なし・増えた違反なし${X}\n`);

if (repaid.length) {
  printKeys(repaid, G, `✓ 返済が進んだもの（${repaid.length}種類）— 落としません`,
    (v, msg) => `${msg} ${D}——${X} ${v.was}件 → ${v.n}件`);
  console.log(`${D}  台帳は自動では書き換えません。反映するなら  npm run design:figma -- --update-baseline${X}\n`);
}

if (info.length) print(info, Y, `△ 確認したほうがよいもの（${info.length}件）`);
if (skipped.length) console.log(`${D}スキップ: ${skipped.join(" / ")}${X}`);

console.log(`${D}未返済の負債（ベースラインで見逃している分）: ${carried}件 / ${allowedCounts.size}種類${X}`);
console.log(`${D}今回の検出合計: ${soft.length}件（新種 ${freshCount} ＋ 増加 ${grownCount} ＋ 既存 ${carried}）${X}`);
console.log(`${D}未バインドの塗り: ${stats.unboundFills} / テキストスタイル未適用: ${stats.noTextStyle}${X}\n`);

/* 台帳がまだ無い状態で違反が出たときだけ案内する。
   新規プロジェクトの初回は必ず全件が「新しい種類」として赤く出るので、
   次に何をすればいいかが書かれていないと「壊れている」と誤解される。
   **台帳が既にある場合は出さない。**既存プロジェクトで --update-baseline を
   安易な逃げ道として案内すると、CLAUDE.md 7章（検品を通さずに完了と言わない）に反する。 */
if (!baselineExists && (fresh.length || grown.length)) {
  console.log(`${Y}▶ これは初回の実行です。${X}台帳（scripts/figma-check-baseline.json）がまだ無いため、いま Figma にある違反が全部「新しい種類」として出ています。${Y}壊れているわけではありません。${X}`);
  console.log(`${D}  いまの状態を基準線として登録する:  npm run design:figma -- --update-baseline${X}`);
  console.log(`${D}  ※ 登録する前に、上の「構造・パディング」が0件で終わっていることを必ず確認すること。${X}\n`);
}

process.exit(hard.length || fresh.length || grown.length ? 1 : 0);
