// v10 browser checks ("how it should work"), phone (375) and desktop widths:
//  dry-cow row with exactly 1 dry cow, new rentals empty with a rent per unit, upgrades with payback, cost before you buy,
//  play time on Home, machine care + insurance on Gear, ads preview, takeover start, failing-business new game, casino limits gone,
//  bonus preview. NODE_PATH=/path/to/node_modules node test/v10-ui.test.js [--width 375] [--shots dir]
const path = require('path'); const puppeteer = require('puppeteer-core'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = Number(arg('width', 375)); const SHOTS = arg('shots', null);
const URL = arg('url', 'file://' + path.join(__dirname, '..', 'index.html'));
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL: ' + msg); } else console.log('  ok  ' + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage(); await page.setViewport({ width: W, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (n, sel) => {
    if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
    await page.evaluate((s) => { document.querySelectorAll('.toast').forEach((t) => t.remove()); const el = s && document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }, sel || null);
    await page.screenshot({ path: path.join(SHOTS, n + '.png') });
  };
  const noSide = async (what) => ok(await page.evaluate((w) => document.documentElement.scrollWidth <= w + 1, W), `${what}: no sideways scroll`);
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); return TG.IDB && TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  // ---- failing-business new game option ----
  ok(await page.evaluate(() => !!document.querySelector('[data-act="newGame"][data-arg="failing"]') && document.getElementById('ngFail').options.length === 18), 'new game: "Take over a failing business" with all 18 types');
  await page.select('#ngFail', 'gym'); await page.click('[data-act="newGame"][data-arg="failing"]'); await sleep(300);
  ok(await page.evaluate(() => TG.G.scenario === 'failing' && TG.G.businesses.length === 1 && TG.G.businesses[0].type === 'gym' && TG.G.businesses[0].rep < 30), 'failing gym game started on its business screen');
  // ---- play time ----
  await page.evaluate(() => { TG.G.playBefore = 30; TG.UI.go('home'); }); await sleep(100);
  const pt = await page.evaluate(() => (document.getElementById('playTime') || {}).innerText || '');
  ok(/Play time: 2 yrs 6 mo/.test(pt) && /v10/.test(pt), `Home shows play time in game years + version (${pt.slice(0, 80)})`); await shot('v10-playtime', '#playTime'); await noSide('home');
  // ---- set up a rich game with a cow farm, a cafe and a rental ----
  await page.evaluate(() => { TG.UI.A.newGameOpen(); }); await page.click('#modal [data-act="newGame"][data-arg="rich"]'); await sleep(300);
  const ids = await page.evaluate(() => {
    const g = TG.G; g.cash = 2e7; const mk = (type, opts) => { const p = TG.P.gen(g, TG.P.idealFor(type)); g.listings.push(p); TG.P.acquire(g, p.id, 'lease'); const r = TG.B.start(g, type, p.id, opts || {}); TG.B.quickSetup(g, r.biz, true, 'standard'); return r.biz; };
    const farm = mk('farm', { ent: 'cows' }); const cafe = mk('cafe');
    for (let i = 0; i < 3; i++) { TG.ST.buy(g, cafe, 3000, 0); TG.Game.nextMonth(g); }
    const a = farm.farm.areas.cows; for (const k of TG.M.cowStages) a.st[k] = a.st[k] || 0; a.st.dry = 1; TG.M.herdSync(a);
    return { farm: farm.id, cafe: cafe.id };
  });
  // ---- 1. dry cow row with exactly 1 dry cow ----
  await page.evaluate((id) => { TG.UI.bizId = id; TG.UI.tab.biz = 'overview'; TG.UI.go('bizd'); }, ids.farm); await sleep(150);
  const dry = await page.evaluate(() => { const rows = [...document.querySelectorAll('.irow')]; const i = rows.findIndex((r) => /Dry \/ old cows/.test(r.innerText)); const j = rows.findIndex((r) => /Market-ready/.test(r.innerText)); const r = rows[i]; return { i, j, txt: r ? r.innerText : '', sell: !!(r && r.querySelector('[data-act="cowSell"][data-arg="dry"]')), q: (document.getElementById('qDry') || {}).value, vis: r ? r.getBoundingClientRect().width > 0 : false }; });
  ok(dry.i >= 0 && dry.i === dry.j + 1, `Dry cows row right under Market-ready (rows ${dry.j} -> ${dry.i})`); ok(/\b1\b/.test(dry.txt) && dry.sell && dry.q === '1' && dry.vis, `row shows 1 dry cow with a Sell control (${dry.txt.replace(/\s+/g, ' ').slice(0, 60)})`);
  ok(await page.evaluate(() => /💵 Sell: 1 ×/.test((document.getElementById('cl_qDry') || {}).innerText || '')), 'dry cow row shows what selling 1 brings');
  await shot('v10-dry-cow-row', '#cl_qFeed'); await noSide('farm Now');
  await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); b.farm.areas.cows.st.dry = 0; TG.UI.render(); });
  ok(await page.evaluate(() => [...document.querySelectorAll('.irow')].some((r) => /Dry \/ old cows/.test(r.innerText) && /\b0\b/.test(r.innerText))), 'Dry cows row still shown at 0');
  await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); const a = b.farm.areas.cows; a.st.dry = 1; TG.M.herdSync(a); TG.UI.A.cowSell('dry'); });
  ok(await page.evaluate(() => Math.floor(TG.B.get(TG.G, TG.UI.bizId).farm.areas.cows.st.dry || 0) === 0), 'Sell on the dry row sells the 1 dry cow');
  // ---- 13. cost before buy: feed + supplies, live ----
  const feed0 = await page.evaluate(() => (document.getElementById('cl_qFeed') || {}).innerText || '');
  await page.evaluate(() => { const el = document.getElementById('qFeed'); el.value = '10'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const feed1 = await page.evaluate(() => (document.getElementById('cl_qFeed') || {}).innerText || ''); const fp = await page.evaluate(() => TG.U.money(TG.M.feedPrice(TG.G) * 10));
  ok(/🧾 Buy: .* × .* =/.test(feed0) && feed1.includes('10 ×') && feed1.includes(fp), `feed: price each and total, updates as you type (${feed1})`);
  await page.evaluate((id) => { TG.UI.bizId = id; TG.UI.tab.biz = 'overview'; TG.UI.go('bizd'); }, ids.cafe); await sleep(150);
  const sup = await page.evaluate(() => { const el = document.getElementById('qSup'); el.value = '250'; el.dispatchEvent(new Event('input', { bubbles: true })); const b = TG.B.get(TG.G, TG.UI.bizId); return { t: (document.getElementById('cl_qSup') || {}).innerText || '', want: TG.U.money(250 * TG.ST.unitCost(TG.G, b)) }; });
  ok(sup.t.includes('250 ×') && sup.t.includes(sup.want), `supplies: 250 × each = ${sup.want} (${sup.t})`); await shot('v10-cost-before-buy', '#qSup'); await noSide('cafe Now');
  // ---- 12. upgrades with payback ----
  await page.evaluate(() => { TG.UI.tab.biz = 'upg'; TG.UI.render(); }); await sleep(100);
  const up = await page.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); const cards = [...document.querySelectorAll('.upgcard')]; return { n: cards.length, want: TG.B.def(b).fixes.length, pay: cards.filter((c) => /📈/.test(c.innerText) && /(pays back|pays from|does not pay)/.test(c.innerText)).length, price: cards.filter((c) => /💵/.test(c.innerText)).length, tab: [...document.querySelectorAll('.tabs .btn')].some((x) => /Upgrades/.test(x.innerText)) }; });
  ok(up.n === up.want && up.n >= 9, `cafe: all ${up.want} upgrades listed`); ok(up.pay === up.n && up.price === up.n, `every upgrade shows its price and payback (${up.pay}/${up.n})`); ok(up.tab, 'tab is called Upgrades');
  await shot('v10-upgrades-payback', 'main .card'); await noSide('upgrades');
  // ---- ads: preview + measured effect ----
  await page.evaluate(() => { TG.UI.tab.biz = 'mkt'; TG.UI.render(); }); await sleep(100);
  const ad = await page.evaluate(() => { const el = document.getElementById('adBudget'); el.value = '2000'; el.dispatchEvent(new Event('input', { bubbles: true })); return (document.getElementById('adPrevBox') || {}).innerText || ''; });
  ok(/\$2,000\/mo ≈ \+\d+%/.test(ad), `ads: what a budget would do, before saving (${ad.slice(0, 90)})`);
  await page.evaluate(() => { TG.UI.A.adSave(); TG.Game.nextMonth(TG.G); TG.UI.render(); });
  ok(await page.evaluate(() => /Last month \(\$2,000\)/.test(document.querySelector('main').innerText) && /\+[\d,]+ customers/.test(document.querySelector('main').innerText)), 'ads: measured extra customers from last month');
  ok(await page.evaluate(() => /Your customers/.test(document.querySelector('main').innerText)), 'ads: the business\'s own customers shown');
  // ---- 6. machine care + insurance on Gear ----
  await page.evaluate(() => { TG.UI.tab.biz = 'equip'; TG.UI.render(); }); await sleep(100);
  const gear = await page.evaluate(() => { const t = document.querySelector('main').innerText; return { care: /Machines cared for/.test(t), ins: /Machine insurance/.test(t), plan: /Maintenance plan|Plan \$/.test(t), like: !!document.querySelector('[data-act="ordLike"]') || /you decide/.test(t) }; });
  ok(gear.care && gear.ins && !gear.plan && gear.like, 'Gear: machines cared for, machine insurance, no maintenance plans, replacement rule');
  await page.evaluate(() => { document.querySelector('[data-act="ins"][data-arg="equipment"]').click(); }); await sleep(100);
  ok(await page.evaluate(() => TG.B.get(TG.G, TG.UI.bizId).ins.equipment === true), 'machine insurance can be bought'); await shot('v10-machine-care-insurance', 'main .card h3'); await noSide('gear');
  // ---- mechanic candidates show machines, not cows ----
  await page.evaluate((id) => { TG.UI.bizId = id; TG.UI.S.hireRole = 'mech'; TG.UI.tab.biz = 'staff'; TG.UI.render(); }, ids.farm); await sleep(100);
  const mech = await page.evaluate(() => document.querySelector('main').innerText);
  ok(/cares for ~\d+ machines/.test(mech) && !/work pts[^\n]*cows[^\n]*\n[^\n]*mechanic/i.test(mech), 'farm mechanic candidates: machines cared for');
  // ---- GM vs Ops ----
  await page.evaluate(() => { TG.UI.tab.biz = 'mgr'; TG.UI.render(); });
  ok(await page.evaluate(() => /GM or Ops manager\?/.test(document.querySelector('main').innerText)), 'Manager tab explains GM vs Ops');
  // ---- 2. bonus preview ----
  await page.evaluate((id) => { TG.UI.bizId = id; const b = TG.B.get(TG.G, id); TG.UI.A.emp(b.staff[0].id); }, ids.cafe); await sleep(100);
  ok(await page.evaluate(() => /loyalty \d+ → \d+/.test((document.getElementById('bonusPrev') || {}).innerText || '')), 'worker card: bonus raises loyalty, lowers poach odds');
  await page.evaluate(() => TG.UI.closeModal());
  // ---- 9. rentals: empty on purchase, rent per unit ----
  const hid = await page.evaluate(() => { const g = TG.G; const l = g.re.listings.filter((x) => x.units > 1 && x.units <= 12 && !x.distressed).sort((a, b) => a.price - b.price)[0] || g.re.listings.find((x) => x.units > 1); const r = TG.RE.buy(g, l.id, false); TG.UI.tab.money = 're'; TG.UI.go('money'); return r.h.id; });
  await sleep(150);
  const re = await page.evaluate((hid) => { const h = TG.G.re.holdings.find((x) => x.id === hid); return { units: h.units, empty: h.tenants.filter((t) => !t).length, sels: document.querySelectorAll('select.usel').length, txt: document.querySelector('main').innerText }; }, hid);
  ok(re.empty === re.units, `new rental: all ${re.units} units empty`); ok(!/not renting/.test(re.txt), 'ready to rent'); ok(re.sels >= re.units, `a rent picker on every empty unit (${re.sels})`);
  await page.evaluate(() => { const s = document.querySelectorAll('select.usel')[1]; s.selectedIndex = s.options.length - 3; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(100);
  const re2 = await page.evaluate((hid) => { const h = TG.G.re.holdings.find((x) => x.id === hid); return { r: h.unitR && h.unitR[1], r0: h.unitR && h.unitR[0], txt: document.querySelector('main').innerText }; }, hid);
  ok(re2.r > 1.05 && re2.r0 == null, `unit 2 has its own rent (${re2.r}), unit 1 unchanged`); ok(/Rents set per unit = \$[\d,]+\/mo when full/.test(re2.txt), 'total rent when full shown');
  await shot('v10-rental-per-unit', 'details.grp'); await noSide('real estate');
  // ---- 11. casino: no limits ----
  await page.evaluate(() => { TG.G.settings.gambling = true; TG.UI.tab.money = 'casino'; TG.UI.render(); });
  ok(await page.evaluate(() => !/Bets left/.test(document.querySelector('main').innerText) && /none \(bet any amount/.test(document.querySelector('main').innerText)), 'casino: no table limit, no bets-left counter');
  // ---- 4. take over a struggling business from the start dialog ----
  await page.evaluate(() => { const g = TG.G; const p = TG.P.gen(g, TG.P.idealFor('salon')); g.listings.push(p); TG.P.acquire(g, p.id, 'lease'); TG.UI.startDialog(p.id, 'salon'); }); await sleep(200);
  await page.select('#stHow', 'take'); await sleep(200);
  ok(await page.evaluate(() => /Price \(cash today\)/.test((document.getElementById('stTakeBox') || {}).innerText || '')), 'start dialog: takeover price, debt and condition shown');
  const n0 = await page.evaluate(() => TG.G.businesses.length); await page.click('#modal [data-act="startGo"]'); await sleep(300);
  ok(await page.evaluate((n0) => TG.G.businesses.length === n0 + 1 && !!TG.G.businesses[n0].takeover, n0), 'took over a struggling salon');
  // ---- saves still work ----
  ok(await page.evaluate(() => TG.UI.save() !== false), 'game saves');
  ok(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  console.log(fails ? `${fails} V10 UI CHECK(S) FAILED` : 'ALL V10 UI CHECKS PASSED');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
