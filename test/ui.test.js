// Headless browser UI test (optional dev tool). Needs puppeteer-core + a Chrome binary:
//   NODE_PATH=/path/to/node_modules node test/ui.test.js [--clicks 600] [--width 375] [--shots dir]
// Opens index.html, starts a game, visits every screen/tab, then clicks random buttons (filling inputs),
// failing on any page error, "Screen error" or horizontal overflow at the given width.
const path = require('path'); const fs = require('fs');
const puppeteer = require('puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const CLICKS = Number(arg('clicks', 600)), W = Number(arg('width', 375)), SHOTS = arg('shots', null), FILE = arg('file', path.join(__dirname, '..', 'index.html'));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 800, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + FILE);
  await page.evaluate(() => { localStorage.clear(); return TG.IDB ? TG.IDB.put('tycoon_save_v1', null) : null; });
  await page.reload(); await page.waitForSelector('#ngSeed');
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${W}-${n}.png`), fullPage: true }); } };
  await shot('00-newgame');
  await page.evaluate(() => { document.getElementById('ngSeed').value = '7'; });
  await page.click('[data-act="newGame"][data-arg="classic"]');
  const check = async (label) => {
    const r = await page.evaluate((w) => ({ over: document.documentElement.scrollWidth > w + 1 ? document.documentElement.scrollWidth : 0, scr: document.body.innerText.includes('Screen error') ? document.body.innerText.match(/Screen error[^\n]*/)[0] : '', nan: /\bNaN\b|undefined|\[object Object\]|Infinity/.test(document.body.innerText) ? (document.body.innerText.match(/.{0,40}(\bNaN\b|undefined|\[object Object\]|Infinity).{0,40}/) || [''])[0] : '' }), W);
    if (r.over) errors.push(`${label}: horizontal overflow ${r.over}px`);
    if (r.scr) errors.push(`${label}: ${r.scr}`);
    if (r.nan) errors.push(`${label}: bad text "${r.nan}"`);
  };
  await check('home'); await shot('01-home');
  // tour: market, start a cafe with quick setup
  await page.click('[data-act="go"][data-arg="market"]'); await check('market'); await shot('02-market');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="acq"]')].find((x) => x.dataset.arg.endsWith('|lease') && !x.disabled); b.click(); });
  await check('start dialog'); await shot('03-start');
  await page.click('[data-act="startGo"]'); await check('biz');
  await shot('04-biz');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-act="tab"]')].map((x) => x.dataset.arg));
  for (const t of tabs) { await page.click(`[data-act="tab"][data-arg="${t}"]`); await check('tab ' + t); await shot('05-' + t.replace(':', '-')); }
  await page.click('[data-act="next"]'); await check('report'); await shot('06-report');
  await page.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.biz = 'overview'; TG.UI.render(); }); await shot('06b-biz-after-month');
  await page.evaluate(() => TG.UI.closeModal());
  for (const s of ['money', 'more']) {
    await page.click(`[data-act="go"][data-arg="${s}"]`);
    const ts = await page.evaluate(() => [...document.querySelectorAll('[data-act="tab"]')].map((x) => x.dataset.arg));
    for (const t of ts) { await page.click(`[data-act="tab"][data-arg="${t}"]`); await check('tab ' + t); await shot('07-' + t.replace(':', '-')); }
  }
  // skip
  await page.evaluate(() => { const i = document.getElementById('skipN'); i.value = '24'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-act="skip"]'); await new Promise((r) => setTimeout(r, 1500)); await check('skip'); await shot('08-skip');
  await page.evaluate(() => TG.UI.closeModal());
  // random clicking
  const SKIP = ['clearSave', 'clearGo', 'importSave', 'importGo', 'bk', 'bkGo', 'newGameOpen', 'newGame', 'copyCode'];
  let clicks = 0, seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const counts = {}; const jumps = [];
  while (clicks < CLICKS) {
    const acts = await page.evaluate((skip) => [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => !skip.includes(x.dataset.act) && x.offsetParent !== null).map((x, i) => i), SKIP);
    if (!acts.length) break;
    // fill inputs with plausible numbers
    await page.evaluate((r) => { for (const i of document.querySelectorAll('input[type=number]')) if (i.id !== 'skipN' && (!i.value || Math.random() < 0.3)) i.value = String(Math.round([1, 5, 50, 500, 5000, 50000][Math.floor(r * 6)])); for (const s of document.querySelectorAll('select')) if (Math.random() < 0.15) { s.selectedIndex = Math.floor(Math.random() * s.options.length); s.dispatchEvent(new Event('change', { bubbles: true })); } }, rnd());
    const pick = Math.floor(rnd() * acts.length);
    const cashB = await page.evaluate(() => TG.G.cash);
    const act = await page.evaluate((skip, k) => { const el = [...document.querySelectorAll('[data-act]:not([disabled])')].filter((x) => !skip.includes(x.dataset.act) && x.offsetParent !== null)[k]; if (!el) return null; const a = el.dataset.act + (el.dataset.arg ? ':' + el.dataset.arg : ''); el.click(); return a; }, SKIP, pick);
    if (act) counts[act.split(':')[0]] = (counts[act.split(':')[0]] || 0) + 1;
    if (act && act.startsWith('skip')) await new Promise((r) => setTimeout(r, 400));
    clicks++;
    const cashA = await page.evaluate(() => TG.G ? TG.G.cash : 0); if (cashA - cashB > 2e6) jumps.push(`${act}: +${Math.round(cashA - cashB)}`);
    if (clicks % 25 === 0) await check('random@' + clicks + ' ' + act);
    if (errors.length > 20) break;
  }
  const state = await page.evaluate(() => ({ month: TG.G.month, cash: TG.G.cash, biz: TG.G.businesses.length, saved: !!localStorage.getItem('tycoon_save_v1') || TG.store.ok }));
  // reload restores save
  await page.reload(); await new Promise((r) => setTimeout(r, 300));
  const after = await page.evaluate(() => TG.G && TG.G.month);
  if (after !== state.month) errors.push(`reload did not restore save (month ${state.month} -> ${after})`);
  await browser.close();
  console.log(`width ${W}: ${clicks} random clicks, ${Object.keys(counts).length} distinct actions, final month ${state.month}, ${state.biz} businesses, cash ${Math.round(state.cash)}`);
  console.log('actions:', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  if (jumps.length) console.log('Big cash jumps:', jumps.join(' | '));
  if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); } else console.log('UI TEST PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
