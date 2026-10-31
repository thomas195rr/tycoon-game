// Now-page machine counts: for every business type, buy each machine type, then check the 💪 Work card on the
// Now page shows exactly how many you own (working + broken), and that a broken one is shown as broken, not missing.
// Also: the live preview must never break machines (it used to show "Tractors x0" for a farm that owned a working tractor).
//   NODE_PATH=/path/to/node_modules node test/now-counts.test.js
const path = require('path'); const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.setViewport({ width: 375, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  await page.click('[data-act="newGame"][data-arg="rich"]');
  const types = await page.evaluate(() => Object.keys(TG.CONFIG.businesses));
  const bad = []; let checks = 0; const unseen = [];
  for (const t of types) {
    await page.evaluate((t) => { const g = TG.G; g.cash = 5e8; const p = TG.P.gen(g, TG.P.idealFor(t)); g.listings.unshift(p); TG.UI.S.mkType = t; TG.UI.go('market'); }, t);
    await page.evaluate(() => { [...document.querySelectorAll('[data-act="acq"]')].find((x) => x.dataset.arg.endsWith('|cash')).click(); });
    await page.click('[data-act="startGo"]');
    await page.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.closeModal(); });
    const r = await page.evaluate((t) => {
      const g = TG.G, b = g.businesses[g.businesses.length - 1], E = TG.E, out = { bad: [], checks: 0, unseen: [] };
      g.cash = 5e8; TG.UI.A.go('bizd:' + b.id); TG.UI.tab.biz = 'overview';
      const owned = (w) => b.equip.filter((x) => { if (x.broken === 'destroyed') return false; const d = E.def(b, x.type); return w.pools.includes(x.type) || (d && (w.pools.includes(E.poolOf(d)) || w.pools.includes(d.countsAs))); });
      const verify = (label) => {
        TG.UI.render(); const W = TG.UI.wk(b); const card = [...document.querySelectorAll('main .card')].find((c) => /Work this month/.test((c.querySelector('h3') || {}).innerText || ''));
        const rows = card ? [...card.querySelectorAll('.link')].map((x) => x.innerText) : [];
        if (!card && W.some((w) => w.kind === 'eq')) out.bad.push(`${t} ${label}: no Work card on the Now page`);
        for (const [wi, w] of W.entries()) {
          if (w.kind !== 'eq' || !w.pools.length) continue; out.checks++;
          const mine = owned(w); const brk = mine.filter((x) => x.broken).length;
          if (w.own !== mine.length) out.bad.push(`${t} ${label}: ${w.t} shows x${w.own}, you own ${mine.length}`);
          if ((w.brk || 0) !== brk) out.bad.push(`${t} ${label}: ${w.t} shows ${w.brk || 0} broken, really ${brk}`);
          const row = rows[wi];
          if (!row || !row.includes('x' + mine.length)) out.bad.push(`${t} ${label}: Now page row for ${w.t} does not say x${mine.length} (${row ? row.split('\n').join(' ') : 'missing'})`);
          if (brk && !/broken/.test(row || '')) out.bad.push(`${t} ${label}: ${w.t} has ${brk} broken but the row does not say so`);
        }
      };
      verify('start');
      for (const ed of TG.CONFIG.businesses[t].equip) {
        if (E.count(b, ed.id) >= E.maxCount(b, ed.id)) continue;
        const before = b.equip.length; const it = E.buy(g, b, ed.id, 'standard'); if (!it || b.equip.length === before) continue;
        TG.UI.render(); const W = TG.UI.wk(b);
        const grp = W.find((w) => w.kind === 'eq' && owned(w).includes(it));
        if (!grp) out.unseen.push(`${t}:${ed.id}`);
        verify('after buying ' + ed.id);
        // a well-worn machine must not "break" in the live preview
        it.wear = 99; TG.B.liveReset(b); verify('worn ' + ed.id); if (it.broken) out.bad.push(`${t}: preview broke ${ed.id}`);
        it.wear = 10;
        // a broken machine still counts as owned and is shown as broken
        it.broken = 'major'; TG.B.liveReset(b); verify('broken ' + ed.id); it.broken = false; TG.B.liveReset(b);
      }
      return out;
    }, t);
    bad.push(...r.bad); checks += r.checks; unseen.push(...r.unseen);
  }
  // the reported bug: a farm that owns one working tractor must say "Tractors x1" on its Now page
  const farm = await page.evaluate(() => { const b = TG.G.businesses.find((x) => x.type === 'farm'); TG.UI.A.go('bizd:' + b.id); TG.UI.tab.biz = 'overview'; TG.UI.render(); return [...document.querySelectorAll('main .link')].map((x) => x.innerText.split('\n').join(' ')).find((x) => /Tractors/.test(x)); });
  if (!farm || !/x[1-9]/.test(farm)) bad.push('farm Now page tractor row: ' + farm);
  console.log(`checked ${checks} machine groups across ${types.length} business types`);
  if (unseen.length) console.log('machine types with no row in the Work card (extras that add no work capacity): ' + unseen.join(', '));
  if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 10).join('\n'));
  if (bad.length) console.log('BAD:\n' + bad.slice(0, 40).join('\n'));
  await browser.close();
  if (errors.length || bad.length) { console.log('NOW-COUNTS TEST FAILED'); process.exit(1); }
  console.log('NOW-COUNTS TEST PASSED');
})();
