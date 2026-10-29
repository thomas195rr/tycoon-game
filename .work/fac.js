const TG = require('../test/load')(); const bots = require('../test/bots')(TG);
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
function play(seed, only) {
  const g = TG.Game.newGame({ seed: seed * 7919 + 7 * 13 }); g.cash = 5000000; const b = bots.startBiz(g, 'factory'); let lim = {};
  for (let i = 0; i < 48; i++) { if (g.businesses.includes(b)) { bots.careful(g, b); if (only && TG.E.count(b, only) < 1 && g.cash > TG.E.def(b, only).price * 3) TG.E.buy(g, b, only, 'standard'); } TG.Game.nextMonth(g); if (b.lastCtx) lim[b.lastCtx.limit || 'x'] = (lim[b.lastCtx.limit || 'x'] || 0) + 1; }
  return [g.lastNW, JSON.stringify(lim), TG.ST.cap(b), b.stock && Math.round(b.stock.qty), b.lastCtx.cap, b.lastCtx.served];
}
for (const only of [null, 'rawsilo', 'robotarm']) { const r = [1, 2, 3, 4].map((s) => play(s, only)); console.log(only, Math.round(med(r.map((x) => x[0])) / 1e3) + 'k', r.map((x) => x.slice(1).join('/')).join('  ')); }
for (const only of [null, 'rawsilo']) {
  const g = TG.Game.newGame({ seed: 1 * 7919 + 7 * 13 }); g.cash = 5000000; const b = bots.startBiz(g, 'factory'); const L = {};
  for (let i = 0; i < 48; i++) { bots.careful(g, b); if (only && TG.E.count(b, only) < 1 && g.cash > 450000) TG.E.buy(g, b, only, 'standard'); TG.Game.nextMonth(g); for (const k in b.hist[b.hist.length - 1].lines) L[k] = (L[k] || 0) + b.hist[b.hist.length - 1].lines[k]; }
  console.log(only, 'nw', Math.round(g.lastNW), 'cash', Math.round(g.cash), 'lines', Object.entries(L).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 9).map(([k, v]) => k + ':' + Math.round(v / 1000) + 'k').join(' '), 'fstock', Math.round(b.factory.stock), 'lines#', b.equip.filter((x) => x.type === 'line').length);
}
