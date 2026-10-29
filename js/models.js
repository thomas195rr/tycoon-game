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
  M.staffEff = (e) => (0.6 + e.skill / 250) * (1 - TG.CONFIG.staff.noShowBase * (1.6 - e.reliability / 100));
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
      if (ctx.own && d.tier === 'small') keyCap += d.roles[kr].cap * 0.6;
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
      const mn = Math.min(k.keyCap, k.eqCap, k.spaceCap, k.supCap);
      ctx.limit = stockLimited ? 'stock' : k.keyCap <= mn ? 'staff' : k.eqCap <= mn ? 'equipment' : k.spaceCap <= mn ? 'space' : 'support';
      if (demand < cap * 0.98 && !stockLimited) ctx.limitNow = 'demand';
      ctx.util = cap > 0 ? demand / cap : 1.5; ctx.busy = cap > 0 ? served / cap : 1;
      ctx.priceR = r;
      const lim = { staff: 'staff', equipment: 'equipment', space: 'space', support: 'helpers', stock: 'stock ran out' }[ctx.limit];
      if (cap === 0) ctx.note = 'No capacity: you need ' + (k.keyCap === 0 ? 'key staff' : k.eqCap === 0 ? 'working equipment' : 'space');
      else if (stockLimited) ctx.note = b.stock && b.stock.short === 'cash' ? 'Ran out of stock: not enough cash to buy supplies' : b.stock && b.stock.short === 'room' ? 'Ran out of stock: storage is too small' : 'Ran out of stock: order more or turn on auto-order';
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

  // ============ FARM ============
  M.farmHerdCap = (prop, e) => Math.round(prop.acres * e.headPerAcre * (0.6 + 0.4 * prop.water) * (0.7 + 0.3 * prop.soil));
  M.bestEnterprise = (prop) => (prop.orchard ? 'orchard' : prop.landType === 'grassland' || prop.landType === 'dry' || prop.landType === 'hillside' ? 'cattle' : 'crops');
  M.isHarvest = (g, b) => { const e = TG.CONFIG.businesses.farm.farm.enterprises[b.farm.ent]; return !!(e.harvest && e.harvest.indexOf(U.moy(g.month)) >= 0); };
  M.isLivestock = (f) => f.ent === 'cattle' || f.ent === 'dairy';
  // ---- herd helpers (cattle & dairy): cows = adult breeders, young = cohorts by age (months), ready = market-age animals waiting to be sold
  M.herdInit = (f, total) => {
    const e = TG.CONFIG.businesses.farm.farm.enterprises[f.ent === 'dairy' ? 'dairy' : 'cattle'];
    const cows = Math.round(total / 2.07); const youngT = Math.max(0, Math.round(total - cows));
    f.cows = cows; f.young = []; f.ready = 0; f.cowAge = 48;
    for (let a = 0; a < e.matureAge; a++) f.young.push({ age: a, n: youngT / e.matureAge });
    M.herdSync(f);
  };
  M.herdSync = (f) => { f.herd = Math.max(0, (f.cows || 0) + U.sum(f.young || [], (x) => x.n) + (f.ready || 0)); return f.herd; };
  M.farmPasture = (f) => { const e = TG.CONFIG.businesses.farm.farm.enterprises[f.ent === 'dairy' ? 'dairy' : 'cattle']; return Math.max(1, Math.round(f.acres * e.headPerAcre * (0.6 + 0.4 * f.water) * (0.7 + 0.3 * f.soil))); };
  M.farmHeadCap = (b) => M.farmPasture(b.farm) + Math.round(TG.E.sumField(b, 'head'));
  M.farmParlorCap = (b) => Math.round(TG.E.sumField(b, 'milkCows'));
  // ---- storage (tons): base shed + legacy storage + bins/silos; seeds share it
  M.farmStoreCap = (b) => { const fd = TG.CONFIG.businesses.farm.farm; return Math.round(fd.baseStoreTons + b.farm.acres * fd.storePerAcre + (b.farm.storageCap || 0) + TG.E.sumField(b, 'storeTons')); };
  M.farmStoreUsed = (b) => { const e = TG.CONFIG.businesses.farm.farm.enterprises.crops; return (b.farm.stored || 0) + (b.farm.seeds || 0) * e.seedTonsPerAcre; };
  M.farmStoreFree = (b) => Math.max(0, M.farmStoreCap(b) - M.farmStoreUsed(b));
  // forecast for the UI: expected births / deaths / culls / matured next month
  M.herdForecast = (g, b) => {
    const f = b.farm, e = M.models.farm.e(b), nm = U.moy(g.month + 1);
    const births = [2, 3, 4].indexOf(nm) >= 0 ? f.cows * e.calving / 3 : 0;
    const youngN = U.sum(f.young || [], (x) => x.n);
    const deaths = youngN * e.calfDeath + (f.cows + f.ready) * e.adultDeath;
    const culls = f.cows / Math.max(12, e.lifespan - 24);
    const matured = U.sum((f.young || []).filter((x) => x.age + 1 >= e.matureAge), (x) => x.n);
    const feed = M.models.farm.feedCost(g, b, false);
    return { births, deaths, culls, matured, feed, youngN };
  };
  M.models.farm = {
    init(g, b, prop, opts) {
      const fd = TG.CONFIG.businesses.farm.farm; const ent = opts.ent || M.bestEnterprise(prop);
      b.farm = { ent, acres: prop.acres, irrigated: 0, storageCap: 0, stored: 0, seeds: 0, autoSeeds: true, seasonYield: 1, planted: 0, toHarvest: 0, futures: [], herd: 0, cows: 0, young: [], ready: 0,
        orchardAge: prop.orchard ? 999 : 0, sellPolicy: 'sell', landType: prop.landType, soil: prop.soil, water: prop.water, yearTons: 0, lastHarvest: null, plantBroken: false, m: {} };
      if (M.isLivestock(b.farm)) M.herdInit(b.farm, Math.round(M.farmHerdCap(prop, fd.enterprises[ent]) * 0.5));
    },
    e(b) { return TG.CONFIG.businesses.farm.farm.enterprises[b.farm.ent]; },
    tractorNeed(b) { const e = this.e(b); return Math.max(1, b.farm.acres / e.acresPerTractor); },
    handNeed(b) { const e = this.e(b); return Math.max(0.3, M.isLivestock(b.farm) ? b.farm.herd / e.headPerHand : b.farm.acres / e.acresPerHand); },
    needs(g, b) {
      const own = B().owner(g, b);
      const eq = [{ type: 'tractor', count: Math.ceil(this.tractorNeed(b) - 0.15) }];
      if (b.farm.ent === 'dairy') eq.push({ type: 'parlor', count: Math.max(1, Math.ceil((b.farm.cows || 1) / 160)) });
      return { equip: eq, staff: [{ role: 'hand', count: Math.max(own ? 0 : 1, Math.ceil(this.handNeed(b) - (own ? 0.7 : 0))) }] };
    },
    baseRev(g, b) {
      const f = b.farm; const e = this.e(b);
      if (f.ent === 'cattle') return f.herd * TG.CONFIG.markets.beef.base * 0.37 / 12 * g.world.priceIdx;
      if (f.ent === 'dairy') return (f.cows || 0) * e.milkPerCow * TG.CONFIG.markets.milk.base * g.world.priceIdx;
      return f.acres * e.yield * TG.CONFIG.markets[e.market].base / 12 * g.world.priceIdx;
    },
    cover(g, b, ctx) {
      const f = b.farm, e = this.e(b);
      let tcap = 0, robotCap = 0, plantX = 0, harvX = 0, combines = 0;
      for (const it of b.equip) {
        const ed = TG.E.def(b, it.type); if (!ed) continue;
        if (it.type === 'tractor' || ed.countsAs === 'tractor') { const c = ed.cap * TG.E.out(it); tcap += c; if (ed.efficiency) robotCap += c; }
        if (ed.plantEq && !it.broken) plantX += ed.plantEq * TG.E.out(it);
        if (ed.harvestEq && !it.broken) { harvX += ed.harvestEq * TG.E.out(it); combines++; }
      }
      const tneed = this.tractorNeed(b);
      const robotShare = tcap > 0 ? robotCap / tcap : 0;
      let heff = U.sum(ctx.key, M.staffEff) + (ctx.own ? 0.7 : 0);
      const hneed = this.handNeed(b) * (1 - robotShare * 0.85 * Math.min(1, tcap / tneed));
      const gear = tcap > 0 ? 1 : 0; // planters and combines need a tractor on the farm
      return { tcov: U.clamp(tcap / tneed, 0, 1), pcov: U.clamp((tcap + plantX * gear) / tneed, 0, 1), hvcov: U.clamp((tcap + harvX * gear) / tneed, 0, 1), combines, hcov: U.clamp(heff / Math.max(0.3, hneed), 0, 1), tcap, tneed };
    },
    weather(g, b, ctx, growing) {
      const f = b.farm, e = this.e(b), C = TG.CONFIG, w = ctx.weather, lt = C.landTypes[f.landType] || C.landTypes.flat;
      const irr = f.acres ? f.irrigated / f.acres : 0;
      if (!growing) return;
      let m = 1, why = '';
      if (w.kind === 'drought') { m = 1 - 0.28 * (e.droughtSens || 0.8) * (1 - irr * C.businesses.farm.farm.irrigationDroughtCut); why = `Drought; ${U.pct(irr)} of land irrigated`; }
      else if (w.kind === 'heat') { m = 1 - 0.08 * (1 - irr); why = 'Heat wave'; }
      else if (w.kind === 'frost') { m = 1 - 0.22 * (e.frostSens || 0.5) * lt.frost; why = `Frost; land frost risk x${lt.frost}`; }
      else if (w.kind === 'storm') { m = 0.96; why = 'Storm damage'; }
      if ((w.kind === 'flood' && lt.flood > 0.005) || R.chance(lt.flood / 6)) { m = Math.min(m, R.range(0.35, 0.7)); why = `Flooding on ${lt.label.toLowerCase()} (flood risk ${U.pct(lt.flood, 0)}/yr)`; }
      if (m < 0.995) { f.seasonYield *= m; TG.rep.event(g, b, m < 0.8 ? 'major' : 'bad', `${why.split(';')[0]} hurt the crop outlook (x${m.toFixed(2)})`, why, m < 0.8 ? { major: 'weather' } : null); }
      if (R.chance(C.goodEvents.bumper.p / 4)) { const x = R.range(C.goodEvents.bumper.yield[0], C.goodEvents.bumper.yield[1]); f.seasonYield *= x; TG.rep.event(g, b, 'good', `Bumper crop conditions (outlook x${x.toFixed(2)})`, 'Ideal weather this month'); }
    },
    price(g, b, qty) { const e = this.e(b); return b.ask != null ? b.ask : TG.W.price(g, e.market, qty / 2); },
    ratio(g, b) { const e = this.e(b); return b.ask != null ? U.clamp(b.ask / Math.max(0.01, TG.W.price(g, e.market, 0)), 0.3, 4) : 1; },
    // offer goods to buyers at your ask; returns {rev, sold, unsold}
    offer(g, b, tons, label) {
      const e = this.e(b), C = TG.CONFIG, f = b.farm;
      const plant = b.fixes.plant && !f.plantBroken && f.yearTons >= C.businesses.farm.fixes.find((x) => x.id === 'plant').minVolume * 0.5;
      const vm = plant ? C.businesses.farm.fixes.find((x) => x.id === 'plant').valueMult : 1;
      const sold = tons * TG.PR.sellF(this.ratio(g, b));
      const p = this.price(g, b, sold) * vm;
      if (sold > 0) { TG.F.earn(g, Math.round(sold * p), label, b.id); TG.W.sell(g, e.market, sold); }
      f.m.sold = (f.m.sold || 0) + sold; f.m.rev = (f.m.rev || 0) + sold * p;
      return { rev: sold * p, sold, unsold: tons - sold };
    },
    sell(g, b, tons, label) {
      const f = b.farm;
      let rev = 0;
      for (const fu of f.futures) { if (tons <= 0) break; const q = Math.min(fu.qty - fu.done, tons); if (q <= 0) continue; fu.done += q; tons -= q; rev += q * fu.price; }
      if (rev > 0) TG.F.earn(g, Math.round(rev), label || 'Crop sales', b.id);
      f.futures = f.futures.filter((fu) => fu.done < fu.qty || fu.month === g.month);
      let stored = 0, rotted = 0;
      if (tons > 0) {
        const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b) : f.sellPolicy;
        if (policy === 'store') { stored = Math.min(tons, M.farmStoreFree(b)); f.stored += stored; tons -= stored; }
        if (tons > 0) {
          const o = this.offer(g, b, tons, label || 'Crop sales'); rev += o.rev;
          if (o.unsold > 0) { const s2 = Math.min(o.unsold, M.farmStoreFree(b)); f.stored += s2; stored += s2; rotted = o.unsold - s2; }
        }
      }
      if (rotted > 0) { f.m.lost = (f.m.lost || 0) + rotted; TG.rep.event(g, b, 'bad', `${Math.round(rotted).toLocaleString()} t had nowhere to go and rotted`, 'Buyers refused your price and storage was full'); }
      return { rev, stored, rotted };
    },
    sellStored(g, b, tons) {
      const f = b.farm; tons = Math.min(tons, f.stored); if (tons <= 0) return 0;
      const o = this.offer(g, b, tons, 'Crop sales'); f.stored -= o.sold; return Math.round(o.rev);
    },
    seedCost(g, b, premium) { const e = TG.CONFIG.businesses.farm.farm.enterprises.crops; return e.seedPerAcre * g.world.priceIdx * (1 + (premium || 0)) * (b.fixes.integrate ? 0.8 : 1); },
    buySeeds(g, b, acres, premium) {
      const e = TG.CONFIG.businesses.farm.farm.enterprises.crops;
      acres = Math.max(0, Math.min(Math.floor(acres), Math.floor(M.farmStoreFree(b) / e.seedTonsPerAcre)));
      const per = this.seedCost(g, b, premium); acres = Math.min(acres, Math.floor(Math.max(0, g.cash) / per));
      if (acres <= 0) return 0;
      TG.F.spend(g, Math.round(acres * per), 'Seed', b.id); b.farm.seeds = (b.farm.seeds || 0) + acres; b.farm.m.seedsIn = (b.farm.m.seedsIn || 0) + acres;
      return acres;
    },
    feedCost(g, b, apply, ctx) {
      const f = b.farm, e = this.e(b);
      const youngN = U.sum(f.young || [], (x) => x.n);
      const heads = (f.cows || 0) + (f.ready || 0) + youngN * e.youngFeed;
      const pasture = M.farmPasture(f); const total = f.herd || 0;
      const barnHeads = Math.max(0, Math.min(total - pasture, TG.E.sumField(b, 'head')));
      const over = total / Math.max(1, M.farmHeadCap(b));
      const drought = ctx && (ctx.weather.kind === 'drought' || ctx.weather.kind === 'heat');
      const cov = ctx ? this.cover(g, b, ctx) : { tcov: 1 };
      let feed = heads * e.feed * g.world.priceIdx * (drought ? e.droughtFeed * (1 - (f.irrigated / f.acres) * 0.6) : 1) * (over > 1 ? 1 + (over - 1) * 2 : 1) * (1 + 0.3 * (1 - cov.tcov)) * (b.fixes.integrate ? 0.8 : 1);
      feed += barnHeads * e.feed * (e.barnFeed - 1) * g.world.priceIdx;
      return feed;
    },
    month(g, b, ctx) {
      const C = TG.CONFIG, f = b.farm, e = this.e(b), fd = C.businesses.farm.farm, moy = U.moy(g.month);
      f.acres = Math.max(f.acres, 1); f.m = f.mNext || {}; f.mNext = null;
      if (f.seeds == null) f.seeds = 0; if (f.autoSeeds == null) f.autoSeeds = true;
      const cov = this.cover(g, b, ctx);
      const soilF = 1 + (e.soilW || 0.3) * (f.soil - 0.6) * 2;
      const irr = f.irrigated / f.acres;
      const waterF = 1 + (e.waterW || 0.3) * (Math.max(f.water, irr * 0.85) - 0.6) * 2;
      const inputCut = b.fixes.integrate ? 0.2 : 0;
      const qMult = 0.9 + 0.2 * ctx.quality / 100;
      ctx.cap = Math.round(f.acres); ctx.util = Math.min(cov.tcov, cov.hcov); ctx.busy = 1 / Math.max(0.3, ctx.util);
      ctx.priceR = this.ratio(g, b);
      if (f.stored > 0) {
        TG.F.spend(g, Math.round(f.stored * e.storageCost * g.world.priceIdx), 'Storage', b.id);
        const sp = f.stored * e.spoil; f.stored -= sp; f.m.spoiled = sp;
        const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b) : f.sellPolicy;
        if (policy === 'sell') this.sellStored(g, b, f.stored);
      }
      { const over = M.farmStoreUsed(b) - M.farmStoreCap(b); if (over > 0.5 && f.stored > 0) { const x = Math.min(over, f.stored); f.stored -= x; f.m.lost = (f.m.lost || 0) + x; } }
      f.plantBroken = false;
      if (b.fixes.plant && R.chance(0.012)) { f.plantBroken = true; const c = Math.round(9000000 * 0.02); TG.F.spend(g, c, 'Repairs', b.id); TG.rep.event(g, b, 'major', `Processing plant broke down (${U.money(c)} repair, no processing this month)`, '1.2% monthly plant failure chance', { major: 'breakdown' }); }
      for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (ed && ed.glitch && !it.broken && R.chance(ed.glitch)) { it.broken = 'major'; TG.rep.event(g, b, 'bad', `Software glitch took a robot tractor offline`, `${U.pct(ed.glitch)} monthly glitch chance; specialist repairs cost double`); TG.E.queueBroken(g, b, it); } }

      if (f.ent === 'crops') {
        const growing = moy >= 3 && moy <= 9;
        // seed: whoever runs the farm buys it ahead of planting (staff pay a premium); you can buy it yourself too
        const plantSoon = e.plant.indexOf(moy) >= 0 || e.plant.indexOf(U.moy(g.month + 1)) >= 0;
        if (plantSoon && f.autoSeeds) {
          const left = e.plant.filter((m) => m >= moy).length || e.plant.length; const pcv = Math.min(cov.pcov, Math.pow(cov.hcov, 0.5));
          const need = f.acres / e.plant.length * left * pcv - f.seeds;
          if (need > 0.5) { const h = TG.D.handler(g, b, 'farm'); const prem = h || ctx.own ? 0 : C.supply.staffReorderPremium; this.buySeeds(g, b, need, prem); }
        }
        if (e.plant.indexOf(moy) >= 0) {
          const want = f.acres / e.plant.length; const pc = Math.min(cov.pcov, Math.pow(cov.hcov, 0.5));
          let acres = Math.min(want * pc, f.seeds);
          const costPer = e.inputPerAcre * g.world.priceIdx * (1 - inputCut);
          const afford = Math.max(0, g.cash) / costPer;
          if (acres > afford) { TG.rep.event(g, b, 'bad', `Could only afford fertilizer & fuel for ${Math.round(afford)} of ${Math.round(acres)} acres`, 'Cash crunch at planting time'); acres = afford; }
          TG.F.spend(g, Math.round(acres * costPer), 'Fertilizer & fuel', b.id);
          f.seeds -= acres; f.planted += acres; f.m.planted = acres;
          if (acres < want * pc - 0.5 && f.seeds < 1) TG.rep.event(g, b, 'bad', `Ran out of seed: planted ${Math.round(acres)} of ${Math.round(want)} acres`, 'Buy seed before planting months (needs storage room)');
          if (pc < 0.95) TG.rep.event(g, b, 'bad', `Only planted ${Math.round(acres)} of ${Math.round(want)} acres this month`, `Planting coverage ${U.pct(cov.pcov)} (tractors + planters), farmhand coverage ${U.pct(cov.hcov)}`);
          if (moy === e.plant[e.plant.length - 1]) f.toHarvest = f.planted;
        }
        this.weather(g, b, ctx, growing && f.planted > 0);
        if (e.harvest.indexOf(moy) >= 0 && f.toHarvest > 0) this.harvest(g, b, ctx, cov, f.toHarvest / e.harvest.length, soilF * waterF * qMult);
        if (moy === e.harvest[e.harvest.length - 1]) this.endSeason(g, b);
      } else if (f.ent === 'orchard') {
        f.orchardAge++;
        const prodShare = U.clamp(f.orchardAge / e.rampMonths, 0, 1);
        TG.F.spend(g, Math.round(f.acres * e.inputPerAcre / 12 * g.world.priceIdx * (1 - inputCut) * (0.35 + 0.65 * prodShare)), 'Orchard upkeep', b.id);
        this.weather(g, b, ctx, moy >= 2 && moy <= 8);
        if (e.harvest.indexOf(moy) >= 0) {
          if (prodShare < 0.05) { if (moy === e.harvest[0]) TG.rep.event(g, b, 'info', 'Young orchard: no fruit yet', `${f.orchardAge} of ${e.rampMonths} months to full production`); }
          else this.harvest(g, b, ctx, cov, f.acres * prodShare / e.harvest.length, soilF * waterF * qMult);
        }
        if (moy === e.harvest[e.harvest.length - 1]) this.endSeason(g, b);
      } else this.herdMonth(g, b, ctx, cov);
      if (!M.isLivestock(f)) ctx.served = Math.round(f.acres * ctx.util);
      if (cov.tcov < 1) ctx.note = `Tractor coverage ${U.pct(cov.tcov)}: ${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} tractors' worth working`;
      else if (cov.hcov < 1) ctx.note = `Short on farmhands (${U.pct(cov.hcov)} coverage)`;
      this.flow(g, b, ctx, cov);
    },
    harvest(g, b, ctx, cov, acres, mult) {
      const f = b.farm, e = this.e(b);
      const hc = Math.min(1, cov.hvcov) * (0.45 + 0.55 * cov.hcov);
      const full = acres * e.yield * f.seasonYield * mult;
      const tons = full * hc;
      const cut = cov.combines ? TG.E.def(b, 'combine').seasonalCut : 0;
      TG.F.spend(g, Math.round(acres * e.seasonalPerAcre * g.world.wageIdx * (b.labor < 0.2 ? 1.25 : 1) * (1 - cut)), 'Seasonal labor', b.id);
      const res = this.sell(g, b, tons, e.market === 'fruit' ? 'Fruit sales' : 'Crop sales');
      f.yearTons += tons; f.m.harvested = tons;
      const lost = full - tons; f.m.lost = (f.m.lost || 0) + lost;
      const broken = b.equip.filter((x) => (x.type === 'tractor' || TG.E.def(b, x.type).countsAs === 'tractor' || x.type === 'combine') && x.broken);
      TG.rep.event(g, b, 'good', `Harvested ${Math.round(tons).toLocaleString()} tons (${U.money(res.rev)} sold${res.stored ? ', ' + Math.round(res.stored) + ' t stored' : ''})`, `Season outlook x${f.seasonYield.toFixed(2)}, soil ${Math.round(f.soil * 100)}, water ${Math.round(f.water * 100)}, harvest coverage ${U.pct(hc)}`);
      if (lost > full * 0.1) TG.rep.event(g, b, 'major', `${Math.round(lost).toLocaleString()} tons rotted in the field`, broken.length ? `${broken.map((x) => x.label + ' #' + TG.E.num(b, x) + ' (' + (x.age / 12).toFixed(0) + ' yrs, ' + Math.round(TG.E.effWear(x)) + '% wear)').join(', ')} broken during harvest; harvest coverage ${U.pct(cov.hvcov)}` : `Harvest coverage ${U.pct(cov.hvcov)} (tractors + combines), farmhand coverage ${U.pct(cov.hcov)}`, { major: 'harvest' });
      f.lastHarvest = { m: g.month, tons: Math.round(tons), lost: Math.round(lost) };
    },
    herdMonth(g, b, ctx, cov) {
      const f = b.farm, e = this.e(b), moy = U.moy(g.month), m = f.m;
      if (f.cows == null) M.herdInit(f, f.herd || 0);
      const cap = M.farmHeadCap(b);
      const over = f.herd / Math.max(1, cap);
      // births (spring calving)
      if ([2, 3, 4].indexOf(moy) >= 0) { const n = f.cows * e.calving / 3 * (0.6 + 0.4 * cov.hcov); if (n > 0) f.young.push({ age: -1, n }); m.born = n; }
      // aging & deaths
      const stress = (1 - cov.hcov) * 0.02 + Math.max(0, over - 1) * 0.02;
      let died = 0;
      for (const c of f.young) { c.age++; const d = c.n * (e.calfDeath + stress); c.n -= d; died += d; }
      const ad = e.adultDeath + stress; died += (f.cows + f.ready) * ad; f.cows *= 1 - ad; f.ready *= 1 - ad;
      if (R.chance(e.diseaseBase * (1 + Math.max(0, over - 1) * 3) * (b.spec.ops ? 0.6 : 1))) {
        const x = R.range(0.05, 0.2); const lost = (f.cows + f.ready + U.sum(f.young, (c) => c.n)) * x;
        f.cows *= 1 - x; f.ready *= 1 - x; for (const c of f.young) c.n *= 1 - x; died += lost;
        TG.rep.event(g, b, 'major', `Herd disease: lost ${Math.round(lost)} head`, `${U.pct(e.diseaseBase * (1 + Math.max(0, over - 1) * 3), 1)} monthly chance; herd at ${U.pct(over)} of capacity`, { major: 'harvest' });
      }
      m.died = died;
      // maturing: animals at market age join the ready pool; some heifers are kept to replace old cows
      let matured = 0;
      for (const c of f.young) if (c.age >= e.matureAge) matured += c.n;
      f.young = f.young.filter((c) => c.age < e.matureAge && c.n > 0.01);
      M.herdSync(f);
      // keep enough heifers to replace old cows, more (up to half) while there is free pasture
      const base = matured * e.replaceShare * (f.ent === 'dairy' ? 2.5 : 1);
      const keep = Math.min(matured, Math.max(base, Math.min(matured * 0.5, cap * 0.95 - f.herd)));
      f.cows += keep; f.ready += matured - keep; m.matured = matured; m.kept = keep;
      // old cows retire (culled and sold for meat at a discount)
      const culls = f.cows / Math.max(12, e.lifespan - 24); f.cows -= culls; m.culled = culls;
      if (culls > 0) { TG.F.earn(g, Math.round(culls * TG.W.price(g, 'beef', culls / 2) * e.cullValue), 'Cattle sales', b.id); TG.W.sell(g, 'beef', culls); }
      M.herdSync(f);
      const drought = ctx.weather.kind === 'drought' || ctx.weather.kind === 'heat';
      const feed = this.feedCost(g, b, true, ctx); m.feed = feed;
      TG.F.spend(g, Math.round(feed), 'Feed & hay', b.id);
      if (drought) TG.rep.event(g, b, 'bad', 'Drought: feed costs up', `Feed x${e.droughtFeed}; irrigation helps`);
      const q = 0.9 + 0.2 * ctx.quality / 100;
      if (f.ent === 'dairy') {
        // milk needs a milking parlor; sold at your ask; unsold milk spoils
        const milked = Math.min(f.cows, M.farmParlorCap(b));
        const milk = milked * e.milkPerCow * (0.6 + 0.4 * cov.hcov) * q;
        m.milk = milk; m.notMilked = f.cows - milked;
        if (milk > 0) { const o = this.offer(g, b, milk, 'Milk sales'); m.lost = (m.lost || 0) + o.unsold; }
        if (f.ready > 0) { const n = f.ready; TG.F.earn(g, Math.round(n * TG.W.price(g, 'beef', n / 2) * 0.8), 'Cattle sales', b.id); TG.W.sell(g, 'beef', n); f.ready = 0; m.soldHead = n; }
      } else {
        // beef: sell the ready pool ('store' policy = hold them; they keep eating)
        let sell = f.sellPolicy === 'store' ? 0 : f.ready;
        if (over > 1.05) sell = Math.max(sell, f.herd - cap);
        sell = Math.max(0, Math.min(sell, f.ready + f.cows));
        if (sell > 0) {
          const sold = sell * TG.PR.sellF(this.ratio(g, b));
          const price = (b.ask != null ? b.ask : TG.W.price(g, 'beef', sold / 2)) * q * (b.fixes.plant && !f.plantBroken ? 1.2 : 1);
          if (sold > 0) { TG.F.earn(g, Math.round(sold * price), 'Cattle sales', b.id); TG.W.sell(g, 'beef', sold); }
          const fromReady = Math.min(f.ready, sold); f.ready -= fromReady; f.cows -= sold - fromReady;
          m.soldHead = sold; m.unsoldHead = sell - sold; m.rev = sold * price;
        }
      }
      M.herdSync(f);
      ctx.cap = cap; ctx.served = Math.round(f.herd);
    },
    flow(g, b, ctx, cov) {
      const f = b.farm, e = this.e(b), m = f.m, FL = TG.FL; FL.start(b);
      if (M.isLivestock(f)) {
        const fc = M.herdForecast(g, b);
        FL.row(b, '🐮', 'Calves born', m.born || 0, '', m.born ? 'g' : '', 'Spring calving: Mar-May');
        FL.row(b, '🐂', 'Reached market age', m.matured || 0, '', 'g', `At ${e.matureAge} months; ${Math.round(m.kept || 0)} kept as new cows`);
        if (f.ent === 'dairy') FL.row(b, '🥛', 'Milk made', m.milk || 0, 't', m.notMilked > 0.5 ? 'y' : 'g', m.notMilked > 0.5 ? `${Math.round(m.notMilked)} cows not milked: need parlor space` : '');
        FL.row(b, '🛒', 'Sold', m.soldHead || 0, 'head', 'g');
        if (m.unsoldHead > 0.5) FL.row(b, '🚫', 'Buyers said no', m.unsoldHead, 'head', 'r', 'Your price is over market');
        if (m.lost > 0.5) FL.row(b, '🗑️', 'Milk spoiled', m.lost, 't', 'r', 'Unsold milk spoils');
        FL.row(b, '👴', 'Old cows retired', m.culled || 0, '', 'y', `Cows retire at ${Math.round(e.lifespan / 12)} years (sold for meat)`);
        FL.row(b, '💀', 'Died', m.died || 0, '', (m.died || 0) > f.herd * 0.02 ? 'r' : 'y', 'Calves ' + U.pct(e.calfDeath, 1) + '/mo, adults ' + U.pct(e.adultDeath, 1) + '/mo');
        FL.row(b, '🌽', 'Feed', m.feed || 0, '$', 'y');
        FL.next(b, '🐮', 'Births expected', fc.births, '', fc.births ? 'g' : ''); FL.next(b, '🐂', 'Ready to sell', fc.matured + f.ready, 'head', 'g');
        FL.next(b, '💀', 'Losses expected', fc.deaths + fc.culls, 'head', 'y'); FL.next(b, '🌽', 'Feed cost', fc.feed, '$', 'y');
      } else {
        if (m.seedsIn) FL.row(b, '🌱', 'Seed bought', m.seedsIn, 'acres', 'g');
        if (m.planted != null) FL.row(b, '🚜', 'Planted', m.planted, 'acres', m.planted < f.acres / (e.plant || [1]).length * 0.95 ? 'y' : 'g');
        if (m.harvested != null) FL.row(b, '🌾', 'Harvested', m.harvested, 't', 'g');
        if (m.sold) FL.row(b, '🛒', 'Sold', m.sold, 't', 'g', `${U.money(m.rev / Math.max(1, m.sold))}/t`);
        if (m.spoiled > 0.5) FL.row(b, '🐭', 'Spoiled in storage', m.spoiled, 't', 'y', `${U.pct(e.spoil, 1)} a month`);
        if (m.lost > 0.5) FL.row(b, '🗑️', 'Lost', m.lost, 't', 'r', 'Rotted in field or no room in storage');
        FL.row(b, '🏚️', 'In storage', f.stored, 't', 'g');
        if (m.planted == null && m.harvested == null && !m.sold) FL.row(b, '🌤️', 'Growing / resting', f.planted || f.toHarvest || 0, 'acres', '');
        const nm = U.moy(g.month + 1);
        if (e.plant && e.plant.indexOf(nm) >= 0) { const need = f.acres / e.plant.length; FL.next(b, '🌱', 'Planting', need, 'acres', f.seeds >= need || f.autoSeeds ? 'g' : 'r', f.seeds >= need ? '' : f.autoSeeds ? 'Seed will be bought' : 'Need more seed'); }
        if (e.harvest.indexOf(nm) >= 0) { const exp = (f.ent === 'crops' ? f.toHarvest || f.planted : f.acres * U.clamp(f.orchardAge / e.rampMonths, 0, 1)) / e.harvest.length * e.yield * f.seasonYield; FL.next(b, '🌾', 'Harvest', exp, 't', 'g'); }
        FL.next(b, '🐭', 'Will spoil', f.stored * e.spoil, 't', 'y');
      }
    },
    endSeason(g, b) {
      const f = b.farm;
      for (const fu of f.futures) if (fu.done < fu.qty) {
        const short = fu.qty - fu.done; const cost = Math.round(short * TG.W.price(g, this.e(b).market, 0) * 1.05);
        TG.F.spend(g, cost, 'Futures shortfall', b.id);
        TG.rep.event(g, b, 'bad', `Futures contract short by ${Math.round(short)} t: bought back for ${U.money(cost)}`, 'Harvest came in below the amount you locked');
      }
      f.futures = []; f.planted = 0; f.toHarvest = 0; f.seasonYield = 1; f.yearTons = 0;
    },
    baseYieldNote(b) { return ''; },
    extraRisks(g, b, ctx) {
      const cov = this.cover(g, b, ctx); const out = [];
      if (cov.tcov < 1) out.push({ label: 'Not enough working tractors for planting / harvest', p: 1 - cov.tcov, why: `${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} tractors' worth working` });
      if (cov.hcov < 1) out.push({ label: 'Not enough farmhands', p: 1 - cov.hcov, why: 'Coverage below 100%' });
      return out;
    },
    inventoryValue(g, b) {
      const f = b.farm, e = this.e(b);
      let v = (f.stored || 0) * TG.W.price(g, e.market, 0) * 0.9 + (f.seeds || 0) * this.seedCost(g, b) * 0.8;
      if (M.isLivestock(f)) v += f.herd * TG.W.price(g, 'beef', 0) * 0.6;
      return Math.round(v);
    },
  };
  // farm actions
  M.farmBuyLand = (g, b, acres, mortgage) => {
    acres = Math.round(acres); if (!(acres > 0)) return { ok: false, msg: 'Enter acres.' };
    const prop = g.properties.find((p) => p.id === b.propId);
    const L = TG.CONFIG.locations[b.loc];
    const per = L.ppa * (0.75 + 0.5 * b.farm.soil) * TG.CONFIG.regions[b.region].price * g.world.housing * TG.CONFIG.businesses.farm.farm.landPriceMult * (1 + acres / 20000);
    const cost = Math.round(acres * per);
    if (mortgage) {
      const down = Math.round(cost * TG.CONFIG.property.mortgageDown);
      if (g.cash < down) return { ok: false, msg: `Need ${U.money(down)} down.` };
      const ok = TG.F.canBorrow(g, 'mortgage', cost - down); if (!ok.ok) return ok;
      TG.F.spend(g, down, 'Land purchases', null, true);
      TG.F.newLoan(g, 'mortgage', cost - down, { collateral: { kind: 'property', id: prop.id }, label: `Land mortgage (${acres} ac)`, bizId: b.id, noCash: true });
    } else { if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Land purchases', null, true); }
    b.farm.acres += acres; b.acres = b.farm.acres;
    if (prop) { prop.acres += acres; if (prop.owned) prop.baseValue = (prop.baseValue || prop.price) + cost * (prop.housingAtBuy || 1) / g.world.housing; else prop.landOwned = (prop.landOwned || 0) + cost / g.world.housing; }
    if (b.farm.ent === 'orchard') { const est = Math.round(acres * TG.CONFIG.businesses.farm.farm.enterprises.orchard.establishPerAcre * g.world.priceIdx); TG.F.spend(g, est, 'Orchard planting', b.id, true); }
    TG.rep.event(g, b, 'info', `Bought ${acres} acres of neighbouring land for ${U.money(cost)}`, `${U.money(per)} per acre`);
    return { ok: true, cost };
  };
  M.farmLandPrice = (g, b) => { const L = TG.CONFIG.locations[b.loc]; return L.ppa * (0.75 + 0.5 * b.farm.soil) * TG.CONFIG.regions[b.region].price * g.world.housing * TG.CONFIG.businesses.farm.farm.landPriceMult; };
  M.farmIrrigate = (g, b, acres) => {
    const fd = TG.CONFIG.businesses.farm.farm; acres = Math.min(Math.round(acres), b.farm.acres - b.farm.irrigated); if (acres <= 0) return { ok: false, msg: 'All land is irrigated.' };
    const cost = Math.round(acres * fd.irrigationPerAcre * g.world.priceIdx); if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Irrigation', b.id, true); b.farm.irrigated += acres; return { ok: true, cost };
  };
  M.farmStorage = (g, b, tons) => {
    const cost = Math.round(tons * 20 * g.world.priceIdx); if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Storage construction', b.id, true); b.farm.storageCap += Math.round(tons); return { ok: true, cost };
  };
  M.farmFutures = (g, b, qty) => {
    const f = b.farm, e = M.models.farm.e(b), fd = TG.CONFIG.businesses.farm.farm;
    if (f.ent === 'cattle') return { ok: false, msg: 'Futures are for crops and fruit.' };
    const expected = (f.ent === 'crops' ? f.acres : f.acres * U.clamp(f.orchardAge / e.rampMonths, 0, 1)) * e.yield;
    const locked = U.sum(f.futures, (x) => x.qty);
    qty = Math.min(Math.round(qty), Math.round(expected * fd.futuresMax - locked)); if (qty <= 0) return { ok: false, msg: `You can lock at most ${U.pct(fd.futuresMax)} of expected harvest.` };
    const price = TG.W.price(g, e.market, 0) * fd.futuresDiscount;
    f.futures.push({ qty, price, done: 0, month: g.month });
    return { ok: true, qty, price };
  };
  M.farmBuyCattle = (g, b, head) => {
    head = Math.round(head); if (!(head > 0)) return { ok: false, msg: 'Pick how many.' };
    const cost = Math.round(head * M.cowPrice(g, b));
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Livestock purchases', b.id, true);
    if (b.farm.cows == null) M.herdInit(b.farm, b.farm.herd || 0);
    b.farm.cows += head; M.herdSync(b.farm); return { ok: true, cost };
  };
  // a bred cow costs more than a market steer (you pay for her future calves); dairy cows cost more again
  M.cowPrice = (g, b) => TG.W.price(g, 'beef', 0) * (b.farm.ent === 'dairy' ? 1.35 : 1.15);
  // sell animals now at market: the ready pool, or breeding cows (at a discount)
  M.farmSellCattle = (g, b, head, which) => {
    const f = b.farm; if (f.cows == null) M.herdInit(f, f.herd || 0);
    head = Math.max(0, Math.round(head)); const pool = which === 'cows' ? f.cows : f.ready; head = Math.min(head, Math.floor(pool));
    if (!head) return { ok: false, msg: which === 'cows' ? 'No cows to sell.' : 'No animals at market age yet.' };
    const p = TG.W.price(g, 'beef', head / 2) * (which === 'cows' ? 0.75 : 1); const rev = Math.round(head * p);
    if (which === 'cows') f.cows -= head; else f.ready -= head;
    TG.F.earn(g, rev, 'Cattle sales', b.id, true); TG.W.sell(g, 'beef', head); M.herdSync(f);
    return { ok: true, rev, head };
  };
  M.farmBuySeeds = (g, b, acres) => { const n = M.models.farm.buySeeds(g, b, acres, 0); return n > 0 ? { ok: true, acres: n } : { ok: false, msg: M.farmStoreFree(b) < 1 ? 'Storage is full.' : 'Not enough cash.' }; };
  M.farmSellSeeds = (g, b, acres) => { const f = b.farm; acres = Math.min(Math.round(acres), Math.floor(f.seeds || 0)); if (acres <= 0) return { ok: false, msg: 'No seed.' }; const v = Math.round(acres * M.models.farm.seedCost(g, b) * 0.5); f.seeds -= acres; TG.F.earn(g, v, 'Asset sales', b.id, true); return { ok: true, rev: v }; };
  M.farmSwitch = (g, b, ent) => {
    const fd = TG.CONFIG.businesses.farm.farm; if (ent === b.farm.ent) return { ok: false };
    let cost = 0; const prop = g.properties.find((p) => p.id === b.propId);
    const pr = prop || { acres: b.farm.acres, water: b.farm.water, soil: b.farm.soil };
    const cowsFor = (en) => Math.round(M.farmHerdCap(pr, fd.enterprises[en]) * 0.4 / 2.07);
    if (ent === 'orchard') cost = b.farm.acres * fd.enterprises.orchard.establishPerAcre * g.world.priceIdx;
    if (ent === 'cattle' || ent === 'dairy') cost = cowsFor(ent) * TG.W.price(g, 'beef', 0) * (ent === 'dairy' ? 1.35 : 1.15);
    cost = Math.round(cost);
    if (g.cash < cost) return { ok: false, msg: `Switching costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Farm conversion', b.id, true);
    if (M.isLivestock(b.farm) && b.farm.herd > 0) { const v = Math.round(b.farm.herd * TG.W.price(g, 'beef', b.farm.herd / 2) * 0.7); TG.F.earn(g, v, 'Cattle sales', b.id, true); }
    Object.assign(b.farm, { ent, planted: 0, toHarvest: 0, seasonYield: 1, futures: [], herd: 0, cows: 0, young: [], ready: 0 }); b.ask = null;
    if (ent === 'orchard') b.farm.orchardAge = 0;
    if (ent === 'cattle' || ent === 'dairy') { b.farm.cows = cowsFor(ent); M.herdSync(b.farm); }
    return { ok: true, cost };
  };

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
      if (ctx.own) driverCap += d.roles.driver.cap * 0.6;
      let cap = Math.min(truckCap, driverCap) * (w.hoursReg > 0 ? 0.9 : 1) * M.paceMult(b) * (1 - ctx.down);
      const st = g.markets.freight;
      const r = TG.PR.ratio(g, b);
      const avail = U.clamp(0.78 + 0.22 * (b.rep / 50) - 0.35 * (st.comp - 1), 0.35, 1.05) * B().demandMult(g, b, ctx, { noPrice: true }) * TG.PR.demandF(r);
      const loads = Math.max(0, Math.min(cap, cap * avail));
      const nTr = trucks.filter((x) => !x.broken).length;
      const reef = b.equip.filter((x) => x.type === 'reefer' && !x.broken).length;
      const reefB = nTr ? Math.min(1, reef / nTr) * TG.E.def(b, 'reefer').ticketBoost : 0;
      const price = (b.ask != null ? TG.PR.ask(g, b) : TG.W.price(g, 'freight', loads * 6)) * (1 + reefB);
      TG.F.earn(g, Math.round(loads * price), 'Freight revenue', b.id); TG.W.sell(g, 'freight', loads);
      ctx.priceR = r;
      { const FL = TG.FL; FL.start(b);
        FL.row(b, '🚛', 'Trucks working', nTr, '/' + trucks.length, nTr < trucks.length ? 'y' : 'g', nTr < trucks.length ? 'Some trucks broken' : '');
        FL.row(b, '📦', 'Loads hauled', loads, '', 'g', `at ${U.money(price)} each`);
        if (cap * (1 - avail) > 0.5 && avail < 1) FL.row(b, '🅿️', 'Empty truck days', cap - loads, 'loads', avail < 0.75 ? 'r' : 'y', r > 1.05 ? 'Your rate is over market' : 'Not enough freight around');
        if (truckCap > driverCap * 1.2) FL.row(b, '🧑‍✈️', 'Trucks without drivers', (truckCap - driverCap) / 14, '', 'r', 'Hire drivers');
        FL.next(b, '📦', 'Loads expected', loads, '', 'g'); }
      const road = (g.properties.find((p) => p.id === b.propId) || { road: 0.6 }).road;
      const fuelIdx = b.hedge && b.hedge.until > g.month ? b.hedge.idx : w.fuel;
      TG.F.spend(g, Math.round(loads * fr.fuelPerLoad * fuelIdx * Math.pow(2 - road, 0.3) * (1 - (fo.fuelCut || 0)) * (w.emissions > 0 ? 1.05 : 1) * w.priceIdx), 'Fuel', b.id);
      TG.F.spend(g, Math.round(loads * fr.tollsPerLoad * w.priceIdx), 'Tolls & fees', b.id);
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
