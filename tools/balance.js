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
      res.push({ cagr, ruined, closed: !biz || !g.businesses.includes(biz), prof: profits.length ? U.avg(profits, (x) => x) : 0, nw1 });
    }
    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    rows.push({ type, tier, style, cagr: med(res.map((r) => r.cagr)), best: Math.max(...res.map((r) => r.cagr)), ruin: res.filter((r) => r.ruined).length / res.length, closed: res.filter((r) => r.closed).length / res.length, prof: med(res.map((r) => r.prof)), nw: med(res.map((r) => r.nw1)) });
  }
}
const pct = (x) => (x * 100).toFixed(0).padStart(4) + '%';
console.log(`Capital: small $250k, in-between $600k, corporation $5M. ${SEEDS} seeds x ${MONTHS} months each.`);
console.log('type'.padEnd(13), 'tier'.padEnd(8), 'style'.padEnd(9), 'medCAGR', ' best', ' ruin', 'closed', ' med biz profit/mo (yr3+)', ' median NW');
for (const r of rows) console.log(r.type.padEnd(13), r.tier.padEnd(8), r.style.padEnd(9), pct(r.cagr).padStart(7), pct(r.best), pct(r.ruin), pct(r.closed).padStart(6), U.money(r.prof).padStart(12), U.money(r.nw).padStart(16));
if (process.argv.includes('--json')) require('fs').writeFileSync(__dirname + '/balance-results.json', JSON.stringify(rows, null, 1));
