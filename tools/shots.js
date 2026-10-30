// Phone-size (375px) screenshots of the v5 screens: land areas, staff tab, manager orders, an upgrade description.
//   NODE_PATH=... node tools/shots.js
const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage(); await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await p.reload();
  await p.addStyleTag({ content: '.toast{display:none!important}' }); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="rich"]');
  const out = (n) => path.join(__dirname, n);
  // a mixed farm (cows + crops) that later plants an orchard, with a few months of history
  await p.evaluate(() => {
    const g = TG.G, M = TG.M; g.cash = 2e7; const pr = TG.P.gen(g, TG.P.idealFor('farm')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'lease');
    const b = TG.B.start(g, 'farm', pr.id, { ent: 'mixed' }).biz; TG.B.quickSetup(g, b, true, 'standard'); b.name = 'Green Acres';
    M.farmBuyLand(g, b, 160, false); M.farmMove(g, b, 'free', 'orchard', 120);
    for (let i = 0; i < 5; i++) TG.Game.nextMonth(g);
    TG.E.buy(g, b, 'sprCrop', 'standard'); TG.E.buy(g, b, 'sprCrop', 'standard'); TG.E.buy(g, b, 'sprCow', 'standard');
    b.orders.spare = 0.1; TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.bizId = b.id; TG.UI.screen = 'bizd';
  });
  const at = async (tab, re, file, off) => {
    await p.evaluate((tab) => { TG.UI.tab.biz = tab; TG.UI.render(); window.scrollTo(0, 0); }, tab);
    await p.evaluate((re, off) => { const h = [...document.querySelectorAll('.card h3')].find((x) => new RegExp(re).test(x.textContent)); if (h) { h.closest('.card').scrollIntoView({ block: 'start' }); let s = h.parentElement; while (s && s.scrollHeight <= s.clientHeight + 2) s = s.parentElement; (s || document.scrollingElement).scrollTop -= off || 70; } }, re, off);
    await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await p.screenshot({ path: out(file) });
  };
  await at('model', 'acres', 'shot-land.png', 200);
  await at('model', 'Crop area', 'shot-land-crops.png', 10);
  await at('staff', 'Work vs your team', 'shot-staff.png', 130);
  await at('mgr', 'Farm orders', 'shot-manager.png', 10);
  await p.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); b.fixes.plant = { since: TG.G.month }; });
  await at('upg', 'Upgrades', 'shot-upgrades.png', 10);
  console.log(errs.join('\n') || 'shots saved'); await br.close();
})();
