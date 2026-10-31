// Two tabs on one save: does the stale tab overwrite progress made in the other tab?
const puppeteer = require('puppeteer-core');
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const ctx = await br.createBrowserContext(); const U = 'http://127.0.0.1:8765/index.html';
  const a = await ctx.newPage(); await a.goto(U, { waitUntil: 'networkidle0' });
  await a.click('[data-act="newGame"]'); await new Promise(r => setTimeout(r, 800));
  const hdr = (p) => p.evaluate(() => document.querySelector('header').innerText.replace(/\n/g, ' '));
  const next = async (p) => { await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Next Month/.test(b.innerText)); b.click(); }); await new Promise(r => setTimeout(r, 700)); await p.evaluate(() => { const c = [...document.querySelectorAll('#modal button')].find(b => b.innerText.trim() === 'Close'); if (c) c.click(); }); };
  const b = await ctx.newPage(); await b.goto(U, { waitUntil: 'networkidle0' });
  console.log('A start', await hdr(a)); console.log('B start', await hdr(b));
  for (let i = 0; i < 5; i++) await next(b);
  console.log('B after 5 months', await hdr(b));
  await a.bringToFront(); await next(a);
  console.log('A (stale) after 1 month', await hdr(a));
  const c = await ctx.newPage(); await c.goto(U, { waitUntil: 'networkidle0' });
  console.log('Fresh tab loads', await hdr(c));
  await br.close();
})();
