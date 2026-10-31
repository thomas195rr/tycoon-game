// Bot strategies used by the simulation test and the balance check.
const load = require('./load');
module.exports = function makeBots(TG) {
  const { U } = TG;
  const rnd = () => TG.R.next();
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // find the best affordable property for a type and start it (sensible)
  function startBiz(g, type, opts, retry) {
    opts = opts || {};
    const C = TG.CONFIG;
    let cands = g.listings.map((p) => ({ p, s: TG.P.suit(p, type) })).filter((x) => x.s >= 0.45);
    if (!cands.length) { g.listings.push(TG.P.gen(g, TG.P.idealFor(type))); cands = g.listings.map((p) => ({ p, s: TG.P.suit(p, type) })); }
    const score = (x) => x.s - x.p.price / (g.cash * 5);
    cands.sort((a, b) => score(b) - score(a));
    for (const c of cands.slice(0, 15)) {
      const p = c.p;
      const modes = opts.lease ? ['lease', 'mortgage', 'cash'] : (p.price < g.cash * 0.3 ? ['cash', 'lease', 'mortgage'] : p.price < g.cash * 0.6 ? ['mortgage', 'lease'] : ['lease']);
      for (const mode of modes) {
        const snap = TG.Game.serialize(g);
        const r = TG.P.acquire(g, p.id, mode); if (!r.ok) continue;
        let s = TG.B.start(g, type, p.id, opts.concept ? { concept: opts.concept } : opts.ent ? { ent: opts.ent } : {});
        if (!s.ok && type === 'farm' && !opts.ent) s = TG.B.start(g, type, p.id, { ent: 'crops' }); // a starter herd for big grassland can cost too much
        if (!s.ok) { restore(g, snap); continue; }
        const plan = TG.B.quickSetup(g, s.biz, false);
        if (plan.cost > g.cash * 0.95) { restore(g, snap); continue; }
        TG.B.quickSetup(g, s.biz, true, opts.tier || 'standard');
        return s.biz;
      }
    }
    if (!retry) { for (let i = 0; i < 4; i++) g.listings.push(TG.P.gen(g, TG.P.idealFor(type))); return startBiz(g, type, Object.assign({}, opts, { lease: true }), true); }
    return null;
  }
  function restore(g, snap) { const o = JSON.parse(snap); for (const k of Object.keys(g)) delete g[k]; Object.assign(g, o); TG.G = g; }

  const goodHandler = { p: 0.92, e: { trait: 'steady' } };
  function resolveSmart(g) {
    for (const d of g.decisions.slice()) {
      const b = d.bizId ? TG.B.get(g, d.bizId) : null;
      if (d.bizId && !b) continue;
      const c = TG.D.choose(g, d, goodHandler);
      if (c.opt != null) TG.D.resolve(g, d, c.opt, null);
    }
  }
  function resolveRandom(g) {
    for (const d of g.decisions.slice()) if (rnd() < 0.6) TG.D.resolve(g, d, pick(d.options).id, null);
  }

  function hireBest(g, b, role) {
    const pool = TG.S.poolFor(g, b, role); if (!pool.length) return null;
    const c = pool.slice().sort((x, y) => y.skillSeen - x.skillSeen)[0];
    TG.S.hire(g, b, c); TG.D.syncTargets(b); return c;
  }

  // sensible, careful operator for one business
  function careful(g, b) {
    if (!g.businesses.includes(b)) return;
    resolveSmart(g);
    const last = b.hist.slice(-3); const p3 = U.sum(last, (x) => x.profit);
    const age = g.month - b.founded;
    // repair broken things the player can see
    for (const it of b.equip) if (it.broken && it.broken !== 'destroyed' && g.cash > TG.E.repairCost(g, b, it) * 3) TG.E.repair(g, b, it.id);
    for (const it of b.equip.slice()) if (it.broken === 'destroyed' && g.cash > TG.E.price(g, b, it.type, 'standard') * 3) TG.E.replace(g, b, it.id, 'standard');
    if (!TG.E.hasMech(b)) for (const it of b.equip) if (!it.broken && TG.E.effWear(it) > 60 && g.cash > 30000) TG.E.service(g, b, it.id);
    // v6: nothing is automatic without a manager: buy supplies yourself
    if (b.stock && !TG.D.handler(g, b, 'stock') && g.cash > 5000) { const q = TG.ST.suggest(b, g); if (q > 0) TG.ST.buy(g, b, q); }
    // fill staff to plan
    const plan = TG.M.needs(g, b);
    for (const n of plan.staff) { const have = b.staff.filter((e) => e.role === n.role).length; if (have < n.count && g.cash > 15000) hireBest(g, b, n.role); }
    // GM once it pays for itself
    const p12 = U.sum(b.hist.slice(-12), (x) => x.profit - Math.max(0, (x.lines && x.lines['Lucky breaks']) || 0)) / 12; // one-off windfalls don't pay a salary
    if (!b.spec.gm && age > 12 && p12 > ({ small: 14000, between: 25000, corp: 30000 }[TG.CONFIG.businesses[b.type].tier] || 14000)) hireBest(g, b, 'gm');
    if (!TG.E.hasMech(b) && TG.S.roleDef(b, 'mech') && age > 12 && U.sum(b.hist.slice(-12), (h) => -((h.lines.Repairs || 0) + (h.lines.Maintenance || 0) + (h.lines['Equipment service'] || 0))) / 12 > TG.S.roleDef(b, 'mech').wage[0] * 1.2) hireBest(g, b, 'mech');
    if (!b.spec.accountant && p12 > 40000) hireBest(g, b, 'accountant');
    if (!b.spec.hr && b.staff.length > 25) hireBest(g, b, 'hr');
    // cheap risk reducers
    const d = TG.CONFIG.businesses[b.type];
    for (const f of d.fixes) if (!b.fixes[f.id] && !f.minRep && f.cost * g.world.priceIdx < g.cash * 0.04 && (f.monthly || 0) < Math.max(500, p3 / 3 * 0.08) && rnd() < 0.2) TG.B.buyFix(g, b, f.id);
    for (const t of d.insurance) if (!b.ins[t] && rnd() < 0.1) b.ins[t] = true;
    // growth: add capacity when demand clearly outstrips it
    const lc = b.lastCtx || {};
    if (lc.demand && lc.cap && lc.demand > lc.cap * 1.12 && p3 > 0 && g.cash > 60000 && (!lc.limit || lc.limit === 'equipment')) {
      const crit = d.equip.find((x) => x.id === lc.limitEquip) || d.equip.find((x) => x.critical);
      if (crit && g.cash > TG.E.price(g, b, crit.id, 'standard') * 3) TG.E.buy(g, b, crit.id, 'standard');
    }
    // cheap upgrades that say what they add (+x% capacity / ticket): a careful owner buys one of each once the shop pays
    if (p3 > 0 && age > 3) for (const ed of d.equip) if ((ed.ticketBoost || ed.staffBoost) && TG.E.count(b, ed.id) < 1 && g.cash > ed.price * 5) TG.E.buy(g, b, ed.id, 'standard');
    if (lc.limit === 'staff' && lc.demand > lc.cap * 1.15 && p3 > 0 && g.cash > 20000) { const kr = TG.M.keyRole(d); if (kr) hireBest(g, b, kr); }
    if (b.stock && g.cash > 15000 && TG.ST.cap(b) < Math.min(lc.demand || 0, lc.cap || 0) * 1.1) TG.ST.addStorage(g, b, Math.min(lc.demand, lc.cap) * 1.1);
    if (lc.limit === 'support' && lc.demand > lc.cap * 1.1 && g.cash > 20000) { const sr = Object.keys(d.roles).find((r) => d.roles[r].support); if (sr) hireBest(g, b, sr); }
    if (b.ads.budget === 0 && p3 > 0 && b.rep < 60 && ['service', 'franchise'].includes(d.model)) b.ads.budget = Math.round(Math.min(3000, Math.max(300, (b.revAvg || 0) * 0.03)));
    // model specific
    if (b.brand) { const s = b.brand; const avgO = s.avgOrders || s.lastOrders || 400; const pipe = s.stock + U.sum(s.incoming, (x) => x.units); const want = Math.max(TG.CONFIG.businesses.brand.brand.minBatch, Math.round(avgO * 3.5)); if (pipe < avgO * 3.2) TG.M.brandOrder(g, b, want, false); if (b.ads.budget < 4000) b.ads.budget = 4000; }
    if (b.proj) for (const kind of ['excavator', 'crane']) { const need = U.sum(b.proj.active, (p) => (kind === 'excavator' ? p.heavy : p.crane) || 0); const have = b.equip.filter((x) => x.type === kind && !x.broken).length; if (need > have) TG.E.buy(g, b, kind, 'standard', { leased: g.cash < TG.E.price(g, b, kind, 'standard') * 4 }); }
    if (b.proj) { const need = Math.max(6, Math.ceil(U.sum(b.proj.active, (p) => p.crew))); const lab = b.staff.filter((e) => e.role === 'laborer'); if (lab.length > need * 1.3 + 2) { for (const e of lab.slice(0, lab.length - need)) TG.S.fire(g, b, e.id, 'no work'); TG.D.syncTargets(b); } }
    if (b.proj) { const crew = TG.M.models.projects.crew(b, TG.B.ctx(g, b)); let need = U.sum(b.proj.active, (p) => p.crew); for (const o of b.proj.offers.slice()) { if (need + o.crew > crew * 1.3 || (o.bond && !b.fixes.bonds)) continue; const r = TG.M.bid(g, b, o.id, 'normal'); if (r.won) need += o.crew; } }
    if (b.fr) for (const a of b.fr.apps.slice()) { if (a.signal > 0.55 && g.cash > 50000) TG.M.franchiseApprove(g, b, a.id); else TG.M.franchiseReject(g, b, a.id); }
    if (b.farm && b.farm.sellPolicy !== 'auto') b.farm.sellPolicy = 'auto';
    if (b.farm) {
      const f = TG.M.farmEnsure(b); const A = f.areas; const main = TG.M.farmAreas.slice().sort((x, y) => A[y].acres - A[x].acres)[0];
      const p12f = U.sum(b.hist.slice(-12), (x) => x.profit);
      if (b.hist.length >= 12 && p12f > 0 && rnd() < 0.08) { const n = Math.max(40, Math.round(f.acres * 0.25)); const land = n * TG.M.farmLandPrice(g, b), conv = TG.M.farmMoveCost(g, b, main, n).cost; if (g.cash > land + conv + 300000 && p12f > (land + conv) * 0.2) TG.M.farmBuyLand(g, b, n, false); } // only expand when a year's profit pays ~1/5 of it
      const fr = TG.M.farmFree(f); if (fr > 0 && g.cash > TG.M.farmMoveCost(g, b, main, fr).cost + 150000) TG.M.farmMove(g, b, 'free', main, fr);
      if (A.cows.acres > 0) {
        const cap = TG.M.farmHeadCap(b); if (A.cows.herd < cap * 0.6 && g.cash > 60000) TG.M.farmBuyCattle(g, b, Math.round(Math.min(cap * 0.7 - A.cows.herd, 60, (g.cash - 50000) / TG.M.cowPrice(g, b))), 'milker');
        if (!TG.D.handler(g, b, 'farm')) { // no manager: do the cow chores yourself
          const st = A.cows.st; if (st.bull < 1 && A.cows.herd > 10) TG.M.farmBuyCattle(g, b, 1, 'bull');
          if (st.ready >= 1) TG.M.farmSellCattle(g, b, st.ready, 'ready'); if (st.dry >= 1) TG.M.farmSellCattle(g, b, st.dry, 'dry');
          const over = A.cows.herd - cap * 0.95; if (over >= 1) TG.M.farmSellCattle(g, b, Math.min(over, st.steer), 'steer');
          let want = 0; for (let i = 1; i <= 2; i++) want += Math.max(0, TG.M.feedNeed(A.cows) - TG.M.grass(g, b, null, U.moy(g.month + i)));
          if (want - (f.feed || 0) >= 1) TG.M.farmBuyFeed(g, b, want - (f.feed || 0));
        }
      }
      if (A.crops.acres > 0 && !TG.D.handler(g, b, 'farm')) { const e = TG.M.areaE(b, 'crops'); const nm = U.moy(g.month + 1); if (e.plant.indexOf(nm) >= 0 || e.plant.indexOf(U.moy(g.month)) >= 0) { const need = A.crops.acres - (f.seeds || 0) - A.crops.planted; if (need > 1) TG.M.farmBuySeeds(g, b, need); } }
      if (!TG.D.handler(g, b, 'farm')) for (const k of ['crops', 'orchard']) if (A[k].acres > 0 && A[k].soil < 0.55 && g.cash > TG.M.farmTreatCost(g, b, k) * 4) TG.M.farmTreat(g, b, k, 'You');
      for (const k of TG.M.farmAreas) { if (A[k].acres < 20) continue; const t = TG.CONFIG.businesses.farm.farm.areas[k].spr; if (!t) continue; if (TG.M.areaWater(b, k) < 0.75 && b.hist.length >= 6 && g.cash > TG.E.price(g, b, t, 'standard') + 250000 && rnd() < 0.3) TG.E.buy(g, b, t, 'standard'); }
    }
    if (b.factory) { const lines = TG.M.models.factory.lines(b).length; if (lc.util > 0.95 && p3 > 50000 && lines < TG.M.models.factory.maxLines(b) && g.cash > TG.E.price(g, b, 'line', 'standard') * 2.5) TG.E.buy(g, b, 'line', 'standard'); }
    if (b.tech && !b.tech.researched && g.cash > 80000) { const f = d.fixes.find((x) => x.id === 'research'); if (f) TG.B.buyFix(g, b, 'research'); }
    // keep a cash buffer: pay down the credit line
    if (g.loc.balance > 0 && g.cash > 50000) TG.F.locRepay(g, g.cash - 50000);
  }

  // reckless: max leverage, expand regardless, ignore problems, gamble
  function reckless(g, b) {
    if (!g.businesses.includes(b)) return;
    resolveRandom(g);
    const d = TG.CONFIG.businesses[b.type];
    const crit = d.equip.find((x) => x.critical);
    if (crit && rnd() < 0.3) TG.E.buy(g, b, crit.id, 'premium', { leased: rnd() < 0.5 });
    if (rnd() < 0.3) for (const n of TG.M.needs(g, b).staff) hireBest(g, b, n.role);
    if (rnd() < 0.1) { const r = TG.F.takeLoan(g, 'business', Math.round(TG.F.maxLoan(g, 'business') * 0.9)); }
    if (rnd() < 0.2 && g.cash > 2000) TG.I.buy(g, pick(['MOON', 'HYPE', 'PNY', 'GROW']), Math.round(g.cash * 0.25), true);
    if (rnd() < 0.3 && g.cash > 5000) for (let i = 0; i < 5; i++) TG.I.casinoBet(g, pick(['red', 'num', 'slots', 'dice']), Math.min(TG.I.betLimit(g), Math.round(g.cash * 0.1)));
    b.ads.budget = Math.round(Math.max(b.ads.budget, (b.revAvg || 5000) * 0.15));
    b.pace = 'rush'; if (TG.PR.hasPrice(b) && rnd() < 0.5) TG.PR.set(g, b, TG.PR.market(g, b) * pick([0.6, 1.4, 2.5]));
    if (b.brand) TG.M.brandOrder(g, b, 20000, false);
    if (b.proj) for (const o of b.proj.offers.slice()) TG.M.bid(g, b, o.id, 'low');
    if (b.fr) for (const a of b.fr.apps.slice()) TG.M.franchiseApprove(g, b, a.id);
  }

  // random: anything goes (crash fuzzing)
  function random(g) {
    const r = rnd();
    resolveRandom(g);
    const bs = g.businesses;
    const types = Object.keys(TG.CONFIG.businesses);
    if (r < 0.04 && bs.length < 4) { const p = pick(g.listings); if (p && TG.P.acquire(g, p.id, pick(['cash', 'mortgage', 'lease'])).ok) { const s = TG.B.start(g, pick(types), p.id, {}); if (s.ok) TG.B.quickSetup(g, s.biz, true, pick(['used', 'budget', 'standard', 'premium'])); } }
    if (!bs.length) return;
    const b = pick(bs); const d = TG.CONFIG.businesses[b.type];
    const acts = [
      () => hireBest(g, b, pick(Object.keys(d.roles))),
      () => hireBest(g, b, pick(Object.keys(TG.CONFIG.specialists).concat(TG.S.roleDef(b, 'mech') ? ['mech'] : []))),
      () => { const e = pick(b.staff); if (e) TG.S.fire(g, b, e.id); },
      () => { const e = pick(TG.S.allStaff(b)); if (e) TG.S.train(g, b, e.id, pick(['basic', 'advanced'])); },
      () => { const e = pick(TG.S.allStaff(b)); if (e) TG.S.raise(g, b, e.id); },
      () => { const e = pick(b.staff); if (e) TG.S.promote(g, b, e.id, pick(Object.keys(TG.CONFIG.specialists))); },
      () => TG.E.buy(g, b, pick(d.equip).id, pick(['used', 'budget', 'standard', 'premium']), { leased: rnd() < 0.3 }),
      () => { const it = pick(b.equip); if (it) pick([TG.E.repair, TG.E.service, TG.E.inspect, TG.E.sell])(g, b, it.id); },
      () => TG.B.buyFix(g, b, pick(d.fixes).id),
      () => { const f = pick(Object.keys(b.fixes)); if (f) TG.B.dropFix(g, b, f); },
      () => { b.ads.budget = pick([0, 500, 3000, 20000]); b.ads.channel = pick(Object.keys(TG.CONFIG.reputation.adChannels)); },
      () => { if (TG.PR.hasPrice(b)) TG.PR.set(g, b, rnd() < 0.3 ? null : TG.PR.market(g, b) * pick([0.3, 0.8, 0.95, 1.1, 1.5, 4])); b.pace = pick(['careful', 'normal', 'rush']); },
      () => { if (b.stock) { if (rnd() < 0.5) TG.ST.buy(g, b, rnd() * 3000); else TG.ST.sell(g, b, rnd() * 500); b.stock.auto = rnd() < 0.8; } },
      () => { if (b.farm) { if (rnd() < 0.5) TG.M.farmBuySeeds(g, b, rnd() * 300); else TG.M.farmSellCattle(g, b, rnd() * 30, pick(TG.M.cowStages)); if (rnd() < 0.3) TG.M.farmBuyFeed(g, b, rnd() * 200); b.farm.orders.seed = rnd() < 0.8; } },
      () => TG.F.takeLoan(g, pick(['business', 'emergency']), Math.round(rnd() * 200000)),
      () => { const l = pick(g.loans); if (l) TG.F.prepay(g, l.id, rnd() * 50000); },
      () => TG.F.locDraw(g, rnd() * 50000), () => TG.F.locRepay(g, rnd() * 50000),
      () => TG.I.buy(g, pick(Object.keys(TG.CONFIG.invest.assets)), Math.round(rnd() * Math.max(0, g.cash) * 0.2), rnd() < 0.3),
      () => { const s = pick(Object.keys(g.invest.pos)); if (s) TG.I.sell(g, s, rnd()); },
      () => TG.I.casinoBet(g, pick(Object.keys(TG.CONFIG.casino.games)), Math.round(10 + rnd() * 3000)),
      () => TG.I.betHorse(g, Math.floor(rnd() * 6), Math.round(10 + rnd() * 2000)),
      () => TG.I.betSports(g, pick(['a', 'b']), Math.round(10 + rnd() * 2000)),
      () => { const o = pick(g.invest.angelOffers); if (o) TG.I.angelInvest(g, o.id, o.min); },
      () => { const l = pick(g.re.listings); if (l) TG.RE.buy(g, l.id, rnd() < 0.7, pick([undefined, 180, 360])); },
      () => { const h = pick(g.re.holdings); if (!h) return; h.rentR = pick(TG.CONFIG.tenants.rentSteps); if (!TG.RE.current(g, h)) TG.RE.search(g, h.id); let k = 0; while (TG.RE.current(g, h) && k++ < 5) TG.RE.decide(g, h.id, rnd() < 0.5); },
      () => TG.CREDIT.apply(g, pick(['business', 'equipment', 'loc', 'emergency']), Math.round(rnd() * 150000), { term: pick([undefined, 36, 60]) }),
      () => { const h = pick(g.re.holdings); if (!h) return; const a = Math.floor(rnd() * 7); if (a === 0) TG.RE.startFlip(g, h.id, pick(['cosmetic', 'full', 'luxury']), pick(['cheap', 'trusted']), rnd() < 0.5); else if (a === 1) TG.RE.list(g, h.id, 0.9 + rnd() * 0.3); else if (a === 2) TG.RE.refinance(g, h.id); else if (a === 3) TG.RE.develop(g, h.id, 40); else if (a === 4) h.rentR = pick([0.8, 1, 1.2]); else if (a === 5) h.upkeep = pick(['low', 'normal', 'high']); else TG.RE.sell(g, h.id); },
      () => { const l = pick(g.re.listings); if (l) TG.RE.inspect(g, l.id); },
      () => { if (!g.re.manager) TG.RE.hireManager(g, pick(TG.RE.managerPool(g))); },
      () => { if (!g.ceo && rnd() < 0.3) TG.D.hireCeo(g, pick(TG.D.ceoPool(g))); else if (g.ceo && rnd() < 0.1) TG.D.fireCeo(g); },
      () => { const pct = pick(TG.CONFIG.finance.investorOffers); TG.F.takeInvestor(g, b, pct); },
      () => TG.F.ipo(g, b), () => TG.F.buyBack(g, b),
      () => { if (rnd() < 0.05) TG.B.sell(g, b.id); },
      () => { if (rnd() < 0.03) TG.F.businessBankruptcy(g, b.id); },
      () => { if (b.brand) TG.M.brandOrder(g, b, Math.round(rnd() * 8000), rnd() < 0.3); if (b.brand && rnd() < 0.2) TG.M.brandClearance(g, b, 0.5); },
      () => { if (b.proj) { const o = pick(b.proj.offers); if (o) TG.M.bid(g, b, o.id, pick(['low', 'normal', 'high'])); } },
      () => { if (b.tech) { if (rnd() < 0.5) TG.M.techResearch(g, b); else TG.M.techPivot(g, b); } },
      () => { if (b.fr) { const a = pick(b.fr.apps); if (a) (rnd() < 0.5 ? TG.M.franchiseApprove : TG.M.franchiseReject)(g, b, a.id); } },
      () => { if (b.farm) { const a = Math.floor(rnd() * 6); if (a === 0) TG.M.farmBuyLand(g, b, 20, rnd() < 0.5); if (a === 1) { const ks = ['free'].concat(TG.M.farmAreas); TG.M.farmMove(g, b, pick(ks), pick(ks), 1 + rnd() * 40); TG.M.farmTreat(g, b, pick(TG.M.farmAreas), 'You'); } if (a === 2) TG.M.farmStorage(g, b, 100); if (a === 3) TG.M.farmFutures(g, b, pick(['crops', 'orchard']), 50); if (a === 4) TG.M.farmBuyCattle(g, b, 10, pick(TG.M.cowStages)); if (a === 5) b.farm.sellPolicy = pick(['sell', 'store', 'auto']); } },
      () => { if (b.freight || b.type === 'freight') TG.M.freightHedge(g, b); },
      () => { const pr = pick(Object.keys(TG.CONFIG.reputation.pr)); TG.B.doPR(g, b, pr, null); },
      () => {},
      () => { g.settings.gambling = rnd() < 0.8; g.settings.ceoBigMoves = rnd() < 0.5; },
      () => { if (rnd() < 0.2) { const p = g.properties.find((x) => !x.bizId); if (p) TG.P.sell(g, p.id); } },
      () => { if (rnd() < 0.05) TG.B.close(g, b, 'closed by owner'); },
      () => { if (!g.re.fund) TG.RE.raiseFund(g); },
    ];
    const n = 1 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) pick(acts)();
  }
  return { startBiz, careful, reckless, random, resolveSmart, resolveRandom, hireBest, restore };
};
