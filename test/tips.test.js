// Help/info test: on every screen and tab (home, shop, every business type and its tabs, money, more, industry outlook)
// tap every "i" info button and every Help button, and check each one shows non-empty text.
//   NODE_PATH=/path/to/node_modules node test/tips.test.js [--width 375]
const path = require('path'); const puppeteer = require('puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = Number(arg('width', 375));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  await page.click('[data-act="newGame"][data-arg="rich"]');
  await page.evaluate(() => { TG.G.settings.gambling = true; TG.G.settings.crime = true; TG.UI.render(); });
  let checked = 0; const empty = [];
  // tap every visible info button ("i") once; each must open a non-empty explanation
  const checkTips = async (label) => {
    const r = await page.evaluate(() => {
      for (const d of document.querySelectorAll('main details, #modal details')) d.open = true; // a player opens folded sections too
      const vis = (b) => b.checkVisibility ? b.checkVisibility() : b.offsetParent !== null;
      const keys = [...new Set([...document.querySelectorAll('.tipb[data-act="tip"]')].filter(vis).map((b) => b.dataset.arg))]; const bad = [];
      for (const k of keys) {
        const sel = `.tipb[data-act="tip"][data-arg="${CSS.escape(k)}"]`; const b = document.querySelector(sel); if (!b) continue;
        const before = [...document.querySelectorAll('.tip')].filter(vis).map((t) => t.innerText).join('|');
        b.click();
        const after = [...document.querySelectorAll('.tip')].filter(vis).map((t) => t.innerText.trim());
        if (!after.some((t) => t.length > 8 && !before.includes(t))) bad.push(k);
        const b2 = document.querySelector(sel); if (b2) b2.click(); // close it again
      }
      return { n: keys.length, bad };
    });
    checked += r.n; for (const k of r.bad) empty.push(`${label}: info "${k}" shows nothing`);
  };
  // popups: open each "look at" popup on this screen (one per kind) and tap every info button inside it
  const OPENERS = /^(emp|detail|reFin|reView|reHold|lastReport|decisions|help|econInfo|saveInfo|loanView|loanInfo|lnView|crDetail|showReport|reApps|reUnit|bizInfo|indInfo|histView|rptView|candView|tenantView)$/;
  const checkPopups = async (label) => {
    const acts = await page.evaluate((src) => { const re = new RegExp(src); const seen = {}; for (const b of document.querySelectorAll('main [data-act]')) { const a = b.dataset.act; if (re.test(a) && !seen[a] && b.offsetParent !== null) seen[a] = b.dataset.arg == null ? null : b.dataset.arg; } return Object.entries(seen); }, OPENERS.source);
    for (const [act, arg] of acts) {
      const opened = await page.evaluate((act, arg) => { TG.UI.closeModal(); const b = [...document.querySelectorAll('main [data-act]')].find((x) => x.dataset.act === act && (x.dataset.arg == null ? null : x.dataset.arg) === arg); if (!b) return false; b.click(); return !!document.getElementById('modal'); }, act, arg);
      if (opened) { popups++; await checkTips(`${label} popup ${act}`); }
      await page.evaluate(() => TG.UI.closeModal());
    }
  };
  let popups = 0;
  const tabsOf = (prefix) => page.evaluate((p) => [...new Set([...document.querySelectorAll('[data-act="tab"]')].map((x) => x.dataset.arg).filter((a) => a.startsWith(p + ':')))], prefix);
  const openTab = (tb) => page.evaluate((tb) => { const i = tb.indexOf(':'); TG.UI.tab[tb.slice(0, i)] = tb.slice(i + 1); TG.UI.render(); }, tb);
  // header Help, economy and save chips
  const helpTxt = await page.evaluate(() => { TG.UI.A.help(); const t = document.querySelector('main').innerText; return t; });
  if (!/How to play/.test(helpTxt) || helpTxt.length < 200) empty.push('header ❓ Help shows no help');
  for (const s of ['home', 'market']) { await page.evaluate((s) => TG.UI.go(s), s); await checkTips(s); await checkPopups(s); }
  for (const scr of ['money', 'more']) { await page.evaluate((s) => TG.UI.go(s), scr); for (const tb of await tabsOf(scr)) { await openTab(tb); await checkTips(tb); await checkPopups(tb); } }
  await page.evaluate(() => TG.UI.go('ind')); await checkTips('industry outlook');
  // the stock-market (investing) and casino screens must have info buttons on every section and every stock
  for (const [tb, min] of [['inv', 12], ['casino', 3]]) { await page.evaluate((tb) => TG.UI.A.goMoneyTab(tb), tb); const c0 = checked; await checkTips('money:' + tb); if (checked - c0 < min) empty.push(`money:${tb}: only ${checked - c0} info buttons (want ${min}+)`); }
  const types = await page.evaluate(() => Object.keys(TG.CONFIG.businesses));
  for (const t of types) {
    await page.evaluate((t) => { const g = TG.G; g.cash = 2e8; const p = TG.P.gen(g, TG.P.idealFor(t)); g.listings.unshift(p); TG.UI.S.mkType = t; TG.UI.go('market'); }, t);
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="acq"]')].find((x) => x.dataset.arg.endsWith('|cash')); b.click(); });
    await page.click('[data-act="startGo"]');
    for (let i = 0; i < 2; i++) await page.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.closeModal(); TG.UI.render(); });
    for (const tb of await tabsOf('biz')) { await openTab(tb); await checkTips(t + ' ' + tb); await checkPopups(t + ' ' + tb); }
    // the first worker's Manage popup (skill, pay, market value, training)
    await openTab('biz:staff'); await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="emp"]')][0]; if (b) b.click(); });
    await page.waitForFunction(() => { const m = document.getElementById('modal'); return m && m.innerText.length > 50; }, { timeout: 5000 }).catch(() => null); // v10: wait for the popup under load
    const c0 = checked; await checkTips(t + ' worker popup'); if (checked - c0 < 6) empty.push(`${t}: worker popup has only ${checked - c0} info buttons`); await page.evaluate(() => TG.UI.closeModal());
  }
  console.log(`width ${W}: tapped ${checked} info buttons (incl. ${popups} popups)`);
  if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 20).join('\n'));
  if (empty.length) { const k = {}; for (const e of empty) { const key = e.replace(/\d+/g, '#'); k[key] = (k[key] || 0) + 1; } console.log('EMPTY (' + empty.length + '):\n' + Object.entries(k).map(([a, n]) => n + 'x ' + a).join('\n')); }
  await browser.close();
  if (errors.length || empty.length || checked < 50 || popups < 20) { console.log('TIPS TEST FAILED'); process.exit(1); }
  console.log('TIPS TEST PASSED');
})();
