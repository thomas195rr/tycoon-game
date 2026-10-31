/* models.js - business models: service (most businesses), farm, freight. models2.js adds brand, factory, projects, tech, franchise. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const M = { models: {} };
  const mdl = (b) => M.models[TG.CONFIG.businesses[b.type].model];
  M.init = (g, b, prop, opts) => { const m = mdl(b); if (m.init) m.init(g, b, prop, opts || {}); };
  M.needs = (g, b) => mdl(b).needs(g, b);
  M.month = (g, b, ctx) => mdl(b).month(g, b, ctx);
  M.baseRev = (g, b) => U.num(mdl(b).baseRev(g, b), 10000);
  M.extraRisks = (g, b, ctx) => (mdl(b).extraRisks ? mdl(b).extraRisks(g, b, ctx) : []);
  M.inventoryValue = (g, b) => (mdl(b).inventoryValue ? U.num(mdl(b).inventoryValue(g, b)) : 0) + Math.round(TG.ST.value(g, b));
  M.keyRole = (d) => Object.keys(d.roles).find((r) => d.roles[r].key);
  M.staffEff = (e) => (0.6 + e.skill / 250) * (1 - TG.CONFIG.staff.noShowBase * (1.6 - e.reliability / 100)) * (1 - (e.away || 0)); // v9: time in training is time off the job
  M.paceMult = (b) => (b.pace === 'rush' ? 1.15 : b.pace === 'careful' ? 0.92 : 1);
  M.priceMult = (g, b) => TG.PR.ratio(g, b);
  M.repF = (b, exp) => U.clamp(Math.pow(Math.max(b.rep, 3) / 50, exp == null ? 1 : exp), 0.04, 2.6);

  // ============ SERVICE ============
  M.models.service = {
    spaceCap(b) { const s = TG.CONFIG.businesses[b.type].svc; return s.mobile ? Infinity : b.sqft * s.perSpace; },
    demandBase(g, b) {
      const d = TG.CONFIG.businesses[b.type], s = d.svc;
      if (s.occupancy) return this.spaceCap(b) * s.occupancy;
      const tf = s.mobile ? 0.55 + 0.6 * b.traffic : 0.25 + 0.95 * Math.pow(b.traffic, 0.8);
      return s.baseDemand * tf;
    },
    baseRev(g, b) { const s = TG.CONFIG.businesses[b.type].svc; return Math.min(this.demandBase(g, b), this.spaceCap(b)) * s.ticket * g.world.priceIdx; },
    needs(g, b) {
      const d = TG.CONFIG.businesses[b.type]; const est = Math.min(this.demandBase(g, b) * M.repF(b, d.svc.repExp) * 1.1, this.spaceCap(b));
      const out = { equip: [], staff: [] };
      for (const ed of d.equip) if (ed.support) out.equip.push({ type: ed.id, count: 1 });
      for (const pl of TG.E.pools(b)) out.equip.push({ type: pl.primary.id, count: Math.max(1, Math.ceil(est / pl.primary.cap)) });
      // storage: enough to hold about a month of supplies
      const sd = d.supply;
      if (sd) {
        const room = Math.max(sd.baseStore || 0, est * 0.75) + U.sum(d.equip.filter((x) => x.support && x.store), (x) => x.store);
        const sto = TG.ST.bestStore(b);
        if (sto && est * 1.08 > room) out.equip.push({ type: sto.id, count: Math.ceil((est * 1.08 - room) / sto.store) + (sto.support ? 1 : 0) });
      }
      for (const r in d.roles) {
        const rd = d.roles[r];
        if (rd.key) out.staff.push({ role: r, count: Math.max(rd.min || 0, Math.ceil(est / (rd.cap * 0.8)) - (B().owner(g, b) && d.tier === 'small' ? 1 : 0), d.tier === 'small' ? 0 : 1) });
        else if (rd.support) out.staff.push({ role: r, count: Math.max(0, Math.round(est / rd.per - 0.5)) });
      }
      return out;
    },
    caps(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses[b.type];
      let keyCap = 0; const kr = M.keyRole(d);
      for (const e of ctx.key) keyCap += d.roles[e.role].cap * M.staffEff(e);
      if (ctx.mw) keyCap += d.roles[kr].cap * ctx.mw; // v9: GM / Ops lend a hand at a fraction of a worker
      keyCap *= 1 + TG.E.boost(b, 'staffBoost');
      let supCap = Infinity;
      for (const r in d.roles) if (d.roles[r].support) { const have = b.staff.filter((e) => e.role === r).length; supCap = Math.min(supCap, (have + 0.5) * d.roles[r].per); }
      let eqCap = Infinity, prod = 1, limEq = null; const links = [];
      for (const pl of TG.E.pools(b)) { const c = TG.E.capacity(b, pl.pool); links.push({ pool: pl.pool, id: pl.primary.id, cat: pl.primary.cat, cap: c }); if (c < eqCap) { limEq = pl.primary.id; eqCap = c; } }
      for (const ed of d.equip) { if (ed.support || ed.critical || !ed.cap || ed.demandBoost) continue; if (TG.E.capacity(b, TG.E.poolOf(ed)) > 0) prod *= 1.06; }
      const spaceCap = this.spaceCap(b);
      return { keyCap: keyCap * prod, eqCap, spaceCap, supCap, limEq, links };
    },
    month(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses[b.type], s = d.svc, P = TG.PR, ST = TG.ST, FL = TG.FL;
      FL.start(b);
      const k = this.caps(g, b, ctx);
      const pace = M.paceMult(b) * (1 - ctx.down);
      const cap = Math.max(0, Math.min(k.keyCap, k.eqCap, k.spaceCap, k.supCap) * pace);
      const qualF = 0.85 + 0.3 * ctx.quality / 100;
      const r = P.ratio(g, b); const pf = P.demandF(r);
      let demand = this.demandBase(g, b) * M.repF(b, s.repExp) * qualF * B().demandMult(g, b, ctx) * pf;
      if (s.staffDemand && ctx.key.length) demand *= 1 + s.staffDemand * (ctx.skill - 50) / 100;
      let served = Math.min(demand, cap), made = 0, waste = 0, stockLimited = false;
      const sd = ST.def(b);
      if (sd) {
        ST.ensure(b);
        const ahead = s.makeAhead || 1;
        ST.restock(g, b, served * ahead);
        if (s.makeAhead) {
          made = Math.min(b.stock.qty, Math.min(demand * R.range(0.95, 1.05) * ahead, cap * 1.05));
          ST.use(b, made);
          const sold = Math.min(served, made); if (sold < served - 0.5) stockLimited = true;
          served = sold; waste = Math.max(0, made - served); b.stock.wasteM = waste;
        } else {
          const u = ST.use(b, served); if (u < served - 0.5) stockLimited = true; served = u;
        }
      }
      const base = s.ticket * g.world.priceIdx;
      const tb = TG.E.boost(b, 'ticketBoost');
      const ticket = P.ask(g, b) * (1 + tb) * ((b.fixesOn && b.fixesOn.ticketMult) || 1);
      const rev = served * ticket;
      if (d.receivable) B().addRecv(g, b, rev, d.receivable.delay - (b.fixes.billing ? 1 : 0));
      else TG.F.earn(g, rev, 'Revenue', b.id);
      if (P.good(b)) TG.W.sell(g, P.good(b).market, served);
      const fo = b.fixesOn || {};
      if (!sd) {
        let cogsPct = s.cogs + (fo.cogsAdd || 0) - (ctx.own ? C.owner.operatedCogsCut : 0);
        if (g.world.shortage[d.cat]) cogsPct *= 1.15;
        TG.F.spend(g, Math.round(served * base * Math.max(0, cogsPct)), 'Supplies & cost of sales', b.id);
      } else if (fo.cogsAdd) TG.F.spend(g, Math.round(served * base * fo.cogsAdd), 'Supplies & cost of sales', b.id);
      if (tb) TG.F.spend(g, Math.round(served * base * tb * 0.5), 'Supplies & cost of sales', b.id);
      if (s.ota) TG.F.spend(g, Math.round(rev * s.ota * (fo.otaCut ? 1 - fo.otaCut : 1)), 'Booking site fees', b.id);
      if (fo.revCostPct) TG.F.spend(g, Math.round(rev * fo.revCostPct), 'Commissions & warranties', b.id);
      const spoiled = sd ? ST.spoil(b) : 0;
      ctx.cap = Math.round(cap); ctx.demand = Math.round(demand); ctx.served = Math.round(served);
      ctx.limitEquip = k.limEq; ctx.links = k.links;
      { // work-capacity report
        const WK = TG.WK, kr = M.keyRole(d), unit = (P.good(b) || {}).unit || 'customer', nk = ctx.key.length + (ctx.own ? 1 : 0);
        WK.add(ctx, 'staff', '👥', (d.roles[kr].label || kr) + 's', nk, k.keyCap * pace, served, unit + 's', [], `Each handles about ${Math.round(d.roles[kr].cap).toLocaleString()} ${unit}s a month at normal skill. Training and skill raise it; over 100% they get tired and grumpy.`);
        for (const r in d.roles) if (d.roles[r].support) WK.add(ctx, 'staff', '🧹', (d.roles[r].label || r) + 's', b.staff.filter((e) => e.role === r).length, k.supCap, served, unit + 's', [], `Each supports about ${Math.round(d.roles[r].per).toLocaleString()} ${unit}s.`, r);
        WK.poolGroups(g, b, ctx, served, unit + 's');
        if (Number.isFinite(k.spaceCap)) WK.add(ctx, 'space', '📐', 'Space', 1, k.spaceCap * pace, served, unit + 's', [], 'How many your building fits. Needs a bigger place.');
      }
      const mn = Math.min(k.keyCap, k.eqCap, k.spaceCap, k.supCap);
      ctx.limit = stockLimited ? 'stock' : k.keyCap <= mn ? 'staff' : k.eqCap <= mn ? 'equipment' : k.spaceCap <= mn ? 'space' : 'support';
      if (demand < cap * 0.98 && !stockLimited) ctx.limitNow = 'demand';
      ctx.util = cap > 0 ? demand / cap : 1.5; ctx.busy = cap > 0 ? served / cap : 1;
      ctx.priceR = r;
      const lim = { staff: 'staff', equipment: 'equipment', space: 'space', support: 'helpers', stock: 'stock ran out' }[ctx.limit];
      if (cap === 0) ctx.note = 'No capacity: you need ' + (k.keyCap === 0 ? 'key staff' : k.eqCap === 0 ? 'working equipment' : 'space');
      else if (stockLimited) ctx.note = b.stock && b.stock.short === 'cash' ? 'Ran out of stock: not enough cash to buy supplies' : b.stock && b.stock.short === 'room' ? 'Ran out of stock: storage is too small' : (TG.D.handler(g, b, 'stock') ? 'Ran out of stock: order more' : 'Ran out of stock: no manager reorders, buy supplies yourself');
      else if (demand > cap * 1.15) ctx.note = `Turning away ${U.pct(1 - cap / demand)} of customers: limited by ${lim}`;
      else if (demand < cap * 0.6) ctx.note = r > 1.08 ? 'Lots of empty capacity: your price is above market' : 'Lots of empty capacity: need more customers';
      // flow
      const gd = P.good(b); const unit = d.supply ? '' : '';
      if (sd) FL.row(b, '📥', 'Stock in', b.stock.inM, '', b.stock.inM > 0 ? 'g' : 'y', b.stock.lastBy ? 'Ordered by ' + b.stock.lastBy : 'Auto-order off');
      if (s.makeAhead) FL.row(b, '🍳', 'Made', made, '', 'g');
      if (b.type === 'gym') {
        const prev = b.members == null ? served : b.members; const left = prev * s.churn * (r > 1.05 ? 1 + (r - 1) * 2 : 1);
        const joined = Math.max(0, served - prev + left); b.members = served;
        FL.row(b, '🙋', 'Joined', joined, 'members', 'g'); FL.row(b, '👋', 'Left', left, 'members', left > joined ? 'r' : 'y', `${U.pct(s.churn)} leave each month`);
      }
      FL.row(b, gd.icon, 'Sold', served, gd.unit, 'g', `at ${U.money(ticket)} each`);
      const lost = Math.max(0, demand - served);
      if (lost > 0.5) FL.row(b, '🚪', 'Turned away', lost, gd.unit, lost > demand * 0.15 ? 'r' : 'y', 'Limited by ' + lim);
      if (waste > 0.5) FL.row(b, '🗑️', 'Unsold (wasted)', waste, '', waste > made * 0.1 ? 'r' : 'y', 'Made ahead, not sold');
      if (spoiled > 0.5) FL.row(b, '🗑️', 'Spoiled', spoiled, '', spoiled > (b.stock.usedM || 1) * 0.1 ? 'r' : 'y', `${U.pct(sd.spoil)} of leftover stock spoils each month`);
      if (sd) FL.row(b, sd.icon, 'Stock left', b.stock.qty, '/' + ST.cap(b), b.stock.qty < served * 0.2 ? 'y' : 'g');
      const moy = U.moy(g.month), nm = (moy + 1) % 12; const sf = d.season[nm] / Math.max(0.1, d.season[moy]);
      const expD = demand * sf;
      FL.next(b, '🧲', 'Customers expected', expD, gd.unit, expD > cap ? 'y' : 'g', expD > cap ? 'More than you can serve (' + Math.round(cap) + ')' : '');
      if (sd) { const need = Math.min(expD, cap) * (s.makeAhead || 1); FL.next(b, sd.icon, 'Stock needed', need, '', need > ST.cap(b) ? 'r' : 'g', need > ST.cap(b) ? 'More than storage holds (' + ST.cap(b) + ')' : ''); FL.next(b, '🗑️', 'Will spoil', Math.max(0, b.stock.qty) * sd.spoil, '', 'y'); }
      if (b.type === 'gym') FL.next(b, '👋', 'Will leave', served * s.churn, 'members', 'y');
    },
  };
  const B = () => TG.B;

  // ============ FARM: see farm.js ============
  // ============ FREIGHT ============
  M.models.freight = {
    needs(g, b) { const n = Math.max(1, b.equip.filter((x) => x.type === 'truck').length); return { equip: [{ type: 'truck', count: n }], staff: [{ role: 'driver', count: B().owner(g, b) ? Math.max(0, n - 1) : n }] }; },
    baseRev(g, b) { return Math.max(1, b.equip.filter((x) => x.type === 'truck').length) * 13 * TG.CONFIG.markets.freight.base * g.world.priceIdx; },
    month(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses.freight, fr = d.freight, w = g.world;
      const fo = b.fixesOn || {};
      const trucks = b.equip.filter((x) => x.type === 'truck');
      const roadM = 0.72 + 0.35 * b.traffic * 0 + 0.35 * (g.properties.find((p) => p.id === b.propId) || { road: 0.6 }).road;
      const truckCap = U.sum(trucks, (x) => TG.E.out(x) * d.equip[0].cap) * roadM * (fo.loadMult || 1);
      let driverCap = U.sum(ctx.key, (e) => d.roles.driver.cap * (0.7 + e.skill / 300) * (1 - C.staff.noShowBase * (1.6 - e.reliability / 100)));
      if (ctx.mw) driverCap += d.roles.driver.cap * ctx.mw;
      let cap = Math.min(truckCap, driverCap) * (w.hoursReg > 0 ? 0.9 : 1) * M.paceMult(b) * (1 - ctx.down);
      const st = g.markets.freight;
      const r = TG.PR.ratio(g, b);
      const avail = U.clamp(0.78 + 0.22 * (b.rep / 50) - 0.35 * (st.comp - 1), 0.35, 1.05) * B().demandMult(g, b, ctx, { noPrice: true }) * TG.PR.demandF(r);
      let loads = Math.max(0, Math.min(cap, cap * avail));
      // diesel comes out of the tanks; bad roads and emission rules burn more, fuel-saving upgrades less
      const road = (g.properties.find((p) => p.id === b.propId) || { road: 0.6 }).road;
      const burn = Math.pow(2 - road, 0.3) * (1 - (fo.fuelCut || 0)) * (w.emissions > 0 ? 1.05 : 1);
      TG.ST.ensure(b); TG.ST.restock(g, b, loads * burn);
      const usedF = TG.ST.use(b, loads * burn); const noFuel = Math.max(0, loads - usedF / burn); loads -= noFuel;
      const nTr = trucks.filter((x) => !x.broken).length;
      const reef = b.equip.filter((x) => x.type === 'reefer' && !x.broken).length;
      const reefB = nTr ? Math.min(1, reef / nTr) * TG.E.def(b, 'reefer').ticketBoost : 0;
      const price = (b.ask != null ? TG.PR.ask(g, b) : TG.W.price(g, 'freight', loads * 6)) * (1 + reefB);
      TG.F.earn(g, Math.round(loads * price), 'Freight revenue', b.id); TG.W.sell(g, 'freight', loads);
      ctx.priceR = r;
      { const FL = TG.FL; FL.start(b);
        FL.row(b, '🚛', 'Trucks working', nTr, '/' + trucks.length, nTr < trucks.length ? 'y' : 'g', nTr < trucks.length ? 'Some trucks broken' : '');
        FL.row(b, '📦', 'Loads hauled', loads, '', 'g', `at ${U.money(price)} each`);
        FL.row(b, '⛽', 'Diesel used', usedF, 'tanks', 'g', `${U.money(TG.ST.unitCost(g, b))} a tank now${b.hedge && b.hedge.until > g.month ? ' (locked price)' : ''}`);
        if (noFuel > 0.5) FL.row(b, '🚫', 'Loads lost: no diesel', noFuel, '', 'r', b.stock.short === 'cash' ? 'Not enough cash for fuel' : 'Tanks empty: buy diesel or turn on auto');
        FL.next(b, '⛽', 'Diesel in tanks', b.stock.qty, '/' + TG.ST.cap(b), b.stock.qty < loads ? 'y' : 'g', 'Enough for about this many loads');
        if (cap * (1 - avail) > 0.5 && avail < 1) FL.row(b, '🅿️', 'Empty truck days', cap - loads, 'loads', avail < 0.75 ? 'r' : 'y', r > 1.05 ? 'Your rate is over market' : 'Not enough freight around');
        if (truckCap > driverCap * 1.2) FL.row(b, '🧑‍✈️', 'Trucks without drivers', (truckCap - driverCap) / 14, '', 'r', 'Hire drivers');
        FL.next(b, '📦', 'Loads expected', loads, '', 'g'); }
      TG.F.spend(g, Math.round(loads * fr.tollsPerLoad * w.priceIdx), 'Tolls & fees', b.id); TG.ST.spoil(b);
      // crashes per active truck
      const active = Math.min(trucks.filter((x) => !x.broken).length, Math.ceil(loads / 12));
      for (let i = 0; i < active; i++) {
        const t = trucks.filter((x) => !x.broken)[i]; if (!t) break;
        const p = fr.crashBase * (1.6 - ctx.skill / 100) * (0.5 + TG.E.effWear(t) / 60) * (b.pace === 'rush' ? 1.6 : b.pace === 'careful' ? 0.75 : 1) * (b.fixes.safetytrain ? 0.6 : 1) * (b.spec.safety ? 0.6 : 1) * (w.hoursReg > 0 ? 0.85 : 1) * ctx.streakMult;
        if (R.chance(p)) {
          t.broken = R.chance(0.4) ? 'destroyed' : 'major';
          const why = `${U.pct(p, 2)} monthly crash chance per truck: driver skill ${Math.round(ctx.skill)}, truck wear ${Math.round(TG.E.effWear(t))}%, ${b.pace} pace${b.fixes.safetytrain ? ', safety training' : ', no safety training'}`;
          TG.rep.event(g, b, 'major', `${t.label} #${TG.E.num(b, t)} crashed`, why, { major: 'breakdown' });
          if (t.broken === 'destroyed') TG.F.claim(g, b, 'equipment', TG.E.resale(g, b, Object.assign({}, t, { broken: null })), 'truck crash');
          TG.E.queueBroken(g, b, t);
          B().lawsuit(g, b, 'Truck crash lawsuit', R.range(fr.crashSuit[0], fr.crashSuit[1]) * w.priceIdx, 'liability', why);
          b.rep = U.clamp(b.rep - R.range(2, 6), 0, 100);
        }
      }
      TG.WK.add(ctx, 'eq', '🚛', 'Trucks', trucks.filter((x) => !x.broken).length, truckCap, loads, 'loads', ['truck'], `About ${d.equip[0].cap} loads a month per truck. Good roads add a little. Busy trucks wear faster.`);
      TG.WK.add(ctx, 'staff', '🧑‍✈️', 'Drivers', ctx.key.length + (ctx.own ? 1 : 0), driverCap, loads, 'loads', [], `About ${d.roles.driver.cap} loads a month per driver (legal driving hours). Skill and reliability raise it.`);
      ctx.cap = Math.round(cap); ctx.served = Math.round(loads); ctx.demand = Math.round(cap * avail);
      ctx.util = cap > 0 ? avail : 1; ctx.busy = U.clamp(avail, 0, 1.2);
      if (truckCap > driverCap * 1.2) ctx.note = 'Trucks sitting idle: not enough drivers';
      else if (driverCap > truckCap * 1.2) ctx.note = 'Drivers waiting: not enough working trucks';
      if (avail < 0.7) ctx.note = 'Too many trucks chasing the same freight: loads are scarce';
    },
    extraRisks(g, b, ctx) {
      const fr = TG.CONFIG.businesses.freight.freight; const t = b.equip.filter((x) => x.type === 'truck' && !x.broken);
      if (!t.length) return [];
      const p = fr.crashBase * (1.6 - ctx.skill / 100) * (0.5 + TG.E.avgWear(b) / 60) * (b.fixes.safetytrain ? 0.6 : 1) * (b.spec.safety ? 0.6 : 1) * t.length;
      return [{ label: 'A truck crash (lawsuit)', p: 1 - Math.pow(1 - p / t.length, t.length), why: `${t.length} trucks on the road, driver skill ${Math.round(ctx.skill)}` }];
    },
  };
  M.freightHedge = (g, b) => {
    const cost = Math.round(b.equip.filter((x) => x.type === 'truck').length * 13 * 12 * 620 * 0.02 * g.world.priceIdx);
    if (g.cash < cost) return { ok: false, msg: `Hedge costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Fuel hedging', b.id, true);
    b.hedge = { idx: g.world.fuel * 1.03, until: g.month + 12 };
    return { ok: true, cost };
  };
  TG.M = M;
})();
