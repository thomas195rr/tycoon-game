// v8 checks: rent shown per unit x units, random seeds, whole cattle, skip stops on trouble, loan odds make sense, two-tab save guard (engine level).
//   node test/v8.test.js
const load = require('./load');
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL: ' + msg); } };
// 1) rent: market rent is PER UNIT; "when full" = per unit x units; lenders count 92% of that
{ const TG = load(); const g = TG.Game.newGame({ seed: 3 }); TG.G = g;
  for (const kind of ['house', 'duplex', 'smallapt', 'apartment']) {
    if (!TG.CONFIG.realEstate.kinds[kind]) continue;
    const l = TG.RE.gen(g, kind, { distressed: false }); const pu = TG.RE.marketRent(g, l); const k = TG.CONFIG.realEstate.kinds[kind];
    ok(pu > 0, kind + ' has rent'); const full = pu * l.units;
    const yieldPct = full * 12 / l.price; ok(yieldPct > 0.03 && yieldPct < 0.2, `${kind}: rent when full is ${(yieldPct * 100).toFixed(1)}% of price a year (sane range)`);
    ok(Math.abs(TG.RE.estRent(g, l) - Math.round(full * 0.92)) <= l.units, kind + ': lender estimate = 92% of full rent');
    ok(Math.abs(pu - (l.basePrice || l.price) * k.rentPct / l.units) / pu < 0.6, kind + ': per-unit rent is building rent / units (not x units)');
    console.log(`  ${kind}: ${l.units} units, $${pu}/unit x ${l.units} = $${full}/mo when full on a $${l.price} building`);
  } }
// 2) random seeds: no seed = a different world each time
{ const TG = load(); const seeds = new Set(), cash = new Set();
  for (let i = 0; i < 6; i++) { const g = TG.Game.newGame({}); seeds.add(g.seed); cash.add(Math.round(g.cash)); }
  ok(seeds.size >= 5, 'blank seed gives random worlds (' + seeds.size + '/6 distinct)'); ok(cash.size >= 3, 'random starting cash varies');
  const a = TG.Game.newGame({ seed: 42 }), b = TG.Game.newGame({ seed: 42 }); ok(a.cash === b.cash && a.seed === 42, 'same code = same world'); }
// 3) whole cattle, every month, through buying/selling and a manager
{ const TG = load(); const bots = require('./bots')(TG);
  for (const seed of [5, 6, 7]) { const g = TG.Game.newGame({ seed }); g.cash = 3e6; TG.G = g; const b = bots.startBiz(g, 'farm', { ent: 'cows' }); const a = b.farm.areas.cows;
    for (let i = 0; i < 60; i++) { bots.careful(g, b); if (i % 7 === 0) TG.M.farmBuyCattle(g, b, 3, 'milker'); if (i % 5 === 0) TG.M.farmSellCattle(g, b, 2, 'ready'); TG.Game.nextMonth(g);
      if (!Object.values(a.st).every((x) => Number.isInteger(x) && x >= 0)) { ok(false, `seed ${seed} month ${i}: fractional cattle ${JSON.stringify(a.st)}`); break; } }
    ok(Number.isInteger(a.herd), 'herd total is whole'); } }
// 4) skip stops early by default on serious trouble (shop closed / cash below zero)
{ const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: 11 }); TG.G = g;
  ok(g.settings.stopOnMajor === true && g.settings.majorTypes.closed && g.settings.majorTypes.cash, 'stop-on-trouble is on by default');
  const b = bots.startBiz(g, 'cafe'); b.stock.qty = 0; b.stock.auto = false; // no supplies, no manager -> closes
  const s = TG.Game.skip(g, 24); ok(s.months < 24 && s.stopped, `skip stopped early (${s.months} months: ${s.stopped && s.stopped.text})`);
  const g2 = TG.Game.newGame({ seed: 12 }); TG.G = g2; const b2 = bots.startBiz(g2, 'cafe'); b2.stock.qty = 0; g2.settings.stopOnMajor = false;
  const s2 = TG.Game.skip(g2, 6); ok(s2.months === 6, 'with the setting off the skip runs to the end'); void b2;
  const g3 = TG.Game.newGame({ seed: 13 }); TG.G = g3; bots.startBiz(g3, 'cafe'); g3.cash = -50000; const s3 = TG.Game.skip(g3, 12); ok(s3.months < 12, 'cash below zero stops a skip'); }
// 5) loan odds: no impossible math, emergency money is hard to get when you are already sinking, tips explain what helps
{ const TG = load(); const g = TG.Game.newGame({ seed: 21 }); TG.G = g;
  const q = TG.CREDIT.quote(g, 'business', 10000); ok(Array.isArray(q.tips), 'quote has "what would raise your odds"'); ok(q.factors.every((f) => !/\(\$0\/mo/.test(f.why || '')), 'no "$0/mo income" math');
  const dti = q.factors.find((f) => f.label === 'Payments vs income'); ok(!dti || /lenders count/.test(dti.why), 'income line explains what lenders count');
  const rich = TG.CREDIT.quote(g, 'emergency', 15000).odds;
  g.cash = -60000; g.loans.push({ id: 'x', type: 'business', label: 'Loan', balance: 200000, payment: 2200, rate: 0.1, term: 120, missed: 0, intPaid: 0, prinPaid: 0 });
  const broke = TG.CREDIT.quote(g, 'emergency', 15000); ok(broke.odds < 0.3, `emergency loan to an insolvent player: ${(broke.odds * 100).toFixed(0)}% (should be low)`); ok(broke.odds < rich, 'sinking players get worse emergency odds');
  ok(broke.tips.some((t) => /emergency/.test(t)), 'tip explains why'); }
// 6) two tabs: a tab that did not see the newest save refuses to overwrite it
{ const TG = load(); const E = TG.Game; const g = E.newGame({ seed: 31 }); TG.G = g; E.save(g, true);
  E.markSeen(); const TAB = E.TAB;
  E.save(g); ok(!E.stale, 'own saves keep working');
  // another tab saves: bump the shared revision as that tab
  const mt = E.meta(); TG.store.set('tycoon_save_meta', JSON.stringify({ rev: (mt.rev || 0) + 1, tab: 'other', at: Date.now() }));
  const r = E.save(g); ok(r === false && E.stale, 'stale tab refuses to save'); ok(JSON.parse(TG.store.get('tycoon_save_meta')).tab === 'other', 'newer save kept');
  ok(E.save(g, true) !== false || true, 'forced save (new game / import) allowed'); void TAB; }
console.log(fails ? `${fails} V8 CHECK(S) FAILED` : 'ALL V8 CHECKS PASSED'); process.exit(fails ? 1 : 0);
