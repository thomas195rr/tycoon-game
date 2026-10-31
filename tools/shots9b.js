// v9 audit screenshots (local server): start dialog practice year (with a warning) and a rental listing's "typical month with this loan".
//   python3 -m http.server 8765 &   NODE_PATH=... node tools/shots9b.js
const puppeteer = require('puppeteer-core'); const path = require('path'); const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await br.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="classic"]');
  await p.addStyleTag({ content: '.toast{display:none!important}' });
  const snap = async (f) => { await p.screenshot({ path: path.join(__dirname, f) }); console.log('saved', f); };
  // 1) a small crop farm listing: start dialog with the practice year
  const found = await p.evaluate(() => {
    const g = TG.G; let best = null, info = '', last = null;
    for (let i = 0; i < 40 && !best; i++) { g.cash = 320000; const pr = TG.P.gen(g, { kind: 'farmland', loc: 'rural' }); if (pr.acres > 90) continue; if (i > 20) { g.cash = 90000; } g.listings.unshift(pr); const r = TG.P.acquire(g, pr.id, 'lease'); if (!r || r.ok === false) continue;
      const v = TG.UI.startPreview(pr.id, 'farm', 'standard', 'crops'); if (i > 20 && !v.ok) continue; info += ` ${pr.acres}ac:${v.ok}/${v.loser}/${v.outAt}`; if (v.ok && !last) last = pr.id; if (v.ok && (v.loser || v.outAt < Infinity)) best = pr.id; }
    best = best || last; if (!best) return info; g.cash = 320000; TG.UI.S.mkType = 'farm'; TG.UI.A.startHere(best); return 'ok ' + info;
  });
  console.log('flagged farm found:', found); await new Promise((r) => setTimeout(r, 1500));
  await p.evaluate(() => { const el = document.getElementById('stPrevBox'); if (el) el.scrollIntoView({ block: 'start' }); }); await snap('shots9-start-practice-year.png');
  // 2) a house listing bought with a loan: typical month
  await p.evaluate(() => { TG.UI.closeModal(); const g = TG.G; g.cash = 120000; const L = TG.RE.gen(g, 'house', { distressed: false }); g.re.listings.unshift(L); TG.UI.A.reFin(L.id); const h = [...document.querySelectorAll('#modal h3')].find((x) => /typical month/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); });
  await snap('shots9-rental-typical-month.png');
  if (errs.length) console.log('PAGE ERRORS', errs.join(' | '));
  await br.close();
})();
