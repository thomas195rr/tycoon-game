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
  const ent = (k) => FD().enterprises[k]; // v6: one cow herd (milk + meat)
  M.areaE = (b, k) => ent(k, b.farm.areas[k]);
  M.areaLabel = (k) => FD().areas[k].label.toLowerCase();
  const pct = (x) => U.pct(x, 0);
  const B = () => TG.B;

  M.newArea = (k, acres, soil) => {
    const a = { acres: acres || 0, soil: soil == null ? 0.7 : soil, askR: null, m: {} };
    if (k === 'cows') Object.assign(a, { herd: 0, st: { calf: 0, heifer: 0, steer: 0, ready: 0, milker: 0, dry: 0, bull: 0 }, health: 0.9 });
    if (k === 'crops') Object.assign(a, { planted: 0, toHarvest: 0, seasonYield: 1, lastHarvest: null });
    if (k === 'orchard') Object.assign(a, { age: 0, seasonYield: 1, lastHarvest: null });
    return a;
  };
  M.farmDefaultOrders = () => ({ spray: { crops: { on: true, below: 0.6 }, orchard: { on: true, below: 0.6 } }, seed: true, cows: M.cowOrderDefaults() }); // orders only run with a manager
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
    nf.feed = 0;
    nf.futures = (old.futures || []).map((x) => Object.assign({ mk: k0 === 'orchard' ? 'fruit' : 'grain' }, x));
    if (old.autoSeeds === false) nf.orders.seed = false;
    if (old.irrigated > 0) nf.legacyIrr = old.irrigated; // old irrigation becomes sprinklers (see migrateEquip)
    b.ask = null; // old saves: one price for the whole farm; areas now each follow their own market
    b.farm = nf; return nf;
  };
  // old irrigated acres turn into sprinklers in the area that was farmed (free: you already paid for them)
  M.farmMigrateEquip = (g, b) => {
    const f = b.farm; if (!f.legacyIrr) return; const k = AR.find((x) => f.areas[x].acres > 0) || 'crops';
    const t = FD().areas[k].spr; if (!t) { delete f.legacyIrr; return; } // v6: cows eat feed, they have no sprinklers
    const ed = TG.E.def(b, t); let n = Math.max(1, Math.round(f.legacyIrr / ed.acres));
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

  M.farmParlorCap = (b) => Math.round(TG.E.sumField(b, 'milkCows'));
  // for the start screen / setup cost (no business yet)
  M.bestEnterprise = (prop) => (prop.orchard ? 'orchard' : prop.landType === 'grassland' || prop.landType === 'dry' || prop.landType === 'hillside' ? 'cows' : 'crops');
  M.isHarvest = (g, b) => { const moy = U.moy(g.month); const A = b.farm.areas; return (A.crops.acres > 0 && FD().enterprises.crops.harvest.indexOf(moy) >= 0) || (A.orchard.acres > 0 && FD().enterprises.orchard.harvest.indexOf(moy) >= 0); };
  M.isLivestock = (f) => !!(f && f.areas && f.areas.cows.acres > 0);
  // ---- storage (tons): base shed + bins/silos; grain, fruit and seed share it
  M.farmStoreCap = (b) => { const fd = FD(); return Math.round(fd.baseStoreTons + b.farm.acres * fd.storePerAcre + (b.farm.storageCap || 0) + TG.E.sumField(b, 'storeTons')); };
  M.farmStoreUsed = (b) => { const f = b.farm; return (f.stored.grain || 0) + (f.stored.fruit || 0) + (f.seeds || 0) * FD().enterprises.crops.seedTonsPerAcre + (f.feed || 0) * TG.CONFIG.cows.feedTonsCap; };
  M.farmStoreFree = (b) => Math.max(0, M.farmStoreCap(b) - M.farmStoreUsed(b));
  // processing plant: works only with enough volume through it (12-month sum; a cow counts as 0.5 t)
  M.plantVolume = (b) => U.sum(b.farm.harv || [], (x) => x.t);
  M.plantOn = (b) => { const fx = FD() && TG.CONFIG.businesses.farm.fixes.find((x) => x.id === 'plant'); return !!(b.fixes.plant && !b.farm.plantBroken && M.plantVolume(b) >= fx.minVolume); };
  M.plantMult = (b, k) => (M.plantOn(b) ? (k === 'cows' ? 1.2 : TG.CONFIG.businesses.farm.fixes.find((x) => x.id === 'plant').valueMult) : 1);
  const logVol = M.logVolX = (g, f, t) => { f.harv = (f.harv || []).filter((x) => x.m > g.month - 12); const cur = f.harv.find((x) => x.m === g.month); if (cur) cur.t += t; else f.harv.push({ m: g.month, t }); };

  M.models.farm = {
    init(g, b, prop, opts) {
      const e0 = opts.ent || M.bestEnterprise(prop);
      const f = b.farm = { acres: prop.acres, landType: prop.landType, rain: prop.water, baseSoil: prop.soil, freeSoil: prop.soil, areas: {}, moving: [], stored: { grain: 0, fruit: 0 }, seeds: 0, feed: 0, storageCap: 0, sellPolicy: 'sell', futures: [], orders: M.farmDefaultOrders(), harv: [], plantBroken: false, m: {} };
      for (const k of AR) f.areas[k] = M.newArea(k, 0, prop.soil);
      const split = { crops: { crops: 1 }, orchard: { orchard: 1 }, cows: { cows: 1 }, cattle: { cows: 1 }, dairy: { cows: 1 }, mixed: { cows: 0.5, crops: 0.5 } }[e0] || { crops: 1 };
      let left = prop.acres; const ks = Object.keys(split);
      ks.forEach((k, i) => { const n = i === ks.length - 1 ? left : Math.round(prop.acres * split[k]); f.areas[k].acres = n; left -= n; });
      f.seeds = Math.round(f.areas.crops.acres); // first season's seed comes with the start-up cost
      if (f.areas.orchard.acres) f.areas.orchard.age = prop.orchard ? FD().enterprises.orchard.rampMonths : 0;
      if (f.areas.cows.acres) { M.herdInit(f.areas.cows, Math.round(M.farmHerdCap({ acres: f.areas.cows.acres }) * (FD().herdStart || 0.5))); f.feed = Math.round(M.feedNeed(f.areas.cows) * 2); } // starter herd + 2 months of feed (in the setup cost)
    },
    e(b, k) { return ent(k || 'crops', b.farm.areas[k || 'crops']); },
    // work: tractors pull planters and trailers (acres each) or haul hay and feed (head each); farmhands per acre / per cow
    tractorNeed(b) { const A = b.farm.areas; const ec = ent('cows', A.cows); return A.crops.acres / ent('crops').acresPerTractor + A.orchard.acres / ent('orchard').acresPerTractor + (A.cows.herd || 0) / (ec.headPerTractor || 600); },
    handNeed(b) { const A = b.farm.areas; const ec = ent('cows', A.cows); return Math.max(0.3, A.crops.acres / ent('crops').acresPerHand + A.orchard.acres / ent('orchard').acresPerHand + (A.cows.herd || 0) / ec.headPerHand); },
    needs(g, b) {
      M.farmEnsure(b);
      const eq = [{ type: 'tractor', count: Math.max(1, Math.ceil(this.tractorNeed(b) - 0.15)) }];
      const A = b.farm.areas; if (A.cows.acres) { M.herdSync(A.cows); eq.push({ type: 'parlor', count: Math.max(1, Math.ceil((A.cows.st.milker || 1) / 160)) }); }
      return { equip: eq, staff: [{ role: 'hand', count: Math.max(1, Math.ceil(this.handNeed(b) * 1.1)) }] };
    },
    baseRev(g, b) {
      M.farmEnsure(b); const A = b.farm.areas, C = TG.CONFIG; let r = 0;
      if (A.cows.herd && A.cows.st) r += A.cows.st.milker * ent('cows').milkPerCow * C.markets.milk.base + A.cows.st.steer / 6 * C.markets.beef.base;
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
    month(g, b, ctx) {
      const f = M.farmEnsure(b); M.farmMigrateEquip(g, b); M.herdMigrate(g, b);
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
          WK.add(ctx, 'eq', '🥛', 'Milking parlors', b.equip.filter((x) => x.type === 'parlor' && !x.broken).length, M.farmParlorCap(b), A.cows.st.milker, 'cows', ['parlor'], 'Each parlor milks about 160 cows. Cows not milked make nothing.');
        }
        for (const k of AR) if (A[k].acres && fd.areas[k].spr) { const t = fd.areas[k].spr; WK.add(ctx, 'eq', '💦', `Sprinklers (${M.areaLabel(k)})`, b.equip.filter((x) => x.type === t && !x.broken).length, M.sprAcres(b, k), A[k].acres, 'acres', [t], 'Acres watered vs acres in the area.'); }
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
      for (const k of AR) { const a = A[k]; if (!a.acres || k === 'cows') continue; const d = M.soilDrop(k, a.soil); a.soil = Math.max(fd.soil.floor, a.soil - d); a.m.soilDrop = d; }
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
        if (acres > afford) { TG.rep.event(g, b, 'bad', `Could only afford planting fuel for ${Math.round(afford)} of ${Math.round(acres)} acres`, 'Cash crunch at planting time'); acres = afford; }
        TG.F.spend(g, Math.round(acres * costPer), 'Planting fuel', b.id);
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
      TG.F.spend(g, Math.round(a.acres * e.inputPerAcre / 12 * g.world.priceIdx * (1 - inputCut) * (0.35 + 0.65 * prod)), 'Orchard care (pruning & fuel)', b.id);
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
    flow(g, b, ctx, cov) {
      const f = b.farm, A = f.areas, FL = TG.FL; FL.start(b);
      const soilRow = (k) => { const a = A[k]; if (!a.acres) return; FL.row(b, '🟫', `Soil (${M.areaLabel(k)})`, Math.round(a.soil * 100), '%', a.soil >= 0.6 ? 'g' : a.soil >= 0.4 ? 'y' : 'r', `Dropped ${(a.m.soilDrop * 100 || 0).toFixed(1)} points this month. Crops grow x${M.soilYield(a.soil).toFixed(2)}.`); };
      if (A.cows.herd || A.cows.acres) {
        const a = A.cows, m = a.m, fc = M.herdForecast(g, b), HC = TG.CONFIG.cows;
        if (m.born) FL.row(b, '🐮', 'Calves born', m.born, '', 'g', `Bulls + cows. Small herds have more calves per cow; full pasture or hungry cows have fewer.`);
        if (m.milk != null) FL.row(b, '🥛', 'Milk made', m.milk || 0, 't', m.notMilked > 0.5 ? 'y' : 'g', m.notMilked > 0.5 ? `${Math.round(m.notMilked)} cows not milked: need parlor space` : 'Collected every day and sold at your milk price');
        if (m.soldHead) FL.row(b, '🛒', 'Cattle sold (meat)', m.soldHead, 'head', 'g', U.money(m.meatRev || 0));
        if (m.lost > 0.5) FL.row(b, '🗑️', 'Milk spoiled', m.lost, 't', 'r', 'Unsold milk spoils');
        FL.row(b, '💀', 'Cows died', m.died || 0, '', (m.died || 0) > a.herd * 0.02 ? 'r' : 'y', `Health ${U.pct(a.health || 0)}: hungry or crowded cows die more`);
        FL.row(b, '🌿', 'Grass eaten', m.grass || 0, 't', 'g', 'From the cow area. Little grass in winter and dry months.');
        FL.row(b, '🌽', 'Feed eaten from storage', m.feedEaten || 0, 't', m.fed < 0.99 ? 'r' : 'g', m.fed < 0.99 ? `Only ${U.pct(m.fed)} of what they needed!` : `${Math.round(f.feed || 0)} t left in storage`);
        if (f.m.feedIn) FL.row(b, '🛒', 'Feed bought', f.m.feedIn, 't', 'g');
        FL.next(b, '🐮', 'Births expected', fc.births, '', fc.births ? 'g' : '');
        FL.next(b, '🥩', 'Market-ready cattle', fc.ready, 'head', 'g', 'Sell them in the Cows card (or your manager does)');
        FL.next(b, '💀', 'Losses expected', fc.deaths, 'head', 'y');
        FL.next(b, '🌽', 'Feed needed from storage', fc.buy, 't', (f.feed || 0) >= fc.buy ? 'g' : 'r', (f.feed || 0) >= fc.buy ? `You have ${Math.round(f.feed || 0)} t` : `You have only ${Math.round(f.feed || 0)} t: buy feed or cows go hungry`);
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
      v += this.inventoryHerd(g, b);
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
      const ok = TG.CREDIT.apply(g, 'mortgage', cost - down, { collateral: { kind: 'property', id: prop.id }, label: `Land mortgage (${acres} ac)`, bizId: b.id, noCash: true, ltv: (cost - down) / cost, asset: cost }); if (!ok.ok) return ok;
      TG.F.spend(g, down, 'Land purchases', b.id, true);
    } else { if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Land purchases', b.id, true); }
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
    const f = M.farmEnsure(b), a = f.areas[k]; if (k === 'cows') return { ok: false, msg: 'Cows need feed, not spray.' }; if (!a || !a.acres) return { ok: false, msg: 'No acres in that area.' };
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
  M.farmBuySeeds = (g, b, acres) => { M.farmEnsure(b); const n = M.models.farm.buySeeds(g, b, acres, 0); return n > 0 ? { ok: true, acres: n } : { ok: false, msg: M.farmStoreFree(b) < 1 ? 'Storage is full.' : 'Not enough cash.' }; };
  M.farmSellSeeds = (g, b, acres) => { const f = M.farmEnsure(b); acres = Math.min(Math.round(acres), Math.floor(f.seeds || 0)); if (acres <= 0) return { ok: false, msg: 'No seed.' }; const v = Math.round(acres * M.models.farm.seedCost(g, b) * 0.5); f.seeds -= acres; TG.F.earn(g, v, 'Asset sales', b.id, true); return { ok: true, rev: v }; };
  M.farmSetupExtra = (g, prop, entK) => {
    const fd = FD(); let c = 0;
    if (entK === 'orchard' && !prop.orchard) c += fd.enterprises.orchard.establishPerAcre * prop.acres * g.world.priceIdx;
    const share = entK === 'cows' || entK === 'cattle' || entK === 'dairy' ? 1 : entK === 'mixed' ? 0.5 : 0;
    if (share) { const n = Math.round(M.farmHerdCap({ acres: prop.acres * share }) * (fd.herdStart || 0.5)); c += n * TG.W.price(g, 'beef', 0) * 0.85 + n * 0.45 * 2 * M.feedPrice(g); }
    if (entK === 'mixed') c += prop.acres * 0.5 * fd.areas.crops.convCost * g.world.priceIdx * 0.5;
    const cropShare = entK === 'crops' ? 1 : entK === 'mixed' ? 0.5 : 0; c += cropShare * prop.acres * fd.enterprises.crops.seedPerAcre * g.world.priceIdx;
    return c;
  };
})();
