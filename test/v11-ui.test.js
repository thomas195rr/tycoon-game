// v11 browser checks: ads preview, law firm making money, compact real-estate list, personal lawyer, property manager training.
// NODE_PATH=/path/to/node_modules node test/v11-ui.test.js [--width 375] [--shots dir] [--url u]
const path = require('path'); const puppeteer = require('puppeteer-core'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = Number(arg('width', 375)); const SHOTS = arg('shots', null);
const URL = arg('url', 'file://' + path.join(__dirname, '..', 'index.html'));
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL: ' + msg); } else console.log('  ok  ' + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: W, height: 900 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (n, sel, off) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.evaluate((s, o) => { document.querySelectorAll('.toast').forEach((t) => t.remove()); const el = s && document.querySelector(s); if (el) el.scrollIntoView({ block: o > 100 ? 'center' : 'start' }); window.scrollBy(0, -(o || 60)); }, sel || null, off || 60); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const noSide = async (what) => ok(await page.evaluate((w) => document.documentElement.scrollWidth <= w + 1, W), `${what}: no sideways scroll`);
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); return TG.IDB && TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  ok(await page.evaluate(() => TG.VERSION === 11), 'game version 11');
  if (URL.startsWith('http')) ok(await page.evaluate(async () => { const t = await (await fetch('sw.js', { cache: 'no-store' })).text(); return /tycoon-app-v11/.test(t); }), 'live sw.js cache is tycoon-app-v11');
  await page.click('[data-act="newGame"][data-arg="classic"]'); await sleep(300);
  // ---- law firm from a normal start, 12 months ----
  const law = await page.evaluate(() => {
    TG.G = TG.Game.newGame({ seed: 3, scenario: 'classic' }); const g = TG.G; g.listings.push(TG.P.gen(g, TG.P.idealFor('law'))); let r = { ok: false, msg: 'no place' };
    const cands = g.listings.filter((p) => TG.P.suit(p, 'law') >= 0.45).sort((a, b) => (a.rent || a.price) - (b.rent || b.price));
    for (const p of cands) { const snap = TG.Game.serialize(g); const a = TG.P.acquire(g, p.id, 'lease'); if (!a.ok) continue; r = TG.B.start(g, 'law', p.id, {}); if (r.ok) break; const o = JSON.parse(snap); for (const k of Object.keys(g)) delete g[k]; Object.assign(g, o); }
    if (!r.ok) return { err: r.msg || 'start failed', cash: g.cash };
    const b = r.biz; TG.B.quickSetup(g, b, true, 'starter'); const c0 = g.cash; for (let i = 0; i < 12; i++) { TG.Game.nextMonth(g); for (const d of (g.decisions || []).slice()) { const c = TG.D.choose(g, d, { p: 0.92, e: { trait: 'steady' } }); if (c.opt != null) TG.D.resolve(g, d, c.opt, null); } }
    const h = b.hist.slice(-3); TG.UI.bizId = b.id; TG.UI.tab.biz = 'overview'; TG.UI.go('bizd'); return { id: b.id, profit: h.reduce((s, x) => s + x.profit, 0) / h.length, closed: !!b.closed, cash0: c0, cash: g.cash };
  });
  ok(law.id && !law.closed && law.profit > 0, `law firm from a classic start is making money after a year (${Math.round(law.profit || 0)}/mo, ${law.err || ''})`);
  await sleep(150); await shot('shots11-law-firm-making-money'); await noSide('law overview');
  // ---- ads: pick type, target, budget, see the preview ----
  await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); b.rep = 20; TG.UI.tab.biz = 'mkt'; TG.UI.render(); }); await sleep(150);
  ok(await page.evaluate(() => document.getElementById('adCh').options.length === 4 && document.getElementById('adTg').options.length >= 3), 'ads: 4 ad types and a "who sees it" choice');
  await page.select('#adCh', 'search'); await page.evaluate(() => { const el = document.getElementById('adBudget'); el.value = '2500'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200);
  const pv = await page.evaluate(() => (document.getElementById('adPrevRes') || {}).innerText || '');
  ok(/2,500|2\.5k/.test(pv) && /Extra served[^+]*\+[1-9]/.test(pv) && /Extra sales\s*\+\$[1-9]/.test(pv) && /(✅|❌|⏳)/.test(pv), `ads preview shows extra customers, sales and payback (${pv.replace(/\s+/g, ' ').slice(0, 140)})`);
  await page.select('#adCh', 'flyers'); await sleep(150); const pv2 = await page.evaluate(() => (document.getElementById('adPrevRes') || {}).innerText || ''); ok(pv2 !== pv, 'preview changes with the ad type');
  await shot('shots11-ads-preview', '#adCh'); await noSide('ads tab');
  // ---- real estate: compact rows, tap to expand ----
  const re = await page.evaluate(() => { const g = TG.G; g.cash = 3e7; for (const k of ['duplex', 'smallapt']) { const L = TG.RE.gen(g, k, { distressed: false }); g.re.listings.unshift(L); TG.RE.buy(g, L.id, false); } TG.Game.nextMonth(g); TG.Game.nextMonth(g); TG.UI.closeModal && TG.UI.closeModal(); TG.UI.tab.money = 're'; TG.UI.go('money');
    const rows = [...document.querySelectorAll('details.rerow')]; return { n: rows.length, h: g.re.holdings.length, sum: rows.map((r) => r.querySelector('summary').innerText), open: rows.filter((r) => r.open).length }; });
  ok(re.n === re.h && re.n >= 2, `one compact row per property (${re.n})`); ok(re.sum.every((s) => /🏷️/.test(s) && /📊/.test(s) && !/tenant/i.test(s)), `rows show only value and profit (${re.sum[0] && re.sum[0].replace(/\s+/g, ' ')})`); ok(re.open === 0, 'rows start collapsed');
  await shot('shots11-real-estate-list', 'details.rerow', 200);
  await page.click('details.rerow summary'); await sleep(150);
  ok(await page.evaluate(() => { const d = document.querySelector('details.rerow'); return d.open && /(Unit|tenant|Empty|empty)/.test(d.innerText); }), 'tapping a row shows its tenants and details');
  await page.evaluate(() => TG.UI.render()); ok(await page.evaluate(() => document.querySelector('details.rerow').open), 'expanded row stays open after the screen updates'); await noSide('real estate');
  // ---- property manager training ----
  await page.evaluate(() => { const g = TG.G; const c = TG.RE.managerPool(g)[0]; TG.RE.hireManager(g, c); g.re.manager.skill = 40; TG.UI.render(); });
  const rm = await page.evaluate(() => { const b = document.querySelector('[data-act="remDo"][data-arg="basic"]'); if (!b) return null; const pv = b.closest('.card').innerText; const s0 = TG.G.re.manager.skill; b.click(); return { s0, s1: TG.G.re.manager.skill, pv }; });
  ok(rm && rm.s1 > rm.s0, `property manager training raises skill (${rm && rm.s0} -> ${rm && rm.s1})`); ok(rm && /→ costs ×/.test(rm.pv), 'training shows its effect before buying');
  // ---- personal lawyer ----
  await page.evaluate(() => { TG.UI.closeModal && TG.UI.closeModal(); TG.UI.tab.money = 'fin'; TG.UI.go('money'); document.querySelector('[data-act="plaw"]').click(); }); await sleep(150);
  const lm = await page.evaluate(() => (document.getElementById('modal') || {}).innerText || '');
  ok(/\/mo/.test(lm) && /loan/i.test(lm) && /(claim|injury)/i.test(lm), 'lawyer modal shows the cost and perks before hiring'); await shot('shots11-lawyer-hire', '#modal');
  await page.evaluate(() => document.querySelector('#modal [data-act="plawGo"]').click()); await sleep(150);
  ok(await page.evaluate(() => !!TG.G.player.lawyer && /Your personal lawyer/.test(document.body.innerText)), 'lawyer hired, card shows on Finance');
  await shot('shots11-lawyer-card', '#lawyerCard'); await noSide('finance');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); console.log(fails ? `${fails} V11 UI CHECK(S) FAILED` : 'ALL V11 UI CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
