/* business.js - generic business engine: creation, context, odds/risks, fixes, reputation, marketing,
   lawsuits, receivables, fixed costs, monthly orchestration, selling and closing. Models live in models.js. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const B = {};
  B.def = (b) => TG.CONFIG.businesses[b.type];
  B.get = (g, id) => g.businesses.find((x) => x.id === id);

  B.setupCost = (g, type, prop, opts) => {
    const d = TG.CONFIG.businesses[type];
    let c = d.setupCost * g.world.priceIdx;
    if (d.license) c += d.license.fee;
    if (g.world.licenseFees[type]) c += g.world.licenseFees[type];
    if (type === 'franchise' && opts && opts.fromBiz) c *= 0.7;
    if (type === 'farm' && opts) {
      const ent = d.farm.enterprises[opts.ent || 'crops'];
      if (opts.ent === 'orchard' && !prop.orchard) c += ent.establishPerAcre * prop.acres * g.world.priceIdx;
      if (opts.ent === 'cattle') c += Math.round(TG.M.farmHerdCap(prop, ent) * 0.5) * ent.stockCost * g.world.priceIdx;
    }
    return Math.round(c);
  };

  B.start = (g, type, propId, opts) => {
    opts = opts || {};
    const C = TG.CONFIG, d = C.businesses[type];
    const prop = g.properties.find((p) => p.id === propId);
    if (!prop) return { ok: false, msg: 'Pick a property you own or lease.' };
    if (prop.bizId) return { ok: false, msg: 'That property already hosts a business.' };
    if (d.model === 'farm' && !opts.ent) opts.ent = TG.M.bestEnterprise(prop);
    const cost = B.setupCost(g, type, prop, opts);
    if (g.cash < cost) return { ok: false, msg: `Setup costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Business setup', null, true);
    const n = g.businesses.filter((x) => x.type === type).length;
    const b = {
      id: U.uid('b'), type, name: opts.name || (d.name + (n ? ' #' + (n + 1) : '')), propId, region: prop.region, loc: prop.loc,
      labor: prop.labor, traffic: prop.traffic, sqft: prop.sqft, acres: prop.acres, founded: g.month,
      rep: d.startRep != null ? d.startRep : C.reputation.start, staff: [], spec: {}, equip: [], fixes: {}, ins: {},
      ads: { budget: 0, channel: 'social' }, pace: 'normal', ask: null, hits: [], boost: null, recv: [], hist: [],
      m: { rev: 0, cost: 0, lines: {} }, revAvg: 0, outside: 0, closed: 0, licensePending: d.license ? d.license.months : 0,
      qHits: [], bad: [], insHike: 1, lastUtil: 0.8, setup: cost,
    };
    prop.bizId = b.id;
    TG.M.init(g, b, prop, opts);
    g.businesses.push(b);
    if (!g.player.ownerBiz) g.player.ownerBiz = b.id;
    TG.rep.event(g, b, 'info', `Opened ${b.name}`, `Setup cost ${U.money(cost)}${d.license ? `; license takes ${d.license.months} months before opening` : ''}`);
    return { ok: true, biz: b };
  };

  // Minimal equipment + staff to open the doors. Returns the cost list (dry run if !apply).
  B.quickSetup = (g, b, apply, tierPref) => {
    const d = B.def(b); const plan = TG.M.needs(g, b);
    let cost = 0; const steps = [];
    for (const n of plan.equip) {
      const have = b.equip.filter((x) => x.type === n.type && x.broken !== 'destroyed').length;
      for (let i = have; i < n.count; i++) { const tier = tierPref || 'standard'; const pr = TG.E.price(g, b, n.type, tier); cost += pr; steps.push({ kind: 'equip', type: n.type, tier, cost: pr }); }
    }
    for (const n of plan.staff) {
      const have = b.staff.filter((e) => e.role === n.role).length;
      for (let i = have; i < n.count; i++) steps.push({ kind: 'staff', role: n.role });
    }
    if (!apply) return { cost, steps };
    for (const s of steps) {
      if (s.kind === 'equip') { if (g.cash >= s.cost) TG.E.buy(g, b, s.type, s.tier); }
      else { const pool = TG.S.poolFor(g, b, s.role); if (pool.length) { const best = pool.slice().sort((x, y) => (y.skill + y.attitude * 0.5) / y.wage - (x.skill + x.attitude * 0.5) / x.wage)[0]; TG.S.hire(g, b, best); } }
    }
    if (TG.D) TG.D.syncTargets(b);
    for (const t of d.insurance) if (t === 'liability' || t === 'malpractice' || (t === 'property' && g.properties.find((p) => p.id === b.propId && p.owned))) b.ins[t] = true;
    return { cost, steps };
  };

  // aggregate active fix effects
  B.fixAgg = (b) => {
    const d = B.def(b); const o = { equipBreak: {}, demand: 0, morale: 0, cogsAdd: 0, revCostPct: 0, skillGrowth: 1, repTarget: 0 };
    for (const f of d.fixes) {
      if (!b.fixes[f.id]) continue;
      for (const k in f) {
        if (['id', 'label', 'cost', 'monthly', 'reduces', 'note'].indexOf(k) >= 0) continue;
        const v = f[k];
        if (k === 'equipBreak') { for (const t in v) o.equipBreak[t] = (o.equipBreak[t] || 1) * v[t]; }
        else if (k === 'demand' || k === 'morale' || k === 'cogsAdd' || k === 'revCostPct' || k === 'repTarget' || k === 'payrollAdd' || k === 'materialAdd') o[k] = (o[k] || 0) + v;
        else if (k === 'skillGrowth') o.skillGrowth = Math.max(o.skillGrowth, v);
        else o[k] = v;
      }
    }
    b.fixesOn = o; return o;
  };
  B.fixMonthly = (g, b) => {
    const d = B.def(b); let t = 0;
    const units = b.equip.filter((x) => { const ed = TG.E.def(b, x.type); return ed && (ed.critical || ed.cap) && !ed.support; }).length;
    for (const f of d.fixes) if (b.fixes[f.id]) { t += (f.monthly || 0) * g.world.priceIdx; if (f.perUnitMonthly) t += f.perUnitMonthly * Math.max(1, units) * g.world.priceIdx; }
    return Math.round(t);
  };
  B.buyFix = (g, b, fixId) => {
    const f = B.def(b).fixes.find((x) => x.id === fixId); if (!f || b.fixes[fixId]) return { ok: false };
    const cost = Math.round((f.cost || 0) * g.world.priceIdx);
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Upgrades', b.id, true); b.fixes[fixId] = { since: g.month };
    if (fixId === 'bulk') b.fixes[fixId].until = g.month + (f.lockMonths || 24);
    if (fixId === 'research' && b.tech) TG.M.techResearch(g, b);
    B.fixAgg(b);
    return { ok: true };
  };
  B.dropFix = (g, b, fixId) => { delete b.fixes[fixId]; B.fixAgg(b); };

  B.baseRev = (g, b) => TG.M.baseRev(g, b);
  B.space = (b) => (B.def(b).space.unit === 'acres' ? (b.farm ? b.farm.acres : b.acres) : b.sqft);
  B.owner = (g, b) => g.player.ownerBiz === b.id;

  // ---------- context: staff stats & risk modifiers ----------
  B.ctx = (g, b) => {
    const C = TG.CONFIG, d = B.def(b);
    const key = TG.S.keyStaff(b), all = TG.S.allStaff(b);
    const own = B.owner(g, b);
    const avg = (f, def) => (key.length ? U.avg(key, f) : def);
    const ctx = {
      key, all, own, down: 0, warnings: [], revAvg: Math.max(b.revAvg || 0, B.baseRev(g, b) * 0.3, 2000),
      skill: avg((e) => e.skill, own ? 55 : 35), attitude: avg((e) => e.attitude, own ? 65 : 45), reliability: avg((e) => e.reliability, 60),
      honesty: all.length ? U.avg(all, (e) => e.honesty) : 70, temper: avg((e) => e.temper, 30), morale: all.length ? U.avg(all, (e) => e.morale) : 60,
      ambition: avg((e) => e.ambition, 40), busy: b.lastUtil || 0.8, util: b.lastUtil || 0.8,
      weather: TG.W.weatherOf(g, b.region), streakMult: 1,
    };
    const recentBad = (b.bad || []).filter((m) => g.month - m <= C.streak.window).length;
    if (recentBad >= C.streak.threshold) ctx.streakMult = C.streak.mult;
    // quality
    const exp = g.player.exp[b.type] || 0;
    let q = 50 + (ctx.skill - 50) * 0.5 + (ctx.attitude - 50) * 0.25;
    const eqList = b.equip.filter((x) => x.broken !== 'destroyed');
    if (eqList.length) { q += (1 - TG.E.avgWear(b) / 100) * 10 - 5; q += (U.avg(eqList, (x) => C.equipTiers[x.tier].out) - 1) * 25; }
    if (own) q += C.owner.operatedQuality + Math.min(C.owner.expQualityCap, (exp / 12) * C.owner.expQualityPerYear);
    else if (!b.spec.gm) q += C.owner.absentQuality;
    for (const h of b.qHits) q -= h.amt;
    ctx.quality = U.clamp(q, 0, 100);
    return ctx;
  };

  B.mod = (g, b, ctx, key) => {
    const s = b.spec || {}; const w = ctx.weather;
    switch (key) {
      case 'skill': return 1.6 - ctx.skill / 100;
      case 'attitude': return 1.6 - ctx.attitude / 100;
      case 'temper': return 0.6 + ctx.temper / 100;
      case 'honestyLow': return 1.8 - ctx.honesty / 100;
      case 'reliability': return 1.6 - ctx.reliability / 100;
      case 'morale': return 1.7 - ctx.morale / 85;
      case 'ambition': return 0.6 + ctx.ambition / 100;
      case 'busy': return 0.7 + 0.6 * U.clamp(ctx.busy, 0, 1.3);
      case 'noHR': return s.hr ? 0.7 : 1.15;
      case 'noOps': return s.ops ? 0.6 : s.gm ? 0.85 : 1.2;
      case 'noSafety': return s.safety ? 0.45 : 1.2;
      case 'noMech': return s.mechanic ? 0.6 : 1.2;
      case 'noAccountant': return s.accountant ? 0.6 : 1.2;
      case 'noLawyer': return s.lawyer ? 0.6 : 1.1;
      case 'equipWear': return 0.5 + TG.E.avgWear(b) / 60;
      case 'supportWear': {
        const sup = b.equip.filter((x) => TG.E.def(b, x.type) && TG.E.def(b, x.type).support);
        if (!sup.length) return 2.2;
        if (sup.some((x) => x.broken)) return 3;
        const wv = U.avg(sup, TG.E.effWear) / 100; return 0.4 + 2 * Math.pow(wv, 1.5);
      }
      case 'scale': return U.clamp(Math.sqrt(Math.max(1, b.staff.length) / 5), 0.6, 8);
      case 'econ': return { boom: 0.85, slowdown: 1.1, recession: 1.4, recovery: 1 }[g.world.phase];
      case 'weather': return w.sev > 0 ? 0.5 + w.sev * 3 : 0.4;
      case 'drought': return w.kind === 'drought' || w.kind === 'heat' ? 4 : 0.5;
      case 'rush': return b.pace === 'rush' ? 1.6 : b.pace === 'careful' ? 0.7 : 1;
      case 'priceHigh': { const r = TG.PR.ratio(g, b); return r > 1.05 ? Math.min(4, 1 + (r - 1) * 4) : r < 0.95 ? 0.6 : 1; }
      case 'world_shortage': return g.world.shortage[B.def(b).cat] ? 3 : 0.7;
      case 'crime': return (TG.CONFIG.locations[b.loc] || { crime: 1 }).crime * (g.world.crime > 0 ? 2 : 1);
      case 'rep': return b.rep < 30 ? 1.4 : b.rep > 70 ? 0.7 : 1;
      case 'labor': return 1.6 - b.labor;
      case 'emissions': return g.world.emissions > 0 ? 2.5 : 1;
      case 'launched': return b.tech && b.tech.phase === 'live' ? 1 : 0;
      default: return 1;
    }
  };
  const MODWORDS = {
    skill: (c) => `avg skill ${Math.round(c.skill)}`, attitude: (c) => `staff attitude ${Math.round(c.attitude)}`, temper: () => 'hot tempers on staff',
    honestyLow: (c) => `staff honesty`, reliability: (c) => `reliability ${Math.round(c.reliability)}`, morale: (c) => `morale ${Math.round(c.morale)}`,
    ambition: () => 'ambitious staff', busy: (c) => `workload ${U.pct(c.busy)}`, noHR: () => 'HR manager', noOps: () => 'ops manager',
    noSafety: () => 'safety officer', noMech: () => 'mechanic', noAccountant: () => 'accountant', noLawyer: () => 'lawyer',
    equipWear: () => 'equipment wear', supportWear: () => 'support equipment condition', scale: (c, b) => `${b.staff.length} staff`,
    econ: (c, b, g) => `${TG.W.phaseLabel(g).toLowerCase()} economy`, weather: (c) => (c.weather.sev ? TG.CONFIG.weather.kinds[c.weather.kind].label.toLowerCase() : 'mild weather'),
    drought: (c) => (c.weather.kind === 'drought' ? 'drought' : 'normal water'), rush: (c, b) => `${b.pace} pace`, priceHigh: (c, b) => `price ${TG.PR.label(c.priceR || 1)}`,
    world_shortage: () => 'supply shortage', crime: () => 'local crime', rep: (c, b) => `reputation ${Math.round(b.rep)}`, labor: () => 'labor pool', emissions: () => 'emissions rules',
  };
  const NO = { noHR: 1, noOps: 1, noSafety: 1, noMech: 1, noAccountant: 1, noLawyer: 1 };
  B.riskP = (g, b, ctx, r) => {
    const d = B.def(b); let p = r.base; const parts = [];
    for (const k of r.mods || []) {
      const m = B.mod(g, b, ctx, k); p *= m;
      if (MODWORDS[k] && (m > 1.12 || m < 0.88)) {
        const w = MODWORDS[k](ctx, b, g);
        parts.push(NO[k] ? (m > 1 ? 'no ' + w : w + ' helps') : (m > 1 ? w + ' (raises odds)' : w + ' (lowers odds)'));
      }
    }
    for (const f of d.fixes) if (b.fixes[f.id] && f.reduces && f.reduces[r.id]) { p *= f.reduces[r.id]; parts.push('with ' + f.label.toLowerCase()); }
    p *= (TG.CONFIG.difficulty.eventFreq[g.settings.eventFreq] || 1) * ctx.streakMult;
    return { p: U.clamp(p, 0, 0.95), parts };
  };

  B.rollRisks = (g, b, ctx) => {
    const d = B.def(b);
    for (const r of d.risks) {
      if (!r.base) continue;
      if (r.sev.harvestOnly && !(b.farm && TG.M.isHarvest(g, b))) continue;
      const { p, parts } = B.riskP(g, b, ctx, r);
      if (R.chance(p)) B.applyRisk(g, b, ctx, r, p, parts);
    }
  };
  B.applyRisk = (g, b, ctx, r, p, parts, extraWhy) => {
    const C = TG.CONFIG, s = r.sev;
    const why = `${U.pct(p, 1)} chance this month` + (parts && parts.length ? ': ' + parts.join(', ') : '') + (extraWhy ? '. ' + extraWhy : '');
    let loss = 0, txt = r.label; const bits = [];
    if (s.revPct) loss += ctx.revAvg * R.range(s.revPct[0], s.revPct[1]);
    if (s.cash) loss += R.range(s.cash[0], s.cash[1]) * g.world.priceIdx;
    if (loss > 0) {
      loss = Math.round(loss);
      TG.F.spend(g, loss, 'Incidents', b.id); bits.push(`cost ${U.money(loss)}`);
      if (s.ins) TG.F.claim(g, b, s.ins, loss, r.label);
    }
    if (s.rep) { const x = R.range(s.rep[0], s.rep[1]) * (b.rep > 70 ? 0.75 : b.rep < 30 ? 1.25 : 1); b.rep = U.clamp(b.rep - x, 0, 100); bits.push(`reputation -${Math.round(x)}`); B.prCard(g, b, r.label, x); }
    if (s.down) { const x = R.range(s.down[0], s.down[1]); ctx.down = U.clamp(ctx.down + x, 0, 1); bits.push(`${U.pct(x)} of capacity lost`); }
    if (s.demandHit) { const soft = (b.fixesOn && b.fixesOn.hitSoften) || 0; const mult = 1 - (1 - s.demandHit[0]) * (1 - soft); b.hits.push({ mult, months: s.demandHit[1], label: r.label }); bits.push(`demand x${mult.toFixed(2)} for ${s.demandHit[1]} mo`); }
    if (s.quit) {
      const pool = ctx.key.length ? ctx.key : b.staff;
      if (pool.length) { const e = s.quit === 'best' ? pool.slice().sort((x, y) => y.skill - x.skill)[0] : R.pick(pool); TG.S.leave(g, b, e, r.label.toLowerCase()); }
    }
    if (s.quality && !(b.fixesOn && b.fixesOn.qualityShield)) { b.qHits.push({ amt: s.quality[0], months: s.quality[1] }); bits.push(`quality -${s.quality[0]} for ${s.quality[1]} mo`); }
    if (s.delayExtra) { const x = R.int(s.delayExtra[0], s.delayExtra[1]); for (const rv of b.recv) rv.due += x; bits.push(`payments delayed ${x} mo`); }
    if (s.churn && b.tech) { const x = R.range(s.churn[0], s.churn[1]); b.tech.users = Math.round(b.tech.users * (1 - x)); bits.push(`${U.pct(x)} of users left`); }
    if (s.yield && b.farm) { const x = R.range(s.yield[0], s.yield[1]); b.farm.seasonYield *= x; bits.push(`harvest outlook x${x.toFixed(2)}`); }
    let sued = false;
    if (s.suit && (!s.suitChance || R.chance(s.suitChance))) {
      const amt = Math.max(C.lawsuits.suitMin, ctx.revAvg * R.range(s.suit[0], s.suit[1]));
      B.lawsuit(g, b, 'Lawsuit: ' + r.label, amt, s.ins, why); sued = true;
    }
    if (s.injury && !sued && R.chance(s.injury * C.lawsuits.injurySuitChance)) { B.lawsuit(g, b, 'Injury lawsuit: ' + r.label, Math.max(C.lawsuits.suitMin, ctx.revAvg * R.range(0.3, 1.5)), s.ins || 'liability', why); }
    b.bad.push(g.month); if (b.bad.length > 10) b.bad.shift();
    TG.rep.event(g, b, sued || (s.rep && s.rep[1] >= 12) ? 'major' : 'bad', txt + (bits.length ? ` (${bits.join(', ')})` : ''), why, sued ? { major: 'lawsuit' } : null);
  };

  B.prCard = (g, b, label, hit) => {
    if (hit < 6) return;
    const P = TG.CONFIG.reputation.pr;
    const opts = Object.keys(P).map((k) => ({ id: k, label: `${P[k].label} (${P[k].cost != null ? U.money(P[k].cost) : U.money(b.revAvg * P[k].costRev)})` }));
    opts.push({ id: 'none', label: 'Do nothing (reputation recovers slowly)' });
    TG.D.add(g, { kind: 'pr', bizId: b.id, title: `Reputation hit at ${b.name}`, text: `${label}. Reputation is now ${Math.round(b.rep)}/100.`, why: 'Reputation falls fast and recovers slowly; PR can speed it up but can also flop.', options: opts, def: 'none' });
  };
  B.doPR = (g, b, kind, by) => {
    const P = TG.CONFIG.reputation.pr[kind]; if (!P) return;
    const cost = Math.round(P.cost != null ? P.cost * g.world.priceIdx : b.revAvg * P.costRev);
    TG.F.spend(g, cost, 'PR & marketing', b.id);
    if (R.chance(P.fail)) { TG.rep.decision(g, b, by, `${P.label} flopped (${U.money(cost)})`, 'bad'); return; }
    const x = R.range(P.rep[0], P.rep[1]); b.rep = U.clamp(b.rep + x, 0, 100);
    TG.rep.decision(g, b, by, `${P.label}: reputation +${Math.round(x)} (${U.money(cost)})`, 'good');
  };

  // ---------- lawsuits ----------
  B.lawsuit = (g, b, label, amount, insType, why) => {
    const C = TG.CONFIG.lawsuits;
    amount = Math.round(amount);
    const ls = { id: U.uid('s'), bizId: b ? b.id : null, label, amount, ins: insType || null, left: R.int(C.months[0], C.months[1]), status: 'open', why };
    g.lawsuits.push(ls);
    const win = B.winChance(g, b);
    TG.rep.event(g, b, 'major', `${label}: sued for ${U.money(amount)}`, why || 'See risk factors', { major: 'lawsuit' });
    TG.D.add(g, { kind: 'lawsuit', bizId: b ? b.id : null, suitId: ls.id, title: label, text: `Claim of ${U.money(amount)}${insType && b && b.ins[insType] ? ` (your ${TG.CONFIG.finance.insurance[insType].label.toLowerCase()} insurance covers most of a loss)` : ' (not insured)'}. Decide within ${ls.left} months.`,
      why: `Estimated chance to win in court: ${U.pct(win)}. Legal fees about ${U.money(amount * C.fees)}.`,
      options: [{ id: 'settle', label: `Settle (about ${U.money(amount * (C.settleShare[0] + C.settleShare[1]) / 2)})` }, { id: 'fight', label: `Fight it (${U.pct(win)} win odds)` }], def: null, persist: true });
    return ls;
  };
  B.winChance = (g, b) => {
    const C = TG.CONFIG.lawsuits;
    const lawyer = (b && b.spec && b.spec.lawyer) || (b && b.type === 'law' && b.staff.filter((e) => e.role === 'attorney').sort((x, y) => y.skill - x.skill)[0]);
    return U.clamp(C.baseWin + (lawyer ? C.lawyerWinBonus * (0.5 + lawyer.skill / 100) : 0) + (b ? (b.rep - 50) * C.repWin : 0), 0.05, 0.9);
  };
  B.resolveSuit = (g, suitId, how, by) => {
    const C = TG.CONFIG.lawsuits; const ls = g.lawsuits.find((x) => x.id === suitId); if (!ls || ls.status !== 'open') return;
    const b = ls.bizId ? B.get(g, ls.bizId) : null;
    if (how === 'settle') {
      const amt = Math.round(ls.amount * R.range(C.settleShare[0], C.settleShare[1]));
      TG.F.spend(g, amt, 'Legal settlements', b && b.id); if (b) TG.F.claim(g, b, ls.ins, amt, ls.label);
      ls.status = 'settled'; TG.rep.decision(g, b, by, `Settled "${ls.label}" for ${U.money(amt)}`);
      g.lawsuits = g.lawsuits.filter((x) => x !== ls);
    } else {
      const fees = Math.round(ls.amount * C.fees * (b && b.spec && b.spec.lawyer ? 0.4 : 1));
      TG.F.spend(g, fees, 'Legal fees', b && b.id); ls.status = 'fighting'; ls.win = B.winChance(g, b);
      TG.rep.decision(g, b, by, `Chose to fight "${ls.label}" (${U.pct(ls.win)} win odds, fees ${U.money(fees)})`);
    }
  };
  B.monthSuits = (g) => {
    const C = TG.CONFIG.lawsuits;
    for (const ls of g.lawsuits.slice()) {
      ls.left--;
      if (ls.left > 0) continue;
      const b = ls.bizId ? B.get(g, ls.bizId) : null;
      if (ls.status === 'open') {
        const amt = Math.round(ls.amount * C.defaultMult);
        TG.F.spend(g, amt, 'Court judgments', b && b.id); if (b) TG.F.claim(g, b, ls.ins, amt, ls.label);
        TG.rep.event(g, b, 'major', `Default judgment: ${ls.label} (${U.money(amt)})`, 'Nobody responded to the lawsuit in time (no lawyer or CEO to handle it)', { major: 'lawsuit' });
        TG.D.removeFor(g, (d) => d.suitId === ls.id);
      } else if (ls.status === 'fighting') {
        if (R.chance(ls.win)) { TG.rep.event(g, b, 'good', `Won the lawsuit: ${ls.label}`, `${U.pct(ls.win)} odds`); if (b) b.rep = U.clamp(b.rep + 2, 0, 100); }
        else { TG.F.spend(g, ls.amount, 'Court judgments', b && b.id); if (b) { TG.F.claim(g, b, ls.ins, ls.amount, ls.label); b.rep = U.clamp(b.rep - 4, 0, 100); } TG.rep.event(g, b, 'major', `Lost the lawsuit: ${ls.label} (${U.money(ls.amount)})`, `Had ${U.pct(ls.win)} odds to win`, { major: 'lawsuit' }); }
      }
      g.lawsuits = g.lawsuits.filter((x) => x !== ls);
    }
  };

  // ---------- receivables ----------
  B.addRecv = (g, b, amt, delay, label) => { if (amt > 0) b.recv.push({ amt: Math.round(amt), due: g.month + delay, label: label || 'Invoices' }); };
  B.collect = (g, b) => {
    const d = B.def(b); const bad = ((d.receivable && d.receivable.badDebt) || 0) * ((b.fixesOn && b.fixesOn.badDebtMult) || 1);
    const keep = [];
    for (const r of b.recv) {
      if (r.due > g.month) { keep.push(r); continue; }
      if (R.chance(bad)) { TG.rep.event(g, b, 'bad', `A client never paid ${U.money(r.amt)}`, `${U.pct(bad, 0)} chance per invoice of bad debt`); continue; }
      TG.F.earn(g, r.amt, 'Revenue', b.id);
    }
    b.recv = keep;
  };

  // ---------- marketing ----------
  B.adBoost = (g, b) => {
    const C = TG.CONFIG.reputation; const a = b.ads; if (!a || !(a.budget > 0)) return { boost: 0 };
    const ch = C.adChannels[a.channel] || C.adChannels.social;
    const mgr = b.spec && b.spec.ads;
    let eff = (a.budget / ch.costPer) * ch.eff * (mgr ? 1 + mgr.skill / 150 : 1);
    const ref = Math.max(500, B.baseRev(g, b) * C.adBoostScale);
    let boost = C.adMaxBoost * (1 - Math.exp(-eff / ref));
    if (b.rep < 30) boost /= C.lowRepAdPenalty;
    const flop = R.chance(ch.flop * (mgr ? 0.5 : 1));
    if (flop) boost *= 0.15;
    return { boost, flop };
  };

  // ---------- fixed costs ----------
  B.fixedCosts = (g, b, ctx) => {
    const C = TG.CONFIG, d = B.def(b);
    const payroll = TG.S.payroll(b) * (1 + ((b.fixesOn && b.fixesOn.payrollAdd) || 0));
    if (g.cash < payroll && g.cash - payroll < -(TG.F.locLimit(g) - g.loc.balance)) ctx.missedPayroll = true;
    TG.F.spend(g, Math.round(payroll), 'Wages', b.id);
    TG.F.spend(g, Math.round(payroll * C.staff.payrollTax), 'Payroll tax', b.id);
    const prop = g.properties.find((p) => p.id === b.propId);
    if (prop) {
      b.propValue = prop.owned ? TG.P.value(g, prop) : 0;
      if (prop.leased) TG.F.spend(g, prop.rent, 'Rent', b.id);
      else TG.F.spend(g, TG.P.monthlyTax(g, prop), 'Property tax', b.id);
      const upkeep = Math.round(b.propValue * 0.0006 * (1.6 - prop.cond));
      if (upkeep) TG.F.spend(g, upkeep, 'Building upkeep', b.id);
    }
    const util = Math.round((d.svc ? d.svc.utilPerSpace : d.space.unit === 'acres' ? 1.5 : 0.3) * Math.min(B.space(b), d.space.ideal * 4) * g.world.priceIdx);
    TG.F.spend(g, util, 'Utilities', b.id);
    let ins = 0; for (const t in b.ins) if (b.ins[t]) ins += TG.F.premium(g, b, t);
    TG.F.spend(g, ins, 'Insurance', b.id);
    b.insHike = Math.max(1, (b.insHike || 1) - C.finance.insHikeDecay);
    TG.F.spend(g, B.fixMonthly(g, b), 'Risk reducers & upgrades', b.id);
    if (b.ads && b.ads.budget > 0) TG.F.spend(g, Math.round(b.ads.budget), 'Advertising', b.id);
    const n = TG.S.allStaff(b).length;
    if (n > C.staff.overheadPerStaffAbove) TG.F.spend(g, Math.round((n - C.staff.overheadPerStaffAbove) * C.staff.overheadPerStaff * g.world.priceIdx), 'Bureaucracy & compliance', b.id);
  };

  // ---------- reputation ----------
  B.repMonth = (g, b, ctx) => {
    const C = TG.CONFIG.reputation, d = B.def(b);
    let target = ctx.quality + (TG.PR.hasPrice(b) && TG.PR.good(b) && TG.PR.good(b).kind === 'service' ? TG.PR.fair(TG.PR.ratio(g, b)) : 0) + ((b.fixesOn && b.fixesOn.repTarget) || 0);
    if (ctx.util > 1.0) target -= 5; // turning customers away
    target = U.clamp(target, 0, 100);
    const rate = (d.svc && d.svc.repRate) || C.upRate;
    if (target > b.rep) b.rep = Math.min(target, b.rep + Math.min(rate, (target - b.rep) * 0.12));
    else b.rep = Math.max(target, b.rep - (b.rep - target) * 0.08);
    b.rep = U.clamp(b.rep + R.normal(0, 0.4), 0, 100);
    if (R.chance(C.viralBad * (b.rep < 40 ? 2 : 1))) { const x = R.range(6, 14); b.rep = U.clamp(b.rep - x, 0, 100); TG.rep.event(g, b, 'bad', `A bad review went viral (reputation -${Math.round(x)})`, `Rare event; ${b.rep < 40 ? 'weak reputation makes it more likely' : 'bad luck'}`); }
  };
  B.goodEvents = (g, b, ctx) => {
    const C = TG.CONFIG, d = B.def(b);
    for (const id of d.goodEvents || []) {
      const ev = C.goodEvents[id]; if (!ev) continue;
      if (id === 'bumper') continue;
      if (!R.chance(ev.p * (0.6 + b.rep / 100))) continue;
      const bits = [];
      if (ev.rep) { const x = R.range(ev.rep[0], ev.rep[1]); b.rep = U.clamp(b.rep + x, 0, 100); bits.push(`reputation +${Math.round(x)}`); }
      if (ev.boost) { const x = R.range(ev.boost[0], ev.boost[1]); b.boost = { mult: x, months: 1 }; bits.push(`demand x${x.toFixed(2)} next month`); }
      if (ev.cashRev) { const x = Math.round(ctx.revAvg * R.range(ev.cashRev[0], ev.cashRev[1])); TG.F.earn(g, x, 'Lucky breaks', b.id); bits.push(`+${U.money(x)}`); }
      TG.rep.event(g, b, 'good', ev.label + (bits.length ? ` (${bits.join(', ')})` : ''), `Lucky break (${U.pct(ev.p, 1)} base chance, higher with good reputation)`);
    }
  };

  // demand multiplier shared by models
  B.demandMult = (g, b, ctx, opts) => {
    const d = B.def(b); opts = opts || {};
    const moy = U.moy(g.month);
    let season = d.season[moy];
    const fo = b.fixesOn || {};
    if (fo.seasonDamp) season = 1 + (season - 1) * (1 - fo.seasonDamp);
    if (fo.seasonFloor) season = Math.max(season, fo.seasonFloor);
    let m = season * TG.W.econMult(g, d.econSens) * (g.world.trends[d.cat] || 1) * TG.CONFIG.regions[b.region].demand;
    for (const h of b.hits) m *= h.mult;
    if (b.boost) m *= b.boost.mult;
    const ad = opts.noAds ? { boost: 0 } : B.adBoost(g, b); if (!opts.noAds) { ctx.adFlop = ad.flop; ctx.adBoost = ad.boost; }
    m *= 1 + ad.boost + (fo.demand || 0);
    m *= 1 - (d.weatherSens || 0) * ctx.weather.sev * 0.35;
    m *= 1 + TG.E.boost(b, 'demandBoost');
    return m;
  };

  // ---------- monthly orchestration ----------
  B.month = (g, b) => {
    b.m = { rev: 0, cost: 0, lines: {} };
    B.fixAgg(b);
    const ctx = B.ctx(g, b);
    // license pending (clinic): costs run, no revenue
    if (b.licensePending > 0) {
      b.licensePending--;
      TG.E.month(g, b, ctx); TG.S.month(g, b, ctx); B.fixedCosts(g, b, ctx);
      if (b.licensePending === 0) TG.rep.event(g, b, 'good', `${b.name} received its license and opened`, 'Licensing period complete');
      B.endMonth(g, b, ctx); return ctx;
    }
    if (B.owner(g, b)) g.player.exp[b.type] = (g.player.exp[b.type] || 0) + 1;
    TG.E.month(g, b, ctx);
    B.rollRisks(g, b, ctx);
    TG.M.month(g, b, ctx);
    B.fixedCosts(g, b, ctx);
    TG.S.month(g, b, ctx);
    B.repMonth(g, b, ctx);
    B.goodEvents(g, b, ctx);
    if (ctx.adFlop) TG.rep.event(g, b, 'bad', 'Ad campaign flopped this month', `${TG.CONFIG.reputation.adChannels[b.ads.channel].label} campaigns flop ${U.pct(TG.CONFIG.reputation.adChannels[b.ads.channel].flop)} of the time${b.spec.ads ? '' : '; no ads manager'}`);
    B.endMonth(g, b, ctx);
    return ctx;
  };
  B.endMonth = (g, b, ctx) => {
    B.collect(g, b);
    TG.FL.commit(g, b);
    b.hits = b.hits.filter((h) => --h.months > 0);
    if (b.boost && --b.boost.months <= 0) b.boost = null;
    b.qHits = b.qHits.filter((h) => --h.months > 0);
    b.lastUtil = ctx.util == null ? b.lastUtil : ctx.util;
    const profit = b.m.rev - b.m.cost;
    // investor dividends
    if (b.outside > 0 && profit > 0) { const div = Math.round(profit * b.outside); TG.F.spend(g, div, 'Investor dividends', b.id); }
    const pr = b.m.rev - b.m.cost;
    b.hist.push({ m: g.month, rev: Math.round(b.m.rev), cost: Math.round(b.m.cost), profit: Math.round(pr), rep: Math.round(b.rep), util: ctx.util || 0, lines: b.m.lines });
    if (b.hist.length > TG.CONFIG.maxHistory) b.hist.shift();
    const last3 = b.hist.slice(-3);
    b.revAvg = U.avg(last3, (x) => x.rev);
    b.lastCtx = { quality: Math.round(ctx.quality), skill: Math.round(ctx.skill), morale: Math.round(ctx.morale), cap: ctx.cap, served: ctx.served, demand: ctx.demand, down: ctx.down, adBoost: ctx.adBoost || 0, note: ctx.note || '', limit: ctx.limit || null, limitEquip: ctx.limitEquip || null, links: ctx.links || null, limitNow: ctx.limitNow || null, priceR: ctx.priceR || 1 };
    for (const w of ctx.warnings) TG.rep.warn(g, b, w.text, w.why, w.p);
    // takeover by investors
    const C = TG.CONFIG.finance;
    if (b.outside > C.takeoverOutside) {
      const p12 = U.sum(b.hist.slice(-12), (x) => x.profit);
      const red = b.fixes.terms ? 0.3 : 1;
      if (p12 < 0 && R.chance(C.takeoverChance * red * (b.type === 'tech' ? 1.5 : 1))) {
        const payout = Math.round(TG.F.bizValue(g, b) * (1 - b.outside) * 0.5);
        TG.rep.event(g, b, 'major', `Investors took control of ${b.name} and pushed you out`, `Outside owners hold ${U.pct(b.outside)} and the last 12 months lost money. You were bought out for ${U.money(payout)}.`, { major: 'keyQuit' });
        B.close(g, b, 'investor takeover', false, true);
        TG.F.earn(g, payout, 'Buy-out payment', null, true);
      }
    }
  };

  B.topRisks = (g, b) => {
    const d = B.def(b); const ctx = B.ctx(g, b); const out = [];
    for (const r of d.risks) { if (!r.base) continue; const { p, parts } = B.riskP(g, b, ctx, r); out.push({ label: r.label, p, why: parts.join(', ') }); }
    for (const it of b.equip) if (!it.broken) { const bc = TG.E.breakChance(g, b, it); out.push({ label: `${it.label} #${TG.E.num(b, it)} breaks down`, p: bc.p, why: bc.factors.join(', ') }); }
    for (const x of TG.M.extraRisks(g, b, ctx)) out.push(x);
    return out.sort((a, c) => c.p - a.p);
  };

  B.inventoryValue = (g, b) => TG.M.inventoryValue(g, b);

  B.close = (g, b, why, forced, keepProp) => {
    const fs = forced ? TG.CONFIG.finance.bankruptcy.fireSale : 1;
    for (const it of b.equip) { const v = Math.round(TG.E.resale(g, b, it) * fs); if (v && !forced) TG.F.earn(g, v, 'Asset sales', null, true); else if (v && forced) TG.F.earn(g, v, 'Fire-sale proceeds', null, true); }
    b.equip = [];
    const prop = g.properties.find((p) => p.id === b.propId); if (prop) prop.bizId = null;
    g.businesses = g.businesses.filter((x) => x !== b);
    g.decisions = g.decisions.filter((d) => d.bizId !== b.id);
    if (g.player.ownerBiz === b.id) g.player.ownerBiz = null;
    for (const ls of g.lawsuits) if (ls.bizId === b.id) ls.bizId = null;
    TG.rep.event(g, null, forced ? 'major' : 'info', `${b.name} closed`, why);
  };
  // Sell a business (with its property if owned). mult < 1 for fire sales.
  B.saleValue = (g, b) => {
    const prop = g.properties.find((p) => p.id === b.propId);
    return Math.round(TG.F.bizValue(g, b) * (1 - (b.outside || 0)) + (prop && prop.owned ? TG.P.value(g, prop) * (1 - TG.CONFIG.property.sellCostPct) : 0));
  };
  B.sell = (g, bizId, mult, forced) => {
    const b = B.get(g, bizId); if (!b) return 0;
    const prop = g.properties.find((p) => p.id === b.propId);
    const v = Math.round(B.saleValue(g, b) * (mult || 1));
    b.equip = [];
    B.close(g, b, forced ? 'sold in a forced liquidation' : `sold for ${U.money(v)}`, false);
    TG.F.earn(g, v, forced ? 'Fire-sale proceeds' : 'Business sales', null, true);
    if (prop) { if (prop.mortgageId) TG.F.payoff(g, prop.mortgageId); g.properties = g.properties.filter((p) => p !== prop); }
    return v;
  };
  TG.B = B;
})();
