const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
const types = (process.argv[2] || 'foodtruck,lawn,hotel,clinic,farm').split(',');
for (const type of types) {
  const tier = TG.CONFIG.businesses[type].tier; const CAP = { small: 250000, between: 600000, corp: 5000000 };
  const lim = {}; let lostStock = 0, served = 0, demand = 0, waste = 0, spoil = 0, inU = 0; const lines = {};
  for (let s = 1; s <= (+process.env.SEEDS || 4); s++) {
    const g = TG.Game.newGame({ seed: s * 104729 + type.length * 7 }); g.cash = CAP[tier];
    const b = bots.startBiz(g, type);
    for (let i = 0; i < (+process.env.MONTHS || 72); i++) {
      if (b && g.businesses.includes(b)) bots.careful(g, b); TG.Game.nextMonth(g);
      if (!b || !g.businesses.includes(b) || i < 12) continue;
      const lc = b.lastCtx; lim[lc.limit] = (lim[lc.limit] || 0) + 1; served += lc.served || 0; demand += lc.demand || 0;
      if (b.stock) { waste += b.stock.wasteM || 0; spoil += b.stock.spoilM || 0; inU += b.stock.inM || 0; }
      const h = b.hist[b.hist.length - 1]; for (const k in h.lines) lines[k] = (lines[k] || 0) + h.lines[k];
    }
    if (s === 1 && b) console.log(type, 'stockcap', b.stock ? TG.ST.cap(b) : '-', 'own', TG.B.owner(g, b), 'equip', b.equip.map((x) => x.type).join(','), 'staff', b.staff.length, 'ask', b.ask);
  }
  console.log(type, 'limits', JSON.stringify(lim), 'served/demand', (served / demand).toFixed(2), 'waste', Math.round(waste), 'spoil', Math.round(spoil), 'in', Math.round(inU), 'served', Math.round(served));
  const tot = Object.entries(lines).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 14).map(([k, v]) => k + ':' + Math.round(v / 240)).join(' | ');
  console.log('  per-month lines:', tot);
}
