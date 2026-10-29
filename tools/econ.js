// Unit economics: avg monthly P&L lines for careful play, months 13-48. node tools/econ.js [types] [seeds]
const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
const types = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : Object.keys(TG.CONFIG.businesses);
const SEEDS = Number(process.argv[3] || 3);
const CAP = { small: 250000, between: 600000, corp: 5000000 };
for (const type of types) {
  const lines = {}; let n = 0, setup = 0, dem = 0, cap = 0, served = 0, staff = 0, eq = 0, rent = 0, own = 0, rep = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: s * 31337 + type.length });
    g.cash = CAP[TG.CONFIG.businesses[type].tier];
    const c0 = g.cash; const b = bots.startBiz(g, type); if (!b) { console.log(type, 'no start'); continue; }
    setup += c0 - g.cash; const p = g.properties.find((x) => x.id === b.propId); if (p.leased) rent++; else own++;
    for (let i = 0; i < 48; i++) {
      if (g.businesses.includes(b)) bots.careful(g, b); TG.Game.nextMonth(g);
      if (i >= 12 && g.businesses.includes(b)) { const h = b.hist[b.hist.length - 1]; for (const k in h.lines) lines[k] = (lines[k] || 0) + h.lines[k]; n++; const lc = b.lastCtx; dem += lc.demand || 0; cap += lc.cap || 0; served += lc.served || 0; staff += TG.S.allStaff(b).length; eq += b.equip.length; rep += b.rep; }
    }
  }
  if (!n) { console.log(type, 'no data'); continue; }
  const tot = U.sum(Object.values(lines)) / n;
  console.log(`\n== ${type}: setup cash used ${U.money(setup / SEEDS)} (${own} owned/${rent} leased). avg profit/mo ${U.money(tot)} | demand ${Math.round(dem / n)} cap ${Math.round(cap / n)} served ${Math.round(served / n)} staff ${(staff / n).toFixed(1)} equip ${(eq / n).toFixed(1)} rep ${Math.round(rep / n)}`);
  console.log('   ' + Object.entries(lines).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => `${k} ${U.money(v / n)}`).join(' | '));
}
