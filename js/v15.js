/* v15: three manager roles, GM+mechanic repairs never ask you, crime corner that can sell, street boss training. */
(function () {
  const TG = globalThis.TG;
  const C = TG.CONFIG, U = TG.U, R = TG.R, S = TG.S, D = TG.D, E = TG.E, F = TG.F;
  const V = TG.V15 = {};

  // ================= 1. FEWER MANAGER ROLES =================
  C.specialists.gm.desc = 'Keeps the place running. Orders supplies and fuel, handles machines (repair with a mechanic, replace what is destroyed), and runs farm orders. Works on the job at 25% of a worker. Does not hire people.';
  C.specialists.hr.desc = 'Does all the hiring. Screens out bad fits, gets a discount on wages, and works to keep people (raises and rival offers).';
  if (C.specialists.people) C.specialists.people.desc = 'Keeps people safe and in a good mood, and cuts quitting and poaching. Lowers injury odds. Part of the high pay is team perks. Hires extra hands when a team is overworked.';
  delete C.specialists.ops; delete C.specialists.safety;
  if (C.perks) {
    delete C.perks.ops; delete C.perks.safety;
    // the GM keeps the place running, so the old Ops perks move here
    C.perks.gm = [[0, 'breakCut', 0.1, '-10% breakdown odds'], [40, 'supplyCut', 0.03, '-3% supply costs (better orders)'], [60, 'wearCut', 0.1, '-10% machine wear'], [80, 'staffMult', 0.03, '+3% work done (smoother shifts)']];
  }
  C.staff.mgrWorkRoles = ['gm'];
  // help pages: the old Ops lines now point at the GM
  if (C.v12 && C.v12.help) for (const t in C.v12.help) {
    const h = C.v12.help[t];
    for (const k of ['mgrs', 'start', 'risks', 'costs']) if (h[k]) h[k] = h[k].map((s) => String(s)
      .replace(/Hire an Ops manager or GM when you can, so supplies are ordered for you/g, 'Hire a GM when you can, so supplies and fuel are ordered for you')
      .replace(/Hire an Ops manager so orders run every month/g, 'Hire a GM so farm orders run every month')
      .replace(/📋 Ops \(farm boss\): buys seed & feed, sprays fields, sells cattle/g, '🧑‍💼 GM: buys seed, feed and fuel, sprays fields, sells cattle')
      .replace(/📋 Ops: /g, '🧑‍💼 GM: ')
      .replace(/Ops manager/g, 'GM')
      .replace(/safety officer/gi, 'people manager'));
  }
  V.moveRole = (b, from, to, notes) => {
    const e = b.spec && b.spec[from]; if (!e) return;
    e.role = to;
    const cur = b.spec[to];
    if (!cur) { b.spec[to] = e; notes.push(`${e.name} (${b.name}) moved from ${from === 'ops' ? 'Ops manager' : 'Safety officer'} to ${C.specialists[to] ? C.specialists[to].label : to}. Same skill, training and pay.`); }
    else if ((e.skill || 0) > (cur.skill || 0)) {
      b.spec[to] = e;
      notes.push(`${e.name} is now the ${C.specialists[to].label} at ${b.name} (higher skill than ${cur.name}, who left when the jobs merged). Skill, training and pay kept.`);
    } else notes.push(`${e.name} (${from === 'ops' ? 'Ops' : 'Safety'} at ${b.name}) left when that job merged into the ${C.specialists[to].label}. ${cur.name} stayed (higher skill).`);
    delete b.spec[from];
    b.keep = b.keep || {}; if (b.keep[from]) { b.keep[to] = true; delete b.keep[from]; }
  };

  // ================= 2. GM + MECHANIC: REPAIR WITHOUT ASKING =================
  V.autoFix = (g, b, it) => {
    const gm = b.spec && b.spec.gm; if (!gm || !E.hasMech(b) || g._pv) return false;
    const who = `${gm.name} (GM)`;
    if (it.broken !== 'destroyed') {
      const cost = it.warranty > 0 || it.leased ? 0 : E.repairCost(g, b, it);
      const ok = E.repair(g, b, it.id, who);
      if (!ok) TG.rep.decision(g, b, who, `Could not afford to repair ${it.label} (${U.money(cost)})`, 'bad');
      return true;
    }
    const like = b.orders && b.orders.replaceLike;
    const tier = like ? it.tier : (g.cash > E.price(g, b, it.type, 'standard') * 3 ? 'standard' : 'budget');
    const why = like ? 'your like-for-like order' : (tier === 'standard' ? 'cash is healthy, so a standard replacement' : 'cash is tighter, so a budget replacement');
    const ok = E.replace(g, b, it.id, tier, who);
    if (ok) TG.rep.decision(g, b, who, `Replaced the destroyed ${it.label} (${why})`, 'good');
    return true;
  };
  const q0 = E.queueBroken;
  E.queueBroken = (g, b, it) => { if (V.autoFix(g, b, it)) return; return q0(g, b, it); };
  const br0 = E.breakItem;
  E.breakItem = (g, b, it, bc, ctx) => {
    const auto = b.spec && b.spec.gm && E.hasMech(b) && !g._pv;
    br0(g, b, it, bc, ctx);
    if (!auto || !g.cur || !g.cur.events) return;
    for (let i = g.cur.events.length - 1; i >= 0 && i >= g.cur.events.length - 3; i--) {
      const ev = g.cur.events[i]; if (ev && ev.bizId === b.id && ev.major === 'breakdown') ev.major = null;
    }
  };

  // ================= 3. STREET BOSS TRAINING (street cash) =================
  V.boss = (g) => g.crime && g.crime.mgr && g.crime.mgr.boss;
  V.bossTrainPreview = (g, level) => {
    const e = V.boss(g); if (!e) return null;
    const basic = level !== 'advanced';
    const cost = Math.round((basic ? 1800 : 4500) * g.world.priceIdx);
    const dim = S.trainDim(e.skill);
    const span = basic ? [4, 9] : [6, 12];
    const lo = Math.round(span[0] * dim), hi = Math.round(span[1] * dim), avg = (lo + hi) / 2;
    const now = TG.V14.bossFx(e), after = TG.V14.bossFx(Object.assign({}, e, { skill: U.clamp(e.skill + avg, 1, 99) }));
    return { cost, lo, hi, now: now.order, after: after.order, wasteNow: now.waste, wasteAfter: after.waste };
  };
  V.bossTrain = (g, level) => {
    const e = V.boss(g); const c = g.crime; const p = V.bossTrainPreview(g, level); if (!e || !p) return { ok: false, msg: 'No street boss.' };
    if (c.dirty < p.cost) return { ok: false, msg: `Training costs ${U.money(p.cost)} street cash.` };
    c.dirty -= p.cost;
    if (S.spam(g, e, 'train')) { e.loyalty = U.clamp((e.loyalty || 60) - 3, 0, 100); return { ok: true, spam: true }; }
    const from = Math.round(e.skill); e.skill = U.clamp(e.skill + R.range(p.lo, p.hi), 1, 99);
    return { ok: true, from, to: Math.round(e.skill), cost: p.cost };
  };
  V.bossRaisePreview = (g) => {
    const e = V.boss(g); if (!e) return null;
    const to = Math.round(e.wage * (1 + C.staff.raisePct) / 10) * 10;
    const now = TG.V14.bossFx(e), after = TG.V14.bossFx(e);
    return { to, add: to - e.wage, now: now.order, after: after.order };
  };
  V.bossRaise = (g) => {
    const e = V.boss(g); if (!e) return { ok: false };
    if (S.spam(g, e, 'raise')) return { ok: true, spam: true };
    const from = e.wage; e.wage = V.bossRaisePreview(g).to; e.morale = U.clamp((e.morale || 70) + C.staff.raiseMorale, 0, 100);
    return { ok: true, from, to: e.wage };
  };
  V.bossBonus = (g) => {
    const e = V.boss(g); const c = g.crime; if (!e) return { ok: false };
    const cost = Math.round(e.wage * 0.5); if (c.dirty < cost) return { ok: false, msg: `Bonus costs ${U.money(cost)} street cash.` };
    c.dirty -= cost;
    if (S.spam(g, e, 'bonus')) { e.morale = U.clamp((e.morale || 70) - 4, 0, 100); return { ok: true, spam: true, cost }; }
    e.morale = U.clamp((e.morale || 70) + C.staff.bonusMorale, 0, 100); e.loyalty = U.clamp((e.loyalty || 60) + 8, 0, 100);
    return { ok: true, cost, morale: e.morale };
  };

  // ================= MIGRATION =================
  V.migrate = (g) => {
    const notes = [];
    for (const b of g.businesses || []) {
      if (!b.spec) continue;
      V.moveRole(b, 'ops', 'gm', notes);
      V.moveRole(b, 'safety', 'people', notes);
    }
    notes.unshift('👔 Fewer bosses. HR does all the hiring and keeps people. The GM buys supplies and fuel and keeps things running (the Ops manager is gone). The people manager keeps everyone safe and in a good mood (the Safety officer is gone).');
    notes.push('🔧 If you have a mechanic and a GM, broken machines are fixed or replaced for you. The cost is in the monthly report. The month does not stop to ask.');
    notes.push('🕶️ The street corner already has a few regulars when you first move cash over. Cooks, heat and cleaning are explained on the crime home screen. The street boss can be trained, raised and given a bonus (paid from street cash).');
    g.v15notes = notes; g.v = 15;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 15) V.migrate(g); return g; };
})();
