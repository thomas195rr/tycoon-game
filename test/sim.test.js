// Headless simulation test: many seeds, random + sensible + reckless bots, every business type.
// Checks: no crashes, no NaN/Infinity anywhere in the state, no negative stock/inventory, saves round-trip.
// Usage: node test/sim.test.js [--months 1200] [--seeds 4] [--quick]
const load = require('./load');
const args = process.argv.slice(2); const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const MONTHS = arg('months', 1200), SEEDS = arg('seeds', 4);
const TG = load(); const bots = require('./bots')(TG);
let problems = [], runs = 0, monthsRun = 0;

function scan(obj, path, out, depth) {
  if (depth > 12 || out.length > 5) return;
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(path + ' = ' + obj); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const k in obj) scan(obj[k], path + '.' + k, out, depth + 1);
}
function check(g, label) {
  const bad = []; scan(g, 'g', bad, 0);
  for (const b of g.businesses) {
    if (b.brand && (b.brand.stock < -1e-6 || b.brand.stockCost < -1)) bad.push(`${b.name} brand stock ${b.brand.stock}`);
    if (b.farm && (b.farm.stored < -1e-6 || b.farm.herd < 0)) bad.push(`${b.name} farm stored ${b.farm.stored} herd ${b.farm.herd}`);
    if (b.factory && b.factory.stock < -1e-6) bad.push(`${b.name} factory stock ${b.factory.stock}`);
    if (b.staff.some((e) => e.wage < 0)) bad.push('negative wage');
    if (b.rep < 0 || b.rep > 100) bad.push(`${b.name} rep ${b.rep}`);
  }
  if (g.loc.balance < -1) bad.push('loc balance negative');
  if (g.crime) { const c = g.crime; if (c.dirty < -1) bad.push('dirty cash negative'); for (const k in c.stock) if (c.stock[k] < 0) bad.push('negative street stock'); if (c.heat < 0 || c.heat > 100) bad.push('heat out of range'); if (c.clients < 0) bad.push('negative clients'); if (c.jail < 0) bad.push('negative jail'); }
  if (g.invest.marginDebt < -1) bad.push('margin debt negative');
  for (const l of g.loans) if (l.balance < -1) bad.push('loan balance negative');
  for (const s in g.invest.pos) if (g.invest.pos[s].qty < 0) bad.push('negative shares');
  if (bad.length) problems.push(label + ': ' + bad.slice(0, 4).join('; '));
  return !bad.length;
}
function roundTrip(g, label) {
  const s1 = TG.Game.serialize(g); const g2 = TG.Game.deserialize(s1); const s2 = TG.Game.serialize(g2);
  if (s1 !== s2) problems.push(label + ': save round-trip mismatch');
  const code = TG.Game.exportCode(g); const g3 = TG.Game.importCode(code); if (TG.Game.serialize(g3) !== s1) problems.push(label + ': export/import mismatch');
  TG.G = g;
}
function run(label, seed, setup, policy, months) {
  let g;
  try {
    g = TG.Game.newGame({ seed });
    setup(g);
    for (let i = 0; i < months; i++) {
      policy(g);
      if (i % 37 === 5) { const n = 1 + (i % 7); const s = TG.Game.skip(g, n); if (!Number.isFinite(s.nw1)) problems.push(label + ': skip NaN'); i += n; }
      else TG.Game.nextMonth(g);
      monthsRun++;
      if (i % 50 === 0 && !check(g, `${label} m${g.month}`)) break;
      if (i % 300 === 0) roundTrip(g, `${label} m${g.month}`);
    }
    check(g, `${label} end`); roundTrip(g, `${label} end`);
  } catch (e) { problems.push(`${label} CRASH at month ${g && g.month}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); }
  runs++;
  return g;
}

const t0 = Date.now();
const types = Object.keys(TG.CONFIG.businesses);
const results = [];
for (let s = 1; s <= SEEDS; s++) {
  // random fuzz bot
  run(`random#${s}`, 1000 + s, (g) => { g.cash += 500000; }, (g) => bots.random(g), MONTHS);
  // every business type, careful and reckless
  for (const type of types) {
    for (const style of ['careful', 'reckless']) {
      let biz = null;
      const g = run(`${style}:${type}#${s}`, s * 7919 + types.indexOf(type) * 31 + (style === 'careful' ? 0 : 5), (g) => {
        const tier = TG.CONFIG.businesses[type].tier; g.cash = tier === 'small' ? 250000 : tier === 'between' ? 600000 : 5000000;
        biz = bots.startBiz(g, type); if (!biz) problems.push(`${style}:${type}#${s}: could not start`);
      }, (g) => { if (biz && g.businesses.includes(biz)) bots[style](g, biz); else if (style === 'careful') bots.resolveSmart(g); }, Math.min(MONTHS, 600));
      if (g) results.push({ type, style, seed: s, nw: g.lastNW, bk: g.player.bankruptcies, open: biz && g.businesses.includes(biz) });
    }
  }
  // scenarios
  { const CB = require('./crime-bots')(TG); for (const st of ['careful', 'reckless', 'heister']) { let biz = null; run(`crime:${st}#${s}`, 4000 + s * 13 + st.length, (g) => { g.cash = 400000; biz = bots.startBiz(g, 'cafe'); }, (g) => { if (biz && g.businesses.includes(biz)) bots.careful(g, biz); else bots.resolveSmart(g); CB[st](g); }, Math.min(MONTHS, 360)); } }
  for (const sc of Object.keys(TG.Game.scenarios)) run(`scenario:${sc}#${s}`, 50 + s, (g) => {}, (g) => bots.random(g), 300);
  // scenario field is set by newGame opts; run them properly too
  for (const sc of Object.keys(TG.Game.scenarios)) {
    try { const g = TG.Game.newGame({ seed: 70 + s, scenario: sc }); for (let i = 0; i < 240; i++) { bots.random(g); TG.Game.nextMonth(g); } check(g, 'scenario ' + sc); runs++; monthsRun += 240; } catch (e) { problems.push(`scenario ${sc} CRASH: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  }
}
console.log(`Runs: ${runs}, months simulated: ${monthsRun.toLocaleString()}, time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (problems.length) { console.log(`PROBLEMS (${problems.length}):`); for (const p of [...new Set(problems)].slice(0, 60)) console.log(' - ' + p); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED: no crashes, no NaN/Infinity, no negative stock, saves round-trip.');
if (args.includes('--table')) {
  const by = {}; for (const r of results) { const k = r.type + ' ' + r.style; (by[k] = by[k] || []).push(r); }
  for (const k in by) console.log(k.padEnd(24), by[k].map((r) => (r.bk ? 'BK ' : '') + Math.round(r.nw / 1000) + 'k').join('  '));
}
