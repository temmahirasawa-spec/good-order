#!/usr/bin/env node
/**
 * お客様側ページのスクリーンショット（PC 1400 / SP 390）を、カートの中身を仕込んだ状態で撮る。
 *
 * Playwright MCP が落ちていても、Playwright が入れた headless Chromium 本体を
 * DevTools Protocol で直接動かして撮る（外部パッケージ不要。Node 22 以上の組み込み WebSocket を使う）。
 *
 * 使い方（先に `npm run dev` が動いていること。起動は天真に頼む）:
 *   node scripts/screenshot-pages.mjs <出力ディレクトリ>
 *
 * 中でやっていること:
 *   1. 本番 DB（.env.local の anon キー）からパンケーキ・アメリカーノ・フライを読んでカートの状態を組む
 *   2. localStorage（orderly-cart / yorkys_order_history）に仕込んでからページを開く
 *   3. CSS が当たり、画面固有の要素が出るまで待ってから撮る（dev の初回コンパイル前に撮らない）
 * 注文は確定しないので本番のデータは増えない。
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BIN = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1237/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const PORT = 9333;
const ORIGIN = process.env.SHOT_ORIGIN || "http://localhost:3000";
const OUT = process.argv[2] || ".claude/verification/screenshots";
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^["']|["']$/g,"").trim()]));
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: "Bearer " + env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
const rest = async (q) => (await fetch(env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/" + q, { headers: H })).json();

// ── カートに入れる商品（本番の実データ）──
const cats = await rest("categories?select=id,slug,category_type");
const slugOf = Object.fromEntries(cats.map(c => [c.id, c.slug]));
const rows = await rest("menu_items?select=id,category_id,name,description,price,image_url,is_takeout&id=in.(c2594d09-5faf-4ac8-9618-29d474c29059,f5dd1e6c-c3b4-486e-ae85-c05a47a5ca5f)");
const byId = Object.fromEntries(rows.map(r => [r.id, r]));
const fries = (await rest("menu_items?select=id,category_id,name,description,price,image_url,is_takeout&is_available=eq.true&category_id=eq." + cats.find(c=>c.slug==="frenchflies").id + "&limit=1"))[0];
const toItem = (r) => ({ id: r.id, category: slugOf[r.category_id] === "drink" ? "drink" : "food", subcategory: slugOf[r.category_id], name: r.name, nameEn: "", description: r.description ?? "", price: r.price, image: r.image_url ?? "", images: r.image_url ? [r.image_url] : [], media: r.image_url ? [{ type: "image", url: r.image_url }] : [], isTakeout: !!r.is_takeout });
const pancake = toItem(byId["c2594d09-5faf-4ac8-9618-29d474c29059"]);
const americano = toItem(byId["f5dd1e6c-c3b4-486e-ae85-c05a47a5ca5f"]);
const friesItem = toItem(fries);
const cartItems = [
  { item: pancake, quantity: 1, servingTiming: "after_meal" },
  { item: americano, quantity: 2, servingTiming: "first" },
  { item: friesItem, quantity: 1, servingTiming: null },
];
const cartState = { state: { items: cartItems, tableNumber: 1, tableId: null, tableLabel: "テーブル A-1", orderType: "dine_in", isTakeoutMode: false, orderHistory: [], hasOrdered: false, lastOrderId: null }, version: 0 };
const completeState = { state: { ...cartState.state, items: [], orderHistory: [cartItems], hasOrdered: true, lastOrderId: "00000000-0000-4000-8000-000000000001" }, version: 0 };
const historyEntry = [{ orderId: "00000000-0000-4000-8000-000000000001", orderedAt: new Date().toISOString(), tableNumber: 1, tableLabel: "テーブル A-1", orderType: "dine_in", totalAmount: 3300, status: "pending", items: cartItems.map(ci => ({ menuItemId: ci.item.id, name: ci.item.name, image: ci.item.image || null, quantity: ci.quantity, unitPrice: ci.item.price, servingTiming: ci.servingTiming })) }];

const SHOTS = [
  { name: "order-item-pancake", path: "/order?item=" + pancake.id, seed: { "orderly-cart": cartState }, wait: 1500, ready: "!!document.querySelector('[role=\"dialog\"] [role=\"radiogroup\"]')" },
  { name: "cart", path: "/cart", seed: { "orderly-cart": cartState }, wait: 1500, ready: "document.querySelectorAll('[role=\"radiogroup\"]').length >= 2" },
  { name: "complete", path: "/complete", seed: { "orderly-cart": completeState, "yorkys_order_history": historyEntry }, wait: 1500, ready: "document.body.innerText.includes('ご注文内容') && document.body.innerText.includes('食後')" },
  { name: "history", path: "/history", seed: { "orderly-cart": completeState, "yorkys_order_history": historyEntry }, wait: 1500, ready: "document.body.innerText.includes('食後')" },
  { name: "dev-ui", path: "/dev/ui", seed: {}, wait: 1500, scrollTo: "提供タイミング", ready: "!!document.querySelector('[role=\"radiogroup\"]')" },
];
const SIZES = [ { tag: "pc-1400", w: 1400, h: 900, scale: 1, mobile: false }, { tag: "sp-390", w: 390, h: 844, scale: 2, mobile: true } ];

// ── Chrome 起動 ──
const chrome = spawn(BIN, ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); } }

let seq = 0;
async function withTab(fn) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const pending = new Map(); const events = [];
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d); });
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const waitEvent = async (name, ms) => { const until = Date.now() + ms; while (Date.now() < until) { const i = events.findIndex(e => e.method === name); if (i >= 0) { events.splice(0, i + 1); return true; } await sleep(50); } return false; };
  try { await fn({ send, waitEvent }); } finally { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); }
}

for (const shot of SHOTS) for (const size of SIZES) {
  await withTab(async ({ send, waitEvent }) => {
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: size.w, height: size.h, deviceScaleFactor: size.scale, mobile: size.mobile });
    if (size.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await send("Page.navigate", { url: ORIGIN + "/order" });
    await waitEvent("Page.loadEventFired", 90000);
    const originCheck = await send("Runtime.evaluate", { expression: "location.origin", returnByValue: true });
    if (!String(originCheck.result?.result?.value || "").startsWith("http://localhost:3000")) throw new Error("origin mismatch: " + JSON.stringify(originCheck.result));
    const seedJs = Object.entries(shot.seed).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join("") + "localStorage.setItem('orderly_kitchen_ack','[]'); true;";
    await send("Runtime.evaluate", { expression: seedJs });
    await send("Page.navigate", { url: ORIGIN + shot.path });
    await waitEvent("Page.loadEventFired", 90000);
    const waitFor = async (expr, ms) => { const until = Date.now() + ms; while (Date.now() < until) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); if (r.result?.result?.value) return true; await sleep(250); } return false; };
    const styled = await waitFor("document.readyState === 'complete' && document.styleSheets.length > 0 && /Noto|Barlow/.test(getComputedStyle(document.body).fontFamily + [...document.querySelectorAll('h1,h2,p')].map(e=>getComputedStyle(e).fontFamily).join(' '))", 60000);
    const ready = await waitFor(shot.ready, 60000);
    console.log(shot.name, size.tag, "styled:", styled, "ready:", ready);
    await sleep(shot.wait);
    if (shot.scrollTo) {
      await send("Runtime.evaluate", { expression: `(() => { const h = [...document.querySelectorAll('h2')].find(e => e.textContent.includes(${JSON.stringify(shot.scrollTo)})); if (h) h.scrollIntoView({ block: 'start' }); return !!h; })()` });
      await sleep(800);
    }
    const { result } = await send("Page.captureScreenshot", { format: "png" });
    const file = `${OUT}/${shot.name}-${size.tag}.png`;
    writeFileSync(file, Buffer.from(result.data, "base64"));
    console.log("saved", file);
  });
}
chrome.kill();
