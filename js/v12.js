/* v12.js - v12 game rules (loaded after v11.js):
   - CEO training, raises and bonuses (business managers already use the staff tools); effects shown before paying
   - GMs reliably order supplies: hiring a GM / Ops manager / CEO turns 🤖 Auto on, managers keep a small buffer
   - GM poach policy for regular workers (always / good only / replace / ask me); handled without stopping the skip
   - CEO keeps chosen manager roles hired per business
   - managers (any manager role, CEO, property manager) who want to quit or get a job offer: a card + the skip stops
   - rentals: costs follow rent; rent yields follow mortgage rates so a normal rental with 20% down always covers a normal month
   - v11 -> v12 save migration */
(function () {
  const TG = globalThis.TG; const U = TG.U, R = TG.R, F = TG.F, C = TG.CONFIG, D = TG.D, S = TG.S;
  const V = (TG.V12 = {});
  const X = () => C.v12;
  const isMgrRole = (r) => !!C.specialists[r];

  // ================= 1. CEO TRAINING / RAISE / BONUS =================
  V.ceoTrainPreview = (g, level) => {
    const e = g.ceo; const t = X().ceoTrain[level] || X().ceoTrain.basic; const cost = Math.round(t.cost * g.world.priceIdx);
    const dim = S.trainDim(e.skill); const lo = Math.round(t.skill[0] * dim), hi = Math.round(t.skill[1] * dim), avg = (lo + hi) / 2;
    return { cost, lo, hi, now: D.pGood(g, e, true), after: D.pGood(g, Object.assign({}, e, { skill: U.clamp(e.skill + avg, 1, 99) }), true) };
  };
  V.ceoTrain = (g, level) => {
    const e = g.ceo; if (!e) return { ok: false, msg: 'No CEO.' }; const p = V.ceoTrainPreview(g, level);
    if (g.cash < p.cost) return { ok: false, msg: `Coaching costs ${U.money(p.cost)}.` };
    F.spend(g, p.cost, 'Training', null, true); if (S.spam(g, e, 'train')) return { ok: true, spam: true };
    const from = Math.round(e.skill); e.skill = U.clamp(e.skill + R.range(p.lo, p.hi), 1, 99); e.skillSeen = Math.round(e.skill); e.morale = U.clamp(e.morale + 4, 0, 100);
    return { ok: true, from, to: Math.round(e.skill) };
  };
  V.ceoRaisePreview = (g) => { const e = g.ceo; const to = Math.round(e.wage * (1 + C.staff.raisePct) / 10) * 10; return { to, add: to - e.wage, quitNow: V.ceoQuitP(e), quitAfter: V.ceoQuitP(Object.assign({}, e, { morale: U.clamp(e.morale + C.staff.raiseMorale, 0, 100) })) }; };
  V.ceoRaise = (g) => { const e = g.ceo; if (!e) return { ok: false }; if (S.spam(g, e, 'raise')) return { ok: true, spam: true }; const from = e.wage; e.wage = V.ceoRaisePreview(g).to; e.morale = U.clamp(e.morale + C.staff.raiseMorale, 0, 100); e.loyalty = U.clamp((e.loyalty || 50) + 5, 0, 100); return { ok: true, from, to: e.wage }; };
  V.ceoBonus = (g) => { const e = g.ceo; if (!e) return { ok: false }; const cost = Math.round(e.wage * 0.5); F.spend(g, cost, 'Bonuses'); if (S.spam(g, e, 'bonus')) return { ok: true, spam: true }; e.morale = U.clamp(e.morale + C.staff.bonusMorale, 0, 100); e.loyalty = U.clamp((e.loyalty || 50) + 10, 0, 100); return { ok: true, cost, morale: e.morale }; };
  V.ceoQuitP = (c) => 0.004 + (c.morale < 35 ? 0.04 : 0) + (c.skill > 75 ? 0.006 : 0);
  // what training does for a business manager: right calls now -> after (shown before paying)
  V.mgrTrainEffect = (g, b, e, level) => { const p = S.trainPreview(g, b, e, level); return { now: D.pGood(g, e), after: D.pGood(g, Object.assign({}, e, { skill: U.clamp(e.skill + p.avg, 1, 99) })), avg: p.avg }; };

  // ================= 2. SUPPLIES: hiring a manager who orders turns Auto on =================
  V.orderer = (g, b) => { const st = b.stock; const h = D.handler(g, b, 'stock'); if (!h) return { who: 'you', h: null }; if (st && !st.auto) return { who: 'off', h }; return { who: 'mgr', h }; };
  V.autoOn = (g, b, why) => { const st = b.stock || (TG.ST.def(b) ? TG.ST.ensure(b) : null); if (st && !st.auto) { st.auto = true; TG.rep.event(g, b, 'info', `🤖 Supplies at ${b.name} are now ordered by ${why}`, 'Turn Auto off on the Now tab if you want to order yourself.'); } };
  const hire0 = S.hire;
  S.hire = (g, b, cand, by) => { const r = hire0(g, b, cand, by); if (b && (cand.role === 'gm' || cand.role === 'ops') && !g._pv) V.autoOn(g, b, `your new ${C.specialists[cand.role].label.toLowerCase()} ${cand.name}`); return r; };
  const prom0 = S.promote;
  S.promote = (g, b, empId, role) => { const e = prom0(g, b, empId, role); if (e && (role === 'gm' || role === 'ops')) V.autoOn(g, b, `${C.specialists[role].label.toLowerCase()} ${e.name}`); return e; };
  const ceoHire0 = D.hireCeo;
  D.hireCeo = (g, cand) => { ceoHire0(g, cand); for (const b of g.businesses) V.autoOn(g, b, `CEO ${cand.name}`); };
  // a manager orders a little extra so a normal month does not run short
  const restock0 = TG.ST.restock;
  TG.ST.restock = (g, b, need) => restock0(g, b, (need || 0) * (D.handler(g, b, 'stock') ? X().restockBuffer : 1));

  // ================= 5. GM POACH POLICY (regular workers) + 8. MANAGERS ASK YOU =================
  V.poachPol = (b) => (b && b.poachPol) || X().poachDefault;
  V.ask = (g, b, text, why) => TG.rep.event(g, b, 'major', text, why, { major: 'mgrAsk' });
  const add0 = D.add;
  D.add = (g, dec) => {
    if (dec.kind !== 'poach' || g._pv) return add0(g, dec);
    const b = TG.B.get(g, dec.bizId); const e = b && S.allStaff(b).find((x) => x.id === dec.empId); if (!e) return add0(g, dec);
    if (isMgrRole(e.role)) { // a manager got a job offer: you decide (the skip stops)
      dec.mgr = true; const d = add0(g, dec); V.ask(g, b, `${e.name} (${C.specialists[e.role].label}) got a job offer: you decide`, `Offer ${U.money(dec.offer)}/mo vs your ${U.money(e.wage)}/mo. Answer the card, or they leave next month.`); return d;
    }
    const pol = V.poachPol(b); const h = D.handler(g, b, 'poach');
    if (!h || pol === 'ask') { const d = add0(g, dec); if (h && pol === 'ask') TG.rep.event(g, b, 'major', `${e.name} got a job offer: your GM is asking you`, 'Your poach setting is "Ask me".', { major: 'poachAsk' }); return d; }
    // the GM / HR / CEO handles it right away with your setting (no card, the skip keeps going); still a roll of their skill
    let opt, why, out = 'ok';
    if (pol === 'always') { opt = 'counter'; why = 'your setting: always match'; }
    else if (pol === 'replace') { opt = 'let'; why = 'your setting: let them go and hire a replacement'; }
    else { const c = D.choose(g, Object.assign({}, dec), h); opt = c.opt || 'let'; out = c.outcome; why = `your setting: match good workers only (${c.why})`; } // a skill roll: a weak manager can misjudge
    const fake = Object.assign({ id: U.uid('d'), month: g.month }, dec); g.decisions.push(fake);
    TG.rep.decision(g, b, h.label, `${dec.title}: ${opt === 'counter' ? `matched ${U.money(dec.offer)}/mo` : 'let them go'} (${why})`, out);
    const ev0 = TG.rep.event; TG.rep.event = (g1, b1, type, text, why, o) => ev0(g1, b1, type === 'major' ? 'bad' : type, text, why, null); // handled by your manager: not a reason to stop the skip
    try { D.resolve(g, fake, opt, h.label); } finally { TG.rep.event = ev0; } // 'let' keeps the spot (target) so the manager hires a replacement
    return fake;
  };
  // a manager who wants to quit: a card instead of leaving on the spot
  V.keepOdds = (e) => U.clamp(X().keepBase + (e.morale - 35) / 150 + (e.loyalty || 50) / 300, 0.15, 0.85);
  V.quitCard = (g, b, e, kind, why) => {
    if (g.decisions.some((d) => d.kind === 'mgrQuit' && d.empId === e.id)) return true;
    const to = Math.round(e.wage * (1 + X().keepRaise) / 10) * 10; const odds = V.keepOdds(e);
    const label = kind === 'ceo' ? 'CEO' : kind === 'rem' ? 'Property manager' : C.specialists[e.role].label;
    add0(g, { kind: 'mgrQuit', mgr: true, who: kind, bizId: b ? b.id : null, empId: e.id, to, title: `${e.name} (${label}) wants to quit`, text: `${why}. Pay now ${U.money(e.wage)}/mo.`, why: `Morale ${Math.round(e.morale)}, loyalty ${Math.round(e.loyalty || 50)}.`,
      options: [{ id: 'keep', label: `💵 Raise to ${U.money(to)}/mo (+${U.money(to - e.wage)}) · ${U.pct(odds)} they stay` }, { id: 'let', label: '👋 Let them go' }], def: 'let' });
    V.ask(g, b, `${e.name} (${label}) wants to quit: you decide`, `${why}. Answer the card, or they leave next month.`);
    return true;
  };
  const leave0 = S.leave;
  S.leave = (g, b, e, why, natural) => {
    if (natural === true && !g._pv && isMgrRole(e.role) && b.spec && b.spec[e.role] === e && !g._v12go) { V.quitCard(g, b, e, 'biz', why[0].toUpperCase() + why.slice(1)); return; }
    return leave0(g, b, e, why, natural);
  };
  // CEO month: same as before, but a CEO who wants to quit asks first
  D.ceoMonth = (g, profit) => {
    const c = g.ceo; if (!c) return;
    c.months++;
    F.spend(g, c.wage, 'CEO salary');
    if (profit > 0) F.spend(g, Math.round(profit * c.profitShare), 'CEO profit share');
    const target = 60 + (profit > 0 ? 8 : -10) - Math.max(0, g.businesses.length - C.ceo.spanFree) * 3;
    c.morale = U.clamp(c.morale + (target - c.morale) * 0.15 + R.normal(0, 2), 0, 100);
    if (c.skill < 95 && R.chance(0.3)) c.skill = U.clamp(c.skill + 0.3, 1, 99);
    if (R.chance(V.ceoQuitP(c))) V.quitCard(g, null, c, 'ceo', c.morale < 35 ? `Morale ${Math.round(c.morale)}/100` : 'A bigger company wants them');
  };
  V.remWantsQuit = (g, e) => V.quitCard(g, null, e, 'rem', `Morale ${Math.round(e.morale)}`);
  const res0 = D.resolve;
  D.resolve = (g, dec, opt, by) => {
    if (dec.kind !== 'mgrQuit') return res0(g, dec, opt, by);
    g.decisions = g.decisions.filter((x) => x !== dec);
    const b = dec.bizId ? TG.B.get(g, dec.bizId) : null;
    const e = dec.who === 'ceo' ? (g.ceo && g.ceo.id === dec.empId ? g.ceo : null) : dec.who === 'rem' ? (g.re.manager && g.re.manager.id === dec.empId ? g.re.manager : null) : b && S.allStaff(b).find((x) => x.id === dec.empId);
    if (!e) return;
    const stay = opt === 'keep' && R.chance(V.keepOdds(e));
    if (opt === 'keep') { e.wage = dec.to; e.morale = U.clamp(e.morale + 15, 0, 100); e.loyalty = U.clamp((e.loyalty || 50) + 10, 0, 100); }
    if (stay) { TG.rep.staff(g, b, `${e.name} stayed for ${U.money(e.wage)}/mo`); return; }
    const why = opt === 'keep' ? 'took the other job anyway' : 'you let them go';
    if (dec.who === 'ceo') { g.ceo = null; TG.rep.event(g, null, 'bad', `CEO ${e.name} left`, why); }
    else if (dec.who === 'rem') { g.re.manager = null; TG.rep.event(g, null, 'bad', `Property manager ${e.name} left`, why); }
    else { g._v12go = true; try { leave0(g, b, e, why, false); } finally { g._v12go = false; } }
  };
  // manager cards wait for YOU: if you skip past them, the default happens (no other manager decides for you)
  const auto0 = D.autoResolve;
  D.autoResolve = (g) => {
    for (const dec of g.decisions.slice()) if (dec.mgr && dec.month < g.month) { TG.rep.decision(g, dec.bizId ? TG.B.get(g, dec.bizId) : null, 'Nobody (you did not answer)', `${dec.title}: ${dec.kind === 'mgrQuit' ? 'they left' : 'they took the offer'}`, 'ok'); D.resolve(g, dec, dec.def || 'let', null); }
    return auto0(g);
  };

  // ================= 7. CEO KEEPS CHOSEN MANAGER ROLES HIRED =================
  V.keepRoles = (b) => Object.keys(b.keep || {}).filter((r) => b.keep[r] && C.specialists[r]);
  V.ceoKeep = (g, b) => {
    if (!g.ceo || g._pv) return;
    for (const role of V.keepRoles(b)) {
      if (b.spec && b.spec[role]) continue;
      const pool = S.poolFor(g, b, role).filter((c) => c.wage * 3 <= Math.max(0, g.cash)); const label = C.specialists[role].label;
      if (!pool.length) { if (!b.keepMiss || g.month - b.keepMiss >= 6) { b.keepMiss = g.month; TG.rep.decision(g, b, `CEO ${g.ceo.name}`, `Could not hire a ${label.toLowerCase()}: nobody affordable (needs 3 months of their pay in cash)`, 'ok'); } continue; }
      const out = D.roll({ p: D.pGood(g, g.ceo, true) }); const cand = D.bestCand(pool, out);
      S.hire(g, b, cand, `CEO ${g.ceo.name}`);
      TG.rep.decision(g, b, `CEO ${g.ceo.name}`, `Hired ${cand.name} as ${label} (${U.money(cand.wage)}/mo, skill ~${Math.round(cand.skillSeen || cand.skill)}) because you asked to always keep one`, out === 'bad' ? 'bad' : 'good');
    }
  };
  const manage0 = D.manage;
  D.manage = (g, b) => { V.ceoKeep(g, b); return manage0(g, b); };

  // ================= 3/4. RENTALS: yields follow mortgage rates (the mortgage rule) =================
  const pmt = (r, n) => (r <= 0 ? 1 / n : (r / 12) / (1 - Math.pow(1 + r / 12, -n)));
  V.pmt = pmt;
  // the worst mortgage rate a buyer can get right now (lowest credit a mortgage allows)
  V.worstRate = (g, base) => { const L = C.finance.loans.mortgage; const cc = C.credit || {}; const minS = L.minCredit || 600; return U.clamp((base != null ? base : g.world.baseRate) + L.spread + Math.max(0, 760 - minS) * (cc.rateSpread || 0.00025), 0.01, 0.45); };
  V.maxRate = (g) => V.worstRate(g, C.economy.rateMax);
  // running costs as a share of the price at purchase (normal upkeep, insured, worst capped tax), and the rent share kept
  V.costShare = () => { const rc = C.realEstate; return rc.propertyTax / 12 * X().taxMultCap + rc.upkeepPct + rc.insurancePct; };
  V.needYield = (rate) => { const Q = X().rule, rc = C.realEstate; return (V.costShare() + (1 - Q.down) * pmt(rate, Q.term)) / (1 - Math.max(rc.managerFeePct, Q.selfPen) - Q.margin); }; // with a manager you pay the fee; without one, the self-manage penalty (smaller)
  V.yieldFor = (g, kindId) => { const k = C.realEstate.kinds[kindId]; return Math.max(k.rentPct, V.needYield(V.worstRate(g))); };
  // a normal month for a rental bought with 20% down at `rate`: full at market rent, no surprises
  V.normalMonth = (g, h, rate, opts) => {
    opts = opts || {}; const rc = C.realEstate; const Q = X().rule; const units = Math.max(1, h.units || 1);
    const rent = TG.RE.marketRent(g, h) * units; const v = TG.RE.costBase(g, h);
    const taxM = opts.taxMult != null ? opts.taxMult : X().taxMultCap;
    const tax = Math.min(v * rc.propertyTax / 12 * taxM, X().taxRentCap * rent), upkeep = v * rc.upkeepPct, ins = v * rc.insurancePct;
    const mgr = rent * rc.managerFeePct + (opts.selfPen ? rent * Q.selfPen : 0);
    const loan = (opts.price || h.basePrice || h.price) * (1 - Q.down) * pmt(rate, Q.term);
    return { rent, tax, upkeep, ins, mgr, loan, net: rent - tax - upkeep - ins - mgr - loan };
  };

  // mortgages need the minimum credit score (shown as the reason), so the worst rate a buyer can get is known
  const quote0 = TG.CREDIT.quote;
  TG.CREDIT.quote = (g, type, amount, opts) => {
    const q = quote0(g, type, amount, opts); const L = C.finance.loans[type];
    if (type === 'mortgage' && L && L.minCredit) { const sc = TG.CREDIT.score(g).score; if (sc < L.minCredit) { q.odds = 0; q.block = q.block || `Mortgages need a credit score of ${L.minCredit}+ (yours is ${sc}).`; } }
    return q;
  };

  // ================= MIGRATION v11 -> v12 =================
  V.migrate = (g) => {
    const notes = [];
    const MT = g.settings.majorTypes = g.settings.majorTypes || {}; if (MT.mgrAsk == null) MT.mgrAsk = true; if (MT.poachAsk == null) MT.poachAsk = true;
    let on = 0; for (const b of g.businesses || []) { const st = b.stock; if (st && !st.auto && D.handler(g, b, 'stock')) { st.auto = true; on++; } }
    if (on) notes.push(`📦 ${on} business${on > 1 ? 'es' : ''} had a manager but 🤖 Auto supplies were off, so nobody ordered. Auto is on again (turn it off on the Now tab if you order yourself).`);
    for (const h of (g.re && g.re.holdings) || []) if (h.taxMult > X().taxMultCap) h.taxMult = X().taxMultCap;
    for (const l of (g.re && g.re.listings) || []) if (l.yld == null && C.realEstate.kinds[l.kind].rentPct) l.yld = V.yieldFor(g, l.kind);
    notes.push('👔 Managers and your CEO can now be trained, get raises and bonuses (effects shown first).');
    notes.push('🙋 When a manager wants to quit or gets a job offer, the month skip stops so you decide.');
    notes.push('🧑‍💼 Set how your GM handles job offers for workers, and which managers your CEO always keeps hired (Staff tab).');
    notes.push('🏘️ Rental property tax, upkeep and insurance now follow rent, and new listings price in mortgage rates: a normal rental with 20% down covers its normal month.');
    g.v12notes = notes; g.v = 12;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 12) V.migrate(g); return g; };
  const ng0 = TG.Game.newGame;
  TG.Game.newGame = (opts) => { const g = ng0(opts); const MT = g.settings.majorTypes; MT.mgrAsk = true; MT.poachAsk = true; return g; };
})();
