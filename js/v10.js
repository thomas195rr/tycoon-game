/* v10.js - v10 game rules (loaded after engine.js):
   - upgrades: more of them, new effect keys (staffMult, capMult, supplyCut, salesUp, costCut) and a payback estimate for each
   - sales that vary: a drifting "buzz" plus a month-to-month wobble, with the reason shown
   - ads: the measured effect each month (extra customers / orders / users) for every business that can advertise
   - machines: no maintenance plans (the mechanic keeps things running), machine insurance on replacement cost,
     a destroyed machine is replaced by the GM / Ops manager (best judgement, or like-for-like if you order it)
   - GM vs Ops manager: different jobs and perks
   - bonuses build loyalty; casino without a table limit; struggling-business takeovers for every type; play time across games */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U; const B = TG.B, F = TG.F, E = TG.E, S = TG.S, C = TG.CONFIG;
  const V = (TG.V10 = {});

  // ================= UPGRADE EFFECTS =================
  const ADD = ['demand', 'morale', 'cogsAdd', 'revCostPct', 'repTarget', 'payrollAdd', 'materialAdd', 'staffMult', 'capMult', 'supplyCut', 'salesUp', 'fuelCut', 'churnCut'];
  const MUL = ['ticketMult', 'loadMult', 'appMult', 'badDebtMult', 'wearMult', 'organicMult', 'packerMult'];
  const MAX = ['skillGrowth', 'seasonFloor', 'seasonDamp', 'hitSoften'];
  const COMB = ['driftCut', 'scandalCut', 'cannibalCut', 'unitCostCut', 'otaCut', 'workerCut'];
  const SKIP = ['id', 'label', 'cost', 'monthly', 'reduces', 'note', 'ic', 'raw', 'v10', 'perUnitMonthly', 'lockMonths', 'minVolume'];
  B.fixAgg = (b, extra) => {
    const d = B.def(b); const o = { equipBreak: {}, demand: 0, morale: 0, cogsAdd: 0, revCostPct: 0, skillGrowth: 1, repTarget: 0, costCut: {} };
    const list = d.fixes.filter((f) => b.fixes[f.id] || (extra && extra === f.id));
    for (const f of list) for (const k in f) {
      if (SKIP.includes(k)) continue; const v = f[k];
      if (k === 'equipBreak') { for (const t in v) o.equipBreak[t] = (o.equipBreak[t] || 1) * v[t]; }
      else if (k === 'costCut') { for (const l in v) o.costCut[l] = 1 - (1 - (o.costCut[l] || 0)) * (1 - v[l]); }
      else if (ADD.includes(k)) o[k] = (o[k] || 0) + v;
      else if (MUL.includes(k)) o[k] = (o[k] || 1) * v;
      else if (MAX.includes(k)) o[k] = Math.max(o[k] || 0, v);
      else if (COMB.includes(k)) o[k] = 1 - (1 - (o[k] || 0)) * (1 - v);
      else o[k] = v;
    }
    if (!extra) b.fixesOn = o;
    return o;
  };
  const fo = (b) => (b && b.fixesOn) || {};
  // every sale of a business gets salesUp (upgrades + a GM's sales perk); money lines in costCut get cheaper
  const NOT_SALES = ['Insurance payouts', 'Lucky breaks', 'Clearance sales', 'Asset sales', 'Fire-sale proceeds', 'Refinance cash-out', 'Buy-out payment', 'Investor funding', 'Cattle sales', 'Herd sales', 'Land sales'];
  V.salesUp = (b) => (fo(b).salesUp || 0) + S.perk(b, 'salesUp');
  const earn0 = F.earn, spend0 = F.spend;
  const bizOf = (g, id) => (id && g.businesses ? g.businesses.find((x) => x.id === id) : null);
  F.earn = (g, amt, label, bizId, capital) => {
    if (bizId && !capital && amt > 0 && !NOT_SALES.includes(label)) { const b = bizOf(g, bizId); const up = b ? V.salesUp(b) : 0; if (up) amt = amt * (1 + up); }
    return earn0(g, amt, label, bizId, capital);
  };
  F.spend = (g, amt, label, bizId, capital) => {
    if (bizId && amt > 0) { const b = bizOf(g, bizId); const cc = b && fo(b).costCut; if (cc && cc[label]) amt = amt * (1 - cc[label]); }
    return spend0(g, amt, label, bizId, capital);
  };
  const unit0 = TG.ST.unitCost;
  TG.ST.unitCost = (g, b) => unit0(g, b) * (1 - (fo(b).supplyCut || 0));
  const boost0 = E.boost;
  E.boost = (b, field) => boost0(b, field) + (field === 'staffBoost' ? (fo(b).staffMult || 0) + S.perk(b, 'staffMult') : 0);
  const cap0 = E.capacity;
  E.capacity = (b, pool) => cap0(b, pool) * (1 + (fo(b).capMult || 0));

  // ================= MANAGER PERKS: GM = people & sales, Ops = machines & running things =================
  C.perks.gm = [[0, 'demand', 0.02, '+2% customers (sales & service boss)'], [40, 'morale', 2, '+2 morale for everyone'], [60, 'salesUp', 0.02, '+2% on every sale (upselling)'], [80, 'demand', 0.03, 'another +3% customers']];
  C.perks.ops = [[0, 'breakCut', 0.1, '-10% breakdown odds'], [40, 'supplyCut', 0.03, '-3% supply costs (better orders)'], [60, 'wearCut', 0.1, '-10% machine wear'], [80, 'staffMult', 0.03, '+3% work done (smoother shifts)']];
  C.specialists.gm.desc = 'The people & sales boss: hires and keeps staff (raises, poach offers), runs PR and bids, and brings in customers. Orders supplies and replaces destroyed machines if there is no Ops manager. Works on the job at 25% of a worker.';
  C.specialists.ops.desc = 'The machines & running-things boss: orders supplies, buys machines when you are full, replaces destroyed ones, fewer breakdowns, cheaper supplies, more work done. Does NOT hire people. Works on the job at 25% of a worker.';
  // ================= BONUSES BUILD LOYALTY =================
  V.bonusLoyalty = (e) => Math.max(C.v10.bonusLoyaltyMin, Math.round(C.v10.bonusLoyalty * (1 - (e.loyalty || 0) / 100)));
  S.bonusPreview = (g, b, e) => { const add = V.bonusLoyalty(e); const now = S.poachOdds(g, b, e, true); const after = S.poachOdds(g, b, Object.assign({}, e, { loyalty: Math.min(100, e.loyalty + add), morale: Math.min(100, e.morale + C.staff.bonusMorale) }), true); return { cost: Math.round(e.wage * 0.5), add, from: Math.round(e.loyalty), to: Math.min(100, Math.round(e.loyalty + add)), pFrom: now.p, pTo: after.p }; };
  S.bonus = (g, b, empId) => {
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return;
    F.spend(g, Math.round(e.wage * 0.5), 'Bonuses', b.id); if (S.spam(g, e, 'bonus')) return { spam: true };
    const add = V.bonusLoyalty(e); const from = e.loyalty;
    e.morale = U.clamp(e.morale + C.staff.bonusMorale, 0, 100); e.loyalty = U.clamp(e.loyalty + add, 0, 100);
    return { loyalty: [Math.round(from), Math.round(e.loyalty)] };
  };

  // ================= CASINO: no table limit, same odds =================
  TG.I.betLimit = () => Infinity;
  TG.I.canBet = (g, amt) => {
    const c = g.invest.casino;
    if (!g.settings.gambling) return 'Gambling is turned off in settings.';
    if (c.banned) return 'The casino has banned you for winning too much.';
    if (!(amt >= C.casino.minBet)) return `Minimum bet ${U.money(C.casino.minBet)}.`;
    if (amt > g.cash) return 'Not enough cash.';
    return null;
  };

  // ================= MACHINE INSURANCE (pays a new machine's price on a total loss) =================
  V.machineNew = (g, b) => U.sum(b.equip.filter((x) => x.broken !== 'destroyed' && !x.leased), (x) => E.price(g, b, x.type, x.tier === 'used' ? 'budget' : x.tier));
  const prem0 = F.premium;
  F.premium = (g, b, type) => {
    if (type !== 'equipment') return prem0(g, b, type);
    const M = C.v10.machineIns; return Math.round(Math.max(M.min * g.world.priceIdx, V.machineNew(g, b) * M.pct) * (b.insHike || 1));
  };
  // chance a month that one of your machines is totally destroyed, and what that costs on average (shown before you buy)
  V.machineRisk = (g, b) => {
    let p = 0, cost = 0; const sev = C.equipment.severity;
    for (const it of b.equip) { if (it.broken || it.leased) continue; const bc = E.breakChance(g, b, it); const w = E.effWear(it) / 100; const tot = sev.minor * (1.2 - w) + sev.major + sev.catastrophic * (0.4 + w * 1.6); const pc = bc.p * sev.catastrophic * (0.4 + w * 1.6) / tot; p += pc; cost += pc * E.price(g, b, it.type, it.tier === 'used' ? 'budget' : it.tier); }
    return { p, exp: cost };
  };

  // ================= DESTROYED MACHINES: the GM / Ops manager replaces them =================
  const choose0 = TG.D.choose;
  TG.D.choose = (g, dec, h) => {
    if (dec.kind === 'broken') {
      const b = TG.B.get(g, dec.bizId); const it = b && b.equip.find((x) => x.id === dec.itemId);
      if (it && it.broken === 'destroyed' && b.orders && b.orders.replaceLike) return { opt: 'replace_' + it.tier, why: 'your order: replace like-for-like', outcome: 'good' };
    }
    return choose0(g, dec, h);
  };

  // ================= SALES THAT VARY =================
  const BZ = () => C.v10.buzz;
  V.buzzWhy = (b, x) => { const d = B.def(b); const up = ['word of mouth is good', 'a local event brought people', 'a busy stretch nearby', 'a trend in your favour', 'a good review got shared']; const dn = ['a quiet stretch in town', 'road works nearby', 'a rival ran a big sale', 'people are spending less this month', 'bad weather days']; const L = x >= 0 ? up : dn; return L[Math.abs(Math.round(x * 997 + (d.name || '').length)) % L.length]; };
  const dm0 = B.demandMult;
  B.demandMult = (g, b, ctx, opts) => {
    let m = dm0(g, b, ctx, opts);
    const swing = (1 + (b.buzz || 0)) * (1 + (b.wob || 0)); m *= swing; ctx.swing = swing;
    return m;
  };
  const month0 = B.month;
  B.month = (g, b) => {
    if (!g._pv) { const Z = BZ(); b.buzz = U.clamp((b.buzz || 0) * Z.keep + R.normal(0, Z.sd), -Z.max, Z.max); b.wob = U.clamp(R.normal(0, Z.noise), -0.12, 0.12); }
    else b.wob = 0; // the preview shows the expected month: today's buzz, no surprise wobble
    return month0(g, b);
  };
  // ================= ADS: what they really did this month =================
  V.adModel = (b) => { const m = B.def(b).model; return m === 'farm' || m === 'factory' ? null : m; };
  B.projAdOffers = (g, b) => { const a = b.ads.budget; return Math.min(4, Math.floor(R.range(0, 1) + 3 * (1 - Math.exp(-a / (12000 * g.world.priceIdx))))); };
  const end0 = B.endMonth;
  B.endMonth = (g, b, ctx) => {
    try {
      const sw = ctx.swing; if (sw && Math.abs(sw - 1) >= 0.03 && TG.FL && !g._pvNoFl) TG.FL.row(b, sw > 1 ? '📈' : '📉', sw > 1 ? 'Busy month' : 'Slow month', Math.round((sw - 1) * 100), '%', sw > 1 ? 'g' : 'y', V.buzzWhy(b, (b.buzz || 0) + (b.wob || 0)));
      const spent = (b.ads && b.ads.budget) || 0; let st = null;
      if (spent > 0 && V.adModel(b)) {
        const mdl = B.def(b).model;
        if ((mdl === 'service' || mdl === 'freight') && ctx.adBoost != null) {
          const f0 = fo(b).demand || 0; const dNo = (ctx.demand || 0) * (1 + f0) / (1 + (ctx.adBoost || 0) + f0);
          const extra = Math.max(0, (ctx.served || 0) - Math.min(ctx.served || 0, dNo)); const tk = (ctx.served || 0) > 0 ? b.m.rev / ctx.served : 0;
          st = { extra, unit: mdl === 'freight' ? 'loads' : (B.def(b).custWord || 'customers'), boost: ctx.adBoost || 0, extraRev: extra * tk, full: (ctx.demand || 0) > (ctx.cap || 0) * 1.02 && dNo >= (ctx.cap || 0), flop: !!ctx.adFlop };
        } else if (ctx.adStat) {
          const a = ctx.adStat; const extra = a.extraOrders != null ? a.extraOrders : a.extra; st = { extra, unit: a.unit, boost: a.share || 0, extraRev: mdl === 'brand' && a.share ? b.m.rev * a.share : null, flop: !!a.flop };
        } else if (mdl === 'projects') st = { extra: (b.proj && b.proj.adOffers) || 0, unit: 'extra bid invitations', boost: 0, extraRev: null };
        if (st) { st.spent = spent; st.m = g.month; if (!g._pv) { b.adHist = (b.adHist || []).concat([st]).slice(-6); } b.adLast = st; }
      } else if (!g._pv) b.adLast = null;
    } catch (e) { /* never block the month */ }
    return end0(g, b, ctx);
  };
  // what a budget would do, shown BEFORE you save it (service & freight: extra customers at today's demand)
  V.adPreview = (g, b, budget, channel) => {
    const a0 = b.ads; b.ads = { budget, channel: channel || (a0 && a0.channel) || 'social' };
    const r0 = g.rngState; let boost = 0; try { boost = B.adBoost(g, b).boost; } finally { g.rngState = r0; b.ads = a0; }
    const ch = C.reputation.adChannels[channel || 'social'] || C.reputation.adChannels.social;
    const lc = b.lastCtx || {}; const dem = lc.demand || 0, cap = lc.cap || 0, cur = lc.adBoost || 0;
    const base = dem / (1 + cur); const want = base * (1 + boost * (1 - ch.flop * 0.85)); const served = Math.min(want, cap); const served0 = Math.min(base, cap);
    const tk = lc.served > 0 && b.hist.length ? b.hist[b.hist.length - 1].rev / lc.served : 0;
    return { boost, expBoost: boost * (1 - ch.flop * 0.85), extra: Math.max(0, served - served0), extraRev: Math.max(0, served - served0) * tk, full: want > cap * 1.02 };
  };

  // ================= UPGRADE PAYBACK =================
  // Money: runs next month twice on a throw-away copy (with and without the upgrade, same luck) and compares the profit.
  // Risks: the odds it cuts x what that kind of trouble usually costs. Shown on every upgrade card before you buy.
  V.riskCost = (g, b, r) => {
    const s = r.sev || {}; const rev = Math.max(b.revAvg || 0, 1000); const gm = rev * 0.45; const avg = (a) => (a ? (a[0] + a[1]) / 2 : 0);
    let c = rev * avg(s.revPct) + avg(s.cash) * g.world.priceIdx + gm * avg(s.down) + avg(s.rep) * gm * 0.06;
    if (s.demandHit) c += (1 - s.demandHit[0]) * s.demandHit[1] * gm * 0.6;
    if (s.suit) c += rev * avg(s.suit) * (s.suitChance || 1) * 0.5;
    if (s.quit) c += 2500 * g.world.priceIdx;
    if (s.quality) c += gm * 0.05 * s.quality[1];
    return c;
  };
  const GAIN = new Map();
  V.supLabel = (b) => { const sd = TG.ST.def(b); return (sd && sd.costLabel) || 'Supplies & cost of sales'; };
  V.fixGain = (g, b, fixId) => {
    const sig = [b.id, g.month, Object.keys(b.fixes).sort().join(','), b.staff.length, b.equip.length, Math.round(b.rep / 5), (b.ads && b.ads.budget) || 0].join('|');
    let cache = GAIN.get(b.id); if (!cache || cache.sig !== sig) { cache = { sig, v: {} }; GAIN.set(b.id, cache); }
    if (cache.v[fixId]) return cache.v[fixId];
    const d = B.def(b); const f = d.fixes.find((x) => x.id === fixId); if (!f) return null;
    const on = !!b.fixes[fixId]; const G0 = TG.G; let money = null; const SUP = V.supLabel(b); const MONTHS = 3, SEEDS = [0, 7919];
    try {
      const base = JSON.stringify(g);
      const run = (withFix, seed) => {
        const g2 = JSON.parse(base); g2._pv = true; g2._pvNoFl = true; g2.rngState = ((g2.rngState || 1) + seed) >>> 0 || 1; const b2 = g2.businesses.find((x) => x.id === b.id);
        if (withFix) b2.fixes[fixId] = { since: g.month }; else delete b2.fixes[fixId]; TG.G = g2; let t = 0;
        for (let k = 0; k < MONTHS; k++) { B.month(g2, b2); const h = b2.hist[b2.hist.length - 1]; if (h) t += h.profit - (f.supplyCut && h.lines ? h.lines[SUP] || 0 : 0); g2.month++; }
        return t / MONTHS;
      };
      money = 0; for (const sd of SEEDS) money += (run(true, sd) - run(false, sd)) / SEEDS.length;
    } catch (e) { money = null; } finally { TG.G = G0; }
    // supplies bought (by you or a manager) cost less: last 3 months of supply spending x the cut
    if (f.supplyCut && money != null) { const sp = -U.avg(b.hist.slice(-3), (h) => (h.lines && h.lines[SUP]) || 0); money += Math.max(0, sp) * f.supplyCut / (on ? 1 - f.supplyCut : 1); }
    let risk = 0; const ctx = B.ctx(g, b);
    for (const [rid, mult] of Object.entries(f.reduces || {})) { const r = d.risks.find((x) => x.id === rid); if (!r || !r.base) continue; const p = B.riskP(g, b, ctx, r).p; const pOff = on ? p / Math.max(0.01, mult) : p; risk += pOff * (1 - mult) * V.riskCost(g, b, r); }
    if (f.equipBreak) for (const [t, mult] of Object.entries(f.equipBreak)) for (const it of b.equip.filter((x) => x.type === t && !x.broken)) { const p = E.breakChance(g, b, it).p; const pOff = on ? p / mult : p; risk += pOff * (1 - mult) * (E.repairCost(g, b, Object.assign({}, it, { broken: 'major' })) * 0.5 + (b.revAvg || 0) * 0.08); }
    if ((f.seasonFloor || f.seasonDamp) && b.revAvg) { const se = d.season || []; const lift = U.avg(se, (x) => Math.max(0, Math.max(x, f.seasonFloor || 0) - x) + (x < 1 ? (1 - x) * (f.seasonDamp || 0) : 0)); money = Math.max(money || 0, b.revAvg * lift * 0.45 - (f.monthly || 0) * g.world.priceIdx); }
    // growth that builds up (fewer users leaving, more invites): estimate the month-12 effect, since next month shows almost nothing
    let slow = false;
    if ((f.churnCut || (f.organicMult && f.organicMult > 1)) && b.tech && b.tech.users > 0 && b.revAvg) {
      const T = d.tech || {}; const users = b.tech.users; const arpu = b.revAvg / users; const keep = 1 - (T.serverCostPerUser || 0) * g.world.priceIdx / Math.max(1e-9, arpu);
      const extraUsers = users * (f.churnCut || 0) * 12 * 0.75 + (f.organicMult > 1 ? users * (T.organic || 0.03) * (f.organicMult - 1) * 12 * 0.7 : 0);
      const est = extraUsers * arpu * Math.max(0.2, keep) - (f.monthly || 0) * g.world.priceIdx;
      if (est > (money || 0)) { money = Math.round(est); slow = true; }
    }
    const cost = Math.round((f.cost || 0) * g.world.priceIdx); const net = (money || 0) + risk;
    const full = !!(b.lastCtx && b.lastCtx.cap && b.lastCtx.demand >= b.lastCtx.cap * 0.98) && !!(f.demand || f.ticketMult == null && f.salesUp == null && f.demand);
    const out = { money: money == null ? null : Math.round(money), risk: Math.round(risk), net: Math.round(net), cost, months: net > 1 ? cost / net : Infinity, full: !!(f.demand && b.lastCtx && b.lastCtx.cap && b.lastCtx.demand >= b.lastCtx.cap * 0.98), slow };
    void full; cache.v[fixId] = out; return out;
  };

  // ================= STRUGGLING-BUSINESS TAKEOVER (any type) =================
  // You buy a business that is failing: cheaper than starting new, but it comes with worn gear, unhappy staff,
  // a weak reputation and the old owner's debt. Fix it up and it can be worth a lot more.
  const setup0 = B.setupCost;
  B.setupCost = (g, type, prop, opts) => (opts && opts._free ? 0 : setup0(g, type, prop, opts));
  V.takeoverQuote = (g, type, pid, opts) => {
    const G0 = TG.G; let out = null;
    try {
      const g2 = JSON.parse(JSON.stringify(g)); g2._pv = true; TG.G = g2; g2.cash = 1e12;
      const r = B.start(g2, type, pid, Object.assign({}, opts, { takeover: false })); if (!r.ok) return { ok: false, msg: r.msg };
      const qs = B.quickSetup(g2, r.biz, false, 'standard'); const gear = U.sum(qs.steps.filter((s) => s.kind === 'equip'), (s) => s.cost || 0);
      const setup = B.setupCost(g, type, g.properties.find((p) => p.id === pid), opts);
      const T = C.v10.takeover; const full = setup + gear;
      out = { ok: true, full, price: Math.round(full * T.price), debt: Math.round(full * T.debt / 1000) * 1000, gear };
    } catch (e) { out = { ok: false, msg: e.message }; } finally { TG.G = G0; }
    return out;
  };
  V.takeover = (g, type, pid, opts) => {
    const q = V.takeoverQuote(g, type, pid, opts); if (!q.ok) return q;
    if (g.cash < q.price) return { ok: false, msg: `Taking it over costs ${U.money(q.price)} in cash.` };
    const r = B.start(g, type, pid, Object.assign({}, opts, { _free: true }));
    if (!r.ok) return r; const b = r.biz;
    F.spend(g, q.price, 'Business takeover', b.id, true);
    V.distress(g, b, q.debt, `Old owner's debt (${b.name})`);
    TG.rep.event(g, b, 'major', `You took over a struggling ${B.def(b).name.toLowerCase()}`, `Paid ${U.money(q.price)} (a new one with gear costs about ${U.money(q.full)}), plus ${U.money(q.debt)} of the old owner's debt. Worn used gear${b.equip.some((x) => x.broken) ? ' (some broken)' : ''}, unhappy staff and a weak reputation (${Math.round(b.rep)}). Fix it up and it is worth a lot more.`);
    return { ok: true, biz: b, quote: q };
  };
  // the state a failing business is in: worn used gear (some broken), a team with low morale, weak reputation, old debt
  V.distress = (g, b, debt, label) => {
    const T = C.v10.takeover;
    const qs = B.quickSetup(g, b, false, 'used');
    for (const st of qs.steps) {
      if (st.kind === 'equip') { const it = E.buy(g, b, st.type, 'used', { free: true }); if (it) { it.wear = R.range(T.wear[0], T.wear[1]); it.age = Math.max(it.age || 0, R.int(60, 160)); it.warranty = 0; if (R.chance(T.broken)) { it.broken = 'major'; E.queueBroken(g, b, it); } } }
    }
    const c0 = g.cash; g.cash = 1e12; try { B.quickSetup(g, b, true, 'used'); } finally { g.cash = c0 + (g.cash - 1e12); } // hires the starting team (gear is already there)
    if (TG.D) TG.D.syncTargets(b);
    b.rep = R.range(T.rep[0], T.rep[1]); for (const e of S.allStaff(b)) { e.morale = R.range(T.morale[0], T.morale[1]); e.loyalty = Math.min(e.loyalty || 0, 25); }
    if (b.stock) b.stock.qty = Math.round((b.stock.qty || 0) * 0.3);
    b.takeover = { m: g.month, debt };
    if (debt > 0) F.newLoan(g, 'business', debt, { label, noCash: true, bizId: b.id });
  };
  // NEW GAME: take over a failing business of any type
  C.v10.failTypes = Object.keys(C.businesses);
  V.startFailing = (g, type) => {
    const d = C.businesses[type]; const p = TG.P.gen(g, TG.P.idealFor(type));
    if (d.model === 'farm' && (p.acres > 320 || p.acres < 60)) { const a2 = R.int(80, 300); p.price = Math.round(p.price * a2 / Math.max(1, p.acres)); p.acres = a2; }
    const own = d.model === 'farm'; const cash0 = g.cash; g.cash = 1e12;
    if (own) { p.owned = true; p.baseValue = p.price; p.housingAtBuy = 1; p.bought = 0; } else { p.leased = true; p.rent = TG.P.leaseRent(g, p); p.deposit = 0; }
    g.properties.push(p);
    const q = V.takeoverQuote(g, type, p.id, {}); const r = B.start(g, type, p.id, { name: 'The ' + d.name });
    if (!r.ok) { g.cash = cash0; throw new Error('failing start: ' + r.msg); }
    V.distress(g, r.biz, q.ok ? q.debt : 0, `Inherited debt (${r.biz.name})`);
    const pay = S.payroll(r.biz); g.cash = Math.round(Math.max(20000, pay * 2.5 + (q.ok ? q.full * 0.08 : 0)) / 1000) * 1000;
    TG.rep.event(g, r.biz, 'major', `You took over a failing ${d.name.toLowerCase()}`, `Worn used gear, unhappy staff, a weak reputation and ${U.money(q.ok ? q.debt : 0)} of debt. ${U.money(g.cash)} in the bank. Turn it around.`);
    return r.biz;
  };

  // ================= PLAY TIME (account age in game years, across restarts) =================
  const PKEY = 'tycoon_profile_v1';
  V.profile = () => { try { const t = TG.store.get(PKEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  V.playMonths = (g) => (g ? (g.playBefore || 0) + (g.month || 0) : 0);
  V.savePlay = (g) => { if (!g || g._pv || g._practice) return; try { TG.store.set(PKEY, JSON.stringify({ months: V.playMonths(g), gameId: g.gameId, at: Date.now() })); } catch (e) { /* ignore */ } };
  V.playText = (months) => { const y = Math.floor(months / 12), mo = months % 12; return y ? `${y} yr${y === 1 ? '' : 's'}${mo ? ' ' + mo + ' mo' : ''}` : `${mo} mo`; };
  TG.Game.scenarios.failing = { label: 'Take over a failing business', desc: 'Pick any kind of business. It comes with worn gear, unhappy staff, a weak reputation and debt, but it is already open. Turn it around.' };
  const ng0 = TG.Game.newGame;
  TG.Game.newGame = (opts) => {
    const prev = TG.G && !TG.G._pv ? V.playMonths(TG.G) : 0; const pf = V.profile(); const before = Math.max(prev, (pf && pf.months) || 0);
    let g; if (opts && opts.scenario === 'failing') { g = ng0(Object.assign({}, opts, { scenario: 'classic' })); g.scenario = 'failing'; V.startFailing(g, opts.failType && C.businesses[opts.failType] ? opts.failType : 'cafe'); g.stats.startCash = g.cash; g.lastNW = F.netWorth(g); g.stats.peakNW = g.lastNW; g.acc = F.newAcc(); g.cashMark = g.cash; g.cur = TG.rep.newBuf ? g.cur : g.cur; }
    else g = ng0(opts);
    g.playBefore = (opts && opts.keepPlay === false) ? 0 : before; V.savePlay(g); return g;
  };
  const nm0 = TG.Game.nextMonth;
  TG.Game.nextMonth = (g) => { const r = nm0(g); if (g && !g._pv && !g._practice) V.savePlay(g); return r; };

  // ================= MIGRATION v9 -> v10 =================
  V.migrate = (g) => {
    const notes = [];
    let plans = 0; for (const b of g.businesses) for (const it of b.equip || []) if (it.maint && !it.leased) { it.maint = false; plans++; }
    if (plans) notes.push(`Maintenance plans are gone (${plans} cancelled, no more monthly fee): your mechanic keeps machines running now.`);
    for (const b of g.businesses) {
      b.orders = b.orders || {}; if (b.orders.replaceLike == null) b.orders.replaceLike = false; if (b.buzz == null) b.buzz = 0;
      if (b.ads && b.ads.budget > 0 && !V.adModel(b)) { notes.push(`${b.name}: ads cannot sell at the market price, so the ad budget was stopped.`); b.ads.budget = 0; }
      for (const dd of g.decisions || []) if (dd.kind === 'broken' && dd.bizId === b.id) dd.def = null;
      B.fixAgg(b);
    }
    for (const h of (g.re && g.re.holdings) || []) if (!h.unitR) h.unitR = {};
    for (const l of g.listings || []) if (l.life == null) l.life = R.int(C.v10.listingLife[0], C.v10.listingLife[1]);
    for (const l of (g.re && g.re.listings) || []) if (l.life == null) l.life = R.int(C.v10.listingLife[0], C.v10.listingLife[1]);
    if (g.playBefore == null) { const pf = V.profile(); g.playBefore = pf && pf.gameId !== g.gameId && pf.months > g.month ? pf.months - g.month : 0; }
    if (notes.length) { g.v10notes = notes; if (TG.rep) for (const n of notes) TG.rep.event(g, null, 'info', 'Update v10: ' + n, 'Game update'); }
    g.v = 10; return g;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 10) V.migrate(g); return g; };
})();

// v10: city gyms charge more (bigger rent, richer members) so the city is a real option, not a trap
(function () { const TG = globalThis.TG, P = TG.PR, m0 = P.market;
  P.market = (g, b) => { const p = m0(g, b); const d = TG.CONFIG.businesses[b.type]; const cp = d && d.cityPrem; return cp && b.loc === 'city' ? p * (1 + cp) : p; };
  TG.CONFIG.businesses.gym.cityPrem = 0.25;
})();
