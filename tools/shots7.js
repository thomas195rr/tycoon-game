// Phone-size (375px) screenshots of the v7 screens. NODE_PATH=/workspace/uitest/node_modules node tools/shots7.js
const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage(); await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await p.reload();
  await p.addStyleTag({ content: '.toast{display:none!important}' }); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="rich"]');
  const out = (n) => path.join(__dirname, n);
  const snap = async (file) => { await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await p.screenshot({ path: out(file) }); console.log('saved', file); };
  const scrollTo = (re) => p.evaluate((re) => { const el = [...document.querySelectorAll('h3, h2, summary, b')].find((x) => new RegExp(re).test(x.textContent)); if (el) el.scrollIntoView({ block: 'start' }); return !!el; }, re);
  await p.evaluate(() => {
    const g = TG.G; g.cash = 3e6;
    const pc = TG.P.gen(g, TG.P.idealFor('cafe')); g.listings.unshift(pc); TG.P.acquire(g, pc.id, 'mortgage');
    const c = TG.B.start(g, 'cafe', pc.id, {}).biz; TG.B.quickSetup(g, c, true, 'standard'); c.name = 'Corner Cafe';
    const L = TG.RE.gen(g, 'smallapt', { distressed: false }); g.re.listings.unshift(L); TG.RE.buy(g, L.id, true); const h = g.re.holdings.find((x) => x.id === L.id); h.name = 'Maple Apartments';
    h.tenants = h.tenants.map((t, i) => (i % 3 === 2 ? null : t));
    TG.F.takeLoan(g, 'business', 60000);
    for (let i = 0; i < 5; i++) { TG.ST.buy(g, c, TG.ST.suggest(c, g)); TG.Game.nextMonth(g); }
    if (!h.issues.length) TG.RE.addIssue(g, h, 0, 'Leaking pipe', 1400, false);
    const pb = TG.P.gen(g, TG.P.idealFor('bakery')); g.listings.unshift(pb); TG.P.acquire(g, pb.id, 'cash');
    const b = TG.B.start(g, 'bakery', pb.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); b.name = 'Sunrise Bakery'; b.stock.qty = 0; b.stock.lots = []; for (const k in b.spec) b.spec[k] = null; g.ceo = null;
    TG.ST.buy(g, c, TG.ST.suggest(c, g)); TG.Game.nextMonth(g); TG.ST.buy(g, c, TG.ST.suggest(c, g)); TG.Game.nextMonth(g);
    b.spec.hr = Object.assign(TG.S.candidate(g, b, 'hr', 0.6), { name: 'Pat Lee', skill: 75, skillSeen: 72 });
    TG.UI.closeModal(); window.__cafe = c.id; window.__bak = b.id; window.__apt = h.id;
  });
  // 1) money report (top) and who-made-what
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.go('home'); TG.UI.A.lastReport(); }); await snap('shot7-money-report.png');
  await p.evaluate(() => document.querySelectorAll('#modal details').forEach((d) => { d.open = true; }));
  if (await scrollTo('Money out')) await snap('shot7-money-out.png');
  if (await scrollTo('Who made')) await snap('shot7-money-who.png');
  // 2) loans list + loan detail
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.money = 'fin'; TG.UI.go('money'); }); await scrollTo('Your loans'); await snap('shot7-loans.png');
  await p.evaluate(() => { const l = TG.G.loans.find((x) => x.type === 'business') || TG.G.loans[0]; TG.UI.A.loanView(l.id); }); await snap('shot7-loan-detail.png');
  await p.evaluate(() => document.querySelectorAll('#modal details').forEach((d) => { d.open = true; })); if (await scrollTo('schedule')) await snap('shot7-loan-schedule.png');
  // 3) apartment units
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.money = 're'; TG.UI.go('money'); }); await p.evaluate(() => document.querySelectorAll('details.units, details').forEach((d) => { if (/Units/.test(d.textContent.slice(0, 80))) d.open = true; })); await scrollTo('Units:'); await p.evaluate(() => window.scrollBy(0, -330)); await snap('shot7-apartment-units.png');
  await p.evaluate(() => TG.UI.A.reSearch(window.__apt + '|' + TG.G.re.holdings.find((x) => x.id === window.__apt).tenants.findIndex((t) => !t))); await snap('shot7-unit-search.png');
  // 4) closed shop
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.bizId = window.__bak; TG.UI.screen = 'bizd'; TG.UI.tab.biz = 'overview'; TG.UI.render(); window.scrollTo(0, 0); }); await snap('shot7-closed-shop.png');
  // 5) HR hiring
  await p.evaluate(() => { TG.UI.tab.biz = 'staff'; TG.UI.render(); const h = document.getElementById('hireCard'); if (h) h.scrollIntoView({ block: 'start' }); }); await snap('shot7-hr-hiring.png');
  await p.evaluate(() => window.scrollBy(0, 600)); await snap('shot7-hr-candidates.png');
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors'); await br.close();
})();
