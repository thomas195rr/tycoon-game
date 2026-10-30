// Crime vs legit balance: same $250k start, careful legit small businesses vs crime strategies. node tools/crime-balance.js [seeds=16] [months=120]
const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const CB = require('../test/crime-bots')(TG); const U = TG.U;
const SEEDS = Number(process.argv[2] || 16), MONTHS = Number(process.argv[3] || 120); const START = 250000;
const plans = {
  'legit careful (cafe)': { biz: 'cafe' }, 'legit careful (carwash)': { biz: 'carwash' },
  'street only, careful': { crime: 'careful' }, 'street + cafe front, careful': { biz: 'cafe', crime: 'careful', opt: { seed: 40000 } },
  'street only, cheap prices (0.85x)': { crime: 'careful', opt: { ask: 0.85 } }, 'street only, dear prices (1.25x)': { crime: 'careful', opt: { ask: 1.25 } },
  'street only, reckless': { crime: 'reckless' }, 'bank jobs only': { crime: 'heister' }, 'cafe + reckless crime': { biz: 'cafe', crime: 'reckless' },
};
const rows = [];
for (const [name, P] of Object.entries(plans)) {
  const res = [];
  for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: s * 7349 + name.length }); g.cash = START; g.lastNW = TG.F.netWorth(g);
    const b = P.biz ? bots.startBiz(g, P.biz) : null; let jail = 0, peak = 0;
    for (let i = 0; i < MONTHS; i++) {
      if (b && g.businesses.includes(b)) bots.careful(g, b); else bots.resolveSmart(g);
      if (P.crime) CB[P.crime](g, P.opt);
      TG.Game.nextMonth(g); if (TG.CR.jailed(g)) jail++; peak = Math.max(peak, g.lastNW);
    }
    const nw = g.lastNW; const cagr = nw > 0 ? Math.pow(nw / START, 12 / MONTHS) - 1 : -1;
    res.push({ cagr, nw, ruined: g.player.bankruptcies > 0 || nw < START * 0.3, jail, seized: g.crime ? g.crime.stats.arrests : 0, lostBiz: b && !g.businesses.includes(b) });
  }
  const s = res.map((r) => r.cagr).sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)];
  rows.push({ name, med, p10: s[Math.floor(s.length * 0.1)], best: s[s.length - 1], ruin: res.filter((r) => r.ruined).length / res.length, jail: U.avg(res, (r) => r.jail), arrests: U.avg(res, (r) => r.seized), lostBiz: res.filter((r) => r.lostBiz).length / res.length, nwMed: res.map((r) => r.nw).sort((a, b) => a - b)[Math.floor(res.length / 2)] });
}
const pct = (x) => ((x * 100).toFixed(0) + '%').padStart(6);
console.log(`Start $250k, ${SEEDS} seeds x ${MONTHS} months. Ruin = bankrupt or net worth under 30% of start at the end.`);
console.log('plan'.padEnd(36), 'median', '  p10', ' best', ' ruin', 'jail mo', 'arrests', 'biz lost', 'median NW');
for (const r of rows) console.log(r.name.padEnd(36), pct(r.med), pct(r.p10), pct(r.best), pct(r.ruin), r.jail.toFixed(1).padStart(7), r.arrests.toFixed(1).padStart(7), pct(r.lostBiz).padStart(8), U.money(r.nwMed).padStart(10));
if (process.argv.includes('--json')) require('fs').writeFileSync(__dirname + '/crime-balance.json', JSON.stringify(rows, null, 1));
