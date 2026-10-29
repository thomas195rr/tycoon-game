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
  M.inventoryValue = (g, b) => (mdl(b).inventoryValue ? U.num(mdl(b).inventoryValue(g, b)) : 0);
  M.keyRole = (d) => Object.keys(d.roles).find((r) => d.roles[r].key);
  M.staffEff = (e) => (0.6 + e.skill / 250) * (1 - TG.CONFIG.staff.noShowBase * (1.6 - e.reliability / 100));
  M.paceMult = (b) => (b.pace === 'rush' ? 1.15 : b.pace === 'careful' ? 0.92 : 1);
  M.priceMult = (b) => TG.CONFIG.reputation.priceMult[b.price] || 1;
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
      for (const ed of d.equip) {
        if (ed.support) out.equip.push({ type: ed.id, count: 1 });
        else if (ed.critical) out.equip.push({ type: ed.id, count: Math.max(1, Math.ceil(est / ed.cap)) });
      }
      for (const r in d.roles) {
        const rd = d.roles[r];
        if (rd.key) out.staff.push({ role: r, count: Math.max(rd.min || 0, Math.ceil(est / (rd.cap * 0.8)) - (B().owner(g, b) && d.tier === 'small' ? 1 : 0), d.tier === 'small' ? 0 : 1) });
        else if (rd.support) out.staff.push({ role: r, count: Math.max(0, Math.round(est / rd.per - 0.5)) });
      }
      return out;
    },
    month(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses[b.type], s = d.svc;
      let keyCap = 0; const kr = M.keyRole(d);
      for (const e of ctx.key) keyCap += d.roles[e.role].cap * M.staffEff(e);
      if (ctx.own && d.tier === 'small') keyCap += d.roles[kr].cap * 0.6;
      let supCap = Infinity;
      for (const r in d.roles) if (d.roles[r].support) { const have = b.staff.filter((e) => e.role === r).length; supCap = Math.min(supCap, (have + 0.5) * d.roles[r].per); }
      let eqCap = Infinity, prod = 1;
      let limEq = null;
      for (const ed of d.equip) { if (ed.support) continue; const c = TG.E.capacity(b, ed.id); if (ed.critical) { if (c < eqCap) limEq = ed.id; eqCap = Math.min(eqCap, c); } else if (c > 0 && !ed.demandBoost) prod *= 1.06; }
      const spaceCap = this.spaceCap(b);
      const cap = Math.max(0, Math.min(keyCap * prod, eqCap, spaceCap, supCap) * M.paceMult(b) * (1 - ctx.down));
      const qualF = 0.85 + 0.3 * ctx.quality / 100;
      let demand = this.demandBase(g, b) * M.repF(b, s.repExp) * qualF * B().demandMult(g, b, ctx);
      if (s.staffDemand && ctx.key.length) demand *= 1 + s.staffDemand * (ctx.skill - 50) / 100;
      const served = Math.min(demand, cap);
      const ticket = s.ticket * M.priceMult(b) * ((b.fixesOn && b.fixesOn.ticketMult) || 1) * g.world.priceIdx;
      const rev = served * ticket;
      if (d.receivable) B().addRecv(g, b, rev, d.receivable.delay - (b.fixes.billing ? 1 : 0));
      else TG.F.earn(g, rev, 'Revenue', b.id);
      const fo = b.fixesOn || {};
      let cogsPct = s.cogs + (fo.cogsAdd || 0) - (ctx.own ? C.owner.operatedCogsCut : 0);
      if (g.world.shortage[d.cat]) cogsPct *= 1.15;
      TG.F.spend(g, Math.round(rev * Math.max(0, cogsPct)), 'Supplies & cost of sales', b.id);
      if (s.ota) TG.F.spend(g, Math.round(rev * s.ota * (fo.otaCut ? 1 - fo.otaCut : 1)), 'Booking site fees', b.id);
      if (fo.revCostPct) TG.F.spend(g, Math.round(rev * fo.revCostPct), 'Commissions & warranties', b.id);
      ctx.cap = Math.round(cap); ctx.demand = Math.round(demand); ctx.served = Math.round(served);
      ctx.limitEquip = limEq;
      ctx.limit = keyCap * prod <= Math.min(eqCap, spaceCap, supCap) ? 'staff' : eqCap <= Math.min(spaceCap, supCap) ? 'equipment' : spaceCap <= supCap ? 'space' : 'support';
      ctx.util = cap > 0 ? demand / cap : 1.5; ctx.busy = cap > 0 ? served / cap : 1;
      if (cap === 0) ctx.note = 'No capacity: you need ' + (keyCap === 0 ? 'key staff' : eqCap === 0 ? 'working critical equipment' : 'space');
      else if (demand > cap * 1.15) ctx.note = `Turning away ${U.pct(1 - cap / demand)} of customers: capacity limited by ${keyCap * prod <= Math.min(eqCap, spaceCap, supCap) ? 'staff' : eqCap <= Math.min(spaceCap, supCap) ? 'equipment' : spaceCap <= supCap ? 'space (hard cap)' : 'support staff'}`;
      else if (demand < cap * 0.6) ctx.note = 'Lots of idle capacity: more customers needed (marketing, reputation, location)';
    },
  };
  const B = () => TG.B;

  // ============ FARM ============
  M.farmHerdCap = (prop, e) => Math.round(prop.acres * e.headPerAcre * (0.6 + 0.4 * prop.water) * (0.7 + 0.3 * prop.soil));
  M.bestEnterprise = (prop) => (prop.orchard ? 'orchard' : prop.landType === 'grassland' || prop.landType === 'dry' || prop.landType === 'hillside' ? 'cattle' : 'crops');
  M.isHarvest = (g, b) => { const e = TG.CONFIG.businesses.farm.farm.enterprises[b.farm.ent]; return !!(e.harvest && e.harvest.indexOf(U.moy(g.month)) >= 0); };
  M.models.farm = {
    init(g, b, prop, opts) {
      const fd = TG.CONFIG.businesses.farm.farm; const ent = opts.ent || M.bestEnterprise(prop);
      b.farm = { ent, acres: prop.acres, irrigated: 0, storageCap: 0, stored: 0, seasonYield: 1, planted: 0, toHarvest: 0, futures: [], herd: 0,
        orchardAge: prop.orchard ? 999 : 0, sellPolicy: 'sell', landType: prop.landType, soil: prop.soil, water: prop.water, yearTons: 0, lastHarvest: null, plantBroken: false };
      if (ent === 'cattle') b.farm.herd = Math.round(M.farmHerdCap(prop, fd.enterprises.cattle) * 0.5);
    },
    e(b) { return TG.CONFIG.businesses.farm.farm.enterprises[b.farm.ent]; },
    tractorNeed(b) { const e = this.e(b); return Math.max(1, b.farm.acres / e.acresPerTractor); },
    handNeed(b) { const e = this.e(b); return Math.max(0.3, b.farm.ent === 'cattle' ? b.farm.herd / e.headPerHand : b.farm.acres / e.acresPerHand); },
    needs(g, b) {
      const own = B().owner(g, b);
      return { equip: [{ type: 'tractor', count: Math.ceil(this.tractorNeed(b) - 0.15) }], staff: [{ role: 'hand', count: Math.max(own ? 0 : 1, Math.ceil(this.handNeed(b) - (own ? 0.7 : 0))) }] };
    },
    baseRev(g, b) {
      const f = b.farm; const e = this.e(b);
      if (f.ent === 'cattle') return f.herd * TG.CONFIG.markets.beef.base * e.saleRate / 12 * g.world.priceIdx;
      return f.acres * e.yield * TG.CONFIG.markets[e.market].base / 12 * g.world.priceIdx;
    },
    cover(g, b, ctx) {
      const f = b.farm, e = this.e(b);
      let tcap = 0, robotCap = 0;
      for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (!ed) continue; if (it.type === 'tractor' || ed.countsAs === 'tractor') { const c = ed.cap * TG.E.out(it); tcap += c; if (ed.efficiency) robotCap += c; } }
      const tneed = this.tractorNeed(b);
      const robotShare = tcap > 0 ? robotCap / tcap : 0;
      let heff = U.sum(ctx.key, M.staffEff) + (ctx.own ? 0.7 : 0);
      const hneed = this.handNeed(b) * (1 - robotShare * 0.85 * Math.min(1, tcap / tneed));
      return { tcov: U.clamp(tcap / tneed, 0, 1), hcov: U.clamp(heff / Math.max(0.3, hneed), 0, 1), tcap, tneed };
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
    sell(g, b, tons, label) {
      const f = b.farm, e = this.e(b), C = TG.CONFIG;
      let rev = 0;
      // futures first
      for (const fu of f.futures) { if (tons <= 0) break; const q = Math.min(fu.qty - fu.done, tons); if (q <= 0) continue; fu.done += q; tons -= q; rev += q * fu.price; }
      f.futures = f.futures.filter((fu) => fu.done < fu.qty || fu.month === g.month);
      const plant = b.fixes.plant && !f.plantBroken && f.yearTons >= C.businesses.farm.fixes.find((x) => x.id === 'plant').minVolume * 0.5;
      const vm = plant ? C.businesses.farm.fixes.find((x) => x.id === 'plant').valueMult : 1;
      let stored = 0;
      if (tons > 0) {
        const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b) : f.sellPolicy;
        if (policy === 'store' && e.market !== 'beef') { stored = Math.min(tons, Math.max(0, f.storageCap - f.stored)); f.stored += stored; tons -= stored; }
        if (tons > 0) { const p = TG.W.price(g, e.market, tons / 2) * vm; rev += tons * p; TG.W.sell(g, e.market, tons); }
      }
      if (rev > 0) TG.F.earn(g, Math.round(rev), label || 'Crop sales', b.id);
      return { rev, stored };
    },
    month(g, b, ctx) {
      const C = TG.CONFIG, f = b.farm, e = this.e(b), fd = C.businesses.farm.farm, moy = U.moy(g.month);
      f.acres = Math.max(f.acres, 1);
      const cov = this.cover(g, b, ctx);
      const soilF = 1 + (e.soilW || 0.3) * (f.soil - 0.6) * 2;
      const irr = f.irrigated / f.acres;
      const waterF = 1 + (e.waterW || 0.3) * (Math.max(f.water, irr * 0.85) - 0.6) * 2;
      const inputCut = b.fixes.integrate ? 0.2 : 0;
      const qMult = 0.9 + 0.2 * ctx.quality / 100;
      ctx.cap = Math.round(f.acres); ctx.util = Math.min(cov.tcov, cov.hcov); ctx.busy = 1 / Math.max(0.3, ctx.util);
      // storage costs & spoilage
      if (f.stored > 0) {
        TG.F.spend(g, Math.round(f.stored * e.storageCost * g.world.priceIdx), 'Storage', b.id);
        const sp = f.stored * e.spoil; f.stored -= sp;
        const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b) : f.sellPolicy;
        if (policy === 'sell') { this.sellStored(g, b, f.stored); }
      }
      // processing plant breakdowns
      f.plantBroken = false;
      if (b.fixes.plant && R.chance(0.012)) { f.plantBroken = true; const c = Math.round(9000000 * 0.02); TG.F.spend(g, c, 'Repairs', b.id); TG.rep.event(g, b, 'major', `Processing plant broke down (${U.money(c)} repair, no processing this month)`, '1.2% monthly plant failure chance', { major: 'breakdown' }); }
      for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (ed && ed.glitch && !it.broken && R.chance(ed.glitch)) { it.broken = 'major'; TG.rep.event(g, b, 'bad', `Software glitch took a robot tractor offline`, `${U.pct(ed.glitch)} monthly glitch chance; specialist repairs cost double`); TG.E.queueBroken(g, b, it); } }

      if (f.ent === 'crops') {
        const growing = moy >= 3 && moy <= 9;
        if (e.plant.indexOf(moy) >= 0) {
          const want = f.acres / e.plant.length; const pc = Math.min(cov.tcov, Math.pow(cov.hcov, 0.5));
          let acres = want * pc;
          const costPer = e.inputPerAcre * g.world.priceIdx * (1 - inputCut);
          const afford = Math.max(0, g.cash) / costPer;
          if (acres > afford) { TG.rep.event(g, b, 'bad', `Could only afford seed for ${Math.round(afford)} of ${Math.round(acres)} acres`, 'Cash crunch at planting time'); acres = afford; }
          TG.F.spend(g, Math.round(acres * costPer), 'Seed, fertilizer & fuel', b.id);
          f.planted += acres;
          if (pc < 0.95) TG.rep.event(g, b, 'bad', `Only planted ${Math.round(acres)} of ${Math.round(want)} acres this month`, `Tractor coverage ${U.pct(cov.tcov)} (${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} needed), farmhand coverage ${U.pct(cov.hcov)}`);
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
      } else this.cattle(g, b, ctx, cov, soilF, waterF);
      ctx.served = Math.round(f.acres * ctx.util);
      if (cov.tcov < 1) ctx.note = `Tractor coverage ${U.pct(cov.tcov)}: ${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} tractors' worth working`;
      else if (cov.hcov < 1) ctx.note = `Short on farmhands (${U.pct(cov.hcov)} coverage)`;
    },
    harvest(g, b, ctx, cov, acres, mult) {
      const C = TG.CONFIG, f = b.farm, e = this.e(b);
      const hc = Math.min(1, cov.tcov) * (0.45 + 0.55 * cov.hcov);
      const full = acres * e.yield * f.seasonYield * mult;
      const tons = full * hc;
      TG.F.spend(g, Math.round(acres * e.seasonalPerAcre * g.world.wageIdx * (b.labor < 0.2 ? 1.25 : 1)), 'Seasonal labor', b.id);
      const res = this.sell(g, b, tons, e.market === 'fruit' ? 'Fruit sales' : 'Crop sales');
      f.yearTons += tons;
      const lost = full - tons;
      const broken = b.equip.filter((x) => (x.type === 'tractor' || TG.E.def(b, x.type).countsAs === 'tractor') && x.broken);
      TG.rep.event(g, b, 'good', `Harvested ${Math.round(tons).toLocaleString()} tons (${U.money(res.rev)} sold${res.stored ? ', ' + Math.round(res.stored) + ' t stored' : ''})`, `Season outlook x${f.seasonYield.toFixed(2)}, soil ${Math.round(f.soil * 100)}, water ${Math.round(f.water * 100)}, harvest coverage ${U.pct(hc)}`);
      if (lost > full * 0.1) TG.rep.event(g, b, 'major', `${Math.round(lost).toLocaleString()} tons rotted in the field`, broken.length ? `${broken.map((x) => x.label + ' #' + TG.E.num(b, x) + ' (' + (x.age / 12).toFixed(0) + ' yrs, ' + Math.round(TG.E.effWear(x)) + '% wear)').join(', ')} broken during harvest; tractor coverage ${U.pct(cov.tcov)}` : `Tractor coverage ${U.pct(cov.tcov)}, farmhand coverage ${U.pct(cov.hcov)}`, { major: 'harvest' });
      f.lastHarvest = { m: g.month, tons: Math.round(tons), lost: Math.round(lost) };
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
    sellStored(g, b, tons) {
      const f = b.farm, e = this.e(b); tons = Math.min(tons, f.stored); if (tons <= 0) return 0;
      const p = TG.W.price(g, e.market, tons / 2); const rev = Math.round(tons * p);
      f.stored -= tons; TG.W.sell(g, e.market, tons); TG.F.earn(g, rev, 'Crop sales', b.id); return rev;
    },
    cattle(g, b, ctx, cov, soilF, waterF) {
      const C = TG.CONFIG, f = b.farm, e = this.e(b), moy = U.moy(g.month);
      const cap = Math.max(1, Math.round(f.acres * e.headPerAcre * (0.6 + 0.4 * f.water) * (0.7 + 0.3 * f.soil)));
      const over = f.herd / cap;
      if ([2, 3, 4].indexOf(moy) >= 0) f.herd += f.herd * 0.5 * e.calving / 3 * (0.6 + 0.4 * cov.hcov);
      const deaths = f.herd * (0.003 + (1 - cov.hcov) * 0.02 + Math.max(0, over - 1) * 0.02);
      f.herd = Math.max(0, f.herd - deaths);
      if (R.chance(e.diseaseBase * (1 + Math.max(0, over - 1) * 3) * (b.spec.ops ? 0.6 : 1))) {
        const x = R.range(0.05, 0.2); const lost = Math.round(f.herd * x); f.herd -= lost;
        TG.rep.event(g, b, 'major', `Herd disease: lost ${lost} head`, `${U.pct(e.diseaseBase * (1 + Math.max(0, over - 1) * 3), 1)} monthly chance; herd at ${U.pct(over)} of pasture capacity`, { major: 'harvest' });
      }
      const drought = ctx.weather.kind === 'drought' || ctx.weather.kind === 'heat';
      const feed = f.herd * e.feed * g.world.priceIdx * (drought ? e.droughtFeed * (1 - (f.irrigated / f.acres) * 0.6) : 1) * (over > 1 ? 1 + (over - 1) * 2 : 1) * (1 + 0.3 * (1 - cov.tcov)) * (b.fixes.integrate ? 0.8 : 1);
      TG.F.spend(g, Math.round(feed), 'Feed & hay', b.id);
      let sell = f.herd * e.saleRate / 12 * (f.sellPolicy === 'store' ? 0.3 : 1);
      if (over > 1.05) sell += f.herd - cap;
      sell = Math.max(0, Math.min(sell, f.herd)); f.herd -= sell;
      const q = 0.9 + 0.2 * ctx.quality / 100;
      const price = TG.W.price(g, 'beef', sell / 2) * q * (b.fixes.plant && !f.plantBroken ? 1.2 : 1);
      if (sell > 0) { TG.F.earn(g, Math.round(sell * price), 'Cattle sales', b.id); TG.W.sell(g, 'beef', sell); }
      if (drought) TG.rep.event(g, b, 'bad', 'Drought: feed costs up', `Feed x${e.droughtFeed}; irrigation helps`);
      ctx.cap = cap; ctx.served = Math.round(f.herd);
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
      let v = f.stored * TG.W.price(g, e.market, 0) * 0.9;
      if (f.ent === 'cattle') v += f.herd * TG.W.price(g, 'beef', 0) * 0.7;
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
    const e = TG.CONFIG.businesses.farm.farm.enterprises.cattle; head = Math.round(head); const cost = Math.round(head * e.stockCost * g.world.priceIdx);
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Livestock purchases', b.id, true); b.farm.herd += head; return { ok: true, cost };
  };
  M.farmSwitch = (g, b, ent) => {
    const fd = TG.CONFIG.businesses.farm.farm; if (ent === b.farm.ent) return { ok: false };
    let cost = 0; const prop = g.properties.find((p) => p.id === b.propId);
    if (ent === 'orchard') cost = b.farm.acres * fd.enterprises.orchard.establishPerAcre * g.world.priceIdx;
    if (ent === 'cattle') cost = Math.round(M.farmHerdCap(prop || { acres: b.farm.acres, water: b.farm.water, soil: b.farm.soil }, fd.enterprises.cattle) * 0.4) * fd.enterprises.cattle.stockCost * g.world.priceIdx;
    cost = Math.round(cost);
    if (g.cash < cost) return { ok: false, msg: `Switching costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Farm conversion', b.id, true);
    if (b.farm.ent === 'cattle' && b.farm.herd > 0) { const v = Math.round(b.farm.herd * TG.W.price(g, 'beef', b.farm.herd / 2) * 0.85); TG.F.earn(g, v, 'Cattle sales', b.id, true); b.farm.herd = 0; }
    b.farm.ent = ent; b.farm.planted = 0; b.farm.toHarvest = 0; b.farm.seasonYield = 1; b.farm.futures = [];
    if (ent === 'orchard') b.farm.orchardAge = 0;
    if (ent === 'cattle') b.farm.herd = Math.round(M.farmHerdCap(prop || { acres: b.farm.acres, water: b.farm.water, soil: b.farm.soil }, fd.enterprises.cattle) * 0.4);
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
      const avail = U.clamp(0.78 + 0.22 * (b.rep / 50) - 0.35 * (st.comp - 1), 0.35, 1.05) * B().demandMult(g, b, ctx, { noPrice: true });
      const loads = Math.max(0, Math.min(cap, cap * avail));
      const price = TG.W.price(g, 'freight', loads * 6);
      TG.F.earn(g, Math.round(loads * price), 'Freight revenue', b.id); TG.W.sell(g, 'freight', loads);
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
