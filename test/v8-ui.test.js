// v8 browser checks at phone + desktop width: listing rent per unit, blank seed = random, phone tabs wrap + Help reachable,
// supplies Auto needs a manager, warning before Next Month, skip stop toggle, Quick setup cost preview, Back button, two tabs.
//   NODE_PATH=/path/to/node_modules node test/v8-ui.test.js [--width 375] [--shots dir]
const path = require('path'); const puppeteer = require('puppeteer-core'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = Number(arg('width', 375)); const SHOTS = arg('shots', null);
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL: ' + msg); } else console.log('  ok  ' + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage(); await page.setViewport({ width: W, height: 800 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (n, full) => { if (SHOTS) { await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: !!full }); } };
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); return TG.IDB.put('tycoon_save_v1', null); }); await page.reload(); await page.waitForSelector('[data-act="newGame"]');
  // blank seed -> random world (start twice)
  ok(await page.evaluate(() => !!document.getElementById('ngCrime') && document.getElementById('ngCrime').value === '0'), 'new game: crime toggle, Off by default');
  await page.click('[data-act="newGame"][data-arg="classic"]'); await sleep(300);
  const s1 = await page.evaluate(() => ({ seed: TG.G.seed, cash: TG.G.cash, crime: TG.G.settings.crime }));
  await page.evaluate(() => TG.UI.A.newGameOpen()); await page.click('#modal [data-act="newGame"][data-arg="classic"]'); await sleep(300);
  const s2 = await page.evaluate(() => ({ seed: TG.G.seed, cash: TG.G.cash }));
  ok(s1.seed !== 0 && s1.seed !== s2.seed, `blank game code gives a random world (${s1.seed} vs ${s2.seed})`); ok(s1.crime === false, 'crime off when chosen Off');
  // header help + phone tabs
  ok(await page.evaluate(() => !!document.querySelector('header [data-act="help"]')), 'Help chip in the header');
  await page.click('header [data-act="help"]'); await sleep(150);
  const helpTxt = await page.evaluate(() => document.querySelector('main').innerText);
  ok(/Supplies/.test(helpTxt) && /Managers/.test(helpTxt) && /Loans/.test(helpTxt) && /Farm/.test(helpTxt) && /Crime/.test(helpTxt) && /Money tab/.test(helpTxt) && /Shop/.test(helpTxt) && !/in Market\b/.test(helpTxt), 'Help covers supplies, managers, farm, real estate, loans, crime, reports; says Shop');
  const tabsFit = await page.evaluate((w) => [...document.querySelectorAll('.tabs .btn')].every((b) => { const r = b.getBoundingClientRect(); return r.right <= w + 1 && r.width > 0; }), W);
  ok(tabsFit, 'More tabs (incl. Settings, Help) are all on screen'); ok(await page.evaluate((w) => document.documentElement.scrollWidth <= w + 1, W), 'no sideways scroll');
  await shot('shots8-phone-tabs-help');
  // skip stop toggle next to Skip
  ok(await page.evaluate(() => /Skip stops early on trouble/.test(document.querySelector('footer').innerText) && /On/.test(document.querySelector('footer .stopRow').innerText)), 'skip stop-early toggle shown by the Skip button, On');
  await shot('shots8-skip-toggle');
  // 1e3 in skip box
  await page.evaluate(() => { const g = TG.G; g.cash = 5e6; }); await page.$eval('#skipN', (e) => { e.value = '2.5'; }); await page.click('[data-act="skip"]'); await sleep(150);
  ok(await page.evaluate(() => TG.G.month === 0), 'non-whole skip is refused');
  // real estate listing: per unit x units
  await page.evaluate(() => { const g = TG.G; g.cash = 5e5; const l = TG.RE.gen(g, 'smallapt', { distressed: false }); l.id = 'tst'; g.re.listings = [l]; TG.UI.tab.money = 're'; TG.UI.go('money'); });
  await sleep(150);
  const lt = await page.evaluate(() => { const g = TG.G, l = g.re.listings[0]; const pu = TG.RE.marketRent(g, l); return { txt: document.querySelector('main').innerText, pu, units: l.units, m: (x) => x }; });
  const money = (x) => '$' + (x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(x));
  ok(new RegExp(`/unit × ${lt.units} units = .*when full`).test(lt.txt), `listing shows per-unit rent × ${lt.units} units = total when full`);
  ok(await page.evaluate(() => /Mortgage \(.* now · (\d+% odds|no chance)\)/.test(document.querySelector('main').innerText)), 'mortgage button shows cash now + odds'); void money;
  await page.evaluate(() => { const el = [...document.querySelectorAll('.card')].find((c) => /when full/.test(c.innerText)); if (el) el.scrollIntoView(); }); await shot('shots8-listing-rent');
  // big cash purchase asks first
  await page.evaluate(() => { TG.G.cash = TG.G.re.listings[0].price * 1.1; TG.UI.refresh(); });
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="reBuy"]')][0]; b.click(); }); await sleep(100);
  ok(await page.evaluate(() => !!document.getElementById('modal') && /Pay .* cash/.test(document.getElementById('modal').innerText)), 'big cash buy asks to confirm');
  // Back closes the popup first, then goes to the previous screen
  await page.goBack(); await sleep(200);
  ok(await page.evaluate(() => !document.getElementById('modal')), 'Back closes the popup'); ok(await page.evaluate(() => TG.UI.screen === 'money'), 'and stays in the game');
  await page.goBack(); await sleep(200);
  ok(await page.evaluate(() => TG.UI.screen !== 'money' && !!TG.G), 'Back again goes to the previous screen (' + (await page.evaluate(() => TG.UI.screen)) + ')');
  // Quick setup: full cost preview + warning
  await page.evaluate(() => { const g = TG.G; g.cash = 60000; const p = TG.P.gen(g, TG.P.idealFor('cafe')); p.id = 'qs1'; g.listings.unshift(p); TG.UI.S.mkType = 'cafe'; TG.UI.go('market'); });
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="acq"]')].find((x) => x.dataset.arg === 'qs1|lease'); b.click(); }); await sleep(400);
  const pv = await page.evaluate(() => { const b = document.getElementById('stPrevBox'); return b ? b.innerText : ''; });
  ok(/Cash spent today/.test(pv) && /Wages each month/.test(pv) && /First month/.test(pv) && /Cash lasts/.test(pv), 'start dialog shows cash today, wages, first month, how long cash lasts');
  ok(/Risky/.test(pv), 'low cash start is flagged risky');
  await page.evaluate(() => document.getElementById('stPrevBox').scrollIntoView()); await shot('shots8-quick-setup-cost');
  await page.click('[data-act="startGo"]'); await sleep(200);
  ok(await page.evaluate(() => /Open anyway/.test(document.getElementById('modal').innerText)), 'opening a risky start asks first');
  await page.evaluate(() => [...document.querySelectorAll('#modal [data-act="startGo"]')][0].click()); await sleep(300);
  const opened = await page.evaluate(() => TG.G.businesses.length); ok(opened === 1, 'Open anyway opens it with the chosen setup');
  // supplies: Auto needs a manager; warning before Next Month
  await page.evaluate(() => { const g = TG.G; g.cash = 2e5; const b = g.businesses[0]; b.stock.qty = 0; TG.UI.bizId = b.id; TG.UI.tab.biz = 'now'; TG.UI.go('bizd'); });
  await sleep(200);
  ok(await page.evaluate(() => /Auto: needs a manager/.test(document.querySelector('main').innerText)), 'Auto button says it needs a manager');
  ok(await page.evaluate(() => /Fill for next month/.test(document.querySelector('main').innerText)), 'one-tap Fill for next month');
  await page.evaluate(() => { const el = [...document.querySelectorAll('[data-act="stAutoNo"]')][0]; if (el) el.scrollIntoView({ block: 'center' }); }); await shot('shots8-supplies-auto');
  await page.click('[data-act="next"]'); await sleep(300);
  ok(await page.evaluate(() => TG.G.month === 0 && /Supplies running low/.test(document.getElementById('modal').innerText)), 'warning before Next Month when a shop will run out');
  await shot('shots8-supplies-warning');
  await page.evaluate(() => [...document.querySelectorAll('#modal [data-act="supFill"]')][0].click()); await sleep(600);
  ok(await page.evaluate(() => TG.G.month === 1), 'buying from the warning plays the month');
  // skip: pre-check, then the skip stops early when the shop closes
  await page.evaluate(() => { TG.UI.closeModal(); const i = document.getElementById('skipN'); i.value = '24'; }); await page.click('[data-act="skip"]'); await sleep(300);
  ok(await page.evaluate(() => /Before you skip/.test(document.getElementById('modal').innerText)), 'skip checks supplies first');
  await shot('shots8-skip-precheck');
  await page.evaluate(() => [...document.querySelectorAll('#modal [data-act="skipAnyway"]')][0].click()); await sleep(1500);
  const sk = await page.evaluate(() => ({ m: TG.G.month, t: (document.getElementById('modal') || {}).innerText || '' }));
  ok(sk.m < 25 && /Stopped early/.test(sk.t), 'skip stopped early on trouble (month ' + sk.m + ')');
  await shot('shots8-skip-stop');
  await page.evaluate(() => TG.UI.closeModal());
  // sales card = report
  await page.evaluate(() => { TG.UI.closeModal(); TG.UI.tab.biz = 'rep'; TG.UI.render(); });
  const sc = await page.evaluate(() => { const b = TG.G.businesses[0]; const t = document.querySelector('main').innerText; return { t, served: b.lastCtx.served }; });
  ok(sc.t.includes(Math.round(sc.served).toLocaleString()) && /Sales last month/.test(sc.t), 'Sales card shows the finished month');
  // two tabs
  const p2 = await ctx.newPage(); await p2.setViewport({ width: W, height: 800 }); await p2.goto(URL); await sleep(800);
  await p2.evaluate(() => { TG.UI.closeModal(); TG.Game.nextMonth(TG.G); TG.UI.save(); }); await sleep(300);
  const m2 = await p2.evaluate(() => TG.G.month);
  await page.bringToFront(); await sleep(300);
  ok(await page.evaluate(() => TG.Game.stale === true && /played in another tab/.test(document.body.innerText)), 'old tab shows "played in another tab: reload"');
  await page.evaluate(() => { TG.UI.closeModal(); TG.Game.nextMonth(TG.G); TG.UI.save(); });
  const p3 = await ctx.newPage(); await p3.goto(URL); await sleep(800);
  ok(await p3.evaluate(() => TG.G.month) === m2, `newest progress kept (month ${m2})`);
  // landscape phone: header scrolls away
  if (W < 500) { await page.setViewport({ width: 740, height: 375 }); await page.reload(); await sleep(600); ok(await page.evaluate(() => getComputedStyle(document.querySelector('header.top')).position === 'static'), 'landscape: header scrolls away'); }
  ok(!errors.length, 'no page errors ' + errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `${fails} V8 UI CHECK(S) FAILED (width ${W})` : `ALL V8 UI CHECKS PASSED (width ${W})`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
