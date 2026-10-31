// Phone-size (375px) screenshots of the v9 screens, from the LOCAL server (not the live site).
//   python3 -m http.server 8765 &   NODE_PATH=/workspace/uitest/node_modules node tools/shots9.js
const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await br.createBrowserContext(); const p = await ctx.newPage(); /* fresh profile: no old save */ await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL);
  await p.addStyleTag({ content: '.toast{display:none!important}' }); await p.waitForSelector('[data-act="newGame"]'); await p.click('[data-act="newGame"][data-arg="rich"]');
  const out = (n) => path.join(__dirname, n);
  const snap = async (file) => { await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await p.screenshot({ path: out(file) }); console.log('saved', file); };
  const scrollTo = (re, root) => p.evaluate((re, root) => { const el = [...document.querySelectorAll((root || '') + ' h3, ' + (root || '') + ' h2, ' + (root || '') + ' b')].find((x) => new RegExp(re).test(x.textContent)); if (el) el.scrollIntoView({ block: 'start' }); return !!el; }, re, root);
  await p.evaluate(() => {
    const g = TG.G; g.cash = 3e6; g.settings.gambling = true;
    const ps = TG.P.gen(g, TG.P.idealFor('salon')); g.listings.unshift(ps); TG.P.acquire(g, ps.id, 'cash');
    const b = TG.B.start(g, 'salon', ps.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); b.name = 'Bright Cuts';
    for (let i = 0; i < 4; i++) { if (b.stock) TG.ST.buy(g, b, TG.ST.suggest(b, g)); TG.Game.nextMonth(g); }
    const S = TG.S; const kr = TG.M.keyRole(TG.CONFIG.businesses.salon);
    // a cheap trainee, an underpaid star (climber) and a loyal bargain
    const tr = S.candidate0(g, b, kr, b.labor, { trainee: true }); tr.name = 'Sam Bell'; tr.learnSeen = true; tr.learning = 1.3; S.hire(g, b, tr);
    const st = S.candidate0(g, b, kr, b.labor); Object.assign(st, { name: 'Sasha Johnson', skill: 82, skillSeen: 82, pers: 'climber', persSeen: true, loyalty: 15, months: 20, morale: 62 }); st.wage = Math.round(S.mv(g, b, st) * 0.72 / 10) * 10; S.hire(g, b, st);
    const lo = S.candidate0(g, b, kr, b.labor); Object.assign(lo, { name: 'Marco Murphy', skill: 70, skillSeen: 70, pers: 'loyal', persSeen: true, loyalty: 70, months: 30, morale: 70 }); lo.wage = Math.round(S.mv(g, b, lo) * 0.82 / 10) * 10; S.hire(g, b, lo);
    const gm = S.candidate0(g, b, 'gm', b.labor); gm.name = 'Pat Lee'; gm.skill = 60; gm.skillSeen = 60; S.hire(g, b, gm);
    TG.UI.closeModal(); window.__b = b.id; window.__star = st.id; window.__tr = tr.id;
  });
  // 1) worker list: skill, pay, market value, personality, poach risk
  await p.evaluate(() => { TG.UI.A.go('bizd:' + window.__b); TG.UI.A.tab('biz:staff'); });
  await scrollTo('Staff \\('); await snap('shots9-worker-list.png');
  // 2) manager works at a fraction (Managers card + Work card)
  await scrollTo('Managers & specialists'); await snap('shots9-manager-works.png');
  await p.evaluate(() => { TG.UI.A.tab('biz:overview'); }); await scrollTo('Work this month'); await p.evaluate(() => { const k = [...document.querySelectorAll('.link[data-act=tip]')][0]; if (k) k.click(); }); await scrollTo('Work this month'); await snap('shots9-manager-work-card.png');
  // 3) training (trainee's Manage popup)
  await p.evaluate(() => { TG.UI.A.tab('biz:staff'); TG.UI.A.emp(window.__tr); }); await scrollTo('Training', '#modal'); await snap('shots9-training.png');
  // 4) poach warning + raise (star's popup, risk opened) and a job-offer card
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.A.emp(window.__star); }); await scrollTo('Pay & keeping', '#modal');
  console.log('risk tip:', await p.evaluate(() => { const b = [...document.querySelectorAll('#modal .lb[data-act=tip]')].find((x) => /hires them away/.test(x.textContent)); if (!b) return 'no label'; b.click(); const t = [...document.querySelectorAll('#modal .tip')].find((x) => x.dataset.tip === b.dataset.arg); return t ? t.style.display + '|' + t.innerText.slice(0, 60) : 'no tip'; }));
  await p.evaluate(() => { const el = [...document.querySelectorAll('#modal .lb')].find((x) => /Market value/.test(x.textContent)); if (el) el.scrollIntoView({ block: 'start' }); }); await snap('shots9-poach-raise.png');
  await p.evaluate(() => { TG.UI.closeModal(); const g = TG.G, b = g.businesses.find((x) => x.id === window.__b); const e = TG.S.allStaff(b).find((x) => x.id === window.__star); const po = TG.S.poachOdds(g, b, e); const offer = Math.round(po.mv * 1.04 / 10) * 10; const pd = TG.S.persDef(e);
    TG.D.add(g, { kind: 'poach', bizId: b.id, empId: e.id, offer, title: `${e.name} got a job offer`, text: `Another company offered ${e.name} (Stylist, skill ${Math.round(e.skill)}) ${TG.U.money(offer)}/mo. You pay ${TG.U.money(e.wage)}/mo; their market value is about ${TG.U.money(po.mv)}/mo.`, why: po.reasons.join('; '), options: [{ id: 'counter', label: `💵 Match: pay ${TG.U.money(offer)}/mo (+${TG.U.money(offer - e.wage)}) · ${TG.U.pct(pd.accept)} they stay` }, { id: 'let', label: 'Let them go' }], def: 'let' });
    TG.UI.A.decisions(); });
  await snap('shots9-poach-card.png');
  // 5) apartment listing (rent per unit x units)
  await p.evaluate(() => { TG.UI.closeModal(); const g = TG.G; const L = TG.RE.gen(g, 'smallapt', { distressed: false }); L.name = 'Maple Apartments'; g.re.listings.unshift(L); TG.UI.A.reFin(L.id); });
  await p.evaluate(() => { const el = [...document.querySelectorAll('#modal .kv span')].find((x) => /Rent/.test(x.textContent)); if (el) el.scrollIntoView({ block: 'center' }); }); await snap('shots9-apartment-listing.png');
  // 6) stock market with its info buttons open
  await p.evaluate(() => { TG.UI.closeModal(); TG.UI.A.goMoneyTab('inv'); for (const k of ['ivIntro', 'iv_GROW']) TG.UI.S.tips[k] = true; TG.UI.render(); }); await snap('shots9-stock-help.png');
  // 7) farm Now page: owned tractor counted
  await p.evaluate(() => { const g = TG.G; g.cash = Math.max(g.cash, 3e7); const pf = TG.P.gen(g, TG.P.idealFor('farm')); g.listings.unshift(pf); TG.P.acquire(g, pf.id, 'cash'); const r = TG.B.start(g, 'farm', pf.id, { ent: 'cows' }); if (!r || !r.biz) throw new Error('farm start: ' + (r && r.msg)); const f = r.biz; window.__f = f.id; TG.B.quickSetup(g, f, true, 'standard'); TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.A.go('bizd:' + f.id); TG.UI.A.tab('biz:overview'); });
  await p.evaluate(() => { const el = [...document.querySelectorAll('main *')].find((x) => x.children.length === 0 && /^Tractors/.test(x.textContent.trim())); if (el) el.scrollIntoView({ block: 'center' }); }); await snap('shots9-farm-now-tractors.png');
  // 8) dry / old cows: the herd row explains itself, count + feed + meat value + Sell button, heads-up with no manager
  await p.evaluate(() => { const g = TG.G, b = g.businesses.find((x) => x.id === window.__f); for (const k in b.spec) b.spec[k] = null; g.ceo = null; const a = b.farm.areas.cows; TG.M.herdSync(a); a.st.dry = Math.max(15, Math.ceil(a.herd * 0.12)); TG.M.herdSync(a); TG.UI.render(); const ch = [...document.querySelectorAll('.herdchips [data-act="tip"]')].find((x) => /dry/.test(x.innerText)); if (ch) ch.click(); });
  await scrollTo('Dry / old cows'); await snap('shots9-dry-cows.png');
  await p.evaluate(() => { const ch = [...document.querySelectorAll('.herdchips [data-act="tip"]')].find((x) => /dry/.test(x.innerText)); if (ch) { ch.click(); ch.scrollIntoView({ block: 'start' }); } }); await snap('shots9-herd-stage-tip.png');
  await p.evaluate(() => { TG.UI.S.supOK = -1; TG.UI.A.next(); }); await snap('shots9-dry-before-next.png');
  if (errs.length) console.log('PAGE ERRORS:', errs.join('\n'));
  await br.close();
})();
