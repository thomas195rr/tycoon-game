// v14 screenshots: gear buy confirm, a compact tab, people manager, save slots, crime crew categories.
// NODE_PATH=/tmp/pptr/node_modules node tools/shots14.js
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
    const g = TG.G; g.cash = 8e6; g.settings.crime = true;
    const p = TG.P.gen(g, TG.P.idealFor('factory')); g.listings.push(p);
    TG.P.acquire(g, p.id, 'lease');
    const b = TG.B.start(g, 'factory', p.id, {}).biz;
    TG.B.quickSetup(g, b, true, 'standard');
    TG.UI.bizId = b.id; TG.UI.tab.biz = 'equip'; TG.UI.S.eqTier = 'premium'; TG.UI.go('bizd');
  });
  await page.waitForSelector('#gearBuy');
  await page.click('#gearBuy ~ .card [data-act="eqBuy"], .card [data-act="eqBuy"]');
  await page.waitForSelector('#gearConfirm');
  await page.click('[data-act="eqN"][data-arg="10"]');
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await new Promise((r) => setTimeout(r, 150));
  const gear = path.join(OUT, 'shots14-gear-buy.png');
  await page.screenshot({ path: gear });
  fs.copyFileSync(gear, path.join(ART, 'shots14-gear-buy.png'));
  const gearTxt = await page.$eval('#gearConfirm', (el) => el.innerText);
  await page.click('[data-act="closeModal"]');

  await page.evaluate(() => { TG.UI.tab.biz = 'staff'; TG.UI.render(); document.querySelectorAll('.toast').forEach((t) => t.remove()); });
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => window.scrollTo(0, 0));
  const staff = path.join(OUT, 'shots14-staff-top.png');
  await page.screenshot({ path: staff });
  fs.copyFileSync(staff, path.join(ART, 'shots14-staff-top.png'));

  await page.evaluate(() => {
    const g = TG.G, b = TG.B.get(g, TG.UI.bizId);
    TG.UI.S.hireRole = 'people'; TG.UI.render();
  });
  await page.waitForSelector('#hireCard');
  await page.evaluate(() => document.querySelector('#hireCard').scrollIntoView({ block: 'start' }));
  const ppl = path.join(OUT, 'shots14-people-manager.png');
  await page.screenshot({ path: ppl });
  fs.copyFileSync(ppl, path.join(ART, 'shots14-people-manager.png'));
  const pplTxt = await page.$eval('#hireCard', (el) => el.innerText.slice(0, 500));

  await page.evaluate(() => {
    const cur = TG.Game.slots.active();
    TG.Game.slots.create('Parked game');
    if (cur) TG.Game.slots.activate(cur);
    TG.UI.tab.more = 'set'; TG.UI.go('more');
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });
  await page.waitForSelector('#slotCard');
  await page.evaluate(() => document.querySelector('#slotCard').scrollIntoView({ block: 'start' }));
  const slots = path.join(OUT, 'shots14-save-slots.png');
  await page.screenshot({ path: slots });
  fs.copyFileSync(slots, path.join(ART, 'shots14-save-slots.png'));

  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => { TG.UI.tab.crime = 'crew'; TG.UI.S.crRole = 'lookout'; TG.UI.go('crime'); document.querySelectorAll('.toast').forEach((t) => t.remove()); });
  await page.waitForSelector('#crewCats');
  await page.evaluate(() => window.scrollTo(0, 0));
  const crew = path.join(OUT, 'shots14-crime-crew.png');
  await page.screenshot({ path: crew });
  fs.copyFileSync(crew, path.join(ART, 'shots14-crime-crew.png'));
  const crewTxt = await page.$eval('#crewCats', (el) => el.innerText);

  console.log('ERRORS', errors);
  console.log('GEAR', gearTxt.replace(/\s+/g, ' ').slice(0, 300));
  console.log('PEOPLE', pplTxt.replace(/\s+/g, ' ').slice(0, 300));
  console.log('CREW', crewTxt.replace(/\s+/g, ' ').slice(0, 300));
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
