/* farm.js - v5 farm. The land is split into areas you choose: 🐄 cow area, 🌾 crop area, 🍎 orchard area (plus free acres).
   Each area has its own soil % (drops every month, faster when it is high; spraying brings it back), water % (how much of the
   area your sprinklers cover; low water RAISES THE ODDS of dry-outs and sick cows), price and work. Moving acres between
   areas costs money and takes a month or two. Farmhands and tractors are shared by all areas. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U; const M = TG.M;
  const FD = () => TG.CONFIG.businesses.farm.farm;
  const AR = ['cows', 'crops', 'orchard'];
  const GOOD = { crops: 'grain', orchard: 'fruit' };
  M.farmAreas = AR;
  const ent = (k, a) => FD().enterprises[k === 'cows' ? (a && a.kind === 'dairy' ? 'dairy' : 'cattle') : k];
  M.areaE = (b, k) => ent(k, b.farm.areas[k]);
  M.areaLabel = (k) => FD().areas[k].label.toLowerCase();
  const pct = (x) => U.pct(x, 0);
  const B = () => TG.B;

  M.newArea = (k, acres, soil) => {
    const a = { acres: acres || 0, soil: soil == null ? 0.7 : soil, askR: null, m: {} };
    if (k === 'cows') Object.assign(a, { kind: 'beef', herd: 0, cows: 0, young: [], ready: 0 });
    if (k === 'crops') Object.assign(a, { planted: 0, toHarvest: 0, seasonYield: 1, lastHarvest: null });
    if (k === 'orchard') Object.assign(a, { age: 0, seasonYield: 1, lastHarvest: null });
    return a;
  };
  M.farmDefaultOrders = () => ({ spray: { cows: { on: true, below: 0.55 }, crops: { on: true, below: 0.6 }, orchard: { on: true, below: 0.6 } }, seed: true });
  // old saves: one enterprise for the whole farm -> that becomes the matching area; everything else stays where it was
  M.farmEnsure = (b, prop) => {
    const f = b.farm; if (f.areas) return f;
    const old = Object.assign({}, f); const soil = old.soil != null ? old.soil : 0.6;
    const nf = { acres: old.acres || 1, landType: old.landType || 'flat', rain: old.water != null ? old.water : 0.6, baseSoil: soil, freeSoil: soil, areas: {}, moving: [],
      stored: { grain: 0, fruit: 0 }, seeds: old.seeds || 0, storageCap: old.storageCap || 0, sellPolicy: old.sellPolicy || 'sell', futures: [], orders: M.farmDefaultOrders(), harv: [], plantBroken: false, m: {} };
    for (const k of AR) nf.areas[k] = M.newArea(k, 0, soil);
    const e0 = old.ent || 'crops'; const k0 = e0 === 'cattle' || e0 === 'dairy' ? 'cows' : e0 === 'orchard' ? 'orchard' : 'crops';
    const a = nf.areas[k0]; a.acres = nf.acres; a.askR = null;
    if (k0 === 'cows') Object.assign(a, { kind: e0 === 'dairy' ? 'dairy' : 'beef', herd: old.herd || 0, cows: old.cows, young: old.young || [], ready: old.ready || 0 });
    if (k0 === 'crops') Object.assign(a, { planted: old.planted || 0, toHarvest: old.toHarvest || 0, seasonYield: old.seasonYield || 1, lastHarvest: old.lastHarvest || null });
    if (k0 === 'orchard') Object.assign(a, { age: Math.min(old.orchardAge || 0, FD().enterprises.orchard.rampMonths), seasonYield: old.seasonYield || 1, lastHarvest: old.lastHarvest || null });
    if (old.stored) nf.stored[k0 === 'orchard' ? 'fruit' : 'grain'] = old.stored;
    nf.futures = (old.futures || []).map((x) => Object.assign({ mk: k0 === 'orchard' ? 'fruit' : 'grain' }, x));
    if (old.autoSeeds === false) nf.orders.seed = false;
    if (old.irrigated > 0) nf.legacyIrr = old.irrigated; // old irrigation becomes sprinklers (see migrateEquip)
    if (k0 === 'cows' && a.cows == null) M.herdInit(a, a.herd || 0);
    b.ask = null; // old saves: one price for the whole farm; areas now each follow their own market
    b.farm = nf; return nf;
  };
  // old irrigated acres turn into sprinklers in the area that was farmed (free: you already paid for them)
  M.farmMigrateEquip = (g, b) => {
    const f = b.farm; if (!f.legacyIrr) return; const k = AR.find((x) => f.areas[x].acres > 0) || 'crops';
    const t = FD().areas[k].spr; const ed = TG.E.def(b, t); let n = Math.max(1, Math.round(f.legacyIrr / ed.acres));
    while (n-- > 0) { const it = TG.E.buy(g, b, t, 'standard', { free: true }); if (!it) break; }
    delete f.legacyIrr;
  };

  // ---------- land helpers ----------
  M.farmUsed = (f) => U.sum(AR, (k) => f.areas[k].acres) + U.sum(f.moving || [], (x) => x.acres);
  M.farmFree = (f) => Math.max(0, Math.round(f.acres - M.farmUsed(f)));
  M.farmAddAcres = (f, k, acres, soil) => {
    const a = f.areas[k]; const tot = a.acres + acres; if (tot <= 0) return;
    a.soil = (a.soil * a.acres + soil * acres) / tot;
    if (k === 'orchard') a.age = Math.min(a.age, FD().enterprises.orchard.rampMonths) * a.acres / tot; // young trees pull the average age down
    a.acres = tot;
  };
  M.sprAcres = (b, k) => { const t = FD().areas[k].spr; let c = 0; for (const it of b.equip) if (it.type === t && !it.broken) { const ed = TG.E.def(b, t); c += ed.acres * TG.E.out(it); } return c; };
  M.areaWater = (b, k) => { const a = b.farm.areas[k]; return a.acres > 0 ? U.clamp(M.sprAcres(b, k) / a.acres, 0, 1) : 0; };
  M.dryMult = (w) => (w && w.kind && w.sev !== 0 ? FD().water.dry[w.kind] || 1 : 1);
  const wLabel = (w) => (w && w.kind && TG.CONFIG.weather.kinds[w.kind] ? TG.CONFIG.weather.kinds[w.kind].label.toLowerCase() : 'normal weather');
  // soil -> yield multiplier, and the monthly drop
  M.soilYield = (s) => FD().soil.yieldBase + FD().soil.yieldK * s;
  M.soilDrop = (k, s) => FD().areas[k].decay * s * s;
  M.soilAdd = (s) => Math.max(0, Math.min(1 - s, FD().soil.add * (FD().soil.ceil - s)));
  M.waterYield = (w) => 1 + FD().water.yieldK * w;
  M.growing = (k, moy) => (k === 'crops' ? moy >= 3 && moy <= 9 : k === 'orchard' ? moy >= 2 && moy <= 8 : true);

  // ---------- odds (shown to the player and used by the monthly roll) ----------
  M.dryOdds = (g, b, k, w) => {
    const f = b.farm, a = f.areas[k], W = FD().water; if (!a.acres || k === 'cows') return { p: 0, why: '' };
    const water = M.areaWater(b, k); const bl = B().backlogMult(b);
    const p = U.clamp(W.lossBase * (1 - water) * M.dryMult(w) * (1.5 - f.rain) * bl, 0, 0.9);
    return { p, why: `water ${pct(water)} (sprinklers cover ${Math.round(Math.min(a.acres, M.sprAcres(b, k)))} of ${Math.round(a.acres)} acres), ${wLabel(w)}, rain on this land ${pct(f.rain)}${bl > 1.05 ? `, unfinished work x${bl.toFixed(2)}` : ''}` };
  };
  M.pestOdds = (g, b, k) => {
    const a = b.farm.areas[k], W = FD().water; if (!a.acres || k === 'cows') return { p: 0, why: '' };
    const rot = k === 'crops' && b.fixes.rotation; const bl = B().backlogMult(b);
    const p = U.clamp(W.pestBase * (1.7 - a.soil) * (rot ? W.rotationCut : 1) * bl, 0, 0.9);
    return { p, why: `soil ${pct(a.soil)} (poor soil = weak plants)${rot ? ', crop rotation helps' : ''}${bl > 1.05 ? `, unfinished work x${bl.toFixed(2)}` : ''}` };
  };
  M.sickOdds = (g, b, w) => {
    const f = b.farm, a = f.areas.cows; if (!a.herd) return { p: 0, why: '' };
    const e = ent('cows', a); const over = a.herd / Math.max(1, M.farmHeadCap(b)); const water = M.areaWater(b, 'cows');
    const hot = w && (w.kind === 'drought' || w.kind === 'heat'); const bl = B().backlogMult(b);
    const p = U.clamp(e.diseaseBase * (1 + 3 * Math.max(0, over - 1)) * (hot ? 1 + FD().water.sickWater * (1 - water) : 1) * (b.spec.ops ? 0.6 : 1) * bl, 0, 0.9);
    return { p, why: `herd at ${pct(over)} of room${hot ? `, ${wLabel(w)} with water ${pct(water)}` : ''}${b.spec.ops ? ', ops manager helps' : ''}${bl > 1.05 ? `, unfinished work x${bl.toFixed(2)}` : ''}` };
  };

  // ---------- herd helpers (cow area): cows = adult mothers, young = cohorts by age (months), ready = market-age animals ----------
  M.herdInit = (a, total) => {
    const e = ent('cows', a);
    const cows = Math.round(total / 2.07); const youngT = Math.max(0, Math.round(total - cows));
    a.cows = cows; a.young = []; a.ready = 0;
    for (let i = 0; i < e.matureAge; i++) a.young.push({ age: i, n: youngT / e.matureAge });
    M.herdSync(a);
  };
  M.herdSync = (a) => { a.herd = Math.max(0, (a.cows || 0) + U.sum(a.young || [], (x) => x.n) + (a.ready || 0)); return a.herd; };
  M.pastureCap = (b, a) => { const e = ent('cows', a); const w = b && b.farm ? Math.max(b.farm.rain, M.areaWater(b, 'cows')) : 0.6; return Math.round(a.acres * e.headPerAcre * (0.6 + 0.4 * w) * M.soilYield(a.soil)); };
  M.farmHeadCap = (b) => M.pastureCap(b, b.farm.areas.cows) + Math.round(TG.E.sumField(b, 'head'));
  M.farmParlorCap = (b) => Math.round(TG.E.sumField(b, 'milkCows'));
  // for the start screen / setup cost (no business yet)
  M.farmHerdCap = (prop, e) => Math.round(prop.acres * e.headPerAcre * (0.6 + 0.4 * prop.water) * M.soilYield(prop.soil));
  M.bestEnterprise = (prop) => (prop.orchard ? 'orchard' : prop.landType === 'grassland' || prop.landType === 'dry' || prop.landType === 'hillside' ? 'cattle' : 'crops');
  M.isHarvest = (g, b) => { const moy = U.moy(g.month); const A = b.farm.areas; return (A.crops.acres > 0 && FD().enterprises.crops.harvest.indexOf(moy) >= 0) || (A.orchard.acres > 0 && FD().enterprises.orchard.harvest.indexOf(moy) >= 0); };
  M.isLivestock = (f) => !!(f && f.areas && f.areas.cows.acres > 0);
  // ---- storage (tons): base shed + bins/silos; grain, fruit and seed share it
  M.farmStoreCap = (b) => { const fd = FD(); return Math.round(fd.baseStoreTons + b.farm.acres * fd.storePerAcre + (b.farm.storageCap || 0) + TG.E.sumField(b, 'storeTons')); };
  M.farmStoreUsed = (b) => { const f = b.farm; return (f.stored.grain || 0) + (f.stored.fruit || 0) + (f.seeds || 0) * FD().enterprises.crops.seedTonsPerAcre; };
  M.farmStoreFree = (b) => Math.max(0, M.farmStoreCap(b) - M.farmStoreUsed(b));
  M.herdForecast = (g, b) => {
    const a = b.farm.areas.cows, e = ent('cows', a), nm = U.moy(g.month + 1);
    const births = [2, 3, 4].indexOf(nm) >= 0 ? (a.cows || 0) * e.calving / 3 : 0;
    const youngN = U.sum(a.young || [], (x) => x.n);
    const deaths = youngN * e.calfDeath + ((a.cows || 0) + (a.ready || 0)) * e.adultDeath;
    const culls = (a.cows || 0) / Math.max(12, e.lifespan - 24);
    const matured = U.sum((a.young || []).filter((x) => x.age + 1 >= e.matureAge), (x) => x.n);
    return { births, deaths, culls, matured, feed: M.models.farm.feedCost(g, b, null), youngN };
  };
  // processing plant: works only with enough volume through it (12-month sum; a cow counts as 0.5 t)
  M.plantVolume = (b) => U.sum(b.farm.harv || [], (x) => x.t);
  M.plantOn = (b) => { const fx = FD() && TG.CONFIG.businesses.farm.fixes.find((x) => x.id === 'plant'); return !!(b.fixes.plant && !b.farm.plantBroken && M.plantVolume(b) >= fx.minVolume); };
  M.plantMult = (b, k) => (M.plantOn(b) ? (k === 'cows' ? 1.2 : TG.CONFIG.businesses.farm.fixes.find((x) => x.id === 'plant').valueMult) : 1);
  const logVol = (g, f, t) => { f.harv = (f.harv || []).filter((x) => x.m > g.month - 12); const cur = f.harv.find((x) => x.m === g.month); if (cur) cur.t += t; else f.harv.push({ m: g.month, t }); };

  M.models.farm = {
    init(g, b, prop, opts) {
      const e0 = opts.ent || M.bestEnterprise(prop);
      const f = b.farm = { acres: prop.acres, landType: prop.landType, rain: prop.water, baseSoil: prop.soil, freeSoil: prop.soil, areas: {}, moving: [], stored: { grain: 0, fruit: 0 }, seeds: 0, storageCap: 0, sellPolicy: 'sell', futures: [], orders: M.farmDefaultOrders(), harv: [], plantBroken: false, m: {} };
      for (const k of AR) f.areas[k] = M.newArea(k, 0, prop.soil);
      const split = { crops: { crops: 1 }, orchard: { orchard: 1 }, cattle: { cows: 1 }, dairy: { cows: 1 }, mixed: { cows: 0.5, crops: 0.5 } }[e0] || { crops: 1 };
      let left = prop.acres; const ks = Object.keys(split);
      ks.forEach((k, i) => { const n = i === ks.length - 1 ? left : Math.round(prop.acres * split[k]); f.areas[k].acres = n; left -= n; });
      if (e0 === 'dairy') f.areas.cows.kind = 'dairy';
      f.seeds = Math.round(f.areas.crops.acres); // first season's seed comes with the start-up cost
      if (f.areas.orchard.acres) f.areas.orchard.age = prop.orchard ? FD().enterprises.orchard.rampMonths : 0;
      if (f.areas.cows.acres) M.herdInit(f.areas.cows, Math.round(M.farmHerdCap({ acres: f.areas.cows.acres, water: prop.water, soil: prop.soil }, ent('cows', f.areas.cows)) * (FD().herdStart || 0.5)));
    },
    e(b, k) { return ent(k || 'crops', b.farm.areas[k || 'crops']); },
    // work: tractors pull planters and trailers (acres each) or haul hay and feed (head each); farmhands per acre / per cow
    tractorNeed(b) { const A = b.farm.areas; const ec = ent('cows', A.cows); return A.crops.acres / ent('crops').acresPerTractor + A.orchard.acres / ent('orchard').acresPerTractor + (A.cows.herd || 0) / (ec.headPerTractor || 600); },
    handNeed(b) { const A = b.farm.areas; const ec = ent('cows', A.cows); return Math.max(0.3, A.crops.acres / ent('crops').acresPerHand + A.orchard.acres / ent('orchard').acresPerHand + (A.cows.herd || 0) / ec.headPerHand); },
    needs(g, b) {
      M.farmEnsure(b);
      const eq = [{ type: 'tractor', count: Math.max(1, Math.ceil(this.tractorNeed(b) - 0.15)) }];
      const A = b.farm.areas; if (A.cows.kind === 'dairy' && A.cows.acres) eq.push({ type: 'parlor', count: Math.max(1, Math.ceil((A.cows.cows || 1) / 160)) });
      return { equip: eq, staff: [{ role: 'hand', count: Math.max(1, Math.ceil(this.handNeed(b) * 1.1)) }] };
    },
    baseRev(g, b) {
      M.farmEnsure(b); const A = b.farm.areas, C = TG.CONFIG; let r = 0;
      if (A.cows.herd) r += A.cows.kind === 'dairy' ? (A.cows.cows || 0) * ent('cows', A.cows).milkPerCow * C.markets.milk.base : A.cows.herd * C.markets.beef.base * 0.37 / 12;
      r += A.crops.acres * ent('crops').yield * C.markets.grain.base / 12 + A.orchard.acres * ent('orchard').yield * C.markets.fruit.base / 12;
      return r * g.world.priceIdx;
    },
    cover(g, b) {
      let tcap = 0, robotCap = 0, plantX = 0, harvX = 0, combines = 0;
      for (const it of b.equip) {
        const ed = TG.E.def(b, it.type); if (!ed) continue;
        if (it.type === 'tractor' || ed.countsAs === 'tractor') { const c = ed.cap * TG.E.out(it); tcap += c; if (ed.efficiency) robotCap += c; }
        if (ed.plantEq && !it.broken) plantX += ed.plantEq * TG.E.out(it);
        if (ed.harvestEq && !it.broken) { harvX += ed.harvestEq * TG.E.out(it); combines++; }
      }
      const tneed = Math.max(0.01, this.tractorNeed(b));
      const robotShare = tcap > 0 ? robotCap / tcap : 0;
      const heff = U.sum(b.staff.filter((e) => e.role === 'hand'), M.staffEff);
      const hneed = this.handNeed(b) * (1 - robotShare * 0.85 * Math.min(1, tcap / tneed));
      const gear = tcap > 0 ? 1 : 0;
      return { tcov: U.clamp(tcap / tneed, 0, 1), pcov: U.clamp((tcap + plantX * gear) / tneed, 0, 1), hvcov: U.clamp((tcap + harvX * gear) / tneed, 0, 1), combines, hcov: U.clamp(heff / Math.max(0.3, hneed), 0, 1), tcap, tneed, heff, hneed, plantX: plantX * gear, harvX: harvX * gear };
    },
    ratio(b, k) { const a = b.farm.areas[k]; return a.askR == null ? 1 : U.clamp(a.askR, 0.3, 4); },
    market(g, b, k, qty) { return TG.W.price(g, ent(k, b.farm.areas[k]).market, (qty || 0) / 2); },
    // offer goods from an area to buyers at your price; returns {rev, sold, unsold}
    offer(g, b, k, units, label) {
      const a = b.farm.areas[k], e = ent(k, a);
      const r = this.ratio(b, k); const sold = units * TG.PR.sellF(r);
      const p = this.market(g, b, k, sold) * r * M.plantMult(b, k);
      if (sold > 0) { TG.F.earn(g, Math.round(sold * p), label, b.id); TG.W.sell(g, e.market, sold); }
      a.m.sold = (a.m.sold || 0) + sold; a.m.rev = (a.m.rev || 0) + sold * p;
      return { rev: sold * p, sold, unsold: units - sold };
    },
    // crops/fruit: fill price locks first, then sell or store (your harvest order)
    sell(g, b, k, tons, label) {
      const f = b.farm, a = f.areas[k], good = GOOD[k];
      let rev = 0;
      for (const fu of f.futures) { if (tons <= 0) break; if ((fu.mk || 'grain') !== good) continue; const q = Math.min(fu.qty - fu.done, tons); if (q <= 0) continue; fu.done += q; tons -= q; rev += q * fu.price; }
      if (rev > 0) TG.F.earn(g, Math.round(rev), label, b.id);
      let stored = 0, rotted = 0;
      if (tons > 0) {
        const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b, good) : f.sellPolicy;
        if (policy === 'store') { stored = Math.min(tons, M.farmStoreFree(b)); f.stored[good] += stored; tons -= stored; }
        if (tons > 0) {
          const o = this.offer(g, b, k, tons, label); rev += o.rev;
          if (o.unsold > 0) { const s2 = Math.min(o.unsold, M.farmStoreFree(b)); f.stored[good] += s2; stored += s2; rotted = o.unsold - s2; }
        }
      }
      if (rotted > 0) { a.m.lost = (a.m.lost || 0) + rotted; TG.rep.event(g, b, 'bad', `${Math.round(rotted).toLocaleString()} t of ${good} had nowhere to go and rotted`, 'Buyers refused your price and storage was full'); }
      return { rev, stored, rotted };
    },
    sellStored(g, b, good, tons) {
      const f = b.farm; tons = Math.min(tons, f.stored[good] || 0); if (tons <= 0) return 0;
      const o = this.offer(g, b, good === 'fruit' ? 'orchard' : 'crops', tons, good === 'fruit' ? 'Fruit sales' : 'Crop sales'); f.stored[good] -= o.sold; return Math.round(o.rev);
    },
    seedCost(g, b, premium) { return ent('crops').seedPerAcre * g.world.priceIdx * (1 + (premium || 0)) * (b.fixes.integrate ? 0.8 : 1); },
    buySeeds(g, b, acres, premium) {
      const e = ent('crops');
      acres = Math.max(0, Math.min(Math.floor(acres), Math.floor(M.farmStoreFree(b) / e.seedTonsPerAcre)));
      const per = this.seedCost(g, b, premium); acres = Math.min(acres, Math.floor(Math.max(0, g.cash) / per));
      if (acres <= 0) return 0;
      TG.F.spend(g, Math.round(acres * per), 'Seed', b.id); b.farm.seeds = (b.farm.seeds || 0) + acres; b.farm.m.seedsIn = (b.farm.m.seedsIn || 0) + acres;
      return acres;
    },
    feedCost(g, b, ctx) {
      const f = b.farm, a = f.areas.cows; if (!a.herd) return 0; const e = ent('cows', a);
      const youngN = U.sum(a.young || [], (x) => x.n);
      const heads = (a.cows || 0) + (a.ready || 0) + youngN * e.youngFeed;
      const pasture = M.pastureCap(b, a); const total = a.herd || 0;
      const barnHeads = Math.max(0, Math.min(total - pasture, TG.E.sumField(b, 'head')));
      const over = total / Math.max(1, M.farmHeadCap(b));
      const drought = ctx && (ctx.weather.kind === 'drought' || ctx.weather.kind === 'heat');
      const cov = ctx ? this.cover(g, b) : { tcov: 1 };
      let feed = heads * e.feed * g.world.priceIdx * (drought ? 1 + (e.droughtFeed - 1) * (1 - M.areaWater(b, 'cows') * 0.7) : 1) * (over > 1 ? 1 + (over - 1) * 2 : 1) * (1 + 0.3 * (1 - cov.tcov)) * (b.fixes.integrate ? 0.8 : 1);
      feed += barnHeads * e.feed * (e.barnFeed - 1) * g.world.priceIdx;
      return feed;
    },
    month(g, b, ctx) {
      const f = M.farmEnsure(b); M.farmMigrateEquip(g, b);
      const C = TG.CONFIG, fd = FD(), moy = U.moy(g.month), A = f.areas;
      f.m = f.mNext || {}; f.mNext = null; for (const k of AR) A[k].m = {};
      // land that was being converted is ready
      for (const mv of (f.moving || []).slice()) if (mv.ready <= g.month) { M.farmAddAcres(f, mv.to, mv.acres, mv.soil); f.moving.splice(f.moving.indexOf(mv), 1); TG.rep.event(g, b, 'info', `${mv.acres} acres are ready in the ${M.areaLabel(mv.to)}`, `Converted for ${U.money(mv.cost)}`); }
      if (M.farmFree(f) > 0) f.freeSoil = Math.min(Math.max(f.baseSoil, f.freeSoil), f.freeSoil + fd.soil.freeRegen); // resting land slowly recovers
      TG.D.farmOrders(g, b); // your manager carries out your standing orders (spray soil)
      const cov = this.cover(g, b);
      const qMult = 0.9 + 0.2 * ctx.quality / 100;
      ctx.cap = Math.round(f.acres); ctx.util = Math.min(cov.tcov, cov.hcov); ctx.busy = 1 / Math.max(0.3, ctx.util);
      { // work report: farmhand work in "acre-equivalents"
        const WK = TG.WK, load = Math.max(0.3, cov.hneed) * 100, per = 100;
        const nT = b.equip.filter((x) => (x.type === 'tractor' || x.type === 'robot') && !x.broken).length;
        WK.add(ctx, 'eq', '🚜', 'Tractors', nT, cov.tcap / cov.tneed * load, load, 'work pts', ['tractor', 'robot'], `Crops: about ${ent('crops').acresPerTractor} acres per tractor; orchard ${ent('orchard').acresPerTractor}; cows about ${ent('cows', A.cows).headPerTractor || 600} head. A robot tractor counts as 4.`);
        WK.add(ctx, 'staff', '👩‍🌾', 'Farmhands', b.staff.filter((e) => e.role === 'hand').length, cov.heff * per, load, 'work pts', [], `100 work pts = one farmhand's month: about ${ent('crops').acresPerHand} crop acres, ${ent('orchard').acresPerHand} orchard acres or ${ent('cows', A.cows).headPerHand} cows. Skill and training raise it.`, 'hand');
        if (A.crops.acres) {
          WK.add(ctx, 'eq', '🌱', 'Planters', b.equip.filter((x) => x.type === 'planter' && !x.broken).length, (cov.tcap + cov.plantX) / cov.tneed * load, load, 'work pts', ['planter'], 'Plant faster in spring (needs a tractor to pull it).');
          WK.add(ctx, 'eq', '🌾', 'Combines', b.equip.filter((x) => x.type === 'combine' && !x.broken).length, (cov.tcap + cov.harvX) / cov.tneed * load, load, 'work pts', ['combine'], 'Harvest faster in fall so less rots in the field.');
        }
        if (A.cows.herd) {
          WK.add(ctx, 'space', '🌿', 'Grass + barns', 1, M.farmHeadCap(b), A.cows.herd, 'head', ['pen', 'barn'], 'Grass in your cow area plus pens and barns. Full = no room for calves.');
          if (A.cows.kind === 'dairy') WK.add(ctx, 'eq', '🥛', 'Milking parlors', b.equip.filter((x) => x.type === 'parlor' && !x.broken).length, M.farmParlorCap(b), A.cows.cows, 'cows', ['parlor'], 'Each parlor milks about 160 cows. Cows not milked make nothing.');
        }
        for (const k of AR) if (A[k].acres) { const t = fd.areas[k].spr; WK.add(ctx, 'eq', '💦', `Sprinklers (${M.areaLabel(k)})`, b.equip.filter((x) => x.type === t && !x.broken).length, M.sprAcres(b, k), A[k].acres, 'acres', [t], 'Acres watered vs acres in the area.'); }
      }
      // storage: costs and spoilage; sell from storage if your order says so
      for (const good of ['grain', 'fruit']) {
        const k = good === 'grain' ? 'crops' : 'orchard', e = ent(k);
        if (f.stored[good] > 0) {
          TG.F.spend(g, Math.round(f.stored[good] * e.storageCost * g.world.priceIdx), 'Storage', b.id);
          const sp = f.stored[good] * e.spoil; f.stored[good] -= sp; A[k].m.spoiled = sp;
          const policy = f.sellPolicy === 'auto' ? TG.D.farmPolicy(g, b, good) : f.sellPolicy;
          if (policy === 'sell') this.sellStored(g, b, good, f.stored[good]);
        }
      }
      { const over = M.farmStoreUsed(b) - M.farmStoreCap(b); if (over > 0.5) for (const good of ['grain', 'fruit']) { const x = Math.min(over, f.stored[good]); if (x > 0) { f.stored[good] -= x; A[good === 'grain' ? 'crops' : 'orchard'].m.lost = (A[good === 'grain' ? 'crops' : 'orchard'].m.lost || 0) + x; } } }
      f.plantBroken = false;
      if (b.fixes.plant && R.chance(0.012)) { f.plantBroken = true; const c = Math.round(9000000 * 0.02 * g.world.priceIdx); TG.F.spend(g, c, 'Repairs', b.id); TG.rep.event(g, b, 'major', `Processing plant broke down (${U.money(c)} repair, no price bonus this month)`, '1.2% monthly plant failure chance', { major: 'breakdown' }); }
      for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (ed && ed.glitch && !it.broken && R.chance(ed.glitch)) { it.broken = 'major'; TG.rep.event(g, b, 'bad', 'Software glitch took a robot tractor offline', `${U.pct(ed.glitch)} monthly glitch chance; specialist repairs cost double`); TG.E.queueBroken(g, b, it); } }
      const inputCut = b.fixes.integrate ? 0.2 : 0;
      if (A.crops.acres || A.crops.planted || A.crops.toHarvest) this.crops(g, b, ctx, cov, moy, inputCut, qMult);
      if (A.orchard.acres) this.orchard(g, b, ctx, cov, moy, inputCut, qMult);
      if (A.cows.acres || A.cows.herd) this.herdMonth(g, b, ctx, cov, qMult);
      // soil drops every month: faster when it is high, slower as it gets low
      for (const k of AR) { const a = A[k]; if (!a.acres) continue; const d = M.soilDrop(k, a.soil); a.soil = Math.max(fd.soil.floor, a.soil - d); a.m.soilDrop = d; }
      ctx.served = Math.round(f.acres * ctx.util);
      if (cov.tcov < 1) ctx.note = `Tractor coverage ${U.pct(cov.tcov)}: ${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} tractors' worth working`;
      else if (cov.hcov < 1) ctx.note = `Short on farmhands (${U.pct(cov.hcov)} of the work gets done)`;
      else if (M.farmFree(f) > 0) ctx.note = `${M.farmFree(f)} acres are not used: give them to an area in the Land tab`;
      this.flow(g, b, ctx, cov);
    },
    crops(g, b, ctx, cov, moy, inputCut, qMult) {
      const f = b.farm, a = f.areas.crops, e = ent('crops'), C = TG.CONFIG;
      if (e.plant.indexOf(U.moy(g.month + 1)) >= 0 || e.plant.indexOf(moy) >= 0) TG.D.farmSeedOrder(g, b, cov);
      if (e.plant.indexOf(moy) >= 0 && a.acres > 0) {
        const want = a.acres / e.plant.length; const pc = Math.min(cov.pcov, Math.pow(cov.hcov, 0.5));
        let acres = Math.min(want * pc, f.seeds);
        const costPer = e.inputPerAcre * g.world.priceIdx * (1 - inputCut);
        const afford = Math.max(0, g.cash) / costPer;
        if (acres > afford) { TG.rep.event(g, b, 'bad', `Could only afford fertilizer & fuel for ${Math.round(afford)} of ${Math.round(acres)} acres`, 'Cash crunch at planting time'); acres = afford; }
        TG.F.spend(g, Math.round(acres * costPer), 'Fertilizer & fuel', b.id);
        f.seeds -= acres; a.planted += acres; a.m.planted = acres;
        if (acres < want * pc - 0.5 && f.seeds < 1) TG.rep.event(g, b, 'bad', `Ran out of seed: planted ${Math.round(acres)} of ${Math.round(want)} acres`, 'Buy seed before planting months, or order your manager to (Manager tab)');
        if (pc < 0.95) TG.rep.event(g, b, 'bad', `Only planted ${Math.round(acres)} of ${Math.round(want)} acres this month`, `Planting coverage ${U.pct(cov.pcov)} (tractors + planters), farmhands got ${U.pct(cov.hcov)} of the work done`);
        if (moy === e.plant[e.plant.length - 1]) a.toHarvest = a.planted;
      }
      if (M.growing('crops', moy) && (a.planted > 0 || a.toHarvest > 0)) this.areaWeather(g, b, ctx, 'crops');
      if (e.harvest.indexOf(moy) >= 0 && a.toHarvest > 0) this.harvest(g, b, ctx, cov, 'crops', a.toHarvest / e.harvest.length, M.soilYield(a.soil) * M.waterYield(M.areaWater(b, 'crops')) * qMult);
      if (moy === e.harvest[e.harvest.length - 1]) this.endSeason(g, b, 'crops');
    },
    orchard(g, b, ctx, cov, moy, inputCut, qMult) {
      const a = b.farm.areas.orchard, e = ent('orchard');
      a.age++;
      const prod = U.clamp(a.age / e.rampMonths, 0, 1);
      TG.F.spend(g, Math.round(a.acres * e.inputPerAcre / 12 * g.world.priceIdx * (1 - inputCut) * (0.35 + 0.65 * prod)), 'Orchard upkeep', b.id);
      if (M.growing('orchard', moy)) this.areaWeather(g, b, ctx, 'orchard');
      if (e.harvest.indexOf(moy) >= 0) {
        if (prod < 0.05) { if (moy === e.harvest[0]) TG.rep.event(g, b, 'info', 'Young orchard: no fruit yet', `${Math.round(a.age)} of ${e.rampMonths} months to full production`); }
        else this.harvest(g, b, ctx, cov, 'orchard', a.acres * prod / e.harvest.length, M.soilYield(a.soil) * M.waterYield(M.areaWater(b, 'orchard')) * qMult);
      }
      if (moy === e.harvest[e.harvest.length - 1]) this.endSeason(g, b, 'orchard');
    },
    // weather, dry-outs and pests for crops / trees: odds, not fixed losses
    areaWeather(g, b, ctx, k) {
      const f = b.farm, a = f.areas[k], e = ent(k), C = TG.CONFIG, W = FD().water, w = ctx.weather, lt = C.landTypes[f.landType] || C.landTypes.flat, L = M.areaLabel(k);
      const d = M.dryOdds(g, b, k, w);
      if (R.chance(d.p)) { const x = R.range(W.lossRange[0], W.lossRange[1]); a.seasonYield *= 1 - x; if (k === 'orchard') a.age = Math.max(0, a.age * (1 - x * 0.3)); TG.rep.event(g, b, x > 0.2 ? 'major' : 'bad', `Dry spell: about ${pct(x)} of the ${L} ${k === 'orchard' ? 'fruit (and some young trees) died' : 'crop died'}`, `${U.pct(d.p, 1)} odds this month: ${d.why}. More sprinklers lower the odds.`, x > 0.2 ? { major: 'weather' } : null); a.m.dry = x; }
      const p = M.pestOdds(g, b, k);
      if (R.chance(p.p)) { const x = R.range(W.pestRange[0], W.pestRange[1]); a.seasonYield *= 1 - x; TG.rep.event(g, b, 'bad', `Pests and disease hit the ${L} (outlook −${pct(x)})`, `${U.pct(p.p, 1)} odds this month: ${p.why}. Spraying keeps soil up and lowers the odds.`); a.m.pest = x; }
      if (w.kind === 'frost' && w.sev) { const m = 1 - 0.22 * (e.frostSens || 0.5) * lt.frost; a.seasonYield *= m; TG.rep.event(g, b, 'bad', `Frost hurt the ${L} (outlook x${m.toFixed(2)})`, `Frost; this land's frost risk x${lt.frost}`); }
      if ((w.kind === 'flood' && lt.flood > 0.005) || R.chance(lt.flood / 6)) { const m = R.range(0.35, 0.7); a.seasonYield *= m; TG.rep.event(g, b, 'major', `Flooding in the ${L} (outlook x${m.toFixed(2)})`, `${lt.label} (flood risk ${U.pct(lt.flood, 0)}/yr)`, { major: 'weather' }); }
      if (R.chance(C.goodEvents.bumper.p / 4)) { const x = R.range(C.goodEvents.bumper.yield[0], C.goodEvents.bumper.yield[1]); a.seasonYield *= x; TG.rep.event(g, b, 'good', `Bumper conditions in the ${L} (outlook x${x.toFixed(2)})`, 'Ideal weather this month'); }
    },
    harvest(g, b, ctx, cov, k, acres, mult) {
      const f = b.farm, a = f.areas[k], e = ent(k);
      const hc = Math.min(1, cov.hvcov) * (0.45 + 0.55 * cov.hcov);
      const full = acres * e.yield * a.seasonYield * mult;
      const tons = full * hc;
      const cut = cov.combines && k === 'crops' ? TG.E.def(b, 'combine').seasonalCut : 0;
      TG.F.spend(g, Math.round(acres * e.seasonalPerAcre * g.world.wageIdx * (b.labor < 0.2 ? 1.25 : 1) * (1 - cut)), 'Seasonal labor', b.id);
      const res = this.sell(g, b, k, tons, k === 'orchard' ? 'Fruit sales' : 'Crop sales');
      logVol(g, f, tons); a.m.harvested = (a.m.harvested || 0) + tons;
      const lost = full - tons; a.m.lost = (a.m.lost || 0) + lost;
      TG.rep.event(g, b, 'good', `Harvested ${Math.round(tons).toLocaleString()} t of ${GOOD[k]} (${U.money(res.rev)} sold${res.stored ? ', ' + Math.round(res.stored) + ' t stored' : ''})`, `Outlook x${a.seasonYield.toFixed(2)}, soil ${pct(a.soil)} (x${M.soilYield(a.soil).toFixed(2)}), water ${pct(M.areaWater(b, k))}, harvest coverage ${U.pct(hc)}`);
      if (lost > full * 0.1) { const broken = b.equip.filter((x) => (x.type === 'tractor' || (TG.E.def(b, x.type) || {}).countsAs === 'tractor' || x.type === 'combine') && x.broken); TG.rep.event(g, b, 'major', `${Math.round(lost).toLocaleString()} t rotted in the field`, broken.length ? `${broken.map((x) => x.label + ' #' + TG.E.num(b, x)).join(', ')} broken during harvest; harvest coverage ${U.pct(cov.hvcov)}` : `Harvest coverage ${U.pct(cov.hvcov)} (tractors + combines), farmhands got ${U.pct(cov.hcov)} of the work done`, { major: 'harvest' }); }
      a.lastHarvest = { m: g.month, tons: Math.round(tons), lost: Math.round(lost) };
    },
    herdMonth(g, b, ctx, cov, q) {
      const f = b.farm, a = f.areas.cows, e = ent('cows', a), moy = U.moy(g.month), m = a.m;
      if (a.cows == null) M.herdInit(a, a.herd || 0);
      const cap = M.farmHeadCap(b);
      const over = a.herd / Math.max(1, cap);
      if ([2, 3, 4].indexOf(moy) >= 0) { const n = a.cows * e.calving / 3 * (0.6 + 0.4 * cov.hcov); if (n > 0) a.young.push({ age: -1, n }); m.born = n; }
      const stress = (1 - cov.hcov) * 0.02 + Math.max(0, over - 1) * 0.02;
      let died = 0;
      for (const c of a.young) { c.age++; const d = c.n * (e.calfDeath + stress); c.n -= d; died += d; }
      const ad = e.adultDeath + stress; died += (a.cows + a.ready) * ad; a.cows *= 1 - ad; a.ready *= 1 - ad;
      const sk = M.sickOdds(g, b, ctx.weather);
      if (R.chance(sk.p)) {
        const x = R.range(0.05, 0.2); const lost = (a.cows + a.ready + U.sum(a.young, (c) => c.n)) * x;
        a.cows *= 1 - x; a.ready *= 1 - x; for (const c of a.young) c.n *= 1 - x; died += lost;
        TG.rep.event(g, b, 'major', `Sick cows: lost ${Math.round(lost)} head`, `${U.pct(sk.p, 1)} odds this month: ${sk.why}`, { major: 'harvest' });
      }
      m.died = died;
      let matured = 0;
      for (const c of a.young) if (c.age >= e.matureAge) matured += c.n;
      a.young = a.young.filter((c) => c.age < e.matureAge && c.n > 0.01);
      M.herdSync(a);
      const base = matured * e.replaceShare * (a.kind === 'dairy' ? 2.5 : 1);
      const keep = Math.min(matured, Math.max(base, Math.min(matured * 0.5, cap * 0.95 - a.herd)));
      a.cows += keep; a.ready += matured - keep; m.matured = matured; m.kept = keep;
      const culls = a.cows / Math.max(12, e.lifespan - 24); a.cows -= culls; m.culled = culls;
      if (culls > 0) { TG.F.earn(g, Math.round(culls * TG.W.price(g, 'beef', culls / 2) * e.cullValue), 'Cattle sales', b.id); TG.W.sell(g, 'beef', culls); }
      M.herdSync(a); logVol(g, f, culls * 0.5);
      const drought = ctx.weather.kind === 'drought' || ctx.weather.kind === 'heat';
      const feed = this.feedCost(g, b, ctx); m.feed = feed;
      TG.F.spend(g, Math.round(feed), 'Feed & hay', b.id);
      if (drought) TG.rep.event(g, b, 'bad', 'Dry weather: feed costs up', `Feed up to x${e.droughtFeed}; water in the cow area is ${pct(M.areaWater(b, 'cows'))} (sprinklers keep grass growing)`);
      if (a.kind === 'dairy') {
        const milked = Math.min(a.cows, M.farmParlorCap(b));
        const milk = milked * e.milkPerCow * (0.6 + 0.4 * cov.hcov) * q;
        m.milk = milk; m.notMilked = a.cows - milked;
        if (milk > 0) { const o = this.offer(g, b, 'cows', milk, 'Milk sales'); m.lost = (m.lost || 0) + o.unsold; logVol(g, f, o.sold); }
        if (a.ready > 0) { const n = a.ready; TG.F.earn(g, Math.round(n * TG.W.price(g, 'beef', n / 2) * 0.8), 'Cattle sales', b.id); TG.W.sell(g, 'beef', n); a.ready = 0; m.soldHead = n; }
      } else {
        let sell = f.sellPolicy === 'store' ? 0 : a.ready;
        if (over > 1.05) sell = Math.max(sell, a.herd - cap);
        sell = Math.max(0, Math.min(sell, a.ready + a.cows));
        if (sell > 0) {
          const r = this.ratio(b, 'cows'); const sold = sell * TG.PR.sellF(r);
          const price = TG.W.price(g, 'beef', sold / 2) * r * q * M.plantMult(b, 'cows');
          if (sold > 0) { TG.F.earn(g, Math.round(sold * price), 'Cattle sales', b.id); TG.W.sell(g, 'beef', sold); logVol(g, f, sold * 0.5); }
          const fromReady = Math.min(a.ready, sold); a.ready -= fromReady; a.cows -= sold - fromReady;
          m.soldHead = sold; m.unsoldHead = sell - sold; m.rev = sold * price;
        }
      }
      M.herdSync(a);
    },
    flow(g, b, ctx, cov) {
      const f = b.farm, A = f.areas, FL = TG.FL; FL.start(b);
      const soilRow = (k) => { const a = A[k]; if (!a.acres) return; FL.row(b, '🟫', `Soil (${M.areaLabel(k)})`, Math.round(a.soil * 100), '%', a.soil >= 0.6 ? 'g' : a.soil >= 0.4 ? 'y' : 'r', `Dropped ${(a.m.soilDrop * 100 || 0).toFixed(1)} points this month. Crops grow x${M.soilYield(a.soil).toFixed(2)}.`); };
      if (A.cows.herd || A.cows.acres) {
        const a = A.cows, e = ent('cows', a), m = a.m, fc = M.herdForecast(g, b);
        if (m.born) FL.row(b, '🐮', 'Calves born', m.born, '', 'g', 'Spring calving: Mar-May');
        FL.row(b, '🐂', 'Reached market age', m.matured || 0, '', 'g', `At ${e.matureAge} months; ${Math.round(m.kept || 0)} kept as new cows`);
        if (a.kind === 'dairy') FL.row(b, '🥛', 'Milk made', m.milk || 0, 't', m.notMilked > 0.5 ? 'y' : 'g', m.notMilked > 0.5 ? `${Math.round(m.notMilked)} cows not milked: need parlor space` : '');
        FL.row(b, '🛒', 'Cattle sold', m.soldHead || 0, 'head', 'g');
        if (m.unsoldHead > 0.5) FL.row(b, '🚫', 'Buyers said no', m.unsoldHead, 'head', 'r', 'Your price is over market');
        if (m.lost > 0.5) FL.row(b, '🗑️', 'Milk spoiled', m.lost, 't', 'r', 'Unsold milk spoils');
        FL.row(b, '💀', 'Cows died', m.died || 0, '', (m.died || 0) > a.herd * 0.02 ? 'r' : 'y', 'Calves ' + U.pct(e.calfDeath, 1) + '/mo, adults ' + U.pct(e.adultDeath, 1) + '/mo, plus sickness');
        FL.row(b, '🌽', 'Feed', m.feed || 0, '$', 'y');
        soilRow('cows');
        FL.next(b, '🐮', 'Births expected', fc.births, '', fc.births ? 'g' : ''); FL.next(b, '🐂', 'Ready to sell', fc.matured + a.ready, 'head', 'g');
        FL.next(b, '💀', 'Losses expected', fc.deaths + fc.culls, 'head', 'y'); FL.next(b, '🌽', 'Feed cost', fc.feed, '$', 'y');
      }
      for (const k of ['crops', 'orchard']) {
        const a = A[k], e = ent(k), m = a.m, good = GOOD[k]; if (!a.acres && !a.planted && !(f.stored[good] > 0)) continue;
        const ic = k === 'crops' ? '🌾' : '🍎';
        if (k === 'crops' && f.m.seedsIn) FL.row(b, '🌱', 'Seed bought', f.m.seedsIn, 'acres', 'g');
        if (m.planted != null) FL.row(b, '🚜', 'Planted', m.planted, 'acres', m.planted < a.acres / e.plant.length * 0.95 ? 'y' : 'g');
        if (m.harvested != null) FL.row(b, ic, `Harvested (${good})`, m.harvested, 't', 'g');
        if (m.sold) FL.row(b, '🛒', `Sold (${good})`, m.sold, 't', 'g', `${U.money(m.rev / Math.max(1, m.sold))}/t`);
        if (m.spoiled > 0.5) FL.row(b, '🐭', `Spoiled in storage (${good})`, m.spoiled, 't', 'y', `${U.pct(e.spoil, 1)} a month`);
        if (m.lost > 0.5) FL.row(b, '🗑️', `Lost (${good})`, m.lost, 't', 'r', 'Rotted in the field or no room in storage');
        if (m.dry) FL.row(b, '🏜️', `Dried out (${M.areaLabel(k)})`, Math.round(m.dry * 100), '%', 'r', 'Share of the crop lost to a dry spell');
        if (m.pest) FL.row(b, '🐛', `Pests (${M.areaLabel(k)})`, Math.round(m.pest * 100), '%', 'r', 'Share of the crop lost to pests');
        soilRow(k);
        const nm = U.moy(g.month + 1);
        if (k === 'crops' && e.plant.indexOf(nm) >= 0 && a.acres) { const need = a.acres / e.plant.length; FL.next(b, '🌱', 'Planting', need, 'acres', f.seeds >= need || f.orders.seed ? 'g' : 'r', f.seeds >= need ? '' : f.orders.seed ? 'Seed will be bought (your order)' : 'Need more seed'); }
        if (e.harvest.indexOf(nm) >= 0) { const exp = (k === 'crops' ? a.toHarvest || a.planted : a.acres * U.clamp(a.age / e.rampMonths, 0, 1)) / e.harvest.length * e.yield * a.seasonYield * M.soilYield(a.soil); if (exp > 0) FL.next(b, ic, `Harvest (${good})`, exp, 't', 'g'); }
        if (f.stored[good] > 0) FL.next(b, '🐭', `Will spoil (${good})`, f.stored[good] * e.spoil, 't', 'y');
      }
      if ((f.moving || []).length) FL.next(b, '🚧', 'Acres getting ready', U.sum(f.moving, (x) => x.acres), 'acres', 'y', f.moving.map((x) => `${x.acres} for the ${M.areaLabel(x.to)} in ${Math.max(0, x.ready - g.month)} mo`).join(', '));
    },
    endSeason(g, b, k) {
      const f = b.farm, a = f.areas[k], good = GOOD[k];
      for (const fu of f.futures) if ((fu.mk || 'grain') === good && fu.done < fu.qty) {
        const short = fu.qty - fu.done; const cost = Math.round(short * TG.W.price(g, good, 0) * 1.05);
        TG.F.spend(g, cost, 'Futures shortfall', b.id); fu.done = fu.qty;
        TG.rep.event(g, b, 'bad', `Price lock short by ${Math.round(short)} t of ${good}: bought back for ${U.money(cost)}`, 'Harvest came in below the amount you locked');
      }
      f.futures = f.futures.filter((fu) => (fu.mk || 'grain') !== good);
      a.seasonYield = 1; if (k === 'crops') { a.planted = 0; a.toHarvest = 0; }
    },
    extraRisks(g, b, ctx) {
      M.farmEnsure(b); const cov = this.cover(g, b); const out = []; const w = ctx.weather;
      for (const k of ['crops', 'orchard']) { const d = M.dryOdds(g, b, k, w); if (d.p > 0.001) out.push({ label: `Dry spell kills part of the ${M.areaLabel(k)}${M.growing(k, U.moy(g.month + 1)) ? '' : ' (only in growing months)'}`, p: M.growing(k, U.moy(g.month + 1)) ? d.p : 0, why: d.why }); const p = M.pestOdds(g, b, k); if (p.p > 0.001 && M.growing(k, U.moy(g.month + 1))) out.push({ label: `Pests in the ${M.areaLabel(k)}`, p: p.p, why: p.why }); }
      const s = M.sickOdds(g, b, w); if (s.p > 0) out.push({ label: 'Sick cows', p: s.p, why: s.why });
      if (cov.tcov < 1) out.push({ label: 'Not enough working tractors for planting / harvest', p: 1 - cov.tcov, why: `${cov.tcap.toFixed(1)} of ${cov.tneed.toFixed(1)} tractors' worth working` });
      if (cov.hcov < 1) out.push({ label: 'Not enough farmhands', p: 1 - cov.hcov, why: 'They cannot get all the work done' });
      return out;
    },
    inventoryValue(g, b) {
      const f = M.farmEnsure(b);
      let v = (f.stored.grain || 0) * TG.W.price(g, 'grain', 0) * 0.9 + (f.stored.fruit || 0) * TG.W.price(g, 'fruit', 0) * 0.9 + (f.seeds || 0) * this.seedCost(g, b) * 0.8;
      v += (f.areas.cows.herd || 0) * TG.W.price(g, 'beef', 0) * 0.6;
      return Math.round(v);
    },
  };

  // ---------- actions ----------
  M.farmLandPrice = (g, b) => { const L = TG.CONFIG.locations[b.loc]; return L.ppa * (0.75 + 0.5 * b.farm.baseSoil) * TG.CONFIG.regions[b.region].price * g.world.housing * FD().landPriceMult; };
  M.farmBuyLand = (g, b, acres, mortgage) => {
    const f = M.farmEnsure(b);
    acres = Math.round(acres); if (!(acres > 0)) return { ok: false, msg: 'Enter acres.' };
    const prop = g.properties.find((p) => p.id === b.propId);
    const per = M.farmLandPrice(g, b) * (1 + acres / 20000);
    const cost = Math.round(acres * per);
    if (mortgage) {
      const down = Math.round(cost * TG.CONFIG.property.mortgageDown);
      if (g.cash < down) return { ok: false, msg: `Need ${U.money(down)} down.` };
      const ok = TG.F.canBorrow(g, 'mortgage', cost - down); if (!ok.ok) return ok;
      TG.F.spend(g, down, 'Land purchases', null, true);
      TG.F.newLoan(g, 'mortgage', cost - down, { collateral: { kind: 'property', id: prop.id }, label: `Land mortgage (${acres} ac)`, bizId: b.id, noCash: true });
    } else { if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Land purchases', null, true); }
    const free = M.farmFree(f); f.freeSoil = (f.freeSoil * free + f.baseSoil * acres) / Math.max(1, free + acres);
    f.acres += acres; b.acres = f.acres;
    if (prop) { prop.acres += acres; if (prop.owned) prop.baseValue = (prop.baseValue || prop.price) + cost * (prop.housingAtBuy || 1) / g.world.housing; else prop.landOwned = (prop.landOwned || 0) + cost / g.world.housing; }
    TG.rep.event(g, b, 'info', `Bought ${acres} acres of neighbouring land for ${U.money(cost)}`, `${U.money(per)} per acre. It is free land until you give it to an area.`);
    return { ok: true, cost };
  };
  // cost and time to turn acres into an area (from free land or from another area)
  M.farmMoveCost = (g, b, to, acres) => {
    if (to === 'free') return { cost: 0, months: 0, why: 'Leaving land empty is free and instant.' };
    const ad = FD().areas[to]; const per = to === 'orchard' ? ent('orchard').establishPerAcre : ad.convCost;
    return { cost: Math.round(acres * per * g.world.priceIdx * (b.fixes.integrate && to === 'orchard' ? 0.8 : 1)), months: ad.convMonths, per: per * g.world.priceIdx, why: `${ad.convWhy}: ${U.money(per * g.world.priceIdx)} an acre, ready in ${ad.convMonths} month${ad.convMonths > 1 ? 's' : ''}` };
  };
  M.farmMove = (g, b, from, to, acres) => {
    const f = M.farmEnsure(b); acres = Math.round(acres);
    if (!(acres > 0)) return { ok: false, msg: 'Pick how many acres.' };
    if (from === to) return { ok: false, msg: 'Pick two different places.' };
    const have = from === 'free' ? M.farmFree(f) : f.areas[from].acres;
    if (acres > have) return { ok: false, msg: `Only ${Math.round(have)} acres there.` };
    const c = M.farmMoveCost(g, b, to, acres);
    if (g.cash < c.cost) return { ok: false, msg: `Costs ${U.money(c.cost)}.` };
    // take the acres out of where they were
    let soil = f.freeSoil;
    if (from !== 'free') {
      const a = f.areas[from]; soil = a.soil; const keep = (a.acres - acres) / a.acres;
      if (from === 'crops') { a.planted *= keep; a.toHarvest *= keep; }
      a.acres -= acres;
      if (from === 'cows' && a.herd > M.farmHeadCap(b) * 1.05) TG.rep.event(g, b, 'bad', 'Less grass than cows now', `${Math.round(a.herd)} cows, room for ${M.farmHeadCap(b)}: sell some or they eat expensive feed`);
    } else { /* free soil stays as it was */ }
    if (c.cost) TG.F.spend(g, c.cost, 'Land conversion', b.id, true);
    if (to === 'free') { const fr = M.farmFree(f) - acres; f.freeSoil = (f.freeSoil * Math.max(0, fr) + soil * acres) / Math.max(1, fr + acres); }
    else f.moving.push({ to, acres, soil, ready: g.month + c.months, cost: c.cost });
    return { ok: true, cost: c.cost, months: c.months };
  };
  // spray pesticide & fertilizer on one area: soil goes up (less when it is already high). Once a month per area.
  M.farmTreatCost = (g, b, k, waste) => Math.round(b.farm.areas[k].acres * FD().areas[k].treat * g.world.priceIdx * (b.fixes.integrate ? 0.8 : 1) * (waste || 1));
  M.farmTreat = (g, b, k, by, waste) => {
    const f = M.farmEnsure(b), a = f.areas[k]; if (!a || !a.acres) return { ok: false, msg: 'No acres in that area.' };
    if (TG.USES.used(a, 'treat', g.month)) return { ok: false, again: true, msg: 'Already sprayed this month. Spraying again does nothing.' };
    const cost = M.farmTreatCost(g, b, k, waste); if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.USES.take(a, 'treat', g.month);
    TG.F.spend(g, cost, 'Spray & fertilizer', b.id, by === 'You');
    const from = a.soil; a.soil = Math.min(1, a.soil + M.soilAdd(a.soil));
    return { ok: true, cost, from, to: a.soil };
  };
  M.farmSetAsk = (b, k, step) => { const a = b.farm.areas[k]; if (step == null) a.askR = null; else a.askR = U.clamp(Math.round(((a.askR == null ? 1 : a.askR) + step) * 100) / 100, 0.5, 2); return a.askR; };
  M.farmStorage = (g, b, tons) => {
    const cost = Math.round(tons * 20 * g.world.priceIdx); if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Storage construction', b.id, true); b.farm.storageCap += Math.round(tons); return { ok: true, cost };
  };
  M.farmExpected = (b, k) => { const a = b.farm.areas[k], e = ent(k); return (k === 'crops' ? a.acres : a.acres * U.clamp(a.age / e.rampMonths, 0, 1)) * e.yield; };
  M.farmFutures = (g, b, k, qty) => {
    const f = M.farmEnsure(b), fd = FD(); if (k !== 'crops' && k !== 'orchard') return { ok: false, msg: 'Price locks are for grain and fruit.' };
    const good = GOOD[k]; const locked = U.sum(f.futures.filter((x) => (x.mk || 'grain') === good), (x) => x.qty);
    qty = Math.min(Math.round(qty), Math.round(M.farmExpected(b, k) * fd.futuresMax - locked)); if (qty <= 0) return { ok: false, msg: `You can lock at most ${U.pct(fd.futuresMax)} of the expected harvest.` };
    const price = TG.W.price(g, good, 0) * fd.futuresDiscount;
    f.futures.push({ mk: good, qty, price, done: 0, month: g.month });
    return { ok: true, qty, price };
  };
  M.cowPrice = (g, b) => TG.W.price(g, 'beef', 0) * (b.farm.areas.cows.kind === 'dairy' ? 1.35 : 1.15);
  M.farmBuyCattle = (g, b, head) => {
    const a = M.farmEnsure(b).areas.cows; head = Math.round(head); if (!(head > 0)) return { ok: false, msg: 'Pick how many.' };
    if (!a.acres) return { ok: false, msg: 'Give some acres to the cow area first.' };
    const cost = Math.round(head * M.cowPrice(g, b));
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Livestock purchases', b.id, true);
    if (a.cows == null) M.herdInit(a, a.herd || 0);
    a.cows += head; M.herdSync(a); return { ok: true, cost };
  };
  M.farmSellCattle = (g, b, head, which) => {
    const a = M.farmEnsure(b).areas.cows; if (a.cows == null) M.herdInit(a, a.herd || 0);
    head = Math.max(0, Math.round(head)); const pool = which === 'cows' ? a.cows : a.ready; head = Math.min(head, Math.floor(pool));
    if (!head) return { ok: false, msg: which === 'cows' ? 'No cows to sell.' : 'No animals at market age yet.' };
    const p = TG.W.price(g, 'beef', head / 2) * (which === 'cows' ? 0.75 : 1); const rev = Math.round(head * p);
    if (which === 'cows') a.cows -= head; else a.ready -= head;
    TG.F.earn(g, rev, 'Cattle sales', b.id, true); TG.W.sell(g, 'beef', head); M.herdSync(a);
    return { ok: true, rev, head };
  };
  // beef <-> dairy: the herd is sold (70% of market) and a starter herd of the other kind is bought
  M.farmCowKind = (g, b, kind) => {
    const a = M.farmEnsure(b).areas.cows; if (a.kind === kind) return { ok: false, msg: 'Already that kind.' };
    if (!a.acres) { a.kind = kind; return { ok: true, cost: 0 }; }
    const n = Math.round(M.pastureCap(b, a) * 0.4 / 2.07);
    const cost = Math.round(n * TG.W.price(g, 'beef', 0) * (kind === 'dairy' ? 1.35 : 1.15));
    if (g.cash < cost) return { ok: false, msg: `A starter herd costs ${U.money(cost)}.` };
    if (a.herd > 0) { const v = Math.round(a.herd * TG.W.price(g, 'beef', a.herd / 2) * 0.7); TG.F.earn(g, v, 'Cattle sales', b.id, true); }
    TG.F.spend(g, cost, 'Livestock purchases', b.id, true);
    Object.assign(a, { kind, herd: 0, cows: n, young: [], ready: 0, askR: null }); M.herdSync(a);
    return { ok: true, cost };
  };
  M.farmBuySeeds = (g, b, acres) => { M.farmEnsure(b); const n = M.models.farm.buySeeds(g, b, acres, 0); return n > 0 ? { ok: true, acres: n } : { ok: false, msg: M.farmStoreFree(b) < 1 ? 'Storage is full.' : 'Not enough cash.' }; };
  M.farmSellSeeds = (g, b, acres) => { const f = M.farmEnsure(b); acres = Math.min(Math.round(acres), Math.floor(f.seeds || 0)); if (acres <= 0) return { ok: false, msg: 'No seed.' }; const v = Math.round(acres * M.models.farm.seedCost(g, b) * 0.5); f.seeds -= acres; TG.F.earn(g, v, 'Asset sales', b.id, true); return { ok: true, rev: v }; };
  M.farmSetupExtra = (g, prop, entK) => {
    const fd = FD(); let c = 0;
    if (entK === 'orchard' && !prop.orchard) c += fd.enterprises.orchard.establishPerAcre * prop.acres * g.world.priceIdx;
    const share = entK === 'cattle' || entK === 'dairy' ? 1 : entK === 'mixed' ? 0.5 : 0;
    if (share) c += Math.round(M.farmHerdCap({ acres: prop.acres * share, water: prop.water, soil: prop.soil }, fd.enterprises[entK === 'dairy' ? 'dairy' : 'cattle']) * (fd.herdStart || 0.5)) * TG.W.price(g, 'beef', 0) * (entK === 'dairy' ? 0.95 : 0.8);
    if (entK === 'mixed') c += prop.acres * 0.5 * fd.areas.crops.convCost * g.world.priceIdx * 0.5;
    const cropShare = entK === 'crops' ? 1 : entK === 'mixed' ? 0.5 : 0; c += cropShare * prop.acres * fd.enterprises.crops.seedPerAcre * g.world.priceIdx;
    return c;
  };
})();
