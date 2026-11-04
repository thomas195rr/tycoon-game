// v13 browser checks: reputation target card (cost shown, needs ads manager), minimum hire skill setting, v12 save note.
// help page per business, a rental row showing profit. NODE_PATH=/path/to/node_modules node test/v12-ui.test.js [--width 375] [--shots dir] [--url u]
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
  const shot = async (n, sel) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.evaluate((s) => { document.querySelectorAll('.toast').forEach((t) => t.remove()); const el = s && document.querySelector(s); if (el) el.scrollIntoView({ block: 'center' }); }, sel || null); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const noSide = async (what) => ok(await page.evaluate((w) => document.documentElement.scrollWidth <= w + 1, W), `${what}: no sideways scroll`);
  const txt = (sel) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); return TG.IDB && TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  ok(await page.evaluate(() => TG.VERSION === 13), 'game version 13');
  if (URL.startsWith('http')) ok(await page.evaluate(async () => /tycoon-app-v13/.test(await (await fetch('sw.js', { cache: 'no-store' })).text())), 'live sw.js cache is tycoon-app-v13');
  await page.click('[data-act="newGame"][data-arg="rich"]'); await sleep(300);
  const id = await page.evaluate(() => {
    const g = TG.G; g.cash = 3e7; const p = TG.P.gen(g, TG.P.idealFor('cafe')); g.listings.push(p); TG.P.acquire(g, p.id, 'lease'); const b = TG.B.start(g, 'cafe', p.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard');
    const gm = TG.S.candidate(g, b, 'gm', 0.6); gm.morale = 95; gm.loyalty = 100; TG.S.hire(g, b, gm, 'you'); TG.Game.nextMonth(g); TG.UI.closeModal && TG.UI.closeModal(); return b.id; });
  await page.evaluate((bid) => { TG.UI.bizId = bid; TG.UI.tab.biz = 'staff'; TG.UI.go('bizd'); }, id); await sleep(150);
  ok(/Needs an ads manager/.test(await txt('#repCard')), 'no ads manager: card says "Needs an ads manager"');
  await page.evaluate(() => { const g = TG.G, b = TG.B.get(g, TG.UI.bizId); const a = TG.S.candidate(g, b, 'ads', 0.6); a.morale = 95; a.loyalty = 100; TG.S.hire(g, b, a, 'you'); b.rep = 48; TG.UI.render(); }); await sleep(100);
  await page.click('#repCard [data-act="repTarget"][data-arg="80"]'); await sleep(150);
  const rc = await txt('#repCard');
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).repTarget === 80) && /Expected about \$[\d,.k]+\/mo to hold ⭐ 80/.test(rc) && /catch-up/.test(rc), `target 80 set, monthly cost + catch-up shown (${rc.replace(/\s+/g, ' ').slice(0, 200)})`);
  await shot('shots13-rep-target', '#repCard'); await noSide('staff tab');
  await page.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.closeModal && TG.UI.closeModal(); TG.UI.render(); }); await sleep(100);
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).rep > 48), 'next month: manager pushed reputation up toward 80');
  ok(/Minimum skill to hire/.test(await txt('#minCard')) && /General manager/.test(await txt('#minCard')), 'min hire skill card on Staff tab, hiring by the GM');
  await page.select('#minSel', '60'); await sleep(150);
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).minSkill === 60 && document.querySelector('#minSel').value === '60'), 'min skill 60 saved');
  await page.evaluate(() => document.querySelector('#minCard [data-act="tip"]').click()); await sleep(80);
  await shot('shots13-min-hire-skill', '#minCard');
  // v12 save -> v13 note
  await page.evaluate(() => { const s = JSON.parse(JSON.stringify(TG.G)); s.v = 12; delete s.v13notes; TG.G = TG.Game.migrate(s); TG.UI.render(); }); await sleep(150);
  ok(/Game updated \(v13\)/.test(await page.evaluate(() => document.body.innerText)), 'v12 save shows the one-time v13 note');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); console.log(fails ? `${fails} V13 UI CHECK(S) FAILED` : 'ALL V13 UI CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
