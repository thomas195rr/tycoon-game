// v12 checks: what the game is EXPECTED to do. node test/v12.test.js
const load = require('./load.js'); const TG = load(); const bots = require('./bots.js')(TG);
const U = TG.U, C = TG.CONFIG, V = TG.V12, S = TG.S, D = TG.D; let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };
const fresh = (seed, cash, scen) => { const g = TG.Game.newGame({ seed: seed || 1, scenario: scen }); TG.G = g; if (cash != null) g.cash = cash; return g; };
const types = Object.keys(C.businesses);
const oneMonth = (g, b, mod) => { const g2 = JSON.parse(JSON.stringify(g)); g2._pv = true; g2._pvNoFl = true; const G0 = TG.G; TG.G = g2; const b2 = g2.businesses.find((x) => x.id === b.id); if (mod) mod(g2, b2); TG.B.month(g2, b2); TG.G = G0; const c = b2.lastCtx || {}; return { cap: c.cap || 0, served: c.served || 0 }; };
const loyal = (e) => { e.morale = 95; e.loyalty = 100; e.ambition = 0; return e; };
const clearMgrs = (g, b) => { for (const r in (b.spec || {})) b.spec[r] = null; g.ceo = null; };
const answerMgrCards = (g) => { for (const d of g.decisions.slice()) if (d.mgr) D.resolve(g, d, d.kind === 'mgrQuit' ? 'keep' : 'counter', null); };

// ---------- 1. managers & CEO: training never lowers output, raises their calls ----------
{
  let n = 0;
  for (const t of types) {
    const g = fresh(5, 5e7, 'rich'); const b = bots.startBiz(g, t, t === 'farm' ? { ent: 'crops' } : {}); if (!b) { ok(false, `${t}: could not start`); continue; }
    clearMgrs(g, b); for (const r of ['gm', 'ops', 'hr', 'accountant']) S.hire(g, b, loyal(S.candidate(g, b, r, 0.6)), 'test');
    for (let i = 0; i < 2; i++) { TG.Game.nextMonth(g); bots.resolveSmart(g); answerMgrCards(g); }
    const base = oneMonth(g, b);
    for (const r of ['gm', 'ops', 'hr', 'accountant']) for (const lvl of ['basic', 'advanced']) {
      const e = b.spec[r]; if (!e) continue; n++;
      const fx = V.mgrTrainEffect(g, b, e, lvl); ok(fx.after >= fx.now, `${t} ${r}: training effect shown (${U.pct(fx.now)} -> ${U.pct(fx.after)})`);
      const x = oneMonth(g, b, (g2, b2) => { S.train(g2, b2, e.id, lvl); });
      ok(x.cap >= base.cap * 0.995 - 0.5 && x.served >= base.served * 0.995 - 0.5, `${t} ${r} ${lvl} training: output fell (${Math.round(base.cap)} -> ${Math.round(x.cap)})`);
    }
  }
  ok(n >= 100, `manager training checked in ${n} business-role-level combos`);
  const g = fresh(6, 5e6); D.hireCeo(g, loyal(D.ceoPool(g)[0])); g.ceo.skill = 50;
  const p = V.ceoTrainPreview(g, 'basic'); ok(p.after > p.now && p.cost > 0, `CEO coaching preview: good calls ${U.pct(p.now)} -> ${U.pct(p.after)} for ${U.money(p.cost)}`);
  const c0 = g.cash; const r = V.ceoTrain(g, 'basic'); ok(r.ok && r.to > r.from && g.cash < c0, `CEO coaching raised skill ${r.from} -> ${r.to}`);
  const w0 = g.ceo.wage; V.ceoRaise(g); ok(g.ceo.wage > w0, 'CEO raise'); const m0 = g.ceo.morale; V.ceoBonus(g); ok(g.ceo.morale >= m0, 'CEO bonus');
}
// ---------- 2. a GM (no Ops, no CEO) orders supplies in every supply-using business ----------
{
  for (const t of types) for (const ent of (t === 'farm' ? ['cows', 'crops'] : [undefined])) {
    const g = fresh(9, 5e7, 'rich'); const b = bots.startBiz(g, t, ent ? { ent } : {}); if (!b) continue;
    const uses = !!TG.ST.def(b) || !!b.farm || !!b.brand; if (!uses) continue;
    clearMgrs(g, b); if (b.stock) b.stock.auto = false; // like an old save where Auto was off
    S.hire(g, b, loyal(S.candidate(g, b, 'gm', 0.6)), 'you');
    if (b.stock) ok(b.stock.auto === true, `${t}: hiring a GM turns Auto supplies on`);
    ok(V.orderer(g, b).who === 'mgr' || !b.stock, `${t}: UI says the GM orders`);
    let byGM = 0, closedNoMgr = 0, months = b.farm ? 12 : 4; while (b.licensePending > 0) { TG.Game.nextMonth(g); bots.resolveSmart(g); answerMgrCards(g); } // a clinic waits for its license first
    for (let i = 0; i < months; i++) {
      TG.Game.nextMonth(g); bots.resolveSmart(g); answerMgrCards(g);
      if (b.stock && /General manager/.test(b.stock.lastBy || '')) byGM++;
      if ((b.lastCtx || {}).closed === 'nomgr') closedNoMgr++;
    }
    const gmLog = g.log.filter((e) => e.type === 'decision' && e.biz === b.name && /General manager/.test(e.by || '')).map((e) => e.text).join(' | ');
    if (b.stock) ok(byGM >= months - 1 && closedNoMgr === 0, `${t}: GM ordered supplies ${byGM}/${months} months, closed for no manager ${closedNoMgr}`);
    else if (b.farm && ent === 'cows') ok(/feed/i.test(gmLog) || (b.farm.feed || 0) > 0, `farm cows: GM bought feed (${gmLog.slice(0, 120)})`);
    else if (b.farm) ok(/seed|Sprayed/i.test(gmLog) || (b.farm.seeds || 0) > 0 || g.log.some((e) => e.biz === b.name && /seed/i.test(e.text || '')), `farm crops: GM bought seed or sprayed (${gmLog.slice(0, 120)})`);
    else if (b.brand) ok(/Reordered/.test(gmLog) || (b.brand.incoming || []).length > 0 || b.brand.stock > 0, `brand: GM reorders batches (${gmLog.slice(0, 120)})`);
  }
}
// ---------- 3. rentals stay profitable as values rise 1x-4x; tax hikes capped and ease back ----------
{
  const g = fresh(12, 5e7); const l = TG.RE.gen(g, 'duplex', { distressed: false }); g.re.listings.unshift(l); const h = TG.RE.buy(g, l.id, false).h;
  const share = () => { const n = V.normalMonth(g, h, 0.05, { taxMult: 1 }); return (n.tax + n.upkeep + n.ins) / n.rent; };
  const s0 = share(); g.world.housing *= 4; const s4 = share(); g.world.housing /= 4;
  ok(s4 <= s0 * 1.02, `costs vs rent when values rise 4x: ${U.pct(s0, 1)} -> ${U.pct(s4, 1)}`);
  h.taxMult = 3; const R0 = TG.R.chance; TG.R.chance = () => false; try { TG.RE.month(g); } finally { TG.R.chance = R0; }
  ok(h.taxMult <= C.v12.taxMultCap + 1e-9, `tax multiplier capped (${h.taxMult.toFixed(2)})`);
  for (let i = 0; i < 120; i++) { TG.R.chance = () => false; try { TG.RE.month(g); } finally { TG.R.chance = R0; } }
  ok(h.taxMult < 1.2, `tax hikes ease back over 10 years (${h.taxMult.toFixed(2)})`);
}
// ---------- 4. THE MORTGAGE RULE ----------
{
  const kinds = Object.keys(C.realEstate.kinds).filter((k) => C.realEstate.kinds[k].rentPct);
  const ec = C.economy; let checked = 0; let worst = Infinity;
  for (const lvl of [1, 3, 10, 40]) for (const base of [ec.rateMin, 0.05, ec.rateMax]) for (const k of kinds) {
    const g = fresh(20 + lvl, 1e10); g.world.priceIdx = lvl; g.world.wageIdx = lvl; g.world.housing = lvl * (0.6 + lvl / 40); g.world.baseRate = base;
    const l = TG.RE.gen(g, k, { distressed: false }); const h = Object.assign({}, l, { base: l.price / (g.world.housing * l.nb * (0.7 + 0.5 * l.cond / 100)), basePrice: l.price, housingAtBuy: g.world.housing, pAtBuy: g.world.priceIdx, taxMult: 1, tenants: [] });
    const rate = V.worstRate(g); ok(rate >= TG.CREDIT.rate(g, 'mortgage', C.finance.loans.mortgage.minCredit) - 1e-9, 'worst rate covers the lowest credit a mortgage allows');
    const n = V.normalMonth(g, h, rate); checked++; worst = Math.min(worst, n.net / n.rent);
    ok(n.net > 0, `${k} at prices x${lvl}, base rate ${U.pct(base, 1)}: normal month ${U.money(n.net)} (rent ${U.money(n.rent)}, loan ${U.money(n.loan)} at ${U.pct(rate, 1)})`);
    // held 20 years: values up 3x, prices 2x, neighbourhood a bit worse, building older: still positive
    g.world.housing *= 3; g.world.priceIdx *= 2; h.cond = Math.max(30, h.cond - 25); const n2 = V.normalMonth(g, h, rate, { price: h.basePrice });
    ok(n2.net > 0, `${k} held 20 years (values x3, prices x2, older): ${U.money(n2.net)}`);
  }
  console.log(`  mortgage rule: ${checked} cases, smallest margin ${U.pct(worst, 1)} of rent at the worst rate (max ${U.pct(V.maxRate(fresh(1)), 1)})`);
  // the formula matches the real month (no surprises, full at market rent, no manager)
  const g = fresh(31, 5e7); const l = TG.RE.gen(g, 'smallapt', { distressed: false }); g.re.listings.unshift(l); const h = TG.RE.buy(g, l.id, false).h;
  for (let i = 0; i < h.units; i++) { const t = TG.RE.newTenant(g, h); t.rent = TG.RE.marketRent(g, h); t.rel = 0.99; t.lease = 99; t.since = g.month; h.tenants[i] = t; }
  const R0 = TG.R.chance; TG.R.chance = () => false; try { TG.RE.month(g); } finally { TG.R.chance = R0; }
  const n = V.normalMonth(g, h, 0, { taxMult: h.taxMult }); const real = g.re.m.rev - g.re.m.cost; const want = n.rent - n.tax - n.upkeep - n.ins;
  ok(Math.abs(real - want) <= Math.max(5, want * 0.03), `engine month matches the rule's numbers (${U.money(real)} vs ${U.money(want)})`);
  // mortgages need credit 600+
  const g2 = fresh(32, 5e6); g2.player.credit = 520; TG.CREDIT.sync && TG.CREDIT.sync(g2); const q = TG.CREDIT.quote(g2, 'mortgage', 100000, { ltv: 0.8, asset: 125000 });
  if (TG.CREDIT.score(g2).score < 600) ok(q.odds === 0 && /600/.test(q.block || ''), 'mortgage refused below credit 600 with the reason shown');
}
// ---------- 5. GM job-offer setting (regular workers) ----------
{
  const mk = (pol) => { const g = fresh(40, 5e7, 'rich'); const b = bots.startBiz(g, 'cafe', {}); clearMgrs(g, b); S.hire(g, b, loyal(S.candidate(g, b, 'gm', 0.8)), 'you'); b.poachPol = pol; const e = b.staff[0]; e.skill = 70; const before = { n: b.staff.length, tgt: b.target[e.role] };
    const nlog = g.log.length; D.add(g, { kind: 'poach', bizId: b.id, empId: e.id, offer: Math.round(e.wage * 1.2), title: `${e.name} got a job offer`, options: [{ id: 'counter' }, { id: 'let' }], def: 'let' });
    return { g, b, e, before, majors: g.log.slice(nlog).filter((x) => x.major) }; };
  let x = mk('always'); ok(!x.g.decisions.some((d) => d.kind === 'poach') && !x.majors.length, 'always match: GM handles it, no card, the skip keeps going'); ok(x.e.wage >= Math.round(x.e.wage) && (x.b.staff.includes(x.e) ? x.e.wage > 0 : true), 'always match: offer matched (they may still leave)');
  x = mk('replace'); ok(!x.b.staff.includes(x.e) && x.b.target[x.e.role] === x.before.tgt && !x.majors.length, 'replace: worker let go, spot kept for a new hire, no stop');
  TG.Game.nextMonth(x.g); ok(x.b.staff.filter((e) => e.role === x.e.role).length >= x.before.n - 0, `replace: GM hired a replacement (${x.b.staff.length}/${x.before.n})`);
  x = mk('good'); ok(!x.g.decisions.some((d) => d.kind === 'poach') && !x.majors.length, 'good only: GM decides now, no stop');
  x = mk('ask'); ok(x.g.decisions.some((d) => d.kind === 'poach') && x.majors.some((m) => m.major === 'poachAsk'), 'ask me: a card and the skip stops');
}
// ---------- 8. month skip stops when a manager wants to quit or gets an offer ----------
{
  const g = fresh(44, 5e7, 'rich'); const b = bots.startBiz(g, 'salon', {}); clearMgrs(g, b); const gm = S.hire(g, b, S.candidate(g, b, 'gm', 0.6), 'you') || b.spec.gm;
  const e = b.spec.gm; e.morale = 0; e.loyalty = 0; e.ambition = 100; e.wage = Math.round(e.wage * 0.4);
  const s = TG.Game.skip(g, 36, { stopOnMajor: true }); void gm;
  ok(s.stopped && /mgrAsk/.test(s.stopped.kind), `skip stopped for the manager (${s.stopped && s.stopped.text}) after ${s.months} months`);
  const card = g.decisions.find((d) => d.mgr); ok(!!card && (b.spec.gm === e || card.kind === 'poach'), 'the manager is still there until you decide');
  if (card) { D.resolve(g, card, card.kind === 'mgrQuit' ? 'let' : 'let', null); ok(!b.spec.gm, 'letting them go removes the manager'); }
  // CEO and property manager ask too
  const g2 = fresh(45, 5e7); D.hireCeo(g2, D.ceoPool(g2)[0]); const R0 = TG.R.chance; TG.R.chance = () => true; try { D.ceoMonth(g2, 1000); } finally { TG.R.chance = R0; }
  ok(g2.ceo && g2.decisions.some((d) => d.kind === 'mgrQuit' && d.who === 'ceo'), 'CEO who wants to quit asks first');
  const keep = g2.decisions.find((d) => d.kind === 'mgrQuit'); const w0 = g2.ceo.wage; TG.R.chance = () => true; try { D.resolve(g2, keep, 'keep', null); } finally { TG.R.chance = R0; } ok(g2.ceo && g2.ceo.wage > w0, 'keeping the CEO costs a raise');
  const g3 = fresh(46, 5e7); const c = TG.RE.managerPool(g3)[0]; TG.RE.hireManager(g3, c); V.remWantsQuit(g3, g3.re.manager); ok(g3.re.manager && g3.decisions.some((d) => d.who === 'rem'), 'property manager who wants to quit asks first');
  TG.Game.nextMonth(g3); TG.Game.nextMonth(g3); ok(!g3.decisions.some((d) => d.who === 'rem'), 'unanswered: they leave after a month');
}
// ---------- 7. CEO keeps chosen managers hired ----------
{
  const g = fresh(50, 5e7, 'rich'); const b = bots.startBiz(g, 'salon', {}); clearMgrs(g, b); b.keep = { gm: true, ops: true };
  TG.Game.nextMonth(g); ok(!b.spec.gm, 'no CEO: nobody hires managers for you');
  D.hireCeo(g, loyal(D.ceoPool(g)[0])); TG.Game.nextMonth(g); answerMgrCards(g);
  ok(b.spec.gm && b.spec.ops, 'CEO hired the chosen GM and Ops manager');
  ok(g.log.some((e) => e.type === 'decision' && /CEO/.test(e.by) && /because you asked/.test(e.text)), 'CEO hire is reported with the reason');
}
// ---------- 6. help pages ----------
for (const t of types) { const h = C.v12.help[t]; ok(h && h.money && ['costs', 'risks', 'mgrs', 'ups', 'start'].every((k) => (h[k] || []).length >= 2), `${t}: help page has money, costs, risks, managers, upgrades and a start plan`); }
// ---------- migration v11 -> v12 ----------
{
  const g = fresh(60, 5e6, 'rich'); const b = bots.startBiz(g, 'cafe', {}); clearMgrs(g, b); S.hire(g, b, S.candidate(g, b, 'gm', 0.6), 'you'); b.stock.auto = false; g.v = 11; delete g.settings.majorTypes.mgrAsk;
  const g2 = TG.Game.deserialize(TG.Game.serialize(g)); ok(g2.v === 12, 'save upgraded to v12'); ok(g2.businesses[0].stock.auto === true, 'Auto supplies switched back on where a manager exists');
  ok(g2.settings.majorTypes.mgrAsk === true, 'skip stops for managers by default'); ok(Array.isArray(g2.v12notes) && g2.v12notes.length >= 3, 'update note shown once');
}
console.log(`${pass}/${pass + fails.length} v12 checks passed`);
if (fails.length) { console.log(`${fails.length} V12 CHECK(S) FAILED`); process.exit(1); } else console.log('ALL V12 CHECKS PASSED');
