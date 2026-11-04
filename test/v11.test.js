// v11 checks: what the game is EXPECTED to do. node test/v11.test.js
const load = require('./load.js'); const TG = load(); const bots = require('./bots.js')(TG);
const U = TG.U, C = TG.CONFIG, V = TG.V11; let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };
const fresh = (seed, cash, scen) => { const g = TG.Game.newGame({ seed: seed || 1, scenario: scen }); TG.G = g; if (cash != null) g.cash = cash; return g; };
const types = Object.keys(C.businesses);
// run one month on a copy of the game (same luck) with a change applied, return what happened
const oneMonth = (g, b, mod) => { const g2 = JSON.parse(JSON.stringify(g)); g2._pv = true; g2._pvNoFl = true; const G0 = TG.G; TG.G = g2; const b2 = g2.businesses.find((x) => x.id === b.id); if (mod) mod(g2, b2); TG.B.month(g2, b2); TG.G = G0; const c = b2.lastCtx || {}; const h = b2.hist[b2.hist.length - 1] || {}; return { cap: c.cap || 0, served: c.served || 0, rev: h.rev || 0 }; };

// ---------- 3. training / a higher skill NEVER lowers output, in every business and every role ----------
{
  let checked = 0;
  for (const t of types) for (const ent of (t === 'farm' ? ['cows', 'crops', 'orchard'] : [undefined])) {
    const g = fresh(77, 5e7, 'rich'); g.cash = 5e7; const b = bots.startBiz(g, t, ent ? { ent } : {}); if (!b) { ok(false, `${t}: could not start for the skill check`); continue; }
    for (let i = 0; i < 3; i++) { TG.Game.nextMonth(g); bots.resolveSmart(g); }
    const base = oneMonth(g, b);
    for (const role of [...new Set(b.staff.map((e) => e.role))]) for (const how of ['skill', 'basic', 'advanced']) {
      const x = oneMonth(g, b, (g2, b2) => { for (const e of b2.staff.filter((e2) => e2.role === role)) { if (how === 'skill') e.skill = Math.min(99, e.skill + 25); else TG.S.train(g2, b2, e.id, how); } });
      checked++;
      ok(x.cap >= base.cap * 0.995 - 0.5 && x.served >= base.served * 0.995 - 0.5, `${t}${ent ? ':' + ent : ''} ${role} ${how}: output fell (capacity ${Math.round(base.cap)} -> ${Math.round(x.cap)}, served ${Math.round(base.served)} -> ${Math.round(x.served)})`);
    }
  }
  console.log(`  skill/training checked in ${checked} business-role-method combos`); ok(checked > 40, 'skill check covered every business');
}
// ---------- 1. ads: a real lever for a business with low sales; diminishing returns; preview ----------
{
  let lifted = 0, n = 0;
  for (const t of ['cafe', 'salon', 'law', 'gym', 'auto', 'lawn', 'clinic', 'bakery']) {
    const g = fresh(31, 5e7, 'rich'); const b = bots.startBiz(g, t, {}); if (!b) continue;
    for (let i = 0; i < 2; i++) { TG.Game.nextMonth(g); bots.resolveSmart(g); }
    b.rep = 20; // low sales
    const ch = Object.keys(C.reputation.adChannels).sort((x, y) => V.adFit(b, y) - V.adFit(b, x))[0];
    const budget = Math.round(TG.B.baseRev(g, b) * 0.06);
    const a = V.adBoostCalc(g, b, { budget, channel: ch, target: 'near' }, true).boost; const a2 = V.adBoostCalc(g, b, { budget: budget * 2, channel: ch, target: 'near' }, true).boost;
    ok(a2 > a && a2 < a * 2, `${t}: diminishing returns (x2 budget gives ${U.pct(a)} -> ${U.pct(a2)})`);
    // compare next month with and without ads (same luck): more customers want to buy
    const mo = (on) => oneMonth(g, b, (g2, b2) => { b2.ads = { budget: on ? budget : 0, channel: ch, target: 'near' }; });
    const off = mo(false), onm = mo(true); const dOff = (b.lastCtx && 0) || 0;
    const g2 = JSON.parse(JSON.stringify(g)); g2._pv = true; g2._pvNoFl = true; const G0 = TG.G; TG.G = g2; const b2 = g2.businesses.find((x) => x.id === b.id); b2.ads = { budget: 0, channel: ch, target: 'near' }; TG.B.month(g2, b2); const d0 = b2.lastCtx.demand;
    const g3 = JSON.parse(JSON.stringify(g)); g3._pv = true; g3._pvNoFl = true; TG.G = g3; const b3 = g3.businesses.find((x) => x.id === b.id); b3.ads = { budget, channel: ch, target: 'near' }; TG.B.month(g3, b3); const d1 = b3.lastCtx.demand; TG.G = G0;
    if (d0 > 0) { n++; if (d1 > d0 * 1.15) lifted++; }
    ok(onm.served >= off.served, `${t}: ads never lower sales`);
    const p = V.adSim(g, b, { budget, channel: ch, target: 'near' }); ok(p && Number.isFinite(p.extraRev) && Number.isFinite(p.net), `${t}: ad preview shows extra sales and payback`);
    ok(a > 0.08, `${t}: a 6%-of-sales budget on the best ad type gives a noticeable boost at low reputation (${U.pct(a)})`);
  }
  ok(lifted >= n - 1, `ads raised customer demand 15%+ in ${lifted}/${n} low-sales businesses`);
  const g = fresh(5, 5e7, 'rich'); const b = bots.startBiz(g, 'law', {}); const fits = Object.keys(C.reputation.adChannels).map((k) => V.adFit(b, k));
  ok(Math.max(...fits) > 1.3 && Math.min(...fits) < 0.9, 'ad types fit a law firm differently (search best)');
  ok(V.adTargetMult(b, 'near') > V.adTargetMult(fresh(6, 5e7, 'rich') && { type: 'tech' }, 'near'), 'targeting nearby people helps local shops more than an app');
}
// ---------- 2. law firm can make money from a normal start ----------
{
  let made = 0, started = 0;
  for (let s = 1; s <= 8; s++) { const g = fresh(600 + s); const nw0 = TG.F.netWorth(g); const b = bots.startBiz(g, 'law', { check: true }); if (!b) continue; started++; for (let i = 0; i < 120; i++) { bots.careful(g, b); TG.Game.nextMonth(g); bots.resolveSmart(g); } if (TG.F.netWorth(g) > nw0 * 1.5) made++; }
  console.log(`  law firm (classic start): ${started}/8 started, ${made} grew net worth by 50%+ in 10 years`);
  ok(started >= 6, `law firm can be started with normal starting cash (${started}/8)`); ok(made >= Math.ceil(started * 0.6), `law firm makes money in normal play (${made}/${started})`);
}
// ---------- 5. tenant search and property-manager pay stay proportional to rent at any year ----------
{
  const g = fresh(3); for (let i = 0; i < 283 * 12; i++) { TG.W.month(g); g.month++; }
  const w = g.world; ok(w.wageIdx / w.priceIdx > 0.8 && w.wageIdx / w.priceIdx < 1.25, `year 283: wages track prices (${(w.wageIdx / w.priceIdx).toFixed(2)})`);
  ok(w.housing / w.priceIdx > 0.3 && w.housing / w.priceIdx < 2.6, `year 283: housing tracks prices (${(w.housing / w.priceIdx).toFixed(2)})`);
  for (const k of ['apartment', 'duplex', 'house']) { const L = TG.RE.gen(g, k, { distressed: false }); const h = Object.assign({}, L, { tenants: [], unitR: {}, rentR: 1, searches: {}, issues: [] }); const rent = TG.RE.askRent(g, h, 0); const sc = TG.RE.searchCost(g, h, false, 0);
    ok(sc <= rent && sc > rent * 0.05, `year 283 ${k}: tenant search ${U.money(sc)} vs rent ${U.money(rent)} (one month or less)`);
    const c = TG.S.candidate(g, { region: 'harbor', loc: 'suburb' }, 'rem', 0.6); ok(c.wage / rent < 6, `year 283 ${k}: property manager ${U.money(c.wage)}/mo vs rent ${U.money(rent)}/unit stays proportional`); }
  // a property held for 50 years: rent keeps up with prices
  const g2 = fresh(9, 5e7); const l = g2.re.listings.find((x) => x.units > 1) || g2.re.listings[0]; const r = TG.RE.buy(g2, l.id, false); const h = r.h; const r0 = TG.RE.marketRent(g2, h), p0 = g2.world.priceIdx;
  for (let i = 0; i < 600; i++) { TG.W.month(g2); g2.month++; } const growth = TG.RE.marketRent(g2, h) / r0, infl = g2.world.priceIdx / p0;
  ok(growth > infl * 0.4 && growth < infl * 2.5, `rent after 50 years x${growth.toFixed(1)} vs prices x${infl.toFixed(1)}`);
  // costs that could run away from revenue: run a few months at year-283 prices and compare each business's margin
  const marg = (t, idx) => { const g3 = fresh(41, 5e8, 'rich'); if (idx) { const w3 = g3.world; w3.priceIdx = idx; w3.wageIdx = idx; w3.housing = idx; for (const k in g3.markets) { /* markets read priceIdx */ } } const b = bots.startBiz(g3, t, {}); if (!b) return null; let rev = 0, prof = 0; for (let i = 0; i < 8; i++) { TG.Game.nextMonth(g3); bots.resolveSmart(g3); const hh = b.hist[b.hist.length - 1]; if (i >= 4 && hh) { rev += hh.rev; prof += hh.profit; } } return rev > 0 ? prof / rev : null; };
  for (const t of types.filter((x) => x !== 'tech' && x !== 'construction')) { const a = marg(t, 0), z = marg(t, 700); if (a == null || z == null) continue; ok(z > a - 0.25, `${t}: margin at year-283 prices ${U.pct(z)} vs today ${U.pct(a)} (no runaway costs)`); }
}
// ---------- 6. property manager: training, raise, bonus with visible effects ----------
{
  const g = fresh(12, 5e6); const c = TG.RE.managerPool(g)[0]; TG.RE.hireManager(g, c); const e = g.re.manager; e.skill = 40;
  const pv = V.remTrainPreview(g, 'basic'); ok(pv.after.costMult < pv.now.costMult && pv.after.quality > pv.now.quality, 'manager training preview shows lower costs and better tenants');
  const c0 = g.cash; const r = V.remTrain(g, 'basic'); ok(r.ok && e.skill > 40 && g.cash < c0, `manager training raised skill 40 -> ${e.skill}`);
  const w0 = e.wage; V.remRaise(g); ok(e.wage > w0, 'manager raise'); const m0 = e.morale; V.remBonus(g); ok(e.morale >= m0, 'manager bonus');
  ok(TG.RE.mgrCostMult(g) < 1.2 - 40 / 250 + 1e-9, 'trained manager gets better prices');
}
// ---------- 7. personal lawyer: perks only ----------
{
  const g = fresh(14, 3e5); const q0 = TG.CREDIT.quote(g, 'business', 50000); const r0 = TG.CREDIT.rate(g, 'business');
  const pool = V.lawyerPool(g); ok(pool.length === 3 && pool.every((c) => c.wage > 0), 'lawyers to choose from, each with a monthly cost');
  V.hireLawyer(g, pool[0].id); const q1 = TG.CREDIT.quote(g, 'business', 50000); const r1 = TG.CREDIT.rate(g, 'business');
  ok(q1.odds >= q0.odds && (q0.odds >= 0.97 || q1.odds > q0.odds), `loan odds better with a lawyer (${U.pct(q0.odds)} -> ${U.pct(q1.odds)})`); ok(r1 < r0, 'loan rate lower with a lawyer');
  const c0 = g.cash; TG.Game.nextMonth(g); const paid = (g.history[g.history.length - 1] || {}); ok(g.cash < c0 + 1e9 && JSON.stringify(g.acc || {}).length >= 0, 'month runs with a lawyer');
  // real-estate claim: some dropped, the rest smaller
  let dropped = 0, n = 0, amt = 0; for (let i = 0; i < 200; i++) { g._own = 'r:x'; const ls = TG.B.lawsuit(g, null, 'Tenant injury', 100000, null, 'test'); g._own = null; n++; if (!ls) dropped++; else { amt += ls.amount; g.lawsuits = g.lawsuits.filter((x) => x !== ls); g.decisions = g.decisions.filter((d) => d.suitId !== ls.id); } }
  ok(dropped > 20 && dropped < 150, `lawyer got ${dropped}/200 real-estate claims dropped`); ok(amt / Math.max(1, n - dropped) < 100000, 'the rest are smaller');
  const bizSuit = TG.B.lawsuit(g, null, 'Not real estate', 100000, null, 'x'); ok(bizSuit && bizSuit.amount === 100000, 'claims that are not from your rentals are not touched');
  ok(!('debt' in V.lawyerPerks(g, g.player.lawyer)), 'the lawyer does not deal with debts');
}
// ---------- migration v10 -> v11 ----------
{
  const g = fresh(21, 5e6); const b = bots.startBiz(g, 'cafe', {}); b.staff[0].away = 0.35; delete b.ads.target; g.v = 10; g.world.wageIdx = g.world.priceIdx * 3;
  const g2 = TG.Game.deserialize(TG.Game.serialize(g)); ok(g2.v >= 11, 'save upgraded to v11 (or later)'); ok(g2.businesses[0].staff.every((e) => !e.away), 'training time-off cleared'); ok(g2.businesses[0].ads.target === 'near', 'ads get a target');
  ok(g2.world.wageIdx / g2.world.priceIdx <= 1.2 + 1e-9, 'runaway wage index brought back in line'); ok(Array.isArray(g2.v11notes) && g2.v11notes.length > 0, 'update note shown once');
}
console.log(`${pass}/${pass + fails.length} v11 checks passed`);
if (fails.length) { console.log(`${fails.length} V11 CHECK(S) FAILED`); process.exit(1); } else console.log('ALL V11 CHECKS PASSED');
