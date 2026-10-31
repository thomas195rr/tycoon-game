// v9 scripted first-time personas on the staff / training / raise screens (local server, phone size).
// Each persona only taps things it can SEE by text or icon, like a new player. Logs what it found and where it got stuck.
//   NODE_PATH=/workspace/uitest/node_modules node tools/playtest/personas9.js
const puppeteer = require('puppeteer-core'); const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const notes = [];
  const persona = async (name, w, fn) => {
    const ctx = await br.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: w, height: 760 }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); // fresh profile: no old save
    await p.goto(URL); await p.waitForSelector('[data-act="newGame"]', { timeout: 30000 });
    await p.click('[data-act="newGame"][data-arg="classic"]');
    const log = []; const say = (t) => log.push(t);
    // tap the first visible element whose text matches
    const tap = async (re, within) => p.evaluate((src, within) => { const re = new RegExp(src); const root = within ? document.querySelector(within) : document; if (!root) return null; const el = [...root.querySelectorAll('[data-act]')].find((x) => x.offsetParent !== null && re.test(x.innerText || x.getAttribute('aria-label') || '')); if (!el) return null; el.click(); return (el.innerText || '').trim().slice(0, 60) || el.dataset.act; }, re.source, within || null);
    const text = (sel) => p.evaluate((sel) => { const els = document.querySelectorAll(sel || 'body'); const el = els[els.length - 1]; return el ? el.innerText : ''; }, sel);
    try { await fn({ p, tap, text, say }); } catch (e) { say('STUCK: ' + e.message); }
    if (errs.length) say('PAGE ERRORS: ' + errs.join(' | '));
    notes.push(`### ${name} (${w}px)\n` + log.map((x) => '- ' + x).join('\n')); await ctx.close();
  };
  // the player has picked a place in the Shop and opened the business with Quick setup (that part was playtested in v8)
  const openShop = async ({ p, say }, type) => {
    const nm = await p.evaluate((t) => { const g = TG.G; g.cash = Math.max(g.cash, 3e6); const pr = TG.P.gen(g, TG.P.idealFor(t)); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'cash'); const b = TG.B.start(g, t, pr.id, t === 'farm' ? { ent: 'cows' } : {}).biz; TG.B.quickSetup(g, b, true, 'standard'); g.cash = 150000; TG.UI.closeModal(); TG.UI.A.go('bizd:' + b.id); return b.name; }, type);
    say(`Opened "${nm}" with Quick setup, $150k left`);
  };
  // A) Maya, 11: hire a cheap trainee and train her
  await persona('Maya, 11, first game: "I want a cheap worker and to make her better"', 375, async (c) => {
    const { p, tap, text, say } = c; await openShop(c, 'cafe');
    say('Staff tab: ' + (await tap(/Staff/, 'main .tabs')));
    const hire = await text('#hireCard'); say(/🌱 trainee/.test(hire) ? 'Sees a 🌱 trainee in the hiring list with a lower price' : 'NO trainee in this month\'s list');
    const hired = await p.evaluate(() => { const ev = [...document.querySelectorAll('#hireCard .ev')].find((x) => /trainee/.test(x.innerText)); if (!ev) return null; ev.querySelector('[data-act="hire"]').click(); return ev.querySelector('b').innerText; });
    say(hired ? `Hired trainee ${hired}` : 'Could not hire a trainee');
    if (!hired) return;
    const m = await p.evaluate((n) => { const row = [...document.querySelectorAll('main .row.sp')].find((x) => x.innerText.includes(n) && x.querySelector('[data-act="emp"]')); if (!row) return false; row.querySelector('[data-act="emp"]').click(); return true; }, hired);
    say(m ? 'Tapped Manage on her row' : 'Could not find her Manage button');
    const t = await text('#modal'); say(/Basic training[\s\S]*skill \+\d+ to \+\d+/.test(t) ? 'Training card shows cost, skill range, time away and market value before paying' : 'Training numbers missing');
    const i = await p.evaluate(() => { const b = [...document.querySelectorAll('#modal .tipb')].find((x) => x.closest('.card') && /Training/.test(x.closest('.card').innerText.split('\n')[0])); if (!b) return ''; b.click(); const tip = [...document.querySelectorAll('#modal .tip')].find((x) => x.dataset.tip === b.dataset.arg); return tip && tip.style.display !== 'none' ? tip.innerText : ''; });
    say(i ? `Tapped the Training "i": "${i.slice(0, 90)}…"` : 'Training "i" showed NOTHING');
    const sk0 = await p.evaluate((n) => { const e = TG.S.allStaff(TG.G.businesses[0]).find((x) => x.name === n); return e && e.skill; }, hired);
    say('Train: ' + (await tap(/Train \$1,500/, '#modal')));
    const sk1 = await p.evaluate((n) => { const e = TG.S.allStaff(TG.G.businesses[0]).find((x) => x.name === n); return e && e.skill; }, hired);
    say(`Skill ${Math.round(sk0)} → ${Math.round(sk1)}; toast: "${(await text('.toast')).slice(0, 100)}"`);
  });
  // B) Dan, casual: a worker gets a job offer
  await persona('Dan, casual player: "someone wants to steal my best stylist?"', 375, async (c) => {
    const { p, tap, text, say } = c; await openShop(c, 'salon');
    await p.evaluate(() => { const g = TG.G, b = g.businesses[0]; const e = b.staff[0]; e.skill = 85; e.pers = 'climber'; e.persSeen = true; e.loyalty = 5; e.wage = Math.round(TG.S.mv(g, b, e) * 0.6); TG.UI.render(); });
    say('Staff tab: ' + (await tap(/Staff/, 'main .tabs')));
    const row = await p.evaluate(() => { const r = [...document.querySelectorAll('main .row.sp')].find((x) => /🎯/.test(x.innerText) && /under market/.test(x.innerText)); return r ? r.innerText.replace(/\n/g, ' ') : ''; });
    say(row ? `Sees the risk on the row: "${row.slice(0, 140)}"` : 'No risk visible on the row');
    const leg = await text('main'); say(/🤝 loyal · 🙂 steady · 📈 climber/.test(leg) ? 'Legend under "Staff" explains the icons' : 'No legend for the icons');
    let card = null; for (let i = 0; i < 24 && !card; i++) { await p.evaluate(() => { const g = TG.G, b = g.businesses[0]; const e = b.staff[0]; if (e) { e.wage = Math.round(TG.S.mv(g, b, e) * 0.6); e.loyalty = 5; } if (b.stock) TG.ST.buy(g, b, TG.ST.suggest(b, g)); }); await p.evaluate(() => { TG.UI.S.supOK = TG.G.month; TG.UI.A.next('sup'); TG.UI.closeModal(); }); card = await p.evaluate(() => { const d = TG.G.decisions.find((x) => x.kind === 'poach'); return d ? d.title : null; }); }
    if (!card) { say('No job offer came in 24 months (odds, not certain)'); return; }
    await p.evaluate(() => TG.UI.A.decisions()); const t = await text('#modal');
    say(`Job-offer card: "${card}". Shows: ${['offered', 'You pay', 'market value', 'they stay', 'Let them go'].filter((w) => t.includes(w)).join(', ')}`);
    say('Taps: ' + (await tap(/Match/, '#modal')));
  });
  // C) Lee, teen min-maxer: cheap, train hard, never raise
  await persona('Lee, 15, min-maxer: "train everyone twice a month, never pay more"', 375, async (c) => {
    const { p, tap, text, say } = c; await openShop(c, 'auto');
    await p.evaluate(() => { TG.G.cash += 50000; TG.UI.A.tab('biz:staff'); });
    await p.evaluate(() => { const b = [...document.querySelectorAll('main [data-act="emp"]')][0]; b.click(); });
    for (let i = 0; i < 3; i++) { await tap(/Train \$1,500/, '#modal'); say(`Training #${i + 1}: "${(await text('.toast')).slice(0, 90)}"`); }
    const r = await text('#modal'); say(/No more training this month/.test(r) ? 'Popup says no more training this month (it backfires)' : 'No limit message');
    const mv = await p.evaluate(() => { const g = TG.G, b = g.businesses[0], e = b.staff[0]; return `pay $${e.wage}, market $${TG.S.mv(g, b, e)}, risk ${(TG.S.poachOdds(g, b, e).p * 100).toFixed(1)}%/mo`; });
    say(`After training: ${mv}`);
  });
  // D) Rosa, 70: what is "market value"?
  await persona('Rosa, 70: "what does market value mean, and what does a raise cost me?"', 1280, async (c) => {
    const { p, tap, text, say } = c; await openShop(c, 'bakery');
    await p.evaluate(() => { TG.UI.A.tab('biz:staff'); const b = [...document.querySelectorAll('main [data-act="emp"]')][0]; b.click(); });
    const mvTip = await p.evaluate(() => { const l = [...document.querySelectorAll('#modal .lb')].find((x) => /Market value/.test(x.innerText)); if (!l) return ''; l.click(); const t = [...document.querySelectorAll('#modal .tip')].find((x) => x.dataset.tip === l.dataset.arg); return t && t.style.display !== 'none' ? t.innerText : ''; });
    say(mvTip ? `Tapped "Market value": "${mvTip.slice(0, 120)}…"` : 'Tapping "Market value" showed nothing');
    const btn = await p.evaluate(() => [...document.querySelectorAll('#modal [data-act="empDo"]')].map((x) => x.innerText).filter((x) => /\+8%|market/.test(x)).join(' | '));
    say(`Raise buttons read: "${btn}"`);
    say('Taps: ' + (await tap(/\+8%/, '#modal')) + ` → toast "${(await text('.toast')).slice(0, 80)}"`);
  });
  // E) Sam, farm kid: old cows
  await persona('Sam, 12, farm fan: "what are dry cows and what do I do with them?"', 375, async (c) => {
    const { p, tap, text, say } = c;
    await openShop(c, 'farm');
    const d = await p.evaluate(() => { const g = TG.G, b = g.businesses[0]; for (const k in b.spec) b.spec[k] = null; g.ceo = null; const a = b.farm.areas.cows; TG.M.herdSync(a); a.st.dry = Math.max(15, Math.ceil(a.herd * 0.12)); TG.M.herdSync(a); TG.UI.render(); return TG.M.dryPile(g, b); });
    say(`(setup: ${d.n} dry cows, no manager)`);
    const now = await text('main'); say(/dry \/ old cows/.test(now) ? 'Now page shows the dry-cow row with feed cost and a Sell button' : 'No dry-cow row'); say(/piling up/.test(now) ? 'Sees "Dry cows are piling up" heads-up' : 'no heads-up');
    const tip = await p.evaluate(() => { const ch = [...document.querySelectorAll('.herdchips [data-act="tip"]')].find((x) => /dry/.test(x.innerText)); if (!ch) return ''; ch.click(); const t = [...document.querySelectorAll('.tip')].find((x) => x.dataset.tip === ch.dataset.arg); return t ? t.innerText : ''; });
    say(tip ? `Tapped "dry / old cows": "${tip.slice(0, 140)}…"` : 'Tapping the dry chip showed nothing');
    say('Taps: ' + (await tap(/Sell all for/, 'main')) + ` → "${(await text('.toast')).slice(0, 80)}"`);
  });
  console.log(notes.join('\n\n'));
  await br.close();
})();
