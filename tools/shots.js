// Phone-size screenshots of the v4 screens: crime, forecast card, hiring.  NODE_PATH=... node tools/shots.js
const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage(); await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await p.reload();
  await p.addStyleTag({ content: '.toast{display:none!important}' }); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="rich"]');
  const out = (n) => path.join(__dirname, n);
  // a cafe with a few months of history
  await p.evaluate(() => { const g = TG.G; g.cash = 2e6; const pr = TG.P.gen(g, TG.P.idealFor('cafe')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'cash'); const s = TG.B.start(g, 'cafe', pr.id, {}); TG.B.quickSetup(g, s.biz, true, 'standard'); });
  await p.evaluate(() => { const g = TG.G, CR = TG.CR; CR.withdraw(g, 60000); CR.buy(g, 'plug', 'sugar', 500); for (const k of CR.candidates(g).filter((c) => c.role === 'dealer').slice(0, 2)) CR.hire(g, k.id); for (let i = 0; i < 5; i++) TG.Game.nextMonth(g); TG.UI.closeModal(); });
  await p.evaluate(() => { TG.UI.tab.crime = 'home'; TG.UI.go('crime'); }); await (await p.evaluate(() => { document.querySelectorAll('.toast').forEach((t) => t.remove()); }), p.screenshot({ path: out('shot-crime.png') }));
  await p.evaluate(() => { TG.UI.tab.crime = 'goods'; TG.UI.render(); window.scrollTo(0, 0); }); await p.screenshot({ path: out('shot-crime-goods.png') });
  await p.evaluate(() => { const b = TG.G.businesses[0]; TG.UI.bizId = b.id; TG.UI.tab.biz = 'overview'; TG.UI.screen = 'bizd'; TG.UI.render(); });
  await p.evaluate(() => { const el = [...document.querySelectorAll('.card h3')].find((h) => /Next month/i.test(h.textContent)); if (el) { el.closest('.card').scrollIntoView(); let s = el.parentElement; while (s && s.scrollHeight <= s.clientHeight + 2) s = s.parentElement; (s || document.scrollingElement).scrollTop -= 110; } });
  await p.setViewport({ width: 375, height: 2600, deviceScaleFactor: 2 }); { const r = await p.evaluate(() => { const hs = [...document.querySelectorAll('.card h3')]; const a = hs.find((x) => /Next month forecast/.test(x.textContent)).closest('.card'); const v = hs.find((x) => /forecast vs actual/.test(x.textContent)); const z = (v ? v.closest('.card') : a); const ra = a.getBoundingClientRect(), rz = z.getBoundingClientRect(); return { x: 0, y: ra.top + window.scrollY - 6, width: 375, height: rz.bottom - ra.top + 12, has: !!v }; }); console.log('vs-actual card:', r.has); delete r.has; await p.screenshot({ path: out('shot-forecast.png'), clip: r }); } await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await p.evaluate(() => { TG.UI.tab.biz = 'staff'; TG.UI.render(); const el = [...document.querySelectorAll('.card h3')].find((h) => /^Hire/.test(h.textContent)); if (el) { el.closest('.card').scrollIntoView(); let s = el.parentElement; while (s && s.scrollHeight <= s.clientHeight + 2) s = s.parentElement; (s || document.scrollingElement).scrollTop -= 110; } });
  await (await p.evaluate(() => { document.querySelectorAll('.toast').forEach((t) => t.remove()); }), p.screenshot({ path: out('shot-hiring.png') }));
  console.log(errs.join('\n') || 'shots saved'); await br.close();
})();
