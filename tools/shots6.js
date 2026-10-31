// Phone-size (375px) screenshots of the v6 screens. NODE_PATH=/workspace/uitest/node_modules node tools/shots6.js
const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage(); await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await p.reload();
  await p.addStyleTag({ content: '.toast{display:none!important}' }); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="rich"]');
  const out = (n) => path.join(__dirname, n);
  const clean = () => p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  const snap = async (file) => { await clean(); await p.screenshot({ path: out(file) }); console.log('saved', file); };
  const toCard = (re, off) => p.evaluate((re, off) => { const h = [...document.querySelectorAll('.card h3, .modal h3, .modal h2, h3')].find((x) => new RegExp(re).test(x.textContent)); if (h) { h.closest('.card, .modal, div').scrollIntoView({ block: 'start' }); window.scrollBy(0, -(off || 0)); const m = document.querySelector('.modal .body, .modal'); if (m && m.contains(h)) h.scrollIntoView({ block: 'start' }); } return !!h; }, re, off || 0);
  // a cow + crop farm and a carwash with history
  await p.evaluate(() => {
    const g = TG.G, M = TG.M; g.cash = 2e7;
    const pr = TG.P.gen(g, TG.P.idealFor('farm')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'lease');
    const b = TG.B.start(g, 'farm', pr.id, { ent: 'mixed' }).biz; TG.B.quickSetup(g, b, true, 'standard'); b.name = 'Green Acres';
    M.farmBuyCattle(g, b, 3, 'bull'); M.farmBuyFeed(g, b, 400, 'You');
    const pc = TG.P.gen(g, TG.P.idealFor('carwash')); g.listings.unshift(pc); TG.P.acquire(g, pc.id, 'cash');
    const c = TG.B.start(g, 'carwash', pc.id, {}).biz; TG.B.quickSetup(g, c, true, 'standard'); c.name = 'Sparkle Wash';
    for (let i = 0; i < 4; i++) { M.farmBuyFeed(g, b, 200, 'You'); TG.ST.buy(g, c, TG.ST.suggest(c, g) || 3000); TG.Game.nextMonth(g); }
    TG.S.hireBest ? TG.S.hireBest(g, c, 'mech') : null;
    const cand = TG.S.candidate(g, c, 'mech', 0.7); TG.S.hire ? TG.S.hire(g, c, cand) : c.staff.push(cand);
    if (c.equip[0]) c.equip[0].broken = 'broken';
    TG.ST.buy(g, c, TG.ST.suggest(c, g) || 3000); TG.Game.nextMonth(g); TG.UI.closeModal();
    window.__farm = b.id; window.__wash = c.id;
  });
  const biz = async (id, tab) => p.evaluate((id, tab) => { TG.UI.closeModal(); TG.UI.bizId = window[id]; TG.UI.screen = 'bizd'; TG.UI.tab.biz = tab; TG.UI.render(); window.scrollTo(0, 0); }, id, tab);
  // 1) Industry Outlook
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.go('ind'); window.scrollTo(0, 0); }); await snap('shot6-industry.png');
  // 2) cow herd + stages + feed (Now tab), and the See-all-cows detail
  await biz('__farm', 'over'); await p.evaluate(() => { const r = [...document.querySelectorAll('.irow .lb')].find((x) => /^Herd/.test(x.textContent.trim())); if (r) { r.scrollIntoView({ block: 'start' }); window.scrollBy(0, -130); } }); await snap('shot6-cows.png');
  await p.evaluate(() => TG.UI.A.detail('stock')); await new Promise((r) => setTimeout(r, 150)); await snap('shot6-cows-all.png');
  // 3) crop area with spray
  await biz('__farm', 'model'); await toCard('Crop area', 10); await snap('shot6-crops-spray.png');
  // 4) staff with a mechanic (carwash), 5) manager tab without auto-fix
  await biz('__wash', 'staff'); await toCard('Mechanic|Repair|Work vs', 10); await snap('shot6-staff-mechanic.png');
  await biz('__wash', 'mgr'); await toCard('Who follows', 10); await snap('shot6-manager.png');
  // 6) Reports tab
  await biz('__wash', 'rep'); await snap('shot6-reports.png');
  await biz('__wash', 'over'); await snap('shot6-now.png');
  // 7) credit & loan screen
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.money = 'fin'; TG.UI.go('money'); TG.UI.S.ln = { type: 'business', amount: 80000, term: 60 }; TG.UI.render(); window.scrollTo(0, 0); });
  await snap('shot6-credit.png'); await toCard('Borrow|Loan|Apply', 10); await snap('shot6-loan.png');
  // 8) finance payment preview (rental listing) and 9) tenant search accept/decline
  await p.evaluate(() => { const g = TG.G; TG.UI.closeModal(); const l = g.re.listings.find((x) => x.kind === 'house') || g.re.listings[0]; window.__lid = l.id; TG.UI.A.reFin(l.id); });
  await new Promise((r) => setTimeout(r, 150)); await snap('shot6-finance-preview.png');
  await p.evaluate(() => { const g = TG.G; TG.UI.closeModal(); const l = g.re.listings.find((x) => x.id === window.__lid); TG.RE.buy(g, l.id, false); const h = g.re.holdings[g.re.holdings.length - 1]; h.tenants = h.tenants.map(() => null); window.__hid = h.id; TG.UI.tab.money = 're'; TG.UI.go('money'); });
  await p.evaluate(() => { const h = [...document.querySelectorAll('h2, h3')].find((x) => /Your properties/.test(x.textContent)); if (h) { h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); } }); await snap('shot6-rentals.png');
  await p.evaluate(() => TG.UI.A.reSearch(window.__hid)); await new Promise((r) => setTimeout(r, 150)); await snap('shot6-tenant-search.png');
  await p.evaluate(() => { const g = TG.G; const h = g.re.holdings.find((x) => x.id === window.__hid); let r; for (let i = 0; i < 6; i++) { r = TG.RE.search(g, h.id); if (r.ok && r.n >= 2) break; } TG.UI.A.reSearch(window.__hid); });
  await new Promise((r) => setTimeout(r, 150)); await snap('shot6-tenant-applicant.png');
  console.log(errs.join('\n') || 'no page errors'); await br.close();
})();
