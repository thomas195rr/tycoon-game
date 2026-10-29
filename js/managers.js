/* managers.js - decision cards (player choices) and the manager / CEO AI that handles them.
   Managers decide from context; decision quality depends on skill, morale, traits. No standing orders. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const D = {};
  const COVER = {
    broken: ['ops', 'mechanic', 'gm'], poach: ['hr', 'gm'], theft: ['hr', 'gm', 'accountant'], lawsuit: ['lawyer'],
    pr: ['ads', 'gm'], evict: [], hire: ['hr', 'gm'], maint: ['mechanic', 'ops', 'gm'], raise: ['hr', 'gm'],
    stock: ['ops', 'gm'], bid: ['gm', 'ops'], franchise: ['gm', 'ops'], farm: ['gm', 'ops'], expand: ['ops', 'gm'],
  };

  D.add = (g, dec) => {
    const dup = g.decisions.find((d) => d.kind === dec.kind && d.bizId === dec.bizId && ((dec.itemId && d.itemId === dec.itemId) || (dec.empId && d.empId === dec.empId) || (dec.suitId && d.suitId === dec.suitId) || (dec.reId && d.reId === dec.reId && d.unit === dec.unit) || (dec.kind === 'pr' && d.kind === 'pr')));
    if (dup) return dup;
    dec.id = U.uid('d'); dec.month = g.month; g.decisions.push(dec); return dec;
  };
  D.removeFor = (g, pred) => { g.decisions = g.decisions.filter((d) => !pred(d)); };

  // manager quality: chance a decision is a good one
  D.pGood = (g, e, isCeo) => {
    const C = TG.CONFIG.decisions;
    let p = C.baseGood + e.skill * C.skillWeight + (e.morale - 50) * C.moraleWeight;
    if (isCeo) { const n = g.businesses.length; p -= Math.max(0, n - TG.CONFIG.ceo.spanFree) * TG.CONFIG.ceo.spanPenalty; }
    return U.clamp(p, C.minGood, C.maxGood);
  };
  D.handler = (g, b, kind) => {
    const roles = COVER[kind] || [];
    if (b && b.spec) for (const r of roles) { const e = b.spec[r]; if (e) return { e, label: `${TG.CONFIG.specialists[r].label} ${e.name}`, role: r, p: D.pGood(g, e) }; }
    if (g.ceo && (kind !== 'evict')) return { e: g.ceo, label: `CEO ${g.ceo.name}`, role: 'ceo', p: D.pGood(g, g.ceo, true) };
    if (kind === 'evict' && g.re.manager) return { e: g.re.manager, label: `Property manager ${g.re.manager.name}`, role: 'rem', p: D.pGood(g, g.re.manager) };
    return null;
  };
  // roll good / ok / bad
  D.roll = (h) => { const C = TG.CONFIG.decisions; if (R.chance(h.p)) return 'good'; return R.chance(C.okShare) ? 'ok' : 'bad'; };
  const biz = (g, d) => (d.bizId ? TG.B.get(g, d.bizId) : null);

  // apply a chosen option
  D.resolve = (g, dec, opt, by) => {
    const b = biz(g, dec);
    g.decisions = g.decisions.filter((x) => x !== dec);
    if ((dec.bizId && !b) || opt == null) return;
    const S = TG.S, E = TG.E, cs = TG.CONFIG.staff;
    switch (dec.kind) {
      case 'broken':
        if (opt === 'repair') E.repair(g, b, dec.itemId, by);
        else if (opt.startsWith('replace_')) E.replace(g, b, dec.itemId, opt.slice(8), by);
        else if (by) TG.rep.decision(g, b, by, `Left ${dec.title.toLowerCase()} as is`);
        break;
      case 'poach': {
        const e = S.allStaff(b).find((x) => x.id === dec.empId); if (!e) break;
        if (opt === 'counter') {
          e.wage = Math.round(e.wage * (1 + cs.counterOfferPct)); e.loyalty = U.clamp(e.loyalty + 15, 0, 100); e.morale = U.clamp(e.morale + 8, 0, 100);
          if (R.chance(cs.counterAccept || 0.75)) TG.rep.staff(g, b, `${by ? by + ': ' : ''}${e.name} accepted a counter-offer (now ${U.money(e.wage)}/mo)`);
          else S.leave(g, b, e, 'took the competitor offer anyway', false);
        } else S.leave(g, b, e, 'poached by a competitor', false);
        break;
      }
      case 'theft': {
        const e = S.allStaff(b).find((x) => x.id === dec.empId); if (!e) break;
        if (opt === 'fire') S.fire(g, b, e.id, 'caught stealing'); else { e.morale = U.clamp(e.morale - 6, 0, 100); e.honesty = U.clamp(e.honesty + 8, 0, 100); TG.rep.staff(g, b, `${by ? by + ' gave' : 'Gave'} ${e.name} a warning for theft`); }
        break;
      }
      case 'pr': if (opt !== 'none') TG.B.doPR(g, b, opt, by); break;
      case 'lawsuit': TG.B.resolveSuit(g, dec.suitId, opt, by); break;
      case 'evict': if (opt === 'evict') TG.RE.evict(g, dec.reId, dec.unit, by || 'You'); break;
      default: if (dec.apply) dec.apply(g, opt, by);
    }
  };

  // a manager picks an option for a card (context-aware); returns { opt, outcome, why }
  D.choose = (g, dec, h) => {
    const b = biz(g, dec); const out = D.roll(h); const trait = h.e.trait;
    const good = out === 'good'; const bad = out === 'bad';
    switch (dec.kind) {
      case 'broken': {
        const it = b.equip.find((x) => x.id === dec.itemId); if (!it) return { opt: null };
        const d = TG.E.def(b, it.type); const destroyed = it.broken === 'destroyed';
        const old = it.age / (d.life || 120); const wear = TG.E.effWear(it);
        const mech = TG.E.hasMech(b); const cash = g.cash; const std = TG.E.price(g, b, it.type, 'standard');
        const profitable = U.sum(b.hist.slice(-3), (x) => x.profit) > 0;
        let best, why;
        if (!destroyed && old < 0.75 && wear < 75) { best = 'repair'; why = `still young (${(it.age / 12).toFixed(1)} yrs) and repair is cheaper`; }
        else if (cash < std * 1.5) { best = mech ? 'replace_used' : (destroyed ? 'replace_budget' : 'repair'); why = mech ? `cash is tight (${U.money(cash)}) and a mechanic can keep a used one running` : `cash is tight (${U.money(cash)}) and there is no mechanic to keep a used one alive`; }
        else if (cash > std * 6 && profitable) { best = d.critical ? 'replace_premium' : 'replace_standard'; why = `cash is healthy (${U.money(cash)}) and ${d.critical ? 'it is critical, so reliability pays' : 'standard is good value'}`; }
        else { best = mech ? 'replace_used' : 'replace_standard'; why = mech ? 'a mechanic on staff makes used gear a good deal' : 'no mechanic, so newer gear avoids breakdowns'; }
        if (trait === 'reckless' && !good) { best = 'replace_premium'; why = 'reckless: wants the best regardless of cash'; }
        if (trait === 'cautious' && !destroyed && !good) { best = 'repair'; why = 'cautious: patches it up'; }
        if (bad) {
          const alts = destroyed ? ['replace_premium', 'leave'] : ['repair', 'replace_premium', 'leave'];
          const alt = R.pick(alts.filter((x) => x !== best)) || 'leave';
          why = alt === 'leave' ? 'did not get around to it' : alt === 'repair' ? `patched a worn-out machine (${Math.round(wear)}% wear) that will likely break again` : `bought top-tier with only ${U.money(cash)} in the bank`;
          best = alt;
        }
        if (d.critical === undefined && best === 'leave' && !bad) best = 'repair';
        return { opt: best, outcome: out, why };
      }
      case 'poach': {
        const e = TG.S.allStaff(b).find((x) => x.id === dec.empId); if (!e) return { opt: null };
        const worth = e.skill >= 65 && (e.role in (b.spec || {}) || TG.CONFIG.businesses[b.type].roles[e.role]?.licensed || e.skill >= 75);
        let opt = worth ? 'counter' : 'let'; if (bad) opt = opt === 'counter' ? 'let' : 'counter';
        return { opt, outcome: out, why: worth ? `${e.name} (skill ${Math.round(e.skill)}) is hard to replace` : `${e.name} can be replaced` };
      }
      case 'theft': return { opt: bad ? 'warn' : 'fire', outcome: out, why: bad ? 'went soft on it' : 'zero tolerance for theft' };
      case 'pr': {
        const rep = b.rep; const cash = g.cash;
        let opt = rep < 25 && cash > 60000 ? 'prfirm' : cash > 30000 ? 'charity' : 'apology';
        if (bad) opt = cash < 30000 ? 'prfirm' : 'none';
        return { opt, outcome: out, why: `reputation ${Math.round(rep)}/100, cash ${U.money(cash)}` };
      }
      case 'lawsuit': {
        const ls = g.lawsuits.find((x) => x.id === dec.suitId); if (!ls) return { opt: null };
        const win = TG.B.winChance(g, b); const cfg = TG.CONFIG.lawsuits;
        const settleCost = ls.amount * (cfg.settleShare[0] + cfg.settleShare[1]) / 2;
        const fightCost = ls.amount * cfg.fees * (b && b.spec && b.spec.lawyer ? 0.4 : 1) + (1 - win) * ls.amount;
        let opt = fightCost < settleCost ? 'fight' : 'settle'; if (bad) opt = opt === 'fight' ? 'settle' : 'fight';
        return { opt, outcome: out, why: `win odds ${U.pct(win)}: expected cost to fight ${U.money(fightCost)} vs settle ${U.money(settleCost)}` };
      }
      case 'evict': return { opt: bad ? 'wait' : 'evict', outcome: out, why: 'tenant 2+ months behind' };
      default: return { opt: dec.def, outcome: 'ok', why: '' };
    }
  };

  // Called at the start of each month: anything the player left unanswered goes to a manager, else default.
  D.autoResolve = (g) => {
    for (const dec of g.decisions.slice()) {
      if (dec.month >= g.month) continue;
      const b = biz(g, dec);
      if (dec.bizId && !b) { g.decisions = g.decisions.filter((x) => x !== dec); continue; }
      const h = D.handler(g, b, dec.kind);
      if (h) {
        const c = D.choose(g, dec, h);
        if (c.opt == null) { g.decisions = g.decisions.filter((x) => x !== dec); continue; }
        const lbl = (dec.options.find((o) => o.id === c.opt) || { label: c.opt }).label;
        TG.rep.decision(g, b, h.label, `${dec.title}: chose "${lbl}"${c.why ? ' because ' + c.why : ''}`, c.outcome);
        D.resolve(g, dec, c.opt, h.label);
        h.e.decisions = (h.e.decisions || 0) + 1; if (c.outcome === 'bad') h.e.badCalls = (h.e.badCalls || 0) + 1;
      } else if (dec.def != null) {
        const lbl = (dec.options.find((o) => o.id === dec.def) || { label: dec.def }).label;
        TG.rep.decision(g, b, 'Nobody (no manager)', `${dec.title}: default "${lbl}"`, 'ok');
        D.resolve(g, dec, dec.def, null);
      } // persist with null default (lawsuit): stays open until the deadline
    }
  };

  // ---------- proactive management each month ----------
  const counts = (b) => { const c = {}; for (const e of b.staff) c[e.role] = (c[e.role] || 0) + 1; return c; };
  D.syncTargets = (b) => { b.target = counts(b); };
  D.bestCand = (list, out) => {
    if (!list.length) return null;
    if (out === 'bad') return R.pick(list);
    return list.slice().sort((x, y) => (y.skillSeen - y.wage / 400) - (x.skillSeen - x.wage / 400))[0];
  };
  D.manage = (g, b) => {
    if (!b.target) D.syncTargets(b);
    const S = TG.S, E = TG.E, M = TG.M;
    const profit3 = U.sum(b.hist.slice(-3), (x) => x.profit);
    // 1) replace staff who left (to the target the player set)
    if (b.proj) { const need = Math.ceil(U.sum(b.proj.active, (p) => p.crew)); b.target.laborer = Math.max(6, need); }
    let h = D.handler(g, b, 'hire');
    if (h) {
      const c = counts(b);
      for (const role in b.target) {
        let missing = b.target[role] - (c[role] || 0);
        while (missing > 0) {
          const out = D.roll(h); const cand = D.bestCand(S.poolFor(g, b, role), out);
          if (!cand) { TG.rep.decision(g, b, h.label, `Could not find a ${S.roleDef(b, role).label.toLowerCase()} to hire (thin labor pool)`, 'ok'); break; }
          S.hire(g, b, cand, h.label); missing--;
          if (out === 'bad') TG.rep.decision(g, b, h.label, `Rushed the hire of ${cand.name} without checking references`, 'bad');
        }
      }
    }
    // 2) maintenance & leaving broken gear
    h = D.handler(g, b, 'maint');
    if (h) {
      for (const it of b.equip) {
        const w = E.effWear(it);
        if (!it.broken && w > 58 && g.cash > 20000) { const out = D.roll(h); if (out !== 'bad') E.service(g, b, it.id); else if (R.chance(0.3)) TG.rep.decision(g, b, h.label, `Skipped servicing ${it.label} (${Math.round(w)}% wear)`, 'bad'); }
        if (it.broken && it.broken !== 'destroyed' && !g.decisions.some((d) => d.itemId === it.id) && g.cash > E.repairCost(g, b, it) * 2) E.repair(g, b, it.id, h.label);
      }
    }
    // 3) raises for unhappy good people
    h = D.handler(g, b, 'raise');
    if (h) for (const e of S.allStaff(b)) if (e.morale < 38 && e.skill >= 55 && profit3 > 0 && R.chance(0.5)) { S.raise(g, b, e.id); TG.rep.decision(g, b, h.label, `Gave ${e.name} a raise (morale was ${Math.round(e.morale)})`, 'good'); }
    // 4) model-specific
    if (b.brand) {
      h = D.handler(g, b, 'stock');
      const s = b.brand; const pipe = s.stock + U.sum(s.incoming, (x) => x.units);
      const avgO = s.avgOrders || s.lastOrders;
      if (h && avgO > 0 && pipe < avgO * 3.2) {
        const out = D.roll(h); let units = Math.max(TG.CONFIG.businesses.brand.brand.minBatch, Math.round(avgO * (out === 'bad' ? 7 : 3.5)));
        const r = M.brandOrder(g, b, units, false);
        if (r.ok) TG.rep.decision(g, b, h.label, `Reordered ${units.toLocaleString()} units (${U.money(r.cost)}) because only ${pipe.toLocaleString()} are in stock or on the way vs about ${Math.round(avgO).toLocaleString()} orders/mo`, out === 'bad' ? 'bad' : 'good');
      }
    }
    if (b.proj && b.proj.autoBid) {
      h = D.handler(g, b, 'bid');
      if (h) {
        const crew = M.models.projects.crew(b, TG.B.ctx(g, b));
        let need = U.sum(b.proj.active, (p) => p.crew);
        for (const o of b.proj.offers.slice()) {
          const out = D.roll(h);
          if (need + o.crew > crew * (out === 'bad' ? 1.5 : 1.2)) continue;
          if (o.size === 'large' && out !== 'bad' && (g.cash < o.cost * 0.08 || crew < 25)) continue;
          if (o.bond && !b.fixes.bonds) continue;
          const r = M.bid(g, b, o.id, b.proj.markup || 'normal', h.label);
          if (r.won) need += o.crew;
        }
      }
    }
    if (b.proj) {
      h = D.handler(g, b, 'expand');
      if (h) for (const kind of ['excavator', 'crane']) {
        const need = U.sum(b.proj.active, (p) => (kind === 'excavator' ? p.heavy : p.crane) || 0);
        const have = b.equip.filter((x) => x.type === kind && !x.broken).length;
        if (need > have) {
          const out = D.roll(h); const lease = out !== 'bad' ? g.cash < E.price(g, b, kind, 'standard') * 4 : R.chance(0.5);
          const it = E.buy(g, b, kind, out === 'bad' ? 'premium' : 'standard', { leased: lease });
          if (it) TG.rep.decision(g, b, h.label, `${lease ? 'Leased' : 'Bought'} a ${it.label.toLowerCase()} because active projects need ${need} and only ${have} work`, out);
        }
      }
    }
    if (b.fr) {
      h = D.handler(g, b, 'franchise');
      if (h) for (const a of b.fr.apps.slice()) {
        const out = D.roll(h); const judge = out === 'good' ? a.q : out === 'ok' ? a.signal : R.next();
        if (judge > 0.55) M.franchiseApprove(g, b, a.id, h.label); else if (judge < 0.4) M.franchiseReject(g, b, a.id);
      }
    }
    const lc = b.lastCtx || {};
    // 4b) staff-limited: add a key worker when demand clearly exceeds capacity and it pays
    h = D.handler(g, b, 'hire');
    if (h && lc.limit === 'staff' && lc.demand > lc.cap * 1.2 && profit3 > 0 && b.hist.length >= 3) {
      const kr = TG.M.keyRole(TG.CONFIG.businesses[b.type]);
      if (kr && R.chance(0.5)) { b.target[kr] = (b.target[kr] || 0) + 1; TG.rep.decision(g, b, h.label, `Added a ${S.roleDef(b, kr).label.toLowerCase()} position: demand ${Math.round(lc.demand)} vs capacity ${Math.round(lc.cap)}, limited by staff`, 'good'); }
    }
    if (h && lc.limit === 'support' && lc.demand > lc.cap * 1.1 && b.hist.length >= 3) {
      const d0 = TG.CONFIG.businesses[b.type]; const sr = Object.keys(d0.roles).find((r) => d0.roles[r].support);
      if (sr) { b.target[sr] = (b.target[sr] || 0) + 1; TG.rep.decision(g, b, h.label, `Added a ${S.roleDef(b, sr).label.toLowerCase()} position: support staff were the bottleneck`, 'good'); }
    }
    // 5) capacity: buy another machine when demand outstrips it (context-aware tier)
    h = D.handler(g, b, 'expand');
    if (h && lc.demand && lc.cap && lc.demand > lc.cap * 1.15 && (!lc.limit || lc.limit === 'equipment') && profit3 > 0 && (b.hist.length >= 3) && b.svc !== false) {
      const d = TG.CONFIG.businesses[b.type];
      const crit = d.equip.find((x) => x.id === lc.limitEquip) || d.equip.find((x) => x.critical && x.cap);
      if (crit && (TG.M.models[d.model].spaceCap ? TG.M.models[d.model].spaceCap(b) > lc.cap * 1.1 : true)) {
        const out = D.roll(h); const mech = E.hasMech(b);
        const std = E.price(g, b, crit.id, 'standard');
        let tier = mech && g.cash < std * 5 ? 'used' : g.cash > std * 8 ? 'standard' : g.cash > std * 3 ? 'budget' : null;
        if (h.e.trait === 'reckless') tier = 'premium';
        if (out === 'bad') tier = R.pick(['premium', 'used']);
        if (tier && g.cash > E.price(g, b, crit.id, tier) * 2) {
          E.buy(g, b, crit.id, tier);
          TG.rep.decision(g, b, h.label, `Bought a ${TG.CONFIG.equipTiers[tier].label.toLowerCase()} ${crit.label.toLowerCase()} because demand (${Math.round(lc.demand)}) exceeds capacity (${Math.round(lc.cap)})${mech ? ' and a mechanic is on staff' : ''}`, out);
        }
      }
    }
    // 6) CEO big moves (optional setting): buy the most useful upgrade when cash is plentiful
    if (g.ceo && g.settings.ceoBigMoves && profit3 > 0 && R.chance(0.25)) {
      const d = TG.CONFIG.businesses[b.type];
      const cand = d.fixes.filter((f) => !b.fixes[f.id] && !f.minRep && f.cost * g.world.priceIdx * 8 < g.cash && f.cost > 0);
      if (cand.length) {
        const out = D.roll({ p: D.pGood(g, g.ceo, true) });
        const f = out === 'bad' ? R.pick(cand) : cand.sort((x, y) => Object.keys(y.reduces || {}).length - Object.keys(x.reduces || {}).length)[0];
        const r = TG.B.buyFix(g, b, f.id);
        if (r && r.ok !== false) TG.rep.decision(g, b, `CEO ${g.ceo.name}`, `Invested in "${f.label}" (${U.money(f.cost * g.world.priceIdx)})`, out);
      }
    }
  };

  // farm sell-vs-store policy ('auto'): managers judge prices vs the yearly average
  D.farmPolicy = (g, b) => {
    const f = b.farm; const e = TG.M.models.farm.e(b); const mk = g.markets[e.market]; if (!mk) return 'sell';
    const hist = mk.hist || []; const avg = hist.length ? U.avg(hist.slice(-12), (x) => x.p || x) : mk.price;
    const now = TG.W.price(g, e.market, 0);
    const h = D.handler(g, b, 'farm');
    let ratio = now / Math.max(1, avg);
    if (h && !f.policyRoll) f.policyRoll = { m: g.month, out: D.roll(h) };
    if (f.policyRoll && f.policyRoll.m !== g.month && h) f.policyRoll = { m: g.month, out: D.roll(h) };
    if (f.policyRoll && f.policyRoll.out === 'bad') ratio = 2 - ratio;
    return ratio < 0.92 && TG.M.farmStoreFree(b) > 1 ? 'store' : 'sell';
  };

  // ---------- CEO ----------
  D.ceoPool = (g) => {
    if (g.ceoPool && g.ceoPool.month === g.month) return g.ceoPool.list;
    const hub = g.businesses[0] || { region: 'harbor', loc: 'city' };
    g.ceoPool = { month: g.month, list: [0, 1, 2].map(() => TG.S.candidate(g, { region: hub.region, loc: hub.loc }, 'ceo', 0.7)) };
    return g.ceoPool.list;
  };
  D.hireCeo = (g, cand) => { g.ceo = cand; cand.hired = g.month; cand.months = 0; TG.rep.staff(g, null, `Hired ${cand.name} as CEO (${U.money(cand.wage)}/mo + ${U.pct(cand.profitShare, 1)} of profit)`); };
  D.fireCeo = (g) => { if (!g.ceo) return; const sev = g.ceo.wage * 3; TG.F.spend(g, sev, 'Severance'); TG.rep.staff(g, null, `Let CEO ${g.ceo.name} go (${U.money(sev)} severance)`); g.ceo = null; };
  D.ceoMonth = (g, profit) => {
    const c = g.ceo; if (!c) return;
    c.months++;
    TG.F.spend(g, c.wage, 'CEO salary');
    if (profit > 0) TG.F.spend(g, Math.round(profit * c.profitShare), 'CEO profit share');
    const target = 60 + (profit > 0 ? 8 : -10) - Math.max(0, g.businesses.length - TG.CONFIG.ceo.spanFree) * 3;
    c.morale = U.clamp(c.morale + (target - c.morale) * 0.15 + R.normal(0, 2), 0, 100);
    if (c.skill < 95 && R.chance(0.3)) c.skill = U.clamp(c.skill + 0.3, 1, 99);
    const quitP = 0.004 + (c.morale < 35 ? 0.04 : 0) + (c.skill > 75 ? 0.006 : 0);
    if (R.chance(quitP)) { TG.rep.event(g, null, 'major', `CEO ${c.name} quit`, c.morale < 35 ? `Morale ${Math.round(c.morale)}/100` : 'Poached by a bigger company', { major: 'keyQuit' }); g.ceo = null; }
  };
  TG.D = D;
})();
