// v10: how fast does each upgrade pay back for a careful player after 2-3 years? (median over seeds)
//   node tools/upg-calib.js [seeds=6] [months=30] [type]
const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
const SEEDS = Number(process.argv[2] || 6), MONTHS = Number(process.argv[3] || 30), ONLY = process.argv[4];
const CAP = { small: 250000, between: 600000, corp: 5000000 };
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
for (const type of Object.keys(TG.CONFIG.businesses)) {
  if (ONLY && type !== ONLY) continue; const res = {}; const revs = [];
  for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: 9100 + s * 31 + type.length }); TG.G = g; g.cash = CAP[TG.CONFIG.businesses[type].tier];
    const b = bots.startBiz(g, type); if (!b) continue;
    for (let i = 0; i < MONTHS && g.businesses.includes(b); i++) { bots.careful(g, b); TG.Game.nextMonth(g); }
    if (!g.businesses.includes(b)) continue; revs.push(b.revAvg);
    for (const f of TG.B.def(b).fixes) { const x = TG.V10.fixGain(g, b, f.id); (res[f.id] = res[f.id] || []).push(x ? x.net : NaN); }
  }
  console.log(`== ${type} rev/mo ${Math.round(med(revs))}`);
  for (const f of TG.B.def({ type }).fixes) { const n = med(res[f.id] || []); const cost = (f.cost || 0) * 1; console.log(`  ${f.id.padEnd(12)} cost ${String(cost).padStart(8)} mo ${String(f.monthly || 0).padStart(6)} net/mo ${String(Math.round(n)).padStart(7)} payback ${n > 0 ? (cost / n).toFixed(1) : '-'}`); }
}
