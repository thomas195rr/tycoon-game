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
    WEATHER_PLACEHOLDER
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
          const left = e.plant.filter((m) => m >= moy).length || e.plant.length; const need = f.acres / e.plant.length * left - f.seeds;
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
      const keep = Math.max(0, Math.min(matured * e.replaceShare * (f.ent === 'dairy' ? 2.5 : 1), cap - f.herd + matured));
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
