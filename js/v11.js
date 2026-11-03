/* v11.js - v11 game rules (loaded after v10.js):
   - ads: 4 ad types with a fit per business, targeting, diminishing returns; ads help low-reputation places most;
     a preview plays next month on a copy of your game (with and without the ads) to show extra sales and payback
   - personal lawyer on your own payroll: better loan odds, lower rates, handles real-estate liability claims
   - property manager: training, raises and bonuses like other staff
   - v10 -> v11 save migration */
(function () {
  const TG = globalThis.TG; const U = TG.U, R = TG.R, B = TG.B, F = TG.F, C = TG.CONFIG;
  const V = (TG.V11 = {});
  const X = () => C.v11;

  // ================= ADS =================
  V.isLocal = (b) => X().local.includes(b.type);
  V.adFit = (b, ch) => ((X().adFit[b.type] || {})[ch] || 1);
  V.adTargetMult = (b, t) => { const T = X().adTarget[t] || X().adTarget.near; return V.isLocal(b) ? T.local : T.far; };
  V.stars = (f) => (f >= 1.3 ? '⭐⭐⭐' : f >= 1.05 ? '⭐⭐' : f >= 0.85 ? '⭐' : '·');
  // ads bring new people who do not know your reputation yet, so they help a low-reputation place more
  V.repComp = (b) => U.clamp(Math.pow(50 / Math.max(5, b.rep || 50), 0.5), 0.75, 2.2);
  V.adBoostCalc = (g, b, a, noRoll) => {
    const RC = C.reputation; if (!a || !(a.budget > 0)) return { boost: 0, flopP: 0 };
    const ch = RC.adChannels[a.channel] || RC.adChannels.social; const T = X().adTarget[a.target || 'near'] || X().adTarget.near;
    const mgr = b.spec && b.spec.ads;
    const eff = (a.budget / ch.costPer) * ch.eff * V.adFit(b, a.channel) * V.adTargetMult(b, a.target || 'near') * (mgr ? 1 + mgr.skill / 150 : 1);
    const ref = Math.max(500 * g.world.priceIdx, B.baseRev(g, b) * RC.adBoostScale);
    const boost = RC.adMaxBoost * T.cap * (1 - Math.exp(-eff / ref)) * V.repComp(b);
    const flopP = U.clamp(ch.flop * T.flop * (mgr ? 0.5 : 1), 0, 0.9);
    if (noRoll) return { boost, flopP, eff, ref };
    const flop = R.chance(flopP);
    return { boost: flop ? boost * 0.15 : boost, flop, flopP };
  };
  B.adBoost = (g, b) => V.adBoostCalc(g, b, b.ads);

  // preview: next month on a throw-away copy, with and without this ad plan (same luck, 3 seeds, flops included)
  const AD = new Map();
  V.adSim = (g, b, plan) => {
    const key = [b.id, g.month, plan.budget, plan.channel, plan.target, b.staff.length, b.equip.length, Math.round(b.rep)].join('|');
    if (AD.has(key)) return AD.get(key);
    const G0 = TG.G; const base = JSON.stringify(g); const SEEDS = [0, 104729, 7919]; let rev = 0, served = 0, profit = 0, ok = true;
    try {
      for (const sd of SEEDS) for (const on of [true, false]) {
        const g2 = JSON.parse(base); g2._pv = true; g2._pvNoFl = true; g2.rngState = ((g2.rngState || 1) + sd) >>> 0 || 1; TG.G = g2;
        const b2 = g2.businesses.find((x) => x.id === b.id); b2.ads = Object.assign({}, b2.ads, on ? plan : { budget: 0 }); b2.recv = []; /* old invoices are the same either way: leave them out so their luck does not blur the answer */
        B.month(g2, b2); const h = b2.hist[b2.hist.length - 1] || {}; const c = b2.lastCtx || {};
        const sgn = on ? 1 : -1; const billed = U.sum(b2.recv || [], (r) => r.amt) * (1 - (((B.def(b2).receivable || {}).badDebt) || 0)); /* invoiced work is paid later: count it */
        rev += sgn * ((h.rev || 0) + billed); profit += sgn * ((h.profit || 0) + billed); served += sgn * (c.served || 0);
      }
    } catch (e) { ok = false; } finally { TG.G = G0; }
    const n = SEEDS.length; const calc = V.adBoostCalc(g, b, plan, true);
    const lc = b.lastCtx || {}; const full = lc.cap > 0 && lc.demand >= lc.cap * 0.98;
    const out = ok ? { extraRev: rev / n, extraServed: served / n, net: profit / n, boost: calc.boost, expBoost: calc.boost * (1 - calc.flopP * 0.85), flopP: calc.flopP, full, slow: B.def(b).model === 'tech' } : null;
    if (AD.size > 200) AD.clear(); AD.set(key, out); return out;
  };
  // the next $500 (diminishing returns)
  V.adMore = (g, b, plan) => { const a = V.adBoostCalc(g, b, plan, true).boost; const b2 = V.adBoostCalc(g, b, Object.assign({}, plan, { budget: plan.budget + 500 * g.world.priceIdx }), true).boost; return b2 - a; };

  // ================= PERSONAL LAWYER =================
  const lerp = (a, t) => a[0] + (a[1] - a[0]) * t;
  V.lawyerT = (e) => U.clamp(((e && e.skill) || 50) / 100, 0, 1);
  V.lawyerPerks = (g, e) => { const L = X().lawyer, t = V.lawyerT(e); return { z: lerp(L.approvalZ, t), rateCut: lerp(L.rateCut, t), stop: lerp(L.suitStop, t), cut: lerp(L.suitCut, t), win: lerp(L.winAdd, t) }; };
  V.lawyerPool = (g) => {
    g.player.lawPool = g.player.lawPool && g.player.lawPool.month === g.month ? g.player.lawPool : { month: g.month, list: [0, 1, 2].map(() => {
      const c = TG.S.candidate(g, { region: 'harbor', loc: 'city' }, 'lawyer', 0.6); c.role = 'plawyer';
      const L = X().lawyer; c.wage = Math.round(lerp(L.wage, U.clamp(c.skill / 100, 0, 1)) * g.world.wageIdx / 10) * 10; return c; }) };
    return g.player.lawPool.list;
  };
  V.hireLawyer = (g, id) => { const c = V.lawyerPool(g).find((x) => x.id === id); if (!c) return { ok: false }; g.player.lawyer = c; c.since = g.month; TG.rep.event(g, null, 'good', `Hired ${c.name} as your personal lawyer (${U.money(c.wage)}/mo)`, 'Personal lawyer'); return { ok: true }; };
  V.fireLawyer = (g) => { const e = g.player.lawyer; g.player.lawyer = null; if (e) TG.rep.event(g, null, 'info', `Let your personal lawyer ${e.name} go`, 'Personal lawyer'); };
  // wages: paid each month from your own cash (not a business)
  const im0 = TG.I.month;
  TG.I.month = (g) => { const r = im0(g); const e = g.player && g.player.lawyer; if (e) F.spend(g, e.wage, 'Personal lawyer'); return r; };
  // better loan odds and lower rates
  const TGC = TG.CREDIT || TG.CR;
  const rate0 = TGC.rate;
  TGC.rate = (g, type, score) => { const r = rate0(g, type, score); const e = g.player && g.player.lawyer; return e ? U.clamp(r - V.lawyerPerks(g, e).rateCut, 0.01, 0.45) : r; };
  const q0 = TGC.quote;
  TGC.quote = (g, type, amount, opts) => {
    const q = q0(g, type, amount, opts); const e = g.player && g.player.lawyer;
    if (e && q && q.odds > 0) { const p = V.lawyerPerks(g, e); const z = Math.log(q.odds / (1 - q.odds)) + p.z; q.odds = U.clamp(1 / (1 + Math.exp(-z)), 0.02, 0.97); if (q.factors) q.factors.push({ label: 'Your lawyer', val: e.name, mark: 'good', why: `Your lawyer prepares the paperwork and talks to the bank: better odds, ${U.pct(p.rateCut, 1)} lower rate.` }); }
    return q;
  };
  // real-estate liability claims (tenant injuries etc.): your lawyer gets some dropped, cuts the rest and wins more often
  const suit0 = B.lawsuit;
  B.lawsuit = (g, b, label, amount, insType, why) => {
    const e = g.player && g.player.lawyer; const reClaim = !b && g._own && String(g._own).startsWith('r:');
    if (e && reClaim) {
      const p = V.lawyerPerks(g, e);
      if (R.chance(p.stop)) { TG.rep.event(g, null, 'good', `${label}: your lawyer ${e.name} got the claim dropped`, `${U.pct(p.stop)} chance with your lawyer (skill ${Math.round(e.skill)})`); return null; }
      amount = amount * (1 - p.cut); why = (why ? why + '; ' : '') + `your lawyer cut the claim by ${U.pct(p.cut)}`;
      const ls = suit0(g, b, label, amount, insType, why); if (ls) ls.plawyer = true; return ls;
    }
    return suit0(g, b, label, amount, insType, why);
  };
  const win0 = B.winChance;
  B.winChance = (g, b) => { const w = win0(g, b); const e = !b && g.player && g.player.lawyer; return e ? U.clamp(w + V.lawyerPerks(g, e).win, 0.05, 0.92) : w; };

  // ================= PROPERTY MANAGER: training, raises, bonuses =================
  V.remEffects = (g, e) => { const s = e.skill || 50; return { costMult: U.clamp(1.2 - s / 250, 0.8, 1.2), quality: (s - 50) / 500 }; };
  V.remTrainPreview = (g, level) => { const t = X().remTrain[level] || X().remTrain.basic; const e = g.re.manager; const cost = Math.round(t.cost * g.world.priceIdx); const avg = (t.skill[0] + t.skill[1]) / 2;
    const now = V.remEffects(g, e), after = V.remEffects(g, Object.assign({}, e, { skill: U.clamp(e.skill + avg, 1, 99) })); return { cost, lo: t.skill[0], hi: t.skill[1], now, after }; };
  V.remTrain = (g, level) => {
    const e = g.re.manager; if (!e) return { ok: false, msg: 'No property manager.' };
    const p = V.remTrainPreview(g, level); if (g.cash < p.cost) return { ok: false, msg: `Training costs ${U.money(p.cost)}.` };
    F.spend(g, p.cost, 'Training', null, true); if (TG.S.spam(g, e, 'train')) return { ok: true, spam: true };
    const gain = Math.round(R.range(p.lo, p.hi) * (e.learning || 1)); const from = e.skill; e.skill = U.clamp(e.skill + gain, 1, 99); e.skillSeen = e.skill; e.morale = U.clamp((e.morale || 60) + 4, 0, 100);
    return { ok: true, from, to: e.skill };
  };
  V.remRaise = (g) => { const e = g.re.manager; if (!e) return { ok: false }; if (TG.S.spam(g, e, 'raise')) return { ok: true, spam: true }; const from = e.wage; e.wage = Math.round(e.wage * (1 + C.staff.raisePct) / 10) * 10; e.morale = U.clamp((e.morale || 60) + C.staff.raiseMorale, 0, 100); e.loyalty = U.clamp((e.loyalty || 50) + 5, 0, 100); return { ok: true, from, to: e.wage }; };
  V.remBonus = (g) => { const e = g.re.manager; if (!e) return { ok: false }; const cost = Math.round(e.wage * 0.5); F.spend(g, cost, 'Bonuses'); if (TG.S.spam(g, e, 'bonus')) return { ok: true, spam: true }; e.morale = U.clamp((e.morale || 60) + C.staff.bonusMorale, 0, 100); e.loyalty = U.clamp((e.loyalty || 50) + 10, 0, 100); return { ok: true, cost, morale: e.morale }; };
  V.remQuitP = (e) => 0.01 * ((e.morale || 60) < 40 ? 4 : 1) * U.clamp(1.4 - (e.loyalty || 50) / 100, 0.5, 1.4);

  // ================= SAVE MIGRATION v10 -> v11 =================
  V.migrate = (g) => {
    const notes = [];
    for (const h of (g.re && g.re.holdings) || []) if (h.pAtBuy == null) h.pAtBuy = g.world.priceIdx;
    for (const b of g.businesses || []) { for (const e of TG.S.allStaff(b)) e.away = 0; if (b.ads && !b.ads.target) b.ads.target = 'near'; }
    if (g.player && g.player.lawyer === undefined) g.player.lawyer = null;
    const w = g.world; if (w && w.priceIdx > 0) { const X1 = X().world; w.wageIdx = w.priceIdx * U.clamp(w.wageIdx / w.priceIdx, X1.wageBand[0], X1.wageBand[1]); w.housing = w.priceIdx * U.clamp(w.housing / w.priceIdx, X1.housingBand[0], X1.housingBand[1]); }
    const m = g.re && g.re.manager; if (m) { const cap = Math.round(5000 * (w ? w.wageIdx : 1)); if (m.wage > cap * 2) { notes.push(`Property manager pay reset from ${U.money(m.wage)} to ${U.money(cap)}/mo (it had run away from rents)`); m.wage = cap; } }
    notes.push('Ads: pick an ad type and who sees it; the Ads tab shows extra sales and payback before you spend');
    notes.push('Training never takes workers off the job any more: it only raises output');
    notes.push('Law firms are cheaper to start and get paid faster');
    g.v11notes = notes; g.v = 11; return g;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 11) V.migrate(g); return g; };
})();
