// Herd help: every cattle stage explains what it does, what it costs and what to do; dry/old cows show a count,
// feed cost and meat value with a Sell button on the farm Now page, and a heads-up appears when they pile up with no manager.
//   NODE_PATH=/path/to/node_modules node test/herd-help.test.js
const path = require('path'); const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.setViewport({ width: 375, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  await page.click('[data-act="newGame"][data-arg="rich"]');
  const r = await page.evaluate(() => {
    const g = TG.G, bad = []; g.cash = 3e7;
    const p = TG.P.gen(g, TG.P.idealFor('farm')); g.listings.unshift(p); TG.P.acquire(g, p.id, 'cash'); const b = TG.B.start(g, 'farm', p.id, { ent: 'cows' }).biz; TG.B.quickSetup(g, b, true, 'standard');
    for (const k in b.spec) b.spec[k] = null; g.ceo = null; // no manager
    const a = b.farm.areas.cows; TG.M.herdSync(a); a.st.dry = Math.max(a.st.dry, 12); TG.M.herdSync(a);
    TG.UI.closeModal(); TG.UI.A.go('bizd:' + b.id); TG.UI.A.tab('biz:overview');
    const main = () => document.querySelector('main').innerText;
    // each stage: tap its chip on the Now page -> explanation with what it does / costs / what to do
    for (const k of TG.M.cowStages) {
      const chip = document.querySelector(`[data-act="tip"][data-arg="hc${b.id}${k}"]`); if (!chip) { bad.push(`no tappable chip for ${k}`); continue; }
      chip.click(); const t = [...document.querySelectorAll('.tip')].find((x) => x.dataset.tip === `hc${b.id}${k}` && x.style.display !== 'none');
      const txt = t ? t.innerText : '';
      if (!/eats|eat /i.test(txt) || !/\$/.test(txt) || !/What to do/i.test(txt)) bad.push(`${k}: explanation missing food cost, $ value or what to do: "${txt.slice(0, 120)}"`);
      chip.click();
    }
    const dryTip = TG.UI.cowStageTip(g, b, 'dry');
    for (const w of ['NO milk', '0.4 t', '30%', '0.4%', 'pile up', 'Sell dry / old cows']) if (!dryTip.includes(w)) bad.push(`dry explanation lacks "${w}"`);
    // dry row: count, feed $/mo, meat value, Sell button
    const d = TG.M.dryPile(g, b); if (!d || !d.pile) bad.push('12 dry cows with no manager should count as piling up');
    // v9: dry cows sit on the Now page right under Market-ready, in the same style (count, number box, 💵 Sell, feed $/mo, meat value)
    { const rows = [...document.querySelectorAll('main .irow, main [data-tip]')].map((x) => x); const txt = main(); const iR = txt.indexOf('Market-ready'), iD = txt.indexOf('Dry / old cows');
      if (iR < 0 || iD < 0 || iD < iR) bad.push('Dry / old cows row is not on the Now page right after Market-ready');
      const seg = txt.slice(iD, iD + 200); if (!seg.includes(String(Math.floor(a.st.dry))) || !/\/mo feed/.test(seg) || !/as meat/.test(seg)) bad.push('dry row lacks count, feed $/mo or meat value: ' + seg.replace(/\n/g, ' '));
      if (!document.querySelector('main [data-act="cowSell"][data-arg="dry"]') || !document.getElementById('qDry')) bad.push('no number box + Sell button on the dry row (like Market-ready)');
      const n0 = Math.floor(a.st.dry); document.getElementById('qDry').value = 2; document.querySelector('main [data-act="cowSell"][data-arg="dry"]').click(); if (Math.floor(a.st.dry) !== n0 - 2) bad.push(`selling 2 from the dry row: ${n0} -> ${a.st.dry}`); a.st.dry = n0; TG.M.herdSync(a); TG.UI.render(); }
    if (!document.querySelector(`[data-act="cowSellDry"][data-arg="${b.id}"]`)) bad.push('no Sell-all button in the piling-up heads-up');
    if (!/piling up/.test(main())) bad.push('no heads-up on the Now page');
    TG.UI.go('home'); if (!/dry cows piling up/.test(main())) bad.push('no heads-up on Home');
    // before Next Month
    TG.UI.S.supOK = null; TG.UI.A.next(); const md = document.getElementById('modal'); if (!md || !/dry \/ old cows piling up/.test(md.innerText) || !md.querySelector('[data-act="cowSellDry"]')) bad.push('no dry-cow heads-up (with Sell) before Next Month');
    // sell from the warning
    const n0 = Math.floor(a.st.dry); const cash0 = g.cash; if (md) md.querySelector('[data-act="cowSellDry"]').click();
    if (!(a.st.dry < 1 && g.cash > cash0)) bad.push(`selling from the heads-up did not work (${n0} -> ${a.st.dry})`);
    // with a manager and the order on: not "piling up"
    a.st.dry = 12; const gm = TG.S.candidate0(g, b, 'gm', 0.5); TG.S.hire(g, b, gm); if (TG.M.dryPile(g, b).pile) bad.push('a manager with the cull order still counts as piling up');
    // help
    TG.UI.A.help(); const h = document.querySelector('main').innerText + (document.getElementById('modal') ? document.getElementById('modal').innerText : '');
    return { bad, help: h.length };
  });
  const helpTxt = await page.evaluate(() => { TG.UI.closeModal(); TG.UI.go('more'); TG.UI.tab.more = 'help'; TG.UI.render(); const b = [...document.querySelectorAll('[data-act]')].find((x) => /Farm/.test(x.innerText) && /help|how|biz/i.test(x.dataset.act + (x.dataset.arg || ''))); if (b) b.click(); return document.body.innerText; });
  if (!/Dry \/ old cows: after about 6 years/.test(helpTxt)) r.bad.push('farm Help does not explain dry cows');
  console.log(r.bad.length ? 'BAD:\n' + r.bad.join('\n') : 'all herd stages explained; dry-cow count, Sell and heads-ups work');
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
  if (r.bad.length || errors.length) { console.log('HERD-HELP TEST FAILED'); process.exit(1); }
  console.log('HERD-HELP TEST PASSED');
})();
