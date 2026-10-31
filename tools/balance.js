// Balance check: ROI and risk of ruin per business type and play style at similar capital.
// node tools/balance.js [seeds=8] [months=120] [types=all]
const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
const SEEDS = Number(process.argv[2] || 8), MONTHS = Number(process.argv[3] || 120);
const only = process.argv[4] && !process.argv[4].startsWith('--') && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const CAP = { small: 250000, between: 600000, corp: 5000000 };
const rows = [];
for (const type of Object.keys(TG.CONFIG.businesses)) {
  if (only && !only.includes(type)) continue;
  const tier = TG.CONFIG.businesses[type].tier;
  for (const style of ['careful', 'reckless']) {
    const res = [];
    for (let s = 1; s <= SEEDS; s++) {
      const g = TG.Game.newGame({ seed: s * 104729 + type.length * 7 + (style === 'careful' ? 0 : 3) });
      // v6: different start years: run the world (economy + industry cycles) forward 0-10 years before starting
      const burn = (s * 37) % 121; for (let i = 0; i < burn; i++) { TG.W.month(g); g.month++; }
      const ind = TG.CONFIG.indOf[type]; const x0 = ind ? g.world.ind[ind].x : 0;
      g.cash = CAP[tier]; g.lastNW = TG.F.netWorth(g);
      const nw0 = g.cash; const biz = bots.startBiz(g, type);
      let profits = [], ruined = false;
      for (let i = 0; i < MONTHS; i++) {
        if (biz && g.businesses.includes(biz)) bots[style](g, biz); else bots.resolveSmart(g);
        TG.Game.nextMonth(g);
        if (biz && g.businesses.includes(biz) && i >= 24) profits.push(biz.hist[biz.hist.length - 1].profit);
        if (g.player.bankruptcies > 0) ruined = true;
      }
      const nw1 = g.lastNW;
      const cagr = nw1 > 0 ? Math.pow(nw1 / nw0, 12 / MONTHS) - 1 : -1;
      res.push({ x0, cagr, ruined, closed: !biz || !g.businesses.includes(biz), prof: profits.length ? U.avg(profits, (x) => x) : 0, nw1 });
    }
    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    rows.push({ type, tier, style, cagr: med(res.map((r) => r.cagr)), best: Math.max(...res.map((r) => r.cagr)), ruin: res.filter((r) => r.ruined).length / res.length, closed: res.filter((r) => r.closed).length / res.length, prof: med(res.map((r) => r.prof)), nw: med(res.map((r) => r.nw1)),
      up: med(res.filter((r) => r.x0 >= 0).map((r) => r.cagr).concat([NaN]).filter((v) => !Number.isNaN(v)).length ? res.filter((r) => r.x0 >= 0).map((r) => r.cagr) : [NaN]), down: med(res.filter((r) => r.x0 < 0).length ? res.filter((r) => r.x0 < 0).map((r) => r.cagr) : [NaN]) });
  }
}
const pct = (x) => (x * 100).toFixed(0).padStart(4) + '%';
console.log(`Capital: small $250k, in-between $600k, corporation $5M. ${SEEDS} seeds x ${MONTHS} months each.`);
console.log('type'.padEnd(13), 'tier'.padEnd(8), 'style'.padEnd(9), 'medCAGR', ' best', ' ruin', 'closed', ' good-start', ' bad-start', ' med biz profit/mo (yr3+)', ' median NW');
const p2 = (x) => (Number.isFinite(x) ? pct(x) : '   –');
for (const r of rows) console.log(r.type.padEnd(13), r.tier.padEnd(8), r.style.padEnd(9), pct(r.cagr).padStart(7), pct(r.best), pct(r.ruin), pct(r.closed).padStart(6), p2(r.up).padStart(11), p2(r.down).padStart(10), U.money(r.prof).padStart(12), U.money(r.nw).padStart(16));
{ const c = rows.filter((r) => r.style === 'careful').sort((a, b) => b.cagr - a.cagr); console.log(`careful: best ${c[0].type} ${pct(c[0].cagr)}, worst ${c[c.length - 1].type} ${pct(c[c.length - 1].cagr)}, spread ${pct(c[0].cagr - c[c.length - 1].cagr)}`);
  const sw = c.filter((r) => Number.isFinite(r.up) && Number.isFinite(r.down)).map((r) => r.up - r.down); if (sw.length) console.log(`industry cycle effect (start in good vs bad times, careful): median ${pct(sw.sort((a, b) => a - b)[Math.floor(sw.length / 2)])} CAGR, range ${pct(Math.min(...sw))} to ${pct(Math.max(...sw))}`); }
if (process.argv.includes('--json')) require('fs').writeFileSync(__dirname + '/balance-results.json', JSON.stringify(rows, null, 1));
// v6: how far each industry swings over 10-year worlds (margin index = demand x price / cost, 1.00 = normal)
{
  const inds = Object.keys(TG.CONFIG.industries); const st = {}; for (const k of inds) st[k] = { lo: 9, hi: 0, cyc: [] };
  for (let s = 1; s <= Math.max(SEEDS, 8); s++) {
    const g = TG.Game.newGame({ seed: 7001 + s * 13 });
    const prevSign = {}; const last = {};
    for (let i = 0; i < 120; i++) {
      TG.W.month(g); g.month++;
      for (const k of inds) { const m = TG.IN.demand(g, k) * TG.IN.price(g, k) / TG.IN.cost(g, k); st[k].lo = Math.min(st[k].lo, m); st[k].hi = Math.max(st[k].hi, m);
        const sg = g.world.ind[k].x >= 0; if (prevSign[k] != null && sg !== prevSign[k]) { if (last[k] != null) st[k].cyc.push(i - last[k]); last[k] = i; } prevSign[k] = sg; }
    }
  }
  console.log('\nIndustry swings over 10-year worlds (margin index: demand x price / cost; 1.00 = normal):');
  const rowsI = inds.map((k) => ({ k, lo: st[k].lo, hi: st[k].hi, half: st[k].cyc.length ? st[k].cyc.reduce((a, b) => a + b, 0) / st[k].cyc.length : NaN })).sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo));
  for (const r of rowsI) console.log('  ' + r.k.padEnd(12), 'worst', r.lo.toFixed(2), ' best', r.hi.toFixed(2), ' swing', ((r.hi / r.lo - 1) * 100).toFixed(0).padStart(3) + '%', ' half-cycle ~' + (Number.isFinite(r.half) ? r.half.toFixed(0) : '–') + ' months');
}
