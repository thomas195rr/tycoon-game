/* v14: people manager, factory-site fit, crime street boss, save notes, property fit for plants. */
(function () {
  const TG = globalThis.TG;
  const C = TG.CONFIG, U = TG.U, R = TG.R, S = TG.S, D = TG.D;
  const X = () => C.v14; const V = TG.V14 = {};

  const sk = (e) => U.clamp(((e && e.skill) || 0) / 100, 0, 1);
  const lerp = (a, t) => a[0] + (a[1] - a[0]) * t;

  // ================= PEOPLE MANAGER =================
  V.people = (b) => b && b.spec && b.spec.people;
  V.peopleFx = (e) => {
    const t = sk(e); const P = X().people;
    return {
      morale: Math.round(lerp(P.morale, t)),
      quit: lerp(P.quitCut, t),
      poach: lerp(P.poachCut, t),
      perk: P.perkShare,
      hires: 1 + (t >= 0.75 ? 1 : 0),
    };
  };
  // what hiring this candidate would change, shown before you pay
  V.peoplePreview = (g, b, cand) => {
    const fx = V.peopleFx(cand); const wage = cand.wage;
    const perk = Math.round(wage * fx.perk);
    const team = (b.staff || []).length;
    let over = 0;
    for (const w of b.work || []) if (w.kind === 'staff' && w.util > X().people.over) over++;
    return { wage, perk, morale: fx.morale, quit: fx.quit, poach: fx.poach, hires: fx.hires, team, over };
  };
  const perk0 = S.perk;
  S.perk = (b, key) => {
    let t = perk0(b, key);
    const p = V.people(b); if (!p) return t;
    const fx = V.peopleFx(p);
    if (key === 'morale') t += fx.morale;
    if (key === 'quitCut') t += fx.quit;
    return t;
  };
  const po0 = S.poachOdds;
  S.poachOdds = (g, b, e, guess) => {
    const o = po0(g, b, e, guess); const p = V.people(b); if (!p || (TG.CONFIG.specialists[e.role])) return o;
    const fx = V.peopleFx(p); o.p = U.clamp(o.p * (1 - fx.poach), 0, TG.CONFIG.staff.poach.max);
    o.reasons = o.reasons.slice(); o.reasons.push(`people manager (skill ~${Math.round(p.skill)}) cuts poach odds`);
    return o;
  };
  // quit odds already go through S.perk('quitCut'), which now includes the people manager
  // staffing: hire so a red work bar comes down. One (or two, if skilled) hire a month. Nothing if you cannot pay.
  V.peopleAct = (g, b) => {
    const p = V.people(b); if (!p || g._pv) return;
    const fx = V.peopleFx(p); let left = fx.hires;
    const rows = (b.work || []).filter((w) => w.kind === 'staff' && w.role && w.util > X().people.over && !TG.CONFIG.specialists[w.role]).sort((a, c) => c.util - a.util);
    for (const w of rows) {
      if (left <= 0) break;
      let pool = S.poolFor(g, b, w.role);
      if (TG.V13 && TG.V13.filter) pool = TG.V13.filter(g, b, w.role, pool, p.name);
      pool = pool.filter((c) => c.wage * 3 <= Math.max(0, g.cash));
      if (!pool.length) { TG.rep.decision(g, b, p.name, `Wanted another ${((S.roleDef(b, w.role) || {}).label || 'worker').toLowerCase()} so the team is not overworked, but nobody affordable applied`, 'ok'); continue; }
      const best = pool.slice().sort((a, c) => (c.skillSeen != null ? c.skillSeen : c.skill) - (a.skillSeen != null ? a.skillSeen : a.skill))[0];
      S.hire(g, b, best, p.name); left--;
      TG.rep.decision(g, b, p.name, `Hired ${best.name} so ${((S.roleDef(b, w.role) || {}).label || 'the team').toLowerCase()}s are not overworked (${Math.round(w.util * 100)}% busy)`, 'good');
    }
  };
  const manage0 = D.manage;
  D.manage = (g, b) => { const r = manage0(g, b); try { V.peopleAct(g, b); } catch (e) { /* a bad hire must not stop the month */ } return r; };

  // ================= FACTORY SITES =================
  // A plant in a hotel or a giant city building looked "great" and the rent ate the profit.
  const suit0 = TG.P.suit;
  TG.P.suit = (p, type) => {
    let s = suit0(p, type);
    if (type === 'factory') {
      if (p.kind !== 'warehouse') s *= 0.42;
      if (p.sqft > 55000) s *= 0.72;
    }
    return U.clamp(s, 0, 1);
  };

  // ================= CRIME: STREET BOSS =================
  V.bossFx = (e) => {
    const t = sk(e);
    return { order: 0.85 + 0.2 * t, waste: 0.25 - 0.15 * t, hire: t >= 0.45 };
  };
  V.bossPreview = (g, e) => {
    const fx = V.bossFx(e); const k = C.crime;
    return { wage: e.wage, order: fx.order, waste: fx.waste, hire: fx.hire, perk: 'Buys about ' + Math.round(fx.order * 100) + '% of what clients will want, and replaces crew who leave.' };
  };
  V.crimeBoss = (g) => {
    const c = g.crime; if (!c || !c.started || !TG.CR.on(g) || TG.CR.jailed(g)) return;
    const boss = c.mgr && c.mgr.boss; if (!boss) return;
    const k = C.crime; const fx = V.bossFx(boss);
    // reorder the product clients want most, up to stash room, paid from street cash
    const products = Object.keys(k.products).filter((p) => TG.CR.unlocked(g, k.products[p].unlock));
    if (products.length && c.supplier) {
      const p = products.slice().sort((a, b2) => (c.clients * k.products[b2].want) - (c.clients * k.products[a].want))[0];
      const dem = Math.max(0, (c.clients || 0) * k.products[p].want * (0.5 + c.rep / 100));
      const have = c.stock[p] || 0; let want = Math.max(0, dem * fx.order - have);
      if (R.chance(fx.waste)) want *= R.chance(0.5) ? 0.7 : 1.3; // skill: a weak boss over- or under-orders
      want = Math.floor(Math.min(want, TG.CR.room(g) - TG.CR.units(g)));
      if (want >= 10) {
        const r = TG.CR.buy(g, c.supplier || 'plug', p, want);
        if (r && r.ok && r.got) TG.rep.event(g, null, 'info', `🕶️ ${boss.name} bought ${Math.round(r.got).toLocaleString()} ${k.products[p].label}`, `Street boss, skill ~${Math.round(boss.skill)}. Aimed for about ${Math.round(fx.order * 100)}% of what clients want.`);
      }
    }
    // replace a missing crew role up to the count you had (stored as c.keep)
    c.keep = c.keep || {};
    if (fx.hire) {
      for (const role of Object.keys(k.crew)) {
        const need = c.keep[role] || 0; const have = TG.CR.count(g, role);
        if (have >= need || need < 1) continue;
        const cand = (TG.CR.candidates(g) || []).filter((x) => x.role === role).sort((a, b2) => b2.skill - a.skill)[0];
        if (!cand) continue;
        const fee = Math.round(cand.wage * k.hireCost); if (c.dirty < fee + cand.wage) continue;
        const r = TG.CR.hire(g, cand.id);
        if (r && r.ok) TG.rep.event(g, null, 'info', `🕶️ ${boss.name} hired ${cand.name} (${k.crew[role].label})`, 'A crew spot you were holding was empty.');
      }
    }
  };
  const crMonth = TG.CR.month;
  TG.CR.month = (g) => { try { V.crimeBoss(g); } catch (e) { /* boss must not stop the month */ } return crMonth(g); };
  const hireCrew = TG.CR.hire;
  TG.CR.hire = (g, id) => {
    const r = hireCrew(g, id); if (r && r.ok && g.crime) { const e = g.crime.crew[g.crime.crew.length - 1]; g.crime.keep = g.crime.keep || {}; if (e) g.crime.keep[e.role] = TG.CR.count(g, e.role); }
    return r;
  };
  const fireCrew = TG.CR.fire;
  TG.CR.fire = (g, id) => { const c = g.crime; const e = c && c.crew.find((x) => x.id === id); const role = e && e.role; fireCrew(g, id); if (c && role) { c.keep = c.keep || {}; c.keep[role] = TG.CR.count(g, role); } };
  TG.CR.bossPool = (g) => {
    const c = TG.CR.ensure(g); if (c.bossM === g.month && c.bossCands) return c.bossCands;
    c.bossM = g.month; c.bossCands = [];
    const W = X().crimeMgr.boss;
    for (let i = 0; i < 3; i++) {
      const skill = Math.round(U.clamp(R.normal(48 + c.rep / 8, 14), 8, 96));
      c.bossCands.push({ id: U.uid('m'), name: S.name(), role: 'boss', skill, wage: Math.round(U.lerp(W.wage[0], W.wage[1], skill / 100) * g.world.priceIdx / 10) * 10 });
    }
    return c.bossCands;
  };
  TG.CR.hireBoss = (g, id) => {
    const c = TG.CR.ensure(g); if (TG.CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    const k = TG.CR.bossPool(g).find((x) => x.id === id); if (!k) return { ok: false, msg: 'They moved on.' };
    if (c.dirty < k.wage) return { ok: false, msg: `Needs ${U.money(k.wage)} street cash for the first month.` };
    c.dirty -= k.wage; c.mgr = c.mgr || {}; c.mgr.boss = Object.assign({}, k, { since: g.month, morale: 70 }); c.started = true;
    return { ok: true };
  };
  TG.CR.fireBoss = (g) => { const c = g.crime; if (c && c.mgr) c.mgr.boss = null; };

  // ================= MIGRATION v13 -> v14 =================
  V.migrate = (g) => {
    for (const b of g.businesses || []) if (b.tech && b.tech.userAvg == null) b.tech.userAvg = b.tech.users || 0;
    if (g.crime && !g.crime.mgr) g.crime.mgr = {};
    g.v14notes = [
      '🛠️ Gear: pick a quality, then Buy. You can buy many at once. The price each and the total show before you confirm.',
      '💛 People manager: a late-game boss for each business. Keeps morale up, cuts quitting and poaching, and hires so nobody is overworked. Part of the high salary is team perks. The CEO "keep hired" list includes them.',
      '🏭 Manufacturing: a sensible plant can make money. Quick setup buys a line you can afford (or leases one), stocks materials, and will not hire a crew for a line it did not get. The best sites are warehouses, not giant city buildings. The plant keeps selling when the price still covers materials.',
      '💾 Save slots: your old save is Game 1. You can keep more games, rename them, and delete one after a confirmation.',
      '💻 Sales cannot go past what the servers (or other capacity) can handle, and a one-month spike no longer inflates the sale price.',
      '🕶️ Crime has a street boss so buying product and replacing crew can run without you. Cooks make the product you pick, and the amount depends on how many cooks you have and how good they are.',
    ];
    g.v = 14;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 14) V.migrate(g); return g; };
})();
