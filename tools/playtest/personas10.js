// v10 scripted first-time personas (local server). Each persona taps what it can SEE (text/icons), like a new player,
// and every step is checked against a "how it should work" list. Prints a log + checklist (also tools/playtest/log10.txt).
//   NODE_PATH=/workspace/uitest/node_modules node tools/playtest/personas10.js
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
const SHOULD = {
  dry: 'Farm Now tab: a 👵 Dry / old cows row sits right under 🥩 Market-ready, even with 1 cow (or 0), with a box + 💵 Sell',
  cost: 'Every "how many" box next to Buy/Sell shows "N × price each = total" and updates while typing',
  pay: 'Every upgrade card shows its price, 📈 what it adds per month and ⏱️ how many months to pay back, before buying',
  adsPrev: 'Ads tab shows what a budget would do before saving, and what the ads really did last month',
  vacant: 'A rental you just bought is completely empty: every unit needs its own tenant',
  unitRent: 'Each empty unit has its own rent picker; the total "when full" adds them up',
  down: 'A mortgage lets you choose the down payment (20-50%) and shows the monthly payment for it',
  takeover: 'You can start by taking over a failing business of any type: worn gear, low morale, weak reputation, debt',
  gear: 'Gear tab: 🔧 machines cared for X/Y (machines, not cows), ♻️ who replaces destroyed machines, 🛡️ machine insurance with its odds',
  noMgr: 'With no GM/Ops manager, a destroyed machine waits for YOU (Replace like-for-like or Scrap)',
  like: 'With an Ops manager, the like-for-like order makes them replace with the same kind and quality',
  bonus: 'A worker card shows what a bonus does to loyalty and to the odds a rival hires them away',
  casino: 'Casino shows no table limit and no bets-left counter; odds text unchanged',
  play: 'Home shows total play time in game years (across games)',
  gmops: 'Manager tab explains GM (people & sales) vs Ops (machines & running things)',
};
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const notes = []; const check = {};
  const mark = (k, okk, why) => { (check[k] = check[k] || []).push({ ok: !!okk, why }); };
  const persona = async (name, w, start, fn) => {
    const ctx = await br.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: w, height: 760 }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('[data-act="newGame"]', { timeout: 30000 });
    const log = []; const say = (t) => log.push(t);
    const tap = async (re, within) => p.evaluate((src, within) => { const re = new RegExp(src); const root = within ? document.querySelector(within) : document; if (!root) return null; const el = [...root.querySelectorAll('button,[data-act]')].find((x) => re.test(x.innerText || '') && x.getBoundingClientRect().width > 0); if (!el) return null; el.click(); return (el.innerText || '').trim().slice(0, 60); }, re.source, within || null);
    const text = (sel) => p.evaluate((sel) => { const el = document.querySelector(sel || 'main'); return el ? el.innerText : ''; }, sel);
    const type = async (id, v) => p.evaluate((id, v) => { const el = document.getElementById(id); if (!el) return false; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, id, v);
    try { await start(p); await new Promise((r) => setTimeout(r, 250)); await fn({ p, tap, text, say, type }); } catch (e) { say('STUCK: ' + e.message); }
    if (errs.length) say('PAGE ERRORS: ' + errs.join(' | '));
    const side = await p.evaluate((w) => document.documentElement.scrollWidth <= w + 1, w); if (!side) say('⚠️ page scrolls sideways');
    notes.push(`### ${name} (${w}px)\n` + log.map((x) => '- ' + x).join('\n')); await ctx.close();
  };
  const rich = async (p) => { await p.click('[data-act="newGame"][data-arg="rich"]'); };
  // A) Leo, 10: cow farm
  await persona('Leo, 10: "I have a cow farm. What do I do with old cows?"', 375, rich, async ({ p, tap, text, say, type }) => {
    await p.evaluate(() => { const g = TG.G; const pr = TG.P.gen(g, { kind: 'ranch' }); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'lease'); const b = TG.B.start(g, 'farm', pr.id, { ent: 'cows' }).biz; TG.B.quickSetup(g, b, true, 'standard'); const a = b.farm.areas.cows; a.st.dry = 1; TG.M.herdSync(a); TG.UI.go('biz'); });
    say('My Biz: ' + (await tap(/Farm/, 'main')));
    const t = await text(); const i = t.indexOf('Market-ready'), j = t.indexOf('Dry / old cows');
    say(j > i && i > 0 ? 'Sees 👵 Dry / old cows right after 🥩 Market-ready' : 'NO dry cow row near Market-ready'); mark('dry', j > i && i > 0, 'farm with 1 dry cow');
    const line = await text('#cl_qDry'); say(`Under it: "${line}"`); mark('cost', /Sell: 1 ×/.test(line), 'dry cow sell value');
    await type('qFeed', '25'); const fl = await text('#cl_qFeed'); say(`Types 25 tons of feed: "${fl}"`); mark('cost', /25 × \$[\d,]+ = \$[\d,]+/.test(fl), 'feed total updates live');
    const sold = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act="cowSell"][data-arg="dry"]')][0]; if (!b) return false; b.click(); return true; });
    say(sold ? 'Tapped 💵 Sell on the dry row' : 'Could not find Sell on the dry row');
    const t2 = await text(); mark('dry', /Dry \/ old cows[\s\S]{0,80}\b0\b/.test(t2), 'row stays at 0 after selling'); say(/Dry \/ old cows/.test(t2) ? 'Row is still there showing 0' : 'Row disappeared after selling');
    say('Gear tab: ' + (await tap(/Gear/, 'main .tabs'))); const g = await text(); mark('gear', /Machines cared for/.test(g) && /Machine insurance/.test(g), 'farm gear'); say(/Machines cared for/.test(g) ? 'Sees 🔧 Machines cared for and 🛡️ Machine insurance' : 'No machine care card');
  });
  // B) Ava, 13: cafe upgrades + ads
  await persona('Ava, 13: "How do I make my cafe earn more?"', 375, rich, async ({ p, tap, text, say, type }) => {
    await p.evaluate(() => { const g = TG.G; const pr = TG.P.gen(g, TG.P.idealFor('cafe')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'lease'); const b = TG.B.start(g, 'cafe', pr.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); for (let i = 0; i < 3; i++) { TG.ST.buy(g, b, 4000, 0); TG.Game.nextMonth(g); } TG.UI.bizId = b.id; TG.UI.go('bizd'); });
    const sup = await type('qSup', '500'); const sl = await text('#cl_qSup'); say(`Types 500 supplies: "${sl}"`); mark('cost', sup && /500 × \$[\d.]+ = \$[\d,]+/.test(sl), 'cafe supplies');
    say('Tab: ' + (await tap(/Upgrades/, 'main .tabs')));
    const cards = await p.evaluate(() => [...document.querySelectorAll('.upgcard')].map((c) => c.innerText));
    const withPay = cards.filter((c) => /📈/.test(c) && /(pays back|pays from|does not pay)/.test(c)); say(`${cards.length} upgrades; ${withPay.length} show payback. Top one: "${(cards[0] || '').split('\n')[0]}" – ${((cards[0] || '').match(/pays[^\n]*/) || [''])[0]}`);
    mark('pay', cards.length >= 9 && withPay.length === cards.length, `${withPay.length}/${cards.length} cards`);
    const bought = await p.evaluate(() => { const c = [...document.querySelectorAll('.upgcard')].find((x) => /pays back in|pays from/.test(x.innerText)); const b = c && c.querySelector('[data-act="fix"]'); if (!b || b.disabled) return null; const name = c.innerText.split('\n')[0]; b.click(); return name; });
    say(bought ? `Bought the best-payback one: ${bought}` : 'Nothing that pays back right now');
    say('Tab: ' + (await tap(/Ads/, 'main .tabs'))); await type('adBudget', '1500'); const pv = await text('#adPrevBox'); say(`Types $1,500: "${pv.slice(0, 120)}"`);
    await tap(/Save ad plan/); await p.evaluate(() => { TG.Game.nextMonth(TG.G); TG.UI.render(); }); const t = await text(); const meas = (t.match(/Last month[^\n]*\n?[^\n]*/) || [''])[0];
    say(`Next month the Ads tab says: "${meas.replace(/\s+/g, ' ').slice(0, 120)}"`); mark('adsPrev', /≈ \+\d+%/.test(pv) && /Last month \(\$1,500\)/.test(t), 'preview + measured');
    const cu = /Your customers/.test(t); say(cu ? 'Sees "Your customers": commuters, remote workers, students, food lovers' : 'No customer list');
    say('Home: ' + (await tap(/Home/, 'nav'))); const pt = await text('#playTime'); say(`"${pt}"`); mark('play', /Play time: .*(mo|yr)/.test(pt), pt);
  });
  // C) Sam, 15, desktop: real estate with a mortgage
  await persona('Sam, 15: "I want to buy a duplex with a loan and rent it out"', 1280, rich, async ({ p, tap, text, say }) => {
    await p.evaluate(() => { const g = TG.G; g.player.credit = 800; TG.UI.tab.money = 're'; TG.UI.go('money'); });
    const lid = await p.evaluate(() => { const l = TG.G.re.listings.filter((x) => x.units > 1 && x.units <= 20 && !x.distressed).sort((a, b) => a.price - b.price)[0]; if (!l) return null; TG.UI.A.reFin(l.id); return l.id; });
    if (!lid) { say('No multi-unit home for sale'); return; }
    const opts = await p.evaluate(() => [...document.querySelectorAll('#modal select[data-change="finDown"] option')].map((o) => o.textContent));
    say(`Mortgage screen: down payment choices ${opts.join(' / ')}`);
    const pay1 = await text('#modal'); const before = (pay1.match(/Loan payment\s*\$[\d,]+\/mo/) || [''])[0];
    await p.evaluate(() => { const s = document.querySelector('#modal select[data-change="finDown"]'); s.selectedIndex = 3; s.dispatchEvent(new Event('change', { bubbles: true })); });
    const pay2 = await text('#modal'); const after = (pay2.match(/Loan payment\s*\$[\d,]+\/mo/) || [''])[0]; say(`Picks 50% down: ${before.replace(/\s+/g, ' ')} -> ${after.replace(/\s+/g, ' ')}`);
    mark('down', opts.length === 4 && before !== after, 'down payment changes payment');
    const got = await p.evaluate(() => { const r = TG.R.chance; TG.R.chance = () => true; try { const b = document.querySelector('#modal [data-act="reFinGo"]'); if (!b || b.disabled) return 'button disabled'; b.click(); } finally { TG.R.chance = r; } return 'ok'; });
    say('Apply & buy: ' + got);
    const h = await p.evaluate(() => { const h = TG.G.re.holdings[TG.G.re.holdings.length - 1]; return h ? { units: h.units, empty: h.tenants.filter((t) => !t).length } : null; });
    say(h ? `Owns it: ${h.empty} of ${h.units} units empty` : 'Did not buy'); mark('vacant', h && h.empty === h.units, 'mortgaged rental');
    const sels = await p.evaluate(() => document.querySelectorAll('select.usel').length); say(`Sees ${sels} rent pickers (one per empty unit)`);
    await p.evaluate(() => { const s = document.querySelectorAll('select.usel')[1]; if (s) { s.selectedIndex = s.options.length - 2; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    const t = await text(); const tot = (t.match(/Rents set per unit = \$[\d,]+\/mo when full/) || [''])[0]; say(`After raising unit 2's rent: "${tot}"`); mark('unitRent', sels >= 2 && !!tot, 'per-unit rent');
    say('Search unit 1: ' + (await tap(/Search \$/, 'main'))); const m = await text('#modal'); say(/Rent you ask/.test(m) ? `Search screen: "${(m.match(/Rent you ask[^\n]*\n?[^\n]*/) || [''])[0].replace(/\s+/g, ' ')}"` : 'No search screen');
  });
  // D) Kim, 12: failing salon
  await persona('Kim, 12: "Give me a broken business to fix"', 375, async (p) => { await p.select('#ngFail', 'carwash'); await p.click('[data-act="newGame"][data-arg="failing"]'); }, async ({ p, tap, text, say }) => {
    const s = await p.evaluate(() => { const b = TG.G.businesses[0]; return b && { type: b.type, rep: Math.round(b.rep), broken: b.equip.filter((x) => x.broken).length, n: b.equip.length, debt: Math.round(TG.U.sum(TG.G.loans, (l) => l.balance)), cash: TG.G.cash, mor: Math.round(TG.U.avg(b.staff, (e) => e.morale)) }; });
    say(s ? `Started with a ${s.type}: rep ${s.rep}, ${s.broken}/${s.n} machines broken, team morale ${s.mor}, debt $${s.debt.toLocaleString()}, cash $${s.cash.toLocaleString()}` : 'No business');
    mark('takeover', s && s.rep < 30 && s.debt > 0 && s.mor < 50, 'failing carwash start');
    say('Gear tab: ' + (await tap(/Gear/, 'main .tabs')));
    const kill = await p.evaluate(() => { const b = TG.G.businesses[0]; const it = b.equip.find((x) => !x.broken); if (!it) return null; it.broken = 'destroyed'; TG.E.queueBroken(TG.G, b, it); TG.UI.render(); return it.id; });
    const g = await text(); say(/you decide/.test(g) ? 'Gear says a destroyed machine waits for "you decide" (no manager)' : 'No replacement rule shown'); mark('gear', /Machines cared for \d|\d+\/\d+/.test(g) && /Machine insurance/.test(g), 'failing start gear');
    const open = await p.evaluate(() => { document.querySelectorAll('main details').forEach((d) => { d.open = true; }); return !!document.querySelector('[data-act="eqDo"][data-arg$="|replace"]'); });
    say(open ? 'Sees ♻️ Replace like-for-like and 🗑️ Scrap on the destroyed machine' : 'No replace button'); mark('noMgr', open && /you decide/.test(g), 'destroyed waits');
    const rep = await p.evaluate((id) => { const b = TG.G.businesses[0]; const btn = document.querySelector(`[data-act="eqDo"][data-arg="${id}|replace"]`); if (!btn) return null; TG.G.cash = Math.max(TG.G.cash, 1e5); btn.click(); return b.equip.some((x) => x.broken === 'destroyed'); }, kill);
    say(rep === false ? 'Replaced it' : 'Could not replace');
  });
  // E) Raj, 14: managers, bonus, casino
  await persona('Raj, 14: "GM or Ops? And can I bet big?"', 375, rich, async ({ p, tap, text, say }) => {
    await p.evaluate(() => { const g = TG.G; const pr = TG.P.gen(g, TG.P.idealFor('auto')); g.listings.unshift(pr); TG.P.acquire(g, pr.id, 'lease'); const b = TG.B.start(g, 'auto', pr.id, {}).biz; TG.B.quickSetup(g, b, true, 'standard'); TG.UI.bizId = b.id; TG.UI.tab.biz = 'mgr'; TG.UI.go('bizd'); });
    const t = await text(); say(/GM or Ops manager\?/.test(t) ? 'Manager tab: "GM or Ops manager?" card with what each does' : 'No GM/Ops card'); mark('gmops', /people & sales|hiring, pay/.test(t) && /supplies/.test(t), 'manager tab');
    await p.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); const c = TG.S.poolFor(TG.G, b, 'ops')[0]; TG.S.hire(TG.G, b, c); TG.UI.tab.biz = 'equip'; TG.UI.render(); });
    say('Gear: ' + (await tap(/Like-for-like/, 'main')));
    const like = await p.evaluate(() => { const g = TG.G, b = TG.B.get(g, TG.UI.bizId); const it = b.equip.find((x) => !x.broken && x.tier === 'standard'); it.broken = 'destroyed'; TG.E.queueBroken(g, b, it); g.month++; const roll = TG.D.roll; TG.D.roll = () => 'good'; try { TG.D.autoResolve(g); } finally { TG.D.roll = roll; } return { left: b.equip.some((x) => x.broken === 'destroyed'), same: b.equip.filter((x) => x.type === it.type && x.tier === 'standard').length > 0, on: !!b.orders.replaceLike }; });
    say(`Destroyed a standard machine: Ops manager ${like.left ? 'did NOT replace it' : 'replaced it'}${like.same ? ' with a standard one' : ''}`); mark('like', like.on && !like.left && like.same, 'like-for-like');
    await p.evaluate(() => { TG.UI.tab.biz = 'staff'; TG.UI.render(); }); const e = await p.evaluate(() => { const b = TG.B.get(TG.G, TG.UI.bizId); TG.UI.A.emp(b.staff[0].id); return (document.getElementById('bonusPrev') || {}).innerText || ''; });
    say(`Worker card: "${e.slice(0, 120)}"`); mark('bonus', /loyalty \d+ → \d+/.test(e) && /hires them away/.test(e), 'bonus preview');
    await p.evaluate(() => { TG.UI.closeModal(); TG.G.settings.gambling = true; TG.UI.tab.money = 'casino'; TG.UI.go('money'); });
    const c = await text(); say(/none \(bet any amount/.test(c) ? 'Casino: "Table limit: none"' : 'Casino still shows a limit'); mark('casino', !/Bets left/.test(c) && /18 in 37/.test(c + (await p.evaluate(() => Object.values(TG.UI.S.tips || {}).join(' ') + document.body.innerHTML))), 'casino');
    const big = await p.evaluate(() => { TG.G.cash = 1e6; document.getElementById('betAmt').value = '250000'; const b = [...document.querySelectorAll('[data-act="bet"]')][0]; b.click(); return TG.UI.S.lastBet ? TG.UI.S.lastBet.text : ''; });
    say(`Bets $250,000: "${big.slice(0, 80)}"`);
  });
  const lines = ['# v10 playtest', '', ...notes, '', '## How it should work (checklist)'];
  let bad = 0; for (const [k, txt] of Object.entries(SHOULD)) { const r = check[k] || []; const okk = r.length && r.every((x) => x.ok); if (!okk) bad++; lines.push(`- [${okk ? 'x' : ' '}] ${txt}${r.length ? '' : ' (NOT CHECKED)'}${r.filter((x) => !x.ok).map((x) => ' ✗ ' + x.why).join('')}`); }
  lines.push('', bad ? `${bad} checklist item(s) not working` : 'All checklist items work');
  const out = lines.join('\n'); console.log(out); fs.writeFileSync(path.join(__dirname, 'log10.txt'), out + '\n');
  await br.close();
})();
