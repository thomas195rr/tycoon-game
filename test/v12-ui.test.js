// v12 browser checks: manager training card, CEO coaching, GM job-offer setting, CEO keeps managers hired, who orders supplies,
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
  ok(await page.evaluate(() => TG.VERSION >= 12), 'game version 12+');
  if (URL.startsWith('http')) ok(await page.evaluate(async () => /tycoon-app-v1[2-9]/.test(await (await fetch('sw.js', { cache: 'no-store' })).text())), 'live sw.js cache is tycoon-app-v12');
  await page.click('[data-act="newGame"][data-arg="rich"]'); await sleep(300);
  const id = await page.evaluate(() => {
    const g = TG.G; g.cash = 3e7; const p = TG.P.gen(g, TG.P.idealFor('salon')); g.listings.push(p); TG.P.acquire(g, p.id, 'lease'); const b = TG.B.start(g, 'salon', p.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard');
    const gm = TG.S.candidate(g, b, 'gm', 0.6); gm.morale = 95; gm.loyalty = 100; TG.S.hire(g, b, gm, 'you'); TG.Game.nextMonth(g); TG.UI.closeModal && TG.UI.closeModal(); return b.id; });
  // ---- who orders supplies ----
  await page.evaluate((bid) => { TG.UI.bizId = bid; TG.UI.tab.biz = 'overview'; TG.UI.go('bizd'); }, id); await sleep(150);
  ok(/Ordering supplies: .*General manager/.test(await txt('#supWho')), `Now tab says who orders supplies (${(await txt('#supWho')).slice(0, 90)})`);
  // ---- manager training card ----
  await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); TG.UI.tab.biz = 'staff'; TG.UI.render(); TG.UI.A.emp(b.spec.gm.id); }); await sleep(150);
  const fx = await txt('#mgrTrainFx'); ok(/Right calls on decisions: \d+% now → about \d+%/.test(fx), `GM training shows its effect before paying (${fx.slice(0, 100)})`);
  ok(/Train \$/.test(await txt('#modal')) && /Bonus/.test(await txt('#modal')) && /\+\d+%/.test(await txt('#modal')), 'GM card has training, raise and bonus with costs');
  await shot('shots12-manager-training', '#mgrTrainFx');
  const sk = await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); const s0 = b.spec.gm.skill; document.querySelector('#modal [data-act="empDo"][data-arg$="|train"]').click(); return [s0, TG.B.get(TG.G, TG.UI.bizId).spec.gm.skill]; });
  ok(sk[1] >= sk[0], `training the GM keeps or raises skill (${Math.round(sk[0])} -> ${Math.round(sk[1])})`);
  // ---- GM job-offer setting + CEO keeps managers ----
  await page.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.biz = 'staff'; TG.UI.render(); }); await sleep(100);
  ok(await page.evaluate(() => document.querySelectorAll('#poachSel option').length === 4), 'job-offer setting has 4 choices');
  await page.select('#poachSel', 'replace'); await sleep(100);
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).poachPol === 'replace' && /hires someone new/.test(document.getElementById('poachTxt').innerText)), 'picking "let them go, hire a replacement" is saved and explained');
  ok(/Handled by .*General manager/.test(await txt('#poachCard')), 'shows who handles job offers');
  await shot('shots12-gm-poach-setting', '#poachCard'); await noSide('staff tab');
  ok(/Needs a CEO/.test(await txt('#keepCard')), 'CEO keep setting says it needs a CEO');
  await page.evaluate(() => { const g = TG.G; const c = TG.D.ceoPool(g)[0]; TG.D.hireCeo(g, c); TG.UI.render(); }); await sleep(100);
  await page.evaluate(() => { TG.UI.closeModal && TG.UI.closeModal(); document.querySelector('#keepCard [data-act="keepRole"][data-arg="hr"]').click(); }); await sleep(100);
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).keep.hr === true) && /✅/.test(await txt('#keepCard')), 'tapping HR manager marks it to keep hired');
  await shot('shots12-ceo-hiring-setting', '#keepCard');
  await page.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.closeModal && TG.UI.closeModal(); TG.UI.render(); });
  ok(await page.evaluate(() => !!TG.B.get(TG.G, TG.UI.bizId).spec.hr), 'next month the CEO hired an HR manager');
  // ---- CEO coaching ----
  await page.evaluate(() => { TG.UI.tab.more = 'mgr'; TG.UI.go('more'); }); await sleep(100);
  const cu = await txt('#ceoUp'); ok(/good calls \d+% → \d+%/.test(cu) && /Raise/.test(cu) && /Bonus/.test(cu), 'CEO card: coaching effect, raise and bonus shown with costs');
  const cs = await page.evaluate(() => { const s0 = TG.G.ceo.skill; document.querySelector('#ceoUp [data-act="ceoDo"][data-arg="basic"]').click(); return [s0, TG.G.ceo.skill]; }); ok(cs[1] > cs[0], 'coaching raised CEO skill');
  // ---- help page ----
  await page.evaluate(() => { TG.UI.tab.more = 'help'; TG.UI.tab.helpb = 'law'; TG.UI.go('more'); }); await sleep(100);
  const hp = await txt('#bizHelp'); ok(/How it makes money/.test(hp) && /Main costs/.test(hp) && /Managers that matter/.test(hp) && /Best first upgrades/.test(hp) && /Getting started/.test(hp), 'law help page: money, costs, risks, managers, upgrades, start plan');
  await shot('shots12-help-page', '#bizHelp'); await noSide('help');
  // ---- rental row with profit ----
  await page.evaluate(() => { const g = TG.G; const L = TG.RE.gen(g, 'duplex', { distressed: false }); g.re.listings.unshift(L); const h = TG.RE.buy(g, L.id, false).h;
    for (let i = 0; i < h.units; i++) { const t = TG.RE.newTenant(g, h); t.rent = TG.RE.marketRent(g, h); t.rel = 0.95; t.lease = 24; t.since = g.month; h.tenants[i] = t; }
    TG.Game.nextMonth(g); TG.Game.nextMonth(g); TG.UI.closeModal && TG.UI.closeModal(); TG.UI.tab.money = 're'; TG.UI.go('money'); });
  await sleep(150); const row = await page.evaluate(() => document.querySelector('details.rerow summary').innerText);
  ok(/🏷️/.test(row) && /📊 \+\$/.test(row), `rental row shows value and a profit (${row.replace(/\s+/g, ' ')})`);
  await shot('shots12-rental-row-profit', 'details.rerow');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); console.log(fails ? `${fails} V12 UI CHECK(S) FAILED` : 'ALL V12 UI CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
