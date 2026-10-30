// Coverage UI test: for every business type, open it in the browser and press every button on every tab once.
//   NODE_PATH=/path/to/node_modules node test/ui-cover.test.js [--width 375]
const path = require('path'); const puppeteer = require('puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = Number(arg('width', 375)); const SHOTS = arg('shots', null); const ONLY = arg('only', null);
const fs = require('fs'); const shot = async (page, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${W}-${n.replace(/[^a-z0-9]+/gi, '-')}.png`), fullPage: true }); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  await page.click('[data-act="newGame"][data-arg="rich"]');
  const types = (await page.evaluate(() => Object.keys(TG.CONFIG.businesses))).filter((t) => !ONLY || ONLY.split(',').includes(t));
  const SKIP = ['clearSave', 'clearGo', 'importSave', 'importGo', 'bk', 'bkGo', 'newGameOpen', 'newGame', 'copyCode', 'go', 'next', 'skip', 'bizSell', 'bizSellGo', 'bizClose', 'bizCloseGo', 'bizBk', 'bizBkGo', 'techPivotGo', 'goMoreTab', 'goMoneyTab'];
  let pressed = 0; const acts = new Set();
  const check = async (label) => {
    const r = await page.evaluate((w) => ({ over: document.documentElement.scrollWidth > w + 1 ? document.documentElement.scrollWidth : 0, bad: (document.body.innerText.match(/.{0,40}(Screen error|\bNaN\b|undefined|\[object Object\]|Infinity).{0,40}/) || [''])[0] }), W);
    if (r.over) errors.push(`${label}: overflow ${r.over}px`); if (r.bad) errors.push(`${label}: "${r.bad}"`);
  };
  const pressAll = async (label) => {
    const done = new Set();
    for (let guard = 0; guard < 120; guard++) {
      const next = await page.evaluate((skip, done) => { const els = [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => !skip.includes(x.dataset.act) && x.dataset.act !== 'tab' && x.offsetParent !== null); const el = els.find((x) => !done.includes(x.dataset.act + '|' + (x.dataset.arg || '').replace(/[a-z]\d+/g, '#'))); if (!el) return null; for (const i of document.querySelectorAll('input[type=number]')) if (!i.value && i.id !== 'skipN') i.value = '20'; return el.dataset.act + '|' + (el.dataset.arg || '').replace(/[a-z]\d+/g, '#'); }, SKIP, [...done]);
      if (!next) break; done.add(next);
      await page.evaluate((key) => { const els = [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => x.offsetParent !== null); const el = els.find((x) => x.dataset.act + '|' + (x.dataset.arg || '').replace(/[a-z]\d+/g, '#') === key); if (el) el.click(); }, next);
      pressed++; acts.add(next.split('|')[0]);
      await check(`${label} ${next}`);
      // modals: press their buttons too (once), then close
      const modal = await page.evaluate(() => !!document.getElementById('modal'));
      if (modal) { await page.evaluate(() => { const m = document.getElementById('modal'); const b = [...m.querySelectorAll('[data-act]')].find((x) => !['closeModal', 'decisions'].includes(x.dataset.act) && !x.disabled); if (b && !/Go$|newGame|clear|import|bk/.test(b.dataset.act)) b.click(); }); await check(label + ' modal'); await page.evaluate(() => TG.UI.closeModal()); await page.evaluate(() => TG.UI.render()); }
    }
  };
  for (const t of types) {
    // fresh property + business via the real start dialog
    await page.evaluate((t) => { const g = TG.G; g.cash = 2e8; const p = TG.P.gen(g, TG.P.idealFor(t)); g.listings.unshift(p); TG.UI.S.mkType = t; TG.UI.go('market'); }, t);
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="acq"]')].find((x) => x.dataset.arg.endsWith('|cash')); b.click(); });
    await page.click('[data-act="startGo"]');
    // a few months so panels fill in
    for (let i = 0; i < 3; i++) await page.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.closeModal(); TG.UI.render(); });
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-act="tab"]')].map((x) => x.dataset.arg));
    for (const tb of tabs) { await page.evaluate((tb) => { const i = tb.indexOf(':'); TG.UI.tab[tb.slice(0, i)] = tb.slice(i + 1); TG.UI.render(); }, tb); await check(t + ' ' + tb); await shot(page, t + ' ' + tb); await pressAll(t + ' ' + tb); }
  }
  // farm enterprises other than the default (crops / dairy / orchard rows, seed and grain buttons)
  for (const ent of ['crops', 'dairy', 'orchard', 'cattle']) {
    await page.evaluate((ent) => { const g = TG.G; g.cash = 2e8; const b = g.businesses.find((x) => x.type === 'farm'); TG.M.farmSwitch(g, b, ent); for (let i = 0; i < 4; i++) TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.bizId = b.id; TG.UI.tab.biz = 'overview'; TG.UI.screen = 'bizd'; TG.UI.render(); }, ent);
    await check('farm ' + ent); await shot(page, 'farm ' + ent); await pressAll('farm ' + ent);
    await page.evaluate(() => { TG.UI.tab.biz = 'model'; TG.UI.render(); }); await check('farm land ' + ent); await pressAll('farm land ' + ent);
  }
  for (const s of [['money', ['fin', 're', 'inv', 'casino']], ['more', ['mgr', 'news', 'log', 'ach', 'set', 'help']], ['home', [null]], ['biz', [null]]]) {
    for (const tb of s[1]) { await page.evaluate((s, tb) => { if (tb) TG.UI.tab[s] = tb; TG.UI.go(s); }, s[0], tb); await check(s[0] + ' ' + tb); await pressAll(s[0] + ' ' + tb); }
  }
  // crime screen: every tab, every button; then the same while in jail
  await page.evaluate(() => { const g = TG.G, CR = TG.CR; g.settings.crime = true; g.cash = 2e8; CR.withdraw(g, 60000); CR.buy(g, 'plug', 'sugar', 400); for (let i = 0; i < 3; i++) TG.Game.nextMonth(g); TG.UI.closeModal(); });
  for (const jail of [0, 4]) for (const tb of ['home', 'goods', 'crew', 'turf', 'clean', 'jobs', 'law']) {
    await page.evaluate((tb, jail) => { TG.G.crime.jail = jail; TG.UI.tab.crime = tb; TG.UI.go('crime'); }, tb, jail);
    await check(`crime ${tb} jail${jail}`); await shot(page, `crime ${tb} jail${jail}`); await pressAll(`crime ${tb} jail${jail}`);
  }
  await page.evaluate(() => { TG.G.crime.jail = 0; });
  // decisions & reports
  await page.evaluate(() => { for (let i = 0; i < 6; i++) TG.Game.nextMonth(TG.G); TG.UI.render(); });
  await page.evaluate(() => TG.UI.A.decisions()); await check('decisions');
  await page.evaluate(() => { const b = document.querySelector('#modal [data-act="decide"]'); if (b) b.click(); }); await check('decide');
  await page.evaluate(() => TG.UI.A.lastReport()); await check('report');
  await browser.close();
  console.log(`width ${W}: pressed ${pressed} distinct buttons, ${acts.size} distinct actions across ${types.length} business types`);
  console.log([...acts].sort().join(' '));
  if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 40).join('\n')); process.exit(1); } else console.log('UI COVERAGE TEST PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
