/* equipment.js - machines, vehicles: age, wear, quality tier, break odds, maintenance, repair/replace, leasing, resale. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const E = {};
  E.def = (b, typeId) => TG.CONFIG.businesses[b.type].equip.find((x) => x.id === typeId);
  E.price = (g, b, typeId, tier) => Math.round(E.def(b, typeId).price * TG.CONFIG.equipTiers[tier].price * g.world.priceIdx);

  E.create = (g, b, typeId, tier, opts) => {
    const C = TG.CONFIG, t = C.equipTiers[tier], d = E.def(b, typeId);
    const it = {
      id: U.uid('q'), type: typeId, tier, label: d.label,
      age: tier === 'used' ? R.int(t.age[0], t.age[1]) : 0,
      wear: R.range(t.wear[0], t.wear[1]),
      hidden: tier === 'used' ? R.range(C.equipment.usedHiddenWear[0], C.equipment.usedHiddenWear[1]) : 0,
      broken: null, maint: false, warranty: t.warranty, leased: !!(opts && opts.leased), paid: 0, n: 0,
    };
    it.paid = E.price(g, b, typeId, tier);
    if (it.leased) { it.leasePay = Math.round(it.paid * C.equipment.leaseMonthlyPct); it.maint = true; }
    return it;
  };

  // Buy (or lease) equipment for a business. Returns item or null if cannot afford.
  E.buy = (g, b, typeId, tier, opts) => {
    opts = opts || {};
    const price = E.price(g, b, typeId, tier);
    if (!opts.free && E.count(b, typeId) >= E.maxCount(b, typeId)) return null;
    if (!opts.leased && !opts.free && g.cash < price && !opts.allowDebt) return null;
    const it = E.create(g, b, typeId, tier, opts);
    if (opts.leased) TG.F.spend(g, it.leasePay, 'Equipment lease', b.id, true);
    else if (!opts.free) TG.F.spend(g, price, 'Equipment purchases', b.id, true);
    b.equip.push(it);
    return it;
  };

  E.effWear = (it) => U.clamp(it.wear + (it.hidden || 0), 0, 100);
  E.hasMech = (b) => !!(b.spec && b.spec.mechanic);
  E.mechCoverage = (b) => {
    if (!E.hasMech(b)) return 0;
    const m = b.spec.mechanic; const n = Math.max(1, b.equip.length);
    return U.clamp((TG.CONFIG.equipment.mechanicCovers * (0.6 + m.skill / 125)) / n, 0, 1);
  };

  // monthly break chance for an item; returns {p, factors[]}
  E.breakChance = (g, b, it) => {
    const C = TG.CONFIG, eq = C.equipment, d = E.def(b, it.type), t = C.equipTiers[it.tier];
    const f = eq.breakFormula;
    const ageF = 1 + (it.age / d.life) * f.ageWeight;
    const w = E.effWear(it) / 100;
    const wearF = f.wearBase + f.wearMult * w * w;
    const cov = E.mechCoverage(b);
    const mechF = 1 - (1 - eq.mechanicBreakMult) * cov * (0.6 + (b.spec && b.spec.mechanic ? b.spec.mechanic.skill : 0) / 250);
    const fixF = (b.fixesOn && b.fixesOn.equipBreak && b.fixesOn.equipBreak[it.type]) || 1;
    const paceF = b.pace === 'rush' ? 1.35 : b.pace === 'careful' ? 0.85 : 1;
    let advF = 1;
    if (t.advanced && !E.hasMech(b) && TG.CONFIG.businesses[b.type].tier !== 'small') advF = 1;
    const lineF = (it.type === 'line' && b.fixesOn && b.fixesOn.lineFailMult) || 1;
    const p = U.clamp(d.brk * t.brk * ageF * wearF * mechF * fixF * paceF * advF * lineF * (1 - TG.S.perk(b, 'breakCut')), 0, 0.9);
    const factors = [];
    factors.push(`${(it.age / 12).toFixed(1)} yrs old`);
    factors.push(`${Math.round(E.effWear(it))}% wear`);
    factors.push(`${t.label.toLowerCase()} quality`);
    factors.push(it.maint ? 'on maintenance plan' : 'no maintenance plan');
    if (cov > 0) factors.push('mechanic on staff'); else factors.push('no mechanic');
    if (b.pace === 'rush') factors.push('rushed pace');
    return { p, factors };
  };

  // output multiplier of a working item
  E.out = (it) => (it.broken ? 0 : TG.CONFIG.equipTiers[it.tier].out);

  // capacity of a pool: every item whose pool (default: its own id) matches adds its cap
  E.poolOf = (ed) => ed.pool || ed.id;
  E.capacity = (b, poolId) => U.sum(b.equip, (x) => { const ed = E.def(b, x.type); return ed && E.poolOf(ed) === poolId ? E.out(x) * (ed.cap || 0) : 0; });
  // critical capacity pools of a business: [{pool, primary (first item def), label}]
  E.pools = (b) => { const out = [], seen = {}; for (const ed of TG.CONFIG.businesses[b.type].equip) { if (!ed.critical) continue; const p = E.poolOf(ed); if (seen[p]) continue; seen[p] = 1; out.push({ pool: p, primary: TG.CONFIG.businesses[b.type].equip.find((x) => E.poolOf(x) === p && x.critical) }); } return out; };
  // a boost field (ticketBoost, staffBoost, demandBoost): one working item per type counts
  E.boost = (b, field) => { const seen = {}; let t = 0; for (const it of b.equip) { if (it.broken || seen[it.type]) continue; const ed = E.def(b, it.type); if (ed && ed[field]) { seen[it.type] = 1; t += ed[field]; } } return t; };
  E.sumField = (b, field) => U.sum(b.equip, (x) => { const ed = E.def(b, x.type); return ed && ed[field] && !x.broken ? ed[field] * (field === 'store' || field === 'storeTons' || field === 'storeUnits' || field === 'head' ? 1 : E.out(x)) : 0; });
  E.count = (b, typeId) => b.equip.filter((x) => x.type === typeId && x.broken !== 'destroyed').length;
  // most of an item you can own (seats limited by floor space; boosts are one-per-type but extras act as spares)
  E.maxCount = (b, typeId) => {
    const ed = E.def(b, typeId); if (!ed) return 0;
    if (ed.seat) { const s = TG.CONFIG.businesses[b.type].svc; return Math.max(1, Math.ceil(b.sqft * s.perSpace / ed.cap)); }
    if (ed.perTruck) return Math.max(1, E.count(b, 'truck'));
    if (ed.max) return ed.max;
    if (ed.ticketBoost || ed.staffBoost || ed.demandBoost) return 2;
    return 999;
  };

  E.resale = (g, b, it) => {
    const eq = TG.CONFIG.equipment;
    if (it.leased) return 0;
    const base = E.def(b, it.type).price * TG.CONFIG.equipTiers[it.tier].price * g.world.priceIdx;
    const v = base * eq.resaleBase * Math.exp(-eq.resaleAgeDecay * it.age) * (1 - eq.resaleWearWeight * E.effWear(it) / 100) * (it.broken === 'destroyed' ? 0.05 : it.broken ? 0.5 : 1);
    return Math.max(0, Math.round(v));
  };

  E.repairCost = (g, b, it) => {
    const eq = TG.CONFIG.equipment, d = E.def(b, it.type);
    let c = d.price * g.world.priceIdx * (it.broken === 'major' ? eq.repairPct.major : eq.repairPct.minor);
    if (E.hasMech(b)) c *= eq.mechanicRepairMult;
    if (TG.CONFIG.equipTiers[it.tier].advanced && !E.hasMech(b)) c *= eq.advancedNoMechRepairMult;
    if (d.efficiency) c *= 2;
    return Math.round(c);
  };

  E.repair = (g, b, itId, by) => {
    const it = b.equip.find((x) => x.id === itId); if (!it || !it.broken || it.broken === 'destroyed') return false;
    const cost = it.warranty > 0 || it.leased ? 0 : E.repairCost(g, b, it);
    TG.F.spend(g, cost, 'Repairs', b.id);
    it.broken = null; it.wear = U.clamp(it.wear - 15, 0, 100);
    TG.rep.decision(g, b, by, `Repaired ${it.label}${cost ? ' for ' + U.money(cost) : ' (covered)'}`);
    return true;
  };
  E.service = (g, b, itId) => {
    const it = b.equip.find((x) => x.id === itId); if (!it || it.broken) return false;
    const eq = TG.CONFIG.equipment; const cost = Math.round(E.def(b, it.type).price * eq.serviceCostPct * g.world.priceIdx);
    TG.F.spend(g, cost, 'Maintenance', b.id);
    if (TG.USES.take(it, 'service', g.month) > 1) return 'again'; // one service a month per machine; more just costs money
    it.wear = U.clamp(it.wear - eq.serviceWearCut, 0, 100); it.hidden = Math.max(0, (it.hidden || 0) - 10);
    return true;
  };
  E.inspect = (g, b, itId) => {
    const it = b.equip.find((x) => x.id === itId); if (!it) return;
    TG.F.spend(g, Math.round(E.def(b, it.type).price * TG.CONFIG.equipment.inspectCost * g.world.priceIdx), 'Inspections', b.id);
    it.wear = E.effWear(it); it.hidden = 0; it.inspected = true;
  };
  E.sell = (g, b, itId) => {
    const it = b.equip.find((x) => x.id === itId); if (!it) return 0;
    const v = E.resale(g, b, it);
    b.equip = b.equip.filter((x) => x.id !== itId);
    if (v) TG.F.earn(g, v, 'Asset sales', b.id, true);
    return v;
  };

  // Monthly wear, breakdowns, theft. Returns nothing; pushes events and decisions.
  E.month = (g, b, ctx) => {
    const C = TG.CONFIG, eq = C.equipment;
    const cov = E.mechCoverage(b);
    const wearFix = (b.fixesOn && b.fixesOn.wearMult) || 1;
    for (const it of b.equip.slice()) {
      if (it.broken === 'destroyed') continue;
      it.age++; if (it.warranty > 0) it.warranty--;
      const d = E.def(b, it.type);
      const pu = b.workPool ? b.workPool[E.poolOf(d)] : undefined;
      const use = it.broken ? 0.2 : (pu != null ? TG.WK.wearMult(pu) : ctx.util == null ? 1 : 0.4 + 0.8 * U.clamp(ctx.util, 0, 1.2)) * (b.pace === 'rush' ? 1.3 : b.pace === 'careful' ? 0.85 : 1);
      let wg = eq.wearPerMonth * use * (it.maint ? eq.maintPlanWearMult : 1) * (1 - (1 - eq.mechanicWearMult) * cov) * wearFix * (120 / d.life);
      it.wear = U.clamp(it.wear + wg * R.range(0.6, 1.4) * (1 - TG.S.perk(b, 'wearCut')), 0, 100);
      if (it.maint && !it.leased) TG.F.spend(g, Math.round(d.price * eq.maintPlanCostPct * g.world.priceIdx), 'Maintenance plans', b.id);
      if (it.leased) TG.F.spend(g, it.leasePay, 'Equipment lease', b.id);
      if (it.broken) continue;
      if (d.upkeep) TG.F.spend(g, Math.round(d.upkeep * g.world.priceIdx), 'Equipment upkeep', b.id);
      const bc = E.breakChance(g, b, it);
      it.lastP = bc.p;
      if (bc.p >= eq.warnAt && R.chance(0.6)) ctx.warnings.push({ text: `${it.label} #${E.num(b, it)} is making a strange noise`, why: `${U.pct(bc.p, 0)} monthly break chance: ${bc.factors.join(', ')}`, p: bc.p });
      if (R.chance(bc.p * (ctx.streakMult || 1))) E.breakItem(g, b, it, bc, ctx);
      // theft / vandalism for vehicles and sites without security
      if ((d.id === 'truck' || d.id === 'mower' || d.id === 'trailer' || d.heavy) && R.chance(eq.theftBase * (C.locations[b.loc] ? C.locations[b.loc].crime : 1) * (g.world.crime > 0 ? 2 : 1) * (b.fixes.gps ? 0.3 : 1))) {
        it.broken = 'major';
        TG.rep.event(g, b, 'bad', `${it.label} #${E.num(b, it)} was vandalized`, `Location crime level and ${b.fixes.gps ? 'tracking helped little' : 'no security or tracking'}`);
        E.queueBroken(g, b, it);
      }
    }
  };
  E.num = (b, it) => b.equip.filter((x) => x.type === it.type).indexOf(it) + 1;

  E.breakItem = (g, b, it, bc, ctx) => {
    const C = TG.CONFIG, eq = C.equipment, d = E.def(b, it.type);
    const w = E.effWear(it) / 100;
    const sev = R.weighted({ minor: eq.severity.minor * (1.2 - w), major: eq.severity.major, catastrophic: eq.severity.catastrophic * (0.4 + w * 1.6) });
    const why = `${it.label} #${E.num(b, it)}: ${bc.factors.join(', ')}; ${U.pct(bc.p, 1)} monthly break chance`;
    if (it.inspected === undefined && it.hidden > 5) it.hidden = 0; // problems surface
    if (sev === 'minor') {
      const cost = it.warranty > 0 || it.leased ? 0 : Math.round(E.repairCost(g, b, Object.assign({}, it, { broken: 'minor' })));
      TG.F.spend(g, cost, 'Repairs', b.id);
      ctx.down = U.clamp((ctx.down || 0) + (d.critical ? eq.minorDowntime / Math.max(1, b.equip.filter((x) => x.type === it.type).length) : 0.02), 0, 1);
      TG.rep.event(g, b, 'bad', `${it.label} #${E.num(b, it)} had a minor breakdown (slow day, ${U.money(cost)} fix)`, why);
      it.wear = U.clamp(it.wear + 3, 0, 100);
      return;
    }
    if (sev === 'major') {
      it.broken = 'major';
      if (d.breakRevLoss) TG.F.spend(g, Math.round(ctx.revAvg * d.breakRevLoss), 'Spoiled stock', b.id);
      TG.rep.event(g, b, d.critical || d.harvestCritical ? 'major' : 'bad', `${it.label} #${E.num(b, it)} broke down`, why, d.critical ? { major: 'breakdown' } : null);
      E.queueBroken(g, b, it);
      return;
    }
    it.broken = 'destroyed';
    let loss = 0;
    if (!it.leased) {
      loss = E.resale(g, b, Object.assign({}, it, { broken: null }));
      const cov = TG.F.claim(g, b, 'equipment', loss, `${it.label} destroyed`);
      if (cov) loss -= cov;
    }
    TG.rep.event(g, b, 'major', `${it.label} #${E.num(b, it)} was destroyed in a catastrophic failure`, why, { major: 'breakdown' });
    if (d.injuryOnCat && R.chance(d.injuryOnCat)) TG.B.lawsuit(g, b, `Injury from ${it.label} failure`, Math.max(C.lawsuits.suitMin, ctx.revAvg * R.range(0.5, 2)), 'liability', why);
    E.queueBroken(g, b, it);
  };

  E.queueBroken = (g, b, it) => {
    const d = E.def(b, it.type);
    const destroyed = it.broken === 'destroyed';
    const opts = [];
    if (!destroyed) opts.push({ id: 'repair', label: `Repair (${it.warranty > 0 || it.leased ? 'covered' : U.money(E.repairCost(g, b, it))})` });
    for (const tier of ['used', 'budget', 'standard', 'premium']) opts.push({ id: 'replace_' + tier, label: `Sell it (${U.money(E.resale(g, b, it))}) and buy a ${TG.CONFIG.equipTiers[tier].label.toLowerCase()} one (${U.money(E.price(g, b, it.type, tier))})` });
    opts.push({ id: 'leave', label: destroyed ? 'Scrap it, no replacement' : 'Leave it broken' });
    TG.D.add(g, { kind: 'broken', bizId: b.id, itemId: it.id, title: `${d.label} ${destroyed ? 'destroyed' : 'broken'}`,
      text: `${it.label} #${E.num(b, it)} (${TG.CONFIG.equipTiers[it.tier].label}, ${(it.age / 12).toFixed(1)} yrs, ${Math.round(E.effWear(it))}% wear) is out of action.${d.critical ? ' It is critical: capacity drops until it is fixed.' : ''}`,
      why: `Break chance was ${U.pct(it.lastP || 0, 1)} per month.`, options: opts, def: 'leave' });
  };

  // replace a broken/destroyed item (or add new)
  E.replace = (g, b, itId, tier, by) => {
    const it = b.equip.find((x) => x.id === itId);
    const typeId = it ? it.type : null; if (!typeId) return false;
    const price = E.price(g, b, typeId, tier);
    if (g.cash < price) { TG.rep.decision(g, b, by, `Could not afford a replacement ${it.label} (${U.money(price)})`, 'bad'); return false; }
    const sold = E.resale(g, b, it);
    b.equip = b.equip.filter((x) => x.id !== itId);
    if (sold) TG.F.earn(g, sold, 'Asset sales', b.id, true);
    const n = E.buy(g, b, typeId, tier);
    if (n) n.maint = !!(it.maint);
    TG.rep.decision(g, b, by, `Sold the old ${it.label} for ${U.money(sold)} and bought a ${TG.CONFIG.equipTiers[tier].label.toLowerCase()} one (${U.money(price)})`);
    return true;
  };

  E.avgWear = (b, filter) => { const l = b.equip.filter((x) => !filter || filter(x)); return l.length ? U.avg(l, E.effWear) : 0; };
  E.value = (g, b) => U.sum(b.equip, (x) => E.resale(g, b, x));
  TG.E = E;
})();
