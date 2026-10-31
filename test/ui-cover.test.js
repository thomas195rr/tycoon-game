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
  await page.evaluate(() => { TG.G.settings.gambling = true; TG.G.settings.crime = true; TG.UI.render(); }); // v8: new-game screen defaults these Off
  const types = (await page.evaluate(() => Object.keys(TG.CONFIG.businesses))).filter((t) => !ONLY || ONLY.split(',').includes(t));
  const SKIP = ['help', 'reloadTab', 'clearSave', 'clearGo', 'importSave', 'importGo', 'bk', 'bkGo', 'newGameOpen', 'newGame', 'copyCode', 'go', 'next', 'skip', 'bizSell', 'bizSellGo', 'bizClose', 'bizCloseGo', 'bizBk', 'bizBkGo', 'techPivotGo', 'goMoreTab', 'goMoneyTab'];
  let pressed = 0; const acts = new Set();
  const check = async (label) => {
    const r = await page.evaluate((w) => ({ over: document.documentElement.scrollWidth > w + 1 ? document.documentElement.scrollWidth : 0, bad: (document.body.innerText.match(/.{0,40}(Screen error|\bNaN\b|undefined|\[object Object\]|Infinity).{0,40}/) || [''])[0] }), W);
    if (r.over) { const who = await page.evaluate((w) => { const o = []; for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); const p = e.parentElement && e.parentElement.getBoundingClientRect(); if (b.width > 0 && b.right > w + 1 && (!p || p.right <= w + 1)) o.push(e.tagName + '.' + e.className + ' "' + (e.innerText || '').slice(0, 30).replace(/\n/g, '/') + '"'); } return o.slice(0, 3).join(' | '); }, W); errors.push(`${label}: overflow ${r.over}px ${who}`); } if (r.bad) errors.push(`${label}: "${r.bad}"`);
  };
  const pressAll = async (label) => {
    const done = new Set();
    for (let guard = 0; guard < 200; guard++) {
      const next = await page.evaluate((skip, done) => { const els = [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => !skip.includes(x.dataset.act) && x.dataset.act !== 'tab' && x.offsetParent !== null); const key = (x) => x.dataset.act + '|' + (x.dataset.arg || '').replace(/[a-z]\d+/g, '#'); const el = els.find((x) => x.dataset.act !== 'tip' && !done.includes(key(x))) || (done.filter((d) => d.startsWith('tip|')).length < 6 ? els.find((x) => !done.includes(key(x))) : null); if (!el) return null; for (const i of document.querySelectorAll('input[type=number]')) if (!i.value && i.id !== 'skipN') i.value = '20'; return el.dataset.act + '|' + (el.dataset.arg || '').replace(/[a-z]\d+/g, '#'); }, SKIP, [...done]);
      if (!next) break; done.add(next);
      await page.evaluate((key) => { const els = [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => x.offsetParent !== null); const el = els.find((x) => x.dataset.act + '|' + (x.dataset.arg || '').replace(/[a-z]\d+/g, '#') === key); const t0 = TG.UI.tab.biz; if (el) el.click(); if (TG.UI.screen === 'bizd' && TG.UI.tab.biz !== t0 && !document.getElementById('modal')) { TG.UI.tab.biz = t0; TG.UI.render(); } }, next);
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
  // farm with all three areas (cows, crops, orchard), then dairy: every farm tab and button, incl. move / buy-land modals
  for (const kind of ['cows']) {
    await page.evaluate((kind) => { const g = TG.G; g.cash = 2e8; const b = g.businesses.find((x) => x.type === 'farm'); const M = TG.M; const f = M.farmEnsure(b);
      if (!f.areas.cows.acres || !f.areas.orchard.acres || !f.areas.crops.acres) { M.farmBuyLand(g, b, 300, false); for (const k of M.farmAreas) M.farmMove(g, b, 'free', k, 100); }
      for (let i = 0; i < 3; i++) TG.Game.nextMonth(g); M.farmBuyCattle(g, b, 20, 'milker'); M.farmBuyCattle(g, b, 1, 'bull'); M.farmBuyFeed(g, b, 100); TG.Game.nextMonth(g);
      TG.UI.closeModal(); TG.UI.bizId = b.id; TG.UI.screen = 'bizd'; }, kind);
    for (const tb of ['overview', 'rep', 'model', 'staff', 'mgr', 'upg']) {
      await page.evaluate((tb) => { TG.UI.tab.biz = tb; TG.UI.render(); }, tb);
      await check(`farm ${kind} ${tb}`); await shot(page, `farm ${kind} ${tb}`); await pressAll(`farm ${kind} ${tb}`);
    }
    // modals: move acres (every from/to button, then move) and buy land
    const mv = await page.evaluate(() => { const out = []; const clickAll = (act) => { for (const el of [...document.querySelectorAll(`#modal [data-act="${act}"]`)].map((x) => x.dataset.arg)) { const e = document.querySelector(`#modal [data-act="${act}"][data-arg="${el}"]`); if (e) { e.click(); out.push(act + ':' + el); } } };
      TG.UI.tab.biz = 'model'; TG.UI.render(); TG.UI.A.moveModal('free'); clickAll('mvFrom'); clickAll('mvTo'); const fr = document.querySelector('#modal [data-act="mvFrom"][data-arg="crops"]'); if (fr) fr.click(); const to = document.querySelector('#modal [data-act="mvTo"][data-arg="orchard"]'); if (to) to.click();
      document.getElementById('mvN').value = '5'; document.querySelector('#modal [data-act="mvN"]').click(); const cost = document.querySelector('#modal .ev').innerText; document.querySelector('#modal [data-act="mvGo"]').click(); out.push('moved:' + cost);
      TG.UI.A.landModal(); document.getElementById('farmAc').value = '10'; document.querySelector('#modal [data-act="farmLand"][data-arg="cash"]').click(); out.push('land:' + !document.getElementById('modal'));
      return out; });
    if (!mv.some((x) => x.startsWith('moved:')) || !mv.includes('land:true')) errors.push('farm modals failed: ' + mv.join(' '));
    await check(`farm ${kind} modals`);
    // herd detail ("See all cows"): every stage buy/sell button
    await page.evaluate(() => { TG.UI.tab.biz = 'overview'; TG.UI.render(); TG.UI.A.detail('stock'); }); await check('farm herd detail'); await shot(page, 'farm herd detail'); await pressAll('farm herd detail');
  }
  for (const s of [['money', ['fin', 're', 'inv', 'casino']], ['more', ['mgr', 'news', 'log', 'ach', 'set', 'help']], ['home', [null]], ['biz', [null]]]) {
    for (const tb of s[1]) { await page.evaluate((s, tb) => { if (tb) TG.UI.tab[s] = tb; TG.UI.go(s); }, s[0], tb); await check(s[0] + ' ' + tb); await pressAll(s[0] + ' ' + tb); }
  }
  // v6: industry outlook, credit/loan screen, rentals with tenant search (accept / decline / no applicants left), financing preview
  await page.evaluate(() => TG.UI.go('ind')); await check('industry outlook'); await shot(page, 'industry outlook'); await pressAll('industry outlook');
  const v6 = await page.evaluate(() => { const g = TG.G, RE = TG.RE, out = []; g.cash = 2e8; g.re.manager = null;
    const l = RE.gen(g, 'duplex', { distressed: false }); g.re.listings.unshift(l); TG.UI.tab.money = 're'; TG.UI.go('money');
    TG.UI.A.reFin(l.id); out.push('fin:' + !!document.querySelector('#modal [data-act="reFinGo"]')); TG.UI.closeModal();
    RE.buy(g, l.id, false); const h = g.re.holdings.find((x) => x.id === l.id); h.tenants = [null, null]; h.rentR = 1; TG.UI.render();
    const sb = document.querySelector('[data-act="reSearch"]'); out.push('searchBtn:' + !!sb); if (sb) sb.click();
    const go = document.querySelector('#modal [data-act="reSearchGo"]'); if (go) go.click(); out.push('applicant:' + !!document.querySelector('#modal [data-act="reDecide"]'));
    let k = 0; while (document.querySelector('#modal [data-act="reDecide"][data-arg$="|0"]') && k++ < 40) document.querySelector('#modal [data-act="reDecide"][data-arg$="|0"]').click();
    out.push('empty:' + /No applicants left/.test((document.getElementById('modal') || {}).innerText || '')); TG.UI.closeModal();
    const r = RE.search(g, h.id); if (r.n) { RE.decide(g, h.id, true); out.push('accepted:' + (h.tenants.filter((t) => t).length === 1)); } else out.push('accepted:true');
    TG.UI.render(); return out; });
  if (v6.some((x) => /:false$/.test(x))) errors.push('v6 flows failed: ' + v6.join(' '));
  // v7: money report reconciles on screen, loan detail + extra payment, units with per-unit search, closed shop banner -> buy supplies reopens, HR hiring panel, skip report
  const v7 = await page.evaluate(() => { const g = TG.G, out = []; TG.UI.closeModal(); g.cash = 5e6; g.cashMark = g.cash; g.acc.led = {}; // test cheat: mark it so the report can reconcile
    const r = TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.A.lastReport(); const mt = (document.getElementById('modal') || {}).innerText || ''; out.push('report:' + /Money in/i.test(mt) + /Bottom line|LEFT WITH|left with/i.test(mt)); out.push('reconciles' + Math.round(r.money.diff) + ':' + (Math.abs(r.money.diff) < 1 && /Matches your real cash change/.test(mt))); TG.UI.closeModal();
    const l = TG.F.takeLoan(g, 'business', 40000); TG.UI.tab.money = 'fin'; TG.UI.go('money'); const lv = document.querySelector('#loansCard [data-act="loanView"]'); out.push('loanRow:' + !!lv); if (lv) lv.click(); const lt = (document.getElementById('modal') || {}).innerText || '';
    out.push('loanDetail:' + (/interest/i.test(lt) && /principal/i.test(lt) && /payoff|paid off/i.test(lt) && /month/i.test(lt)));
    if (l.ok) { const n0 = TG.F.loanInfo(g, g.loans.find((x) => x.id === l.loan.id)).monthsLeft; TG.UI.A.loanView(l.loan.id); document.getElementById('xPay').value = '5000'; document.querySelector(`#modal [data-act="loanExtra"][data-arg="${l.loan.id}"]`).click(); const ln = g.loans.find((x) => x.id === l.loan.id); out.push('extraPay:' + (!ln || TG.F.loanInfo(g, ln).monthsLeft < n0)); } TG.UI.closeModal();
    g.cash = 2e7; const L = TG.RE.gen(g, 'smallapt', { distressed: false }); g.re.listings.unshift(L); TG.RE.buy(g, L.id, false); const h = g.re.holdings.find((x) => x.id === L.id); h.tenants = h.tenants.map(() => null); h.issues = []; g.re.manager = null; TG.UI.tab.money = 're'; TG.UI.go('money');
    const units = document.querySelectorAll(`[data-act="reSearch"][data-arg^="${h.id}|"]`).length; out.push('unitButtons:' + (units >= Math.min(h.units, 4)));
    const b2 = document.querySelector(`[data-act="reSearch"][data-arg="${h.id}|1"]`); if (b2) b2.click(); const go = document.querySelector('#modal [data-act="reSearchGo"]'); if (go) go.click(); const acc = document.querySelector('#modal [data-act="reDecide"][data-arg$="|1"]'); if (acc) acc.click();
    out.push('unitFilled:' + (!acc || (!!h.tenants[1] && h.tenants.filter((t) => t).length === 1))); TG.UI.closeModal();
    g.cash = 5e6; const pr = TG.P.gen(g, TG.P.idealFor('bakery')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'cash'); const b = TG.B.start(g, 'bakery', pr.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); TG.ST.ensure(b); b.stock.qty = 0; b.stock.lots = []; b.stock.auto = false; for (const k in b.spec) b.spec[k] = null; const ceo = g.ceo; g.ceo = null;
    TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.bizId = b.id; TG.UI.screen = 'bizd'; TG.UI.tab.biz = 'overview'; TG.UI.render(); const ct = document.body.innerText; out.push('closedBanner:' + /Closed: no supplies, no manager/.test(ct));
    const buy = document.querySelector('[data-act="stBuyN"]'); if (buy) buy.click(); out.push('buyReopens:' + (!!buy && b.stock.qty > 0)); g.ceo = ceo;
    b.spec.hr = Object.assign(TG.S.candidate(g, b, 'hr', 0.6), { skill: 80 }); TG.UI.tab.biz = 'staff'; TG.UI.render(); out.push('hrPanel:' + /HR/.test((document.getElementById('hireCard') || document.body).innerText));
    const sk = TG.Game.skip(g, 3); TG.UI.closeModal(); TG.UI.showSkip(sk); const st = (document.getElementById('modal') || {}).innerText || ''; out.push('skipReport:' + (/Money in/i.test(st) && /month by month|each month|Month by month/i.test(st))); TG.UI.closeModal(); TG.UI.render();
    return out; });
  console.log('v7 flows:', v7.join(' ')); if (v7.some((x) => /false/.test(x))) errors.push('v7 flows failed: ' + v7.join(' '));
  await check('v7'); await shot(page, 'v7 bakery');
  // v6 item 12: INSTANT UPDATES. Hire, fire and buy a machine by clicking the real buttons; the Work card must change at once (same month).
  {
    const setup = await page.evaluate(() => { TG.UI.closeModal(); const g = TG.G; g.cash = 5e6; const pr = TG.P.gen(g, TG.P.idealFor('cafe')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'cash');
      const b = TG.B.start(g, 'cafe', pr.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); b.name = 'Instant Cafe'; TG.Game.nextMonth(g); TG.UI.closeModal(); TG.UI.bizId = b.id; TG.UI.screen = 'bizd'; TG.UI.tab.biz = 'overview'; TG.UI.render();
      const W = TG.UI.wk(b); const kr = TG.M.keyRole(TG.CONFIG.businesses.cafe); const crit = TG.CONFIG.businesses.cafe.equip.find((x) => x.critical);
      const eqW = W.find((w) => w.kind === 'eq' && w.pools.indexOf(TG.E.poolOf(crit)) >= 0);
      return { month: g.month, staff: (W.find((w) => w.kind === 'staff') || {}).t, eq: eqW && eqW.t, kr, crit: crit.id, bid: b.id }; });
    const at = (tab) => page.evaluate((tab) => { TG.UI.closeModal(); TG.UI.tab.biz = tab; TG.UI.render(); }, tab);
    const click = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el; }, sel);
    const capOf = async (label) => { await at('overview'); return page.evaluate((label) => { const r = [...document.querySelectorAll('.card .link')].find((x) => { const gr = x.querySelector('.grow'); return gr && gr.textContent.trim().startsWith(label); }); if (!r) return null;
      const bb = [...r.querySelectorAll('b')].map((x) => x.textContent).find((t) => /\//.test(t)) || ''; const cap = Number((bb.split('/')[1] || '').replace(/[^\d]/g, '')); return { txt: bb, max: cap }; }, label); };
    const month = () => page.evaluate(() => TG.G.month);
    const fcW = () => page.evaluate(() => { const f = TG.UI.fc(TG.B.get(TG.G, TG.UI.bizId)); return f && f.lines ? Math.round(f.lines.Wages || 0) : null; });
    const iu = []; const c0 = await capOf(setup.staff); const w0 = await fcW();
    await page.evaluate((kr) => { TG.UI.S.hireRole = kr; }, setup.kr); await at('staff'); const hired = await click('#hireCard [data-act="hire"]'); const c1 = await capOf(setup.staff);
    iu.push(`hire:${hired && c0 && c1 && c1.max > c0.max}`, `forecast-wages:${(await fcW()) < w0}`, `hire-month:${(await month()) === setup.month}`);
    const victim = await page.evaluate((kr) => { const b = TG.B.get(TG.G, TG.UI.bizId); const e = b.staff.filter((x) => x.role === kr).slice(-1)[0]; return e && e.id; }, setup.kr);
    await at('staff'); await click(`[data-act="emp"][data-arg="${victim}"]`); const fired = await click(`[data-act="empDo"][data-arg="${victim}|fire"]`); const c2 = await capOf(setup.staff);
    iu.push(`fire:${fired && c2 && c2.max < c1.max}`, `fire-month:${(await month()) === setup.month}`);
    const e0 = setup.eq ? await capOf(setup.eq) : null; await at('equip'); const bought = await click(`[data-act="eqBuy"][data-arg="${setup.crit}"]`); const e1 = setup.eq ? await capOf(setup.eq) : null;
    iu.push(`machine:${bought && e0 && e1 && e1.max > e0.max}`, `machine-month:${(await month()) === setup.month}`);
    console.log('instant updates:', iu.join(' '), `| ${setup.staff}: ${c0 && c0.txt} -> ${c1 && c1.txt} -> ${c2 && c2.txt} | ${setup.eq}: ${e0 && e0.txt} -> ${e1 && e1.txt}`);
    if (iu.some((x) => /:false$/.test(x))) errors.push('instant updates failed: ' + iu.join(' '));
  }
  await check('money re'); await shot(page, 'money re'); await pressAll('money re');
  await page.evaluate(() => { TG.UI.tab.money = 'fin'; TG.UI.go('money'); }); await check('money fin'); await shot(page, 'money fin'); await pressAll('money fin');
  // crime screen: every tab, every button; then the same while in jail
  await page.evaluate(() => { const g = TG.G, CR = TG.CR; g.settings.crime = true; g.cash = 2e8; CR.withdraw(g, 60000); CR.buy(g, 'plug', 'sugar', 400); for (let i = 0; i < 3; i++) TG.Game.nextMonth(g); TG.UI.closeModal(); });
  for (const jail of [0, 4]) for (const tb of ['home', 'goods', 'crew', 'turf', 'clean', 'jobs', 'law', 'rep']) {
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
