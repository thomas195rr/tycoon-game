// Quick 10-year money check for v14. One careful start per business (and a reckless pass),
// plus each rental kind. Not the full 24-seed audit.
//   node tools/money-v14.js [seeds=6] [months=120]
const TG = require('../test/load')(); const bots = require('../test/bots')(TG);
const SEEDS = Number(process.argv[2] || 6), MONTHS = Number(process.argv[3] || 120);
const pct = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : '–');
const med = (a) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const q = (a, p) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
function summ(res) {
  return { n: res.length, med: med(res.map((r) => r.cagr)), grew: res.filter((r) => r.cagr > 0).length / Math.max(1, res.length), prof: res.filter((r) => r.prof3 > 0).length / Math.max(1, res.length), ruin: res.filter((r) => r.ruined).length / Math.max(1, res.length), p10: q(res.map((r) => r.cagr), 0.1), boom: med(res.filter((r) => r.x0 >= 0).map((r) => r.cagr)), slump: med(res.filter((r) => r.x0 < 0).map((r) => r.cagr)) };
}
const lines = [];
lines.push('v14 money check: ' + SEEDS + ' seeds x ' + MONTHS + ' months. Careful bot, one normal start (lease if that is what fits). Reckless on the same cash.');
lines.push('unit                 median/yr  grew   prof yr2-3  ruin   worst10%   boom-start  slump-start   reckless med/ruin');
const bizUnits = Object.keys(TG.CONFIG.businesses).filter((t) => t !== 'farm').concat(['farm:cows', 'farm:crops', 'farm:orchard']);
for (const unit of bizUnits) {
  const [type, ent] = unit.split(':'); const tier = TG.CONFIG.businesses[type].tier;
  const CAP = { small: 250000, between: 600000, corp: 5000000 }[tier];
  const run = (style, s) => {
    const g = TG.Game.newGame({ seed: s * 7919 + unit.length * 17 + (style === 'reckless' ? 9 : 0) }); TG.G = g;
    const burn = (s * 37) % 80; for (let i = 0; i < burn; i++) { TG.W.month(g); g.month++; }
    const ind = TG.CONFIG.indOf[type]; const x0 = ind ? g.world.ind[ind].x : 0;
    g.cash = CAP; g.lastNW = TG.F.netWorth(g); const nw0 = g.cash;
    if (ent === 'orchard') g.listings.push(TG.P.gen(g, { kind: 'hillside', loc: 'rural' }));
    if (ent === 'cows') g.listings.push(TG.P.gen(g, { kind: 'ranch' }));
    const biz = bots.startBiz(g, type, Object.assign({ check: style === 'careful' }, ent ? { ent } : {}));
    if (!biz) return null;
    let ruined = false; const pr = [];
    for (let i = 0; i < MONTHS; i++) {
      if (g.businesses.includes(biz)) bots[style](g, biz); else bots.resolveSmart(g);
      TG.Game.nextMonth(g);
      if (g.businesses.includes(biz) && i >= 12 && i < 36) pr.push(biz.hist[biz.hist.length - 1].profit);
      if (g.player.bankruptcies > 0) ruined = true;
    }
    const nw1 = g.lastNW; const cagr = nw1 > 0 && nw0 > 0 ? Math.pow(nw1 / nw0, 12 / MONTHS) - 1 : -1;
    return { cagr, ruined, x0, prof3: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : -1 };
  };
  const care = [], reck = [];
  for (let s = 1; s <= SEEDS; s++) { const c = run('careful', s); if (c) care.push(c); if (s <= Math.max(4, Math.ceil(SEEDS / 2))) { const r = run('reckless', s); if (r) reck.push(r); } }
  const A = summ(care), R = summ(reck);
  const name = unit.padEnd(20);
  lines.push(`${name} ${pct(A.med).padStart(6)}  ${pct(A.grew).padStart(5)}  ${pct(A.prof).padStart(8)}  ${pct(A.ruin).padStart(5)}  ${pct(A.p10).padStart(8)}  ${pct(A.boom).padStart(8)}  ${pct(A.slump).padStart(8)}    ${pct(R.med)} / ${pct(R.ruin)}`);
  console.log(lines[lines.length - 1]);
}
const kinds = Object.keys(TG.CONFIG.realEstate.kinds);
for (const unit of kinds) {
  const all = [];
  for (const fin of ['cash', 'mortgage']) for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: 3100 + s * 53 + unit.length * 7 + (fin === 'cash' ? 0 : 1) }); TG.G = g;
    const burn = (s * 37) % 80; for (let i = 0; i < burn; i++) { TG.W.month(g); g.month++; }
    const x0 = g.world.housing - 1;
    const L = TG.RE.gen(g, unit, { distressed: false }); g.re.listings = [L];
    const fees = Math.round(L.price * TG.CONFIG.property.buyCostPct); const ltv = TG.CONFIG.realEstate.kinds[unit].commercial ? 0.75 : 0.8;
    const mort = fin !== 'cash'; g.cash = Math.round(!mort ? L.price + fees + L.price * 0.08 : L.price * (1 - ltv) + fees + L.price * 0.1); g.lastNW = TG.F.netWorth(g); const nw0 = g.cash;
    const r0 = TG.RE.buy(g, L.id, mort, 360); if (!r0 || r0.ok === false) continue;
    const h = r0.h; let ruined = false; const pr = [];
    if (h.units > 20 && !g.re.manager) { const c = TG.RE.managerPool(g).slice().sort((a, b) => b.skill - a.skill)[0]; if (c) TG.RE.hireManager(g, c); }
    for (let m = 0; m < MONTHS; m++) {
      if (g.re.holdings.includes(h)) {
        for (let u = 0; u < h.tenants.length; u++) if (!h.tenants[u] && g.cash > 5000) { if (!TG.RE.current(g, h, u)) TG.RE.search(g, h.id, null, u); let tries = 0; while (TG.RE.current(g, h, u) && !h.tenants[u] && tries++ < 6) { const a = TG.RE.current(g, h, u); const marks = TG.RE.applicantMarks ? TG.RE.applicantMarks(a) : []; const bad = marks.filter((x) => x.tone === 'bad').length; TG.RE.decide(g, h.id, bad < 2 || tries > 3, u); } }
        for (const it of (h.issues || []).slice()) if (g.cash > TG.RE.fixCost(g, it) + 2000) TG.RE.fixIssue(g, h.id, it.id);
      }
      const c0 = g.cash; TG.Game.nextMonth(g); bots.resolveSmart(g); if (m >= 12 && m < 36) pr.push(g.cash - c0);
      if (g.player.bankruptcies > 0) ruined = true;
    }
    const nw1 = g.lastNW; const cagr = nw1 > 0 && nw0 > 0 ? Math.pow(nw1 / nw0, 12 / MONTHS) - 1 : -1;
    all.push({ cagr, ruined, x0, prof3: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : -1 });
  }
  const A = summ(all);
  const name = ('re:' + unit).padEnd(20);
  lines.push(`${name} ${pct(A.med).padStart(6)}  ${pct(A.grew).padStart(5)}  ${pct(A.prof).padStart(8)}  ${pct(A.ruin).padStart(5)}  ${pct(A.p10).padStart(8)}  ${pct(A.boom).padStart(8)}  ${pct(A.slump).padStart(8)}`);
  console.log(lines[lines.length - 1]);
}
require('fs').writeFileSync(require('path').join(__dirname, 'money-check-v14.txt'), lines.join('\n') + '\n');
console.log('wrote tools/money-check-v14.txt');
