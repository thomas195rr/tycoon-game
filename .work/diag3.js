const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
for (let s = 1; s <= 8; s++) {
  const g = TG.Game.newGame({ seed: s * 104729 + 4 * 7 }); g.cash = 600000;
  const b = bots.startBiz(g, 'farm'); if (!b) { console.log('no start'); continue; }
  const lines = {}; let prof = 0, n = 0;
  for (let i = 0; i < 120; i++) { if (g.businesses.includes(b)) bots.careful(g, b); TG.Game.nextMonth(g); if (!g.businesses.includes(b)) break; const h = b.hist[b.hist.length - 1]; prof += h.profit; n++; for (const k in h.lines) lines[k] = (lines[k] || 0) + h.lines[k]; }
  const f = b.farm;
  console.log(s, f.ent, 'acres', f.acres, 'months', n, 'avgProfit', Math.round(prof / Math.max(1, n)), 'herd', Math.round(f.herd), 'cows', Math.round(f.cows || 0), 'ready', Math.round(f.ready || 0), 'cap', f.ent === 'cattle' ? TG.M.farmHeadCap(b) : '', 'stored', Math.round(f.stored), 'seeds', Math.round(f.seeds || 0), 'bk', g.player.bankruptcies);
  console.log('   ', Object.entries(lines).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 10).map(([k, v]) => k + ':' + Math.round(v / Math.max(1, n))).join(' | '));
}
