// Pricing & equipment balance checks.
// 1) Price sweep: for every business with a sale price, play a careful game at a fixed price/market ratio.
//    A huge price must never win, and no fixed ratio may give a large edge over pricing at market.
// 2) Upgrade spam: buying every small upgrade must not dominate normal careful play.
// node test/pricing.test.js [--seeds 6] [--months 60]
const load = require('./load');
const args = process.argv.slice(2); const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const SEEDS = arg('seeds', 10), MONTHS = arg('months', 60); // 10 seeds: medians near the ruin line are noisy with fewer
const TG = load(); const bots = require('./bots')(TG); const U = TG.U;
const CAP = { small: 250000, between: 600000, corp: 5000000 };
const RATIOS = [0.6, 0.85, 1, 1.15, 1.4, 2, 4];
let fails = 0; const fail = (m) => { fails++; console.log('FAIL: ' + m); };
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
function play(type, seed, ratio, spam) {
  const g = TG.Game.newGame({ seed: seed * 7919 + type.length * 13 }); g.cash = CAP[TG.CONFIG.businesses[type].tier];
  const b = bots.startBiz(g, type); if (!b) return null;
  for (let i = 0; i < MONTHS; i++) {
    if (g.businesses.includes(b)) {
      bots.careful(g, b);
      if (ratio != null && TG.PR.hasPrice(b)) { const m = b.farm ? TG.W.price(g, TG.PR.good(b).market, 0) : TG.PR.market(g, b); if (m > 0) b.ask = m * ratio; }
      if (spam) for (const ed of TG.CONFIG.businesses[type].equip) if ((ed.ticketBoost || ed.staffBoost || ed.demandBoost || ed.store) && TG.E.count(b, ed.id) < 1 && g.cash > ed.price * 3) TG.E.buy(g, b, ed.id, 'standard');
    } else bots.resolveSmart(g);
    TG.Game.nextMonth(g);
  }
  return g.lastNW;
}
const rows = [];
for (const type of Object.keys(TG.CONFIG.businesses)) {
  const probe = { type, farm: type === 'farm' ? { ent: 'crops' } : null, proj: type === 'construction' ? {} : null, fr: type === 'franchise' ? {} : null };
  if (!TG.PR.hasPrice(probe)) continue;
  const res = {};
  for (const r of [null].concat(RATIOS)) { const v = []; for (let s = 1; s <= SEEDS; s++) { const x = play(type, s, r, false); if (x != null) v.push(x); } res[r] = med(v); }
  const base = Math.max(res[null], res[1]); const best = Math.max(...RATIOS.map((r) => res[r])); const bestR = RATIOS.find((r) => res[r] === best);
  rows.push({ type, res, bestR });
  console.log(type.padEnd(13), `auto:${(res[null] / 1e3).toFixed(0)}k `, RATIOS.map((r) => `${r}x:${(res[r] / 1e3).toFixed(0)}k`).join('  '), ` best ${bestR}x`);
  if (res[4] >= base) fail(`${type}: 4x price is not worse than market (${res[4]} vs ${base})`);
  if (res[2] >= base) fail(`${type}: 2x price is not worse than market (${res[2]} vs ${base})`);
  if (res[1.4] > base * 1.1) fail(`${type}: 1.4x price clearly beats market (${res[1.4]} vs ${base})`);
  if (best > Math.abs(base) * 1.35 + 50000) fail(`${type}: price ${bestR}x beats market by more than 35% (${best} vs ${base})`);
}
console.log('--- upgrade spam vs normal careful play (median NW) ---');
for (const type of ['cafe', 'foodtruck', 'bakery', 'salon', 'carwash', 'lawn', 'auto', 'gym', 'hotel', 'clinic', 'brand', 'factory']) {
  const a = [], s2 = [];
  for (let s = 1; s <= SEEDS; s++) { const x = play(type, s, null, false), y = play(type, s, null, true); if (x != null && y != null) { a.push(x); s2.push(y); } }
  const ma = med(a), ms = med(s2); console.log(type.padEnd(13), `normal ${(ma / 1e3).toFixed(0)}k  all-upgrades ${(ms / 1e3).toFixed(0)}k  (${ms >= ma ? '+' : ''}${((ms / ma - 1) * 100).toFixed(1)}%)`);
  if (ms > ma * 1.25) fail(`${type}: buying every upgrade dominates (+${((ms / ma - 1) * 100).toFixed(0)}%)`);
}
console.log(fails ? `${fails} PRICING/EQUIPMENT CHECK(S) FAILED` : 'ALL PRICING/EQUIPMENT CHECKS PASSED'); process.exit(fails ? 1 : 0);
