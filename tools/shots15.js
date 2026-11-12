// v15 screenshots: three bosses, GM repair in the report, crime money card, street boss upgrades.
// NODE_PATH=/tmp/pptr/node_modules node tools/shots15.js
const path = require('path'); const fs = require('fs');
const puppeteer = require('puppeteer-core');
const OUT = path.join(__dirname);
const ART = '/opt/cursor/artifacts';
(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844 });
  const url = 'file://' + path.join(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('[data-act="newGame"]');
  await page.click('[data-act="newGame"][data-arg="rich"]');
  await page.waitForFunction(() => window.TG && TG.G && TG.G.businesses);
  await page.evaluate(() => {
    const g = TG.G; g.cash = 50e6; g.settings.crime = true;
    const p = TG.P.gen(g, TG.P.idealFor('carwash')); g.listings.push(p);
    const ac = TG.P.acquire(g, p.id, 'cash');
    if (!ac || ac.ok === false) throw new Error('acquire ' + (ac && ac.msg));
    const started = TG.B.start(g, 'carwash', p.id, {});
    if (!started || !started.biz) throw new Error('start ' + (started && started.msg));
    const b = started.biz;
    TG.B.quickSetup(g, b, true, 'standard');
    if (!b.spec.gm) { const gm = TG.S.candidate(g, b, 'gm', 0.8); gm.skill = 72; TG.S.hire(g, b, gm, 'you'); }
    if (!b.staff.some((e) => e.role === 'mech')) TG.S.hire(g, b, TG.S.candidate(g, b, 'mech', 0.7), 'you');
    const it = b.equip.find((x) => !x.leased) || b.equip[0];
    it.broken = 'major'; it.wear = 40; it.warranty = 0; it.age = 30;
    TG.E.queueBroken(g, b, it);
    TG.Game.nextMonth(g);
    TG.UI.bizId = b.id;
    TG.UI.showReport(g.lastReport);
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });
  await page.waitForSelector('.modal, #modal');
  const scrolled = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.ev')];
    const hit = nodes.find((n) => /Repaired/.test(n.innerText));
    if (hit) hit.scrollIntoView({ block: 'center' });
    return hit ? hit.innerText : '';
  });
  await new Promise((r) => setTimeout(r, 200));
  const rep = path.join(OUT, 'shots15-gm-repair.png');
  await page.screenshot({ path: rep });
  fs.copyFileSync(rep, path.join(ART, 'shots15-gm-repair.png'));
  await page.evaluate(() => { if (TG.UI.closeModal) TG.UI.closeModal(); document.querySelectorAll('.toast').forEach((t) => t.remove()); });

  await page.evaluate(() => { TG.UI.tab.biz = 'staff'; TG.UI.go('bizd'); document.querySelectorAll('.toast').forEach((t) => t.remove()); });
  await page.waitForSelector('#roleCard');
  await page.evaluate(() => { document.querySelector('#roleCard').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await new Promise((r) => setTimeout(r, 150));
  const staff = path.join(OUT, 'shots15-roles.png');
  await page.screenshot({ path: staff });
  fs.copyFileSync(staff, path.join(ART, 'shots15-roles.png'));
  const roleTxt = await page.$eval('#roleCard', (el) => el.innerText.slice(0, 400));

  await page.evaluate(() => {
    const g = TG.G;
    TG.CR.withdraw(g, 40000);
    TG.CR.buy(g, 'plug', 'sugar', 400);
    TG.Game.nextMonth(g);
    if (TG.UI.closeModal) TG.UI.closeModal();
    TG.UI.tab.crime = 'home'; TG.UI.go('crime');
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });
  await page.waitForSelector('#crBooks');
  await page.evaluate(() => document.querySelector('#crBooks').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 150));
  const crime = path.join(OUT, 'shots15-crime.png');
  await page.screenshot({ path: crime });
  fs.copyFileSync(crime, path.join(ART, 'shots15-crime.png'));
  const books = await page.$eval('#crBooks', (el) => el.innerText.slice(0, 400));

  await page.evaluate(() => {
    const g = TG.G; const pool = TG.CR.bossPool(g);
    TG.CR.hireBoss(g, pool[0].id);
    g.crime.dirty = Math.max(g.crime.dirty, 20000);
    TG.UI.tab.crime = 'crew'; TG.UI.go('crime');
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });
  await page.waitForSelector('#bossUp');
  await page.evaluate(() => document.querySelector('#bossUp').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 150));
  const boss = path.join(OUT, 'shots15-boss.png');
  await page.screenshot({ path: boss });
  fs.copyFileSync(boss, path.join(ART, 'shots15-boss.png'));
  const bossTxt = await page.$eval('#bossUp', (el) => el.innerText.slice(0, 500));

  console.log('ERRORS', errors);
  console.log('REPAIR', scrolled.replace(/\s+/g, ' ').slice(0, 240));
  console.log('ROLES', roleTxt.replace(/\s+/g, ' ').slice(0, 280));
  console.log('BOOKS', books.replace(/\s+/g, ' ').slice(0, 280));
  console.log('BOSS', bossTxt.replace(/\s+/g, ' ').slice(0, 320));
  await browser.close();
  if (errors.length || !scrolled) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
