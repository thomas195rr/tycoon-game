/* managers.js - decision cards (player choices) and the manager / CEO AI that handles them.
   Managers decide from context; decision quality depends on skill, morale, traits. No standing orders. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const D = {};
  const COVER = {
    broken: ['ops', 'gm'], poach: ['hr', 'gm'], theft: ['hr', 'gm', 'accountant'], lawsuit: ['lawyer'],
    pr: ['ads', 'gm'], fund: ['gm', 'accountant'], evict: [], hire: ['hr', 'gm'], maint: [], raise: ['hr', 'gm'],
    stock: ['ops', 'gm'], bid: ['gm', 'ops'], franchise: ['gm'], farm: ['ops', 'gm'], expand: ['ops'],
  };
  // v10: the GM is the people & sales boss, the Ops manager the machines & running-things boss.
  // Each makes better calls in their own area and worse ones outside it (shown on the Manager tab).
  const STRONG = { gm: ['poach', 'theft', 'pr', 'fund', 'hire', 'raise', 'bid', 'franchise'], ops: ['broken', 'stock', 'farm', 'expand'] };
  D.COVER = COVER; D.STRONG = STRONG;
  D.roleEdge = (role, kind) => (STRONG[role] ? (STRONG[role].includes(kind) ? 0.08 : -0.06) : 0);

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
    if (b && b.spec) for (const r of roles) { const e = b.spec[r]; if (e) return { e, label: `${TG.CONFIG.specialists[r].label} ${e.name}`, role: r, p: U.clamp(D.pGood(g, e) + D.roleEdge(r, kind), 0.05, 0.97) }; }
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
          e.wage = dec.offer ? Math.max(e.wage, dec.offer) : Math.round(e.wage * (1 + cs.counterOfferPct)); e.loyalty = U.clamp(e.loyalty + 10, 0, 100); e.morale = U.clamp(e.morale + 8, 0, 100);
          if (R.chance(S.persDef(e).accept)) TG.rep.staff(g, b, `${by ? by + ': ' : ''}${e.name} stayed for the matched pay (now ${U.money(e.wage)}/mo)`);
          else S.leave(g, b, e, 'took the other offer anyway', false);
        } else S.leave(g, b, e, 'poached by a competitor', false);
        break;
      }
      case 'theft': {
        const e = S.allStaff(b).find((x) => x.id === dec.empId); if (!e) break;
        if (opt === 'fire') S.fire(g, b, e.id, 'caught stealing'); else { e.morale = U.clamp(e.morale - 6, 0, 100); e.honesty = U.clamp(e.honesty + 8, 0, 100); TG.rep.staff(g, b, `${by ? by + ' gave' : 'Gave'} ${e.name} a warning for theft`); }
        break;
      }
      case 'pr': if (opt !== 'none') TG.B.doPR(g, b, opt, by); break;
      case 'fund': if (opt === 'take') { b.outside = (b.outside || 0) + dec.pct; TG.F.earn(g, dec.cash, 'Investor funding', b.id, true); TG.rep.event(g, b, 'info', `${by ? by + ' took' : 'Took'} ${U.money(dec.cash)} for ${U.pct(dec.pct)} of ${b.name}`, `Investors now own ${U.pct(b.outside)}`); } break;
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
        if (false) { /* v6: managers never repair; only replace or scrap destroyed machines */ }
        else if (cash < std * 1.5) { best = mech ? 'replace_used' : (destroyed ? 'replace_budget' : 'repair'); why = mech ? `cash is tight (${U.money(cash)}) and a mechanic can keep a used one running` : `cash is tight (${U.money(cash)}) and there is no mechanic to keep a used one alive`; }
        else if (cash > std * 6 && profitable) { best = d.critical ? 'replace_premium' : 'replace_standard'; why = `cash is healthy (${U.money(cash)}) and ${d.critical ? 'it is critical, so reliability pays' : 'standard is good value'}`; }
        else { best = mech ? 'replace_used' : 'replace_standard'; why = mech ? 'a mechanic on staff makes used gear a good deal' : 'no mechanic, so newer gear avoids breakdowns'; }
        if (trait === 'reckless' && !good) { best = 'replace_premium'; why = 'reckless: wants the best regardless of cash'; }
        if (best === 'repair') best = 'replace_used';
        if (bad) {
          const alts = ['replace_premium', 'leave'];
          const alt = R.pick(alts.filter((x) => x !== best)) || 'leave';
          why = alt === 'leave' ? 'did not get around to it' : alt === 'repair' ? `patched a worn-out machine (${Math.round(wear)}% wear) that will likely break again` : `bought top-tier with only ${U.money(cash)} in the bank`;
          best = alt;
        }

        return { opt: best, outcome: out, why };
      }
      case 'poach': {
        const e = TG.S.allStaff(b).find((x) => x.id === dec.empId); if (!e) return { opt: null };
        const mv = TG.S.mv(g, b, e); const offer = dec.offer || e.wage * 1.15;
        const key = (e.role in (b.spec || {})) || (TG.CONFIG.businesses[b.type].roles[e.role] || {}).licensed;
        const worth = (e.skill >= 50 || key) && offer <= mv * 1.2; // v9: match fair offers for good people; let overpriced ones go
        let opt = worth ? 'counter' : 'let'; if (bad) opt = opt === 'counter' ? 'let' : 'counter';
        return { opt, outcome: out, why: worth ? `${e.name} (skill ${Math.round(e.skill)}) is worth the market rate (${U.money(mv)}/mo)` : offer > mv * 1.2 ? `the offer is well above their market value (${U.money(mv)}/mo)` : `${e.name} can be replaced` };
      }
      case 'fund': { // take the money when cash would not last a year of losses, otherwise keep the equity
        const burn = Math.max(1, -U.avg(b.hist.slice(-3), (x) => x.profit, 0)); const months = g.cash / burn; let opt = months < 12 || g.cash < dec.cash ? 'take' : 'no'; if (bad) opt = opt === 'take' ? 'no' : 'take';
        return { opt, outcome: out, why: opt === 'take' ? `cash ${U.money(g.cash)} lasts about ${Math.round(Math.min(99, months))} months at the current burn` : `cash ${U.money(g.cash)} is enough; keeping the full company` };
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
      if (dec.kind === 'broken') { // v6: a broken machine waits for you or your mechanic; only a destroyed one goes to a manager (replace or scrap)
        const it = b.equip.find((x) => x.id === dec.itemId);
        if (!it || !it.broken) { g.decisions = g.decisions.filter((x) => x !== dec); continue; }
        if (it.broken !== 'destroyed') continue;
      }
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
    // 2) v6: machines are looked after by mechanics (staff), never by managers; see equipment.js E.mechMonth
    // 3) raises for unhappy good people
    h = D.handler(g, b, 'raise');
    if (h) for (const e of S.allStaff(b)) {
      if (e.morale < 38 && e.skill >= 55 && profit3 > 0 && R.chance(0.5)) { S.raise(g, b, e.id); TG.rep.decision(g, b, h.label, `Gave ${e.name} a raise (morale was ${Math.round(e.morale)})`, 'good'); continue; }
      // v9: an HR manager (or GM) raises good people who are likely to be poached, up to their market value
      const po = S.poachOdds(g, b, e);
      if (po.p >= TG.CONFIG.staff.poach.warnAt && e.skill >= 50 && profit3 > 0 && R.chance(h.p)) { const r = S.raise(g, b, e.id, po.gap > 0.2 ? 'market' : 'pct'); if (r && !r.spam) TG.rep.decision(g, b, h.label, `Raised ${e.name} to ${U.money(r.to)}/mo (poach odds were ${U.pct(po.p, 1)} a month)`, 'good'); }
    }
    // 3b) your order: keep spare staff so call-outs don't leave work undone
    h = D.handler(g, b, 'hire');
    const spare = (b.orders && b.orders.spare) || 0;
    if (h && spare > 0 && b.hist.length >= 2) for (const w of b.work || []) {
      if (w.kind !== 'staff' || !w.role || !(w.load > 0) || !w.cap) continue;
      const n = b.staff.filter((e) => e.role === w.role).length; const per = w.cap / Math.max(1, n);
      if (w.cap < w.load * (1 + spare) && (b.target[w.role] || 0) <= n) {
        const add = Math.max(1, Math.ceil((w.load * (1 + spare) - w.cap) / Math.max(1, per)));
        b.target[w.role] = n + Math.min(add, 3);
        TG.rep.decision(g, b, h.label, `Added ${Math.min(add, 3)} ${TG.S.roleDef(b, w.role).label.toLowerCase()} position(s): your order is ${U.pct(spare)} spare, they had ${U.pct(Math.max(0, w.cap / w.load - 1))}`, 'good');
      }
    }
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
    // 5b) stock kept running out: add storage (cheapest per unit)
    h = D.handler(g, b, 'stock');
    if (h && b.stock && lc.limit === 'stock' && b.hist.length >= 2) {
      const need = (lc.served || 0) * 1.25; const before = TG.ST.cap(b);
      if (before < need && g.cash > 20000) { const n = TG.ST.addStorage(g, b, need); if (n) TG.rep.decision(g, b, h.label, `Added ${n} storage (${before.toLocaleString()} → ${TG.ST.cap(b).toLocaleString()}) because stock kept running out`, 'good'); }
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

  // farm sell-vs-store policy ('auto'): managers judge today's price vs the yearly average
  D.farmPolicy = (g, b, good) => {
    const f = b.farm; const mk = g.markets[good || 'grain']; if (!mk) return 'sell';
    const hist = mk.hist || []; const avg = hist.length ? U.avg(hist.slice(-12), (x) => x.p || x) : mk.price;
    const now = TG.W.price(g, good || 'grain', 0);
    const h = D.handler(g, b, 'farm'); if (!h) return 'sell';
    let ratio = now / Math.max(1, avg);
    if (h && (!f.policyRoll || f.policyRoll.m !== g.month)) f.policyRoll = { m: g.month, out: D.roll(h) };
    if (f.policyRoll && f.policyRoll.out === 'bad') ratio = 2 - ratio;
    return ratio < 0.92 && TG.M.farmStoreFree(b) > 1 ? 'store' : 'sell';
  };
  // with no manager, your most skilled worker carries out standing orders (less reliably)
  D.foreman = (g, b) => {
    const kr = TG.M.keyRole(TG.CONFIG.businesses[b.type]); const best = b.staff.filter((e) => e.role === kr).sort((x, y) => y.skill - x.skill)[0];
    if (!best) return null;
    return { e: best, label: `Head ${TG.S.roleDef(b, kr).label.toLowerCase()} ${best.name}`, role: 'foreman', p: U.clamp(0.25 + best.skill / 250, 0.25, 0.6), foreman: true };
  };
  D.orderTaker = (g, b, kind) => D.handler(g, b, kind); // v6: no manager = nobody carries out orders (you do it yourself)
  // farm order: spray & feed the soil of an area when it drops below your line
  D.farmOrders = (g, b) => {
    const f = b.farm, o = f.orders || (f.orders = TG.M.farmDefaultOrders());
    for (const k of TG.M.farmAreas) {
      const so = o.spray && o.spray[k]; const a = f.areas[k]; if (!so || !so.on || !a.acres || a.soil >= so.below) continue;
      const h = D.orderTaker(g, b, 'farm'); if (!h) continue;
      const out = D.roll(h); const L = TG.M.areaLabel(k);
      if (out === 'bad' && R.chance(0.5)) { TG.rep.decision(g, b, h.label, `Forgot your order to spray the ${L} (soil ${U.pct(a.soil)}, your line ${U.pct(so.below)})`, 'bad'); continue; }
      if (out === 'ok' && h.foreman && R.chance(0.4)) continue; // a busy head worker gets to it next month
      const r = TG.M.farmTreat(g, b, k, h.label, out === 'bad' ? 1.5 : 1);
      if (r.ok) TG.rep.decision(g, b, h.label, `Sprayed & fed the ${L}: soil ${U.pct(r.from)} → ${U.pct(r.to)} for ${U.money(r.cost)}${out === 'bad' ? ' (used 50% too much spray)' : ''}`, out === 'bad' ? 'bad' : 'good');
    }
  };
  // v6 cow orders (ONLY with a farm manager / ops / CEO): sell market-ready cattle, cull dry cows, keep the herd within room,
  // keep N months of feed in storage. Without one nothing happens: you do it yourself in the Cows card.
  D.farmCowOrders = (g, b) => {
    const f = b.farm, a = f.areas.cows; if (!a.herd) return; const o = (f.orders = f.orders || TG.M.farmDefaultOrders()).cows || (f.orders.cows = TG.M.cowOrderDefaults());
    const h = D.handler(g, b, 'farm'); if (!h) return;
    const out = D.roll(h); const M = TG.M;
    if (o.sellReady && a.st.ready >= 1) { const r = M.farmSellCattle(g, b, out === 'bad' ? a.st.ready * 0.5 : a.st.ready, 'ready'); if (r.ok) TG.rep.decision(g, b, h.label, `Sold ${r.head} market-ready cattle for ${U.money(r.rev)}`, out === 'bad' ? 'bad' : 'good'); }
    if (o.cullDry && a.st.dry >= 1) { const keep = out === 'bad' ? a.st.dry * 0.5 : 0; const r = M.farmSellCattle(g, b, a.st.dry - keep, 'dry'); if (r.ok) TG.rep.decision(g, b, h.label, `Sold ${r.head} dry/old cows for meat (${U.money(r.rev)})`); }
    if (o.keepRoom) { const cap = M.farmHeadCap(b); const over = a.herd - cap * 0.95; if (over >= 1) { const k = a.st.steer >= over ? 'steer' : a.st.heifer >= over ? 'heifer' : 'calf'; const r = M.farmSellCattle(g, b, Math.min(over, a.st[k]), k); if (r.ok) TG.rep.decision(g, b, h.label, `Herd was over room: sold ${r.head} ${TG.CONFIG.cows.stages[k].label.toLowerCase()} (${U.money(r.rev)})`); } }
    if (o.feedMonths > 0) {
      const fc = M.herdForecast(g, b); let want = 0; for (let i = 1; i <= o.feedMonths; i++) { const moy = U.moy(g.month + i); want += Math.max(0, M.feedNeed(a) - M.grass(g, b, null, moy)); }
      let need = want - (f.feed || 0); if (out === 'bad') need *= R.chance(0.5) ? 0.5 : 1.4;
      if (need >= 1) { const r = M.farmBuyFeed(g, b, need, h.label); if (r.ok) TG.rep.decision(g, b, h.label, `Bought ${r.tons} t of feed (${U.money(r.cost)}) to keep ${o.feedMonths} months in storage`); else TG.rep.decision(g, b, h.label, `Could not buy feed: ${r.msg}`, 'bad'); }
      void fc;
    }
  };
  // farm order: buy seed before planting (a manager buys at the normal price; a head farmhand pays a little more)
  D.farmSeedOrder = (g, b, cov) => {
    const f = b.farm, a = f.areas.crops, e = TG.M.areaE(b, 'crops'), moy = U.moy(g.month);
    if (!f.orders || !f.orders.seed || !a.acres) return;
    const left = e.plant.filter((m) => m >= moy).length || e.plant.length; const pcv = Math.min(cov.pcov, Math.pow(cov.hcov, 0.5));
    let need = a.acres / e.plant.length * left * pcv - f.seeds; if (need <= 0.5) return;
    const h = D.orderTaker(g, b, 'farm'); if (!h) return;
    const out = D.roll(h); if (out === 'bad') need *= R.chance(0.5) ? 1.3 : 0.6;
    const n = TG.M.models.farm.buySeeds(g, b, need, h.foreman ? TG.CONFIG.supply.staffReorderPremium : 0);
    if (out === 'bad' && n > 0) TG.rep.decision(g, b, h.label, `Bought seed for ${n} acres, ${need > a.acres / e.plant.length * left ? 'more than needed' : 'not enough'} for ${Math.round(a.acres)} crop acres`, 'bad');
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
