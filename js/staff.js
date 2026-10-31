/* staff.js - employees, candidates, hiring, training, morale, quitting, theft, poaching. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const S = {};
  const FIRST = ['Alex','Sam','Jordan','Taylor','Casey','Riley','Morgan','Jamie','Avery','Quinn','Drew','Reese','Parker','Rowan','Skyler','Blake','Cameron','Dana','Elliot','Frankie','Harper','Jesse','Kai','Logan','Marley','Noel','Oakley','Peyton','Remy','Sasha','Toni','Val','Wren','Zion','Luis','Maria','Wei','Aisha','Omar','Priya','Kenji','Sofia','Mateo','Nina','Ivan','Leah','Marco','Tess','Hugo','Iris'];
  const LAST = ['Smith','Garcia','Chen','Patel','Johnson','Okafor','Nguyen','Kowalski','Rossi','Murphy','Silva','Kim','Novak','Brown','Ali','Haddad','Larsen','Moreau','Tanaka','Diaz','Fischer','Reyes','Walsh','Ito','Mensah','Costa','Price','Hughes','Ward','Bell'];
  S.name = () => R.pick(FIRST) + ' ' + R.pick(LAST);

  // role info for a business role or specialist
  S.roleDef = (b, role) => {
    if (TG.CONFIG.specialists[role]) {
      const sp = TG.CONFIG.specialists[role]; const d = b && b.type ? TG.CONFIG.businesses[b.type] : null;
      const k = d ? TG.CONFIG.staff.specWageByTier[d.tier] || 1 : 1;
      return Object.assign({ specialist: true }, sp, { wage: [Math.round(sp.wage[0] * k), Math.round(sp.wage[1] * k)] });
    }
    if (role === 'ceo') return { label: 'CEO', wage: TG.CONFIG.ceo.wage, specialist: true };
    if (role === 'rem') return { label: 'Property manager', wage: [900, 2800], specialist: true };
    return TG.CONFIG.businesses[b.type].roles[role];
  };

  // v7: an HR manager negotiates lower wages for the same skill and screens out some bad fits. Odds, not magic:
  // the cheapest deals are the likeliest duds, and people paid under the going rate are less happy.
  S.hrOf = (b) => (b && b.spec && b.spec.hr) || null;
  S.hrDisc = (hr) => U.clamp(0.02 + 0.13 * (hr.skill || 50) / 100, 0.02, 0.15); // average wage cut
  S.hrScreen = (hr) => U.clamp(0.2 + 0.6 * (hr.skill || 50) / 100, 0.2, 0.8);  // share of unreliable / dishonest applicants spotted
  S.candidate = (g, b, role, labor, noHR, opts) => {
    const e = S.candidate0(g, b, role, labor, opts); const hr = !noHR && S.hrOf(b);
    if (!hr || TG.CONFIG.specialists[role] || role === 'ceo' || role === 'rem' || !b.type) return e;
    let c = e;
    if ((c.reliability < 50 || c.honesty < 40) && R.chance(S.hrScreen(hr))) { c = S.candidate0(g, b, role, labor, opts); c.screened = true; }
    if (R.chance(S.hrScreen(hr) + 0.15)) { c.persSeen = true; c.persByHR = true; } // v9: HR reads people: spots the loyal bargains and the job-hoppers
    const disc = U.clamp(S.hrDisc(hr) + R.normal(0, 0.035), 0, 0.22);
    c.listWage = c.wage; c.wage = Math.round(c.wage * (1 - disc) / 10) * 10; c.hrDisc = disc;
    if (disc > S.hrDisc(hr) && R.chance(0.15 + (disc - S.hrDisc(hr)) * 3)) { // a bargain that is a bargain for a reason
      c.reliability = U.clamp(c.reliability - R.int(15, 35), 5, 99); c.attitude = U.clamp(c.attitude - R.int(5, 20), 5, 99); c.dud = true;
    }
    return c;
  };
  // Generate a candidate. labor = property labor pool (0..1)
  S.candidate0 = (g, b, role, labor, opts) => {
    const C = TG.CONFIG, rd = S.roleDef(b, role); opts = opts || {};
    labor = U.clamp(labor == null ? 0.5 : labor, 0.02, 1);
    const qr = R.next(); const quals = opts.trainee ? R.range(C.staff.trainee.quals[0], C.staff.trainee.quals[1]) : U.clamp(Math.pow(qr, 1.25 - labor * 0.6), 0, 1);
    const skill = U.clamp(Math.round(C.staff.skillByQuals[0] + quals * C.staff.skillByQuals[1] + R.normal(0, C.staff.skillNoise)), 5, 99);
    const regionWage = b && b.region ? C.regions[b.region].wage : 1;
    const locWage = b && b.loc ? C.locations[b.loc].wage : 1;
    const scarcity = 1 + (1 - labor) * 0.3;
    const wage = Math.round(U.lerp(rd.wage[0], rd.wage[1], U.clamp(quals * 0.75 + R.next() * 0.25, 0, 1)) * regionWage * locWage * scarcity * g.world.wageIdx / 10) * 10;
    const e = {
      id: U.uid('e'), name: S.name(), role, wage, quals: Math.round(quals * 100), skill,
      years: Math.round(quals * 15 + R.next() * 3),
      attitude: U.clamp(Math.round(R.normal(55 + quals * 10, 18)), 5, 99),
      reliability: U.clamp(Math.round(R.normal(60 + quals * 10, 16)), 5, 99),
      honesty: U.clamp(Math.round(R.normal(70, 18)), 5, 99),
      temper: U.clamp(Math.round(R.normal(35, 18)), 1, 99),
      ambition: U.clamp(Math.round(R.normal(45 + quals * 15, 20)), 1, 99),
      learning: R.chance(C.staff.learnNoResponse) ? R.range(0.05, 0.25) : R.range(0.6, 1.5),
      loyalty: Math.round(R.range(10, 40)),
      morale: Math.round(R.range(55, 75)), months: 0,
      revealed: { reliability: false, honesty: false, temper: false },
      skillSeen: U.clamp(skill + Math.round(R.normal(0, 9)), 1, 99),
    };
    if (rd.specialist) {
      e.trait = R.chance(C.traits.reckless) ? 'reckless' : R.chance(C.traits.cautious) ? 'cautious' : R.chance(C.traits.dishonest) ? 'dishonest' : 'steady';
      if (e.trait === 'dishonest') e.honesty = Math.min(e.honesty, 30);
    }
    // v9: personality (hidden until you have worked with them a few months, or HR reads it at the interview)
    e.pers = R.weighted({ loyal: C.staff.pers.loyal.w, steady: C.staff.pers.steady.w, climber: C.staff.pers.climber.w }); e.persSeen = false;
    if (opts.trainee) {
      e.trainee = true; e.learning = R.range(C.staff.trainee.learn[0], C.staff.trainee.learn[1]);
      e.wage = Math.round(S.mv(g, b, e) * R.range(C.staff.trainee.pay[0], C.staff.trainee.pay[1]) / 10) * 10;
    }
    if (role === 'ceo') e.profitShare = +(U.lerp(C.ceo.profitShare[0], C.ceo.profitShare[1], quals)).toFixed(3);
    return e;
  };

  S.poolFor = (g, b, role) => {
    b.pools = b.pools || {};
    const key = role;
    if (b.pools[key] && b.pools[key].month === g.month) return b.pools[key].list;
    const C = TG.CONFIG, rd = S.roleDef(b, role);
    let labor = b.labor == null ? 0.5 : b.labor;
    let n = R.int(C.staff.poolSize[0], C.staff.poolSize[1]);
    if (rd.licensed || role === 'lawyer' || role === 'ceo') n = Math.round(n * Math.pow(labor, 1.2) + (labor > 0.5 ? 1 : 0));
    else n = Math.max(1, Math.round(n * (0.4 + labor * 0.8)));
    if (role === 'driver' && g.world.driverShortage > 0) n = Math.max(0, Math.round(n * 0.4));
    const list = [];
    for (let i = 0; i < n; i++) list.push(S.candidate(g, b, role, labor));
    // v9: a couple of cheap trainees for regular (unlicensed) jobs: low skill, low pay, can be trained up
    if (!rd.specialist && !rd.licensed && role !== 'ceo' && role !== 'rem' && b.type) { const k = R.int(C.staff.trainee.n[0], C.staff.trainee.n[1]); for (let i = 0; i < k; i++) list.push(S.candidate(g, b, role, labor, false, { trainee: true })); }
    b.pools[key] = { month: g.month, list };
    return list;
  };

  S.allStaff = (b) => {
    const out = (b.staff || []).slice();
    for (const k in b.spec || {}) if (b.spec[k]) out.push(b.spec[k]);
    return out;
  };
  S.keyStaff = (b) => (b.staff || []).filter((e) => { const r = TG.CONFIG.businesses[b.type].roles[e.role]; return r && r.key; });

  S.hire = (g, b, cand, by) => {
    const pool = b.pools && b.pools[cand.role];
    if (pool) pool.list = pool.list.filter((c) => c.id !== cand.id);
    cand.hired = g.month; cand.months = 0;
    if (TG.CONFIG.specialists[cand.role]) { b.spec = b.spec || {}; if (b.spec[cand.role]) S.removeSpec(g, b, cand.role, 'replaced'); b.spec[cand.role] = cand; }
    else b.staff.push(cand);
    if (b.fixes && b.fixes.certified) cand.skill = Math.max(cand.skill, 45);
    TG.rep.staff(g, b, `${by ? by + ' hired' : 'Hired'} ${cand.name} as ${S.roleDef(b, cand.role).label} (${U.money(cand.wage)}/mo)`);
    return cand;
  };
  S.removeSpec = (g, b, role, why) => { const e = b.spec[role]; if (!e) return; b.spec[role] = null; TG.rep.staff(g, b, `${e.name} (${S.roleDef(b, role).label}) left: ${why}`); };

  S.fire = (g, b, empId, reason) => {
    const C = TG.CONFIG;
    let e = b.staff.find((x) => x.id === empId), spec = null;
    if (!e) for (const k in b.spec) if (b.spec[k] && b.spec[k].id === empId) { e = b.spec[k]; spec = k; }
    if (!e) return false;
    const sev = Math.round(e.wage * C.staff.severanceMonths);
    TG.F.spend(g, sev, 'Severance', b.id);
    if (spec) b.spec[spec] = null; else b.staff = b.staff.filter((x) => x.id !== empId);
    for (const o of S.allStaff(b)) o.morale = U.clamp(o.morale - 3, 0, 100);
    TG.rep.staff(g, b, `Let go ${e.name} (${reason || 'fired'}), severance ${U.money(sev)}`);
    if (!e.revealed.honesty || e.honesty > 40) {
      if (R.chance(C.staff.wrongfulFireChance)) TG.B.lawsuit(g, b, 'Wrongful termination claim by ' + e.name, Math.max(C.lawsuits.suitMin, e.wage * R.range(3, 10)), 'liability', 'Fired employee with no documented cause');
    }
    return true;
  };

  // v9: training takes part of their month (less work done this month), gains shrink at high skill, some people barely learn
  S.trainDim = (skill) => (skill < 60 ? 1 : Math.max(0.25, 1 - (skill - 60) / 50));
  S.trainPreview = (g, b, e, level) => {
    const C = TG.CONFIG, t = level === 'advanced' ? C.staff.trainAdvanced : C.staff.trainBasic; const growth = (b.fixesOn && b.fixesOn.skillGrowth) || 1;
    const dim = S.trainDim(e.skill); const lr = e.learnSeen ? e.learning : 1;
    const lo = Math.round(t.skill[0] * dim * growth * (e.learnSeen ? lr : 0.6)), hi = Math.round(t.skill[1] * dim * growth * (e.learnSeen ? lr : 1.4));
    const avg = Math.round((t.skill[0] + t.skill[1]) / 2 * dim * growth * lr);
    const away = C.staff.trainAway[level === 'advanced' ? 'advanced' : 'basic'];
    const mv0 = S.mv(g, b, e), mv1 = S.mv(g, b, Object.assign({}, e, { skill: Math.min(99, e.skill + avg) }));
    return { cost: t.cost, lo, hi, avg, dim, away, noStick: e.learnSeen ? (e.learning < 0.3 ? 1 : 0) : C.staff.learnNoResponse, mv0, mv1 };
  };
  S.learnLabel = (e) => (!e.learnSeen ? 'not known yet (shows after the first training)' : e.learning < 0.3 ? 'barely learns from training' : e.learning < 0.9 ? 'learns at a normal pace' : e.learning < 1.2 ? 'learns well' : 'fast learner');
  S.train = (g, b, empId, level) => {
    const C = TG.CONFIG, t = level === 'advanced' ? C.staff.trainAdvanced : C.staff.trainBasic;
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return null;
    if (g.cash < t.cost) return null;
    TG.F.spend(g, t.cost, 'Training', b.id, true);
    if (S.spam(g, e, 'train')) return { gain: 0, att: 0, spam: true };
    const growth = (b.fixesOn && b.fixesOn.skillGrowth) || 1; const mv0 = S.mv(g, b, e);
    const gain = Math.round(R.range(t.skill[0], t.skill[1]) * e.learning * growth * S.trainDim(e.skill));
    const att = Math.round(R.range(t.attitude[0], t.attitude[1]) * e.learning);
    e.skill = U.clamp(e.skill + gain, 1, 99); e.skillSeen = e.skill; e.attitude = U.clamp(e.attitude + att, 1, 99);
    e.morale = U.clamp(e.morale + 4, 0, 100); e.learnSeen = true; e.trained = (e.trained || 0) + 1;
    const away = C.staff.trainAway[level === 'advanced' ? 'advanced' : 'basic']; e.away = U.clamp((e.away || 0) + away, 0, 0.7);
    return { gain, att, away, mv0, mv1: S.mv(g, b, e) };
  };

  // true when this click is past the monthly limit: it backfires (morale down) and gives nothing
  S.spam = (g, e, kind) => {
    const C = TG.CONFIG.staff; const n = TG.USES.take(e, kind, g.month);
    if (n <= C.perMonth[kind]) return false;
    e.morale = U.clamp(e.morale - C.spamMorale, 0, 100); return true;
  };
  S.usesLeft = (g, e, kind) => TG.USES.left(e, kind, g.month, TG.CONFIG.staff.perMonth[kind]);
  // total effect of unlocked manager perks at this business, e.g. S.perk(b, 'demand') = 0.05
  S.perk = (b, key) => {
    const P = TG.CONFIG.perks; let t = 0; if (!b || !b.spec) return 0;
    for (const r in P) { const e = b.spec[r]; if (!e) continue; for (const [lvl, k, v] of P[r]) if (k === key && e.skill >= lvl) t += v; }
    return t;
  };
  // v9: raise by the usual % or straight to their market value. Bigger raises lift morale more.
  S.raiseTo = (g, b, e, mode) => { const p = Math.round(e.wage * (1 + TG.CONFIG.staff.raisePct) / 10) * 10; if (mode !== 'market') return p; return Math.max(Math.round(S.mv(g, b, e) / 10) * 10, e.wage + 10); };
  S.raisePreview = (g, b, e, mode) => { const to = S.raiseTo(g, b, e, mode); const now = S.poachOdds(g, b, e); const after = S.poachOdds(g, b, Object.assign({}, e, { wage: to, loyalty: Math.min(100, e.loyalty + 5) })); return { to, add: to - e.wage, cost: Math.round((to - e.wage) * (1 + TG.CONFIG.staff.payrollTax)), pNow: now.p, pAfter: after.p }; };
  S.raise = (g, b, empId, mode) => {
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return;
    if (S.spam(g, e, 'raise')) return { spam: true };
    const from = e.wage; const to = S.raiseTo(g, b, e, mode); const k = U.clamp((to - from) / Math.max(1, from) / TG.CONFIG.staff.raisePct, 0.5, 2.5);
    e.wage = to; e.morale = U.clamp(e.morale + TG.CONFIG.staff.raiseMorale * k, 0, 100); e.loyalty = U.clamp(e.loyalty + 5, 0, 100);
    return { from, to };
  };
  S.bonus = (g, b, empId) => {
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return;
    TG.F.spend(g, Math.round(e.wage * 0.5), 'Bonuses', b.id); if (S.spam(g, e, 'bonus')) return { spam: true }; e.morale = U.clamp(e.morale + TG.CONFIG.staff.bonusMorale, 0, 100);
  };
  S.backgroundCheck = (g, b, cand) => {
    TG.F.spend(g, TG.CONFIG.staff.backgroundCheck, 'Background checks', b.id);
    cand.revealed.honesty = true; cand.revealed.temper = true; cand.revealed.reliability = true; cand.skillSeen = cand.skill;
  };
  // promote a regular employee to a specialist / manager role. Their manager skill can surprise you.
  S.promote = (g, b, empId, role) => {
    const e = b.staff.find((x) => x.id === empId); if (!e) return null;
    b.staff = b.staff.filter((x) => x.id !== empId);
    e.role = role; e.wage = Math.round(e.wage * 1.35);
    e.skill = U.clamp(Math.round(e.skill * 0.6 + R.normal(25, 15)), 5, 99); e.skillSeen = e.skill;
    e.trait = R.chance(0.12) ? 'reckless' : R.chance(0.15) ? 'cautious' : 'steady';
    e.morale = U.clamp(e.morale + 15, 0, 100); e.loyalty = U.clamp(e.loyalty + 15, 0, 100);
    b.spec = b.spec || {}; if (b.spec[role]) S.removeSpec(g, b, role, 'replaced by a promotion');
    b.spec[role] = e;
    TG.rep.staff(g, b, `Promoted ${e.name} to ${S.roleDef(b, role).label}`);
    return e;
  };

  // Monthly staff simulation for one business. ctx from business sim.
  S.month = (g, b, ctx) => {
    const C = TG.CONFIG, cs = C.staff;
    const all = S.allStaff(b);
    const hasHR = !!(b.spec && b.spec.hr), hasGM = !!(b.spec && b.spec.gm);
    const cams = !!(b.fixes && b.fixes.cameras);
    const fixMorale = (b.fixesOn && b.fixesOn.morale) || 0;
    const payrollAdd = (b.fixesOn && b.fixesOn.payrollAdd) || 0;
    for (const e of all) {
      e.months++;
      if (e.months >= 3) { e.revealed.reliability = true; e.persSeen = true; }
      if (e.months >= 2) e.skillSeen = e.skill;
      // experience growth
      const growth = (b.fixesOn && b.fixesOn.skillGrowth) || 1;
      if (e.skill < 95 && R.chance(0.5)) { const s0 = e.skill; e.skill = U.clamp(e.skill + (cs.expSkillPerYear / 6) * e.learning * growth * (e.skill > 80 ? 0.4 : 1), 1, 99); e.expGain = (e.expGain || 0) + (e.skill - s0); } // v9: skill learned on YOUR job counts only partly to other companies (S.mv)
      e.loyalty = U.clamp(e.loyalty + 0.6, 0, 100);
      // morale target
      const fair = S.mv(g, b, e); const pw = S.persDef(e).payWeight; // v9: market value for their skill; loyal people mind low pay less
      const payDelta = U.clamp((e.wage * (1 + payrollAdd) - fair) / fair, -0.5, 0.5) * (e.wage < fair ? pw : 1);
      let target = 58 + payDelta * 60 + (hasHR ? 8 : 0) + (hasGM ? 4 : 0) + fixMorale - Math.max(0, (ctx.busy || 0) - 0.95) * 60;
      if (ctx.missedPayroll) target -= 30;
      if (b.ownerOp) target += 3;
      target = U.clamp(target, 0, 100);
      e.morale = U.clamp(e.morale + (target + S.perk(b, 'morale') - e.morale) * cs.moraleDrift + R.normal(0, 2), 0, 100);
      if (ctx.missedPayroll) e.morale = U.clamp(e.morale + cs.missedPayrollMorale * 0.5, 0, 100);
    }
    // quitting
    for (const e of all.slice()) {
      const low = e.morale < 35 ? cs.quitLowMorale * (35 - e.morale) / 35 : 0;
      let p = (cs.quitBase + low) * (0.6 + e.ambition / 100) * (1.2 - e.loyalty / 125) * (hasHR ? 0.75 : 1) * (1 - S.perk(b, 'quitCut'));
      if (ctx.missedPayroll) p += 0.1;
      if (R.chance(p)) {
        S.leave(g, b, e, e.morale < 35 ? `low morale (${Math.round(e.morale)}/100)` : 'personal reasons / better offer', true);
        continue;
      }
      // v9 poaching: other companies go after people paid under their market value (odds and reasons in S.poachOdds)
      const po = S.poachOdds(g, b, e);
      if (R.chance(po.p)) {
        const offer = Math.round(Math.max(po.mv, e.wage) * R.range(cs.poach.offer[0], cs.poach.offer[1]) / 10) * 10; const pd = S.persDef(e);
        TG.D.add(g, { kind: 'poach', bizId: b.id, empId: e.id, offer, title: `${e.name} got a job offer`,
          text: `Another company offered ${e.name} (${S.roleDef(b, e.role).label}, skill ${Math.round(e.skill)}) ${U.money(offer)}/mo. You pay ${U.money(e.wage)}/mo; their market value is about ${U.money(po.mv)}/mo.`,
          why: po.reasons.join('; '),
          options: [{ id: 'counter', label: `💵 Match: pay ${U.money(offer)}/mo (+${U.money(offer - e.wage)}) · ${U.pct(pd.accept)} they stay` }, { id: 'let', label: `👋 Let them go (you will need to hire someone; a new ${S.roleDef(b, e.role).label.toLowerCase()} costs about ${U.money(po.mv)}/mo at this skill)` }], def: 'let' });
      } else if (po.p >= cs.poach.warnAt && (e.warnedM == null || g.month - e.warnedM >= 6)) {
        e.warnedM = g.month; const hr = S.hrOf(b);
        TG.rep.event(g, b, 'warn', hr ? `HR: ${e.name} may get poached (${U.pct(po.p, 1)} a month)` : `${e.name} seems to be looking around`, `${po.reasons.join('; ')}. A raise to about ${U.money(po.mv)}/mo cuts the odds to ${U.pct(S.poachOdds(g, b, Object.assign({}, e, { wage: po.mv })).p, 1)}.`);
      }
    }
    // theft
    for (const e of S.allStaff(b)) {
      if (e.honesty < 50) {
        const p = cs.theftBase * (1.6 - e.honesty / 100) * (cams ? 0.4 : 1) * (g.world.crime > 0 ? 1.4 : 1);
        if (R.chance(p)) {
          const amt = Math.round(R.range(200, 2500) * Math.max(1, Math.sqrt(ctx.revAvg / 20000)));
          TG.F.spend(g, amt, 'Theft losses', b.id);
          const catchP = (b.spec && b.spec.accountant ? 0.6 : 0.25) + (cams ? 0.25 : 0);
          if (R.chance(catchP)) {
            e.revealed.honesty = true;
            TG.rep.event(g, b, 'bad', `${e.name} was caught stealing (${U.money(amt)})`, `Honesty ${Math.round(e.honesty)}/100${cams ? '' : ', no cameras'}; theft chance ${U.pct(p, 1)}/mo`);
            TG.D.add(g, { kind: 'theft', bizId: b.id, empId: e.id, title: `${e.name} caught stealing`, text: `${U.money(amt)} went missing and the trail leads to ${e.name}.`, why: `Low honesty and ${cams ? 'cameras caught it' : 'no cameras'}.`, options: [{ id: 'fire', label: 'Fire them' }, { id: 'warn', label: 'Give a warning' }], def: 'warn' });
          } else TG.rep.event(g, b, 'bad', `Unexplained cash and stock shrinkage (${U.money(amt)})`, `Someone is stealing; ${b.spec && b.spec.accountant ? 'the accountant could not trace it' : 'no accountant to trace it'}${cams ? '' : ', no cameras'}`);
        }
      }
      // fights
      if (e.temper > 60 && R.chance(cs.fightBase * (e.temper / 60) * (1 + Math.max(0, (ctx.busy || 0) - 0.9) * 2) * (hasHR ? 0.5 : 1))) {
        e.revealed.temper = true;
        const repHit = R.range(1, 5);
        b.rep = U.clamp(b.rep - repHit, 0, 100);
        TG.rep.event(g, b, 'bad', `${e.name} got into a fight with ${R.chance(0.5) ? 'a coworker' : 'a customer'}`, `Hidden temper revealed (${Math.round(e.temper)}/100), workload ${U.pct(ctx.busy || 0)}${hasHR ? '' : ', no HR manager'}`);
        if (R.chance(0.15)) TG.B.lawsuit(g, b, 'Injury claim after a fight', Math.max(C.lawsuits.suitMin, ctx.revAvg * R.range(0.2, 1)), 'liability', `${e.name}'s temper`);
        for (const o of S.allStaff(b)) o.morale = U.clamp(o.morale - 2, 0, 100);
      }
      // dishonest managers skim
      if (e.trait === 'dishonest' && R.chance(C.decisions.skimChance * 4)) {
        const amt = Math.round(ctx.revAvg * R.range(0.01, 0.03));
        if (amt > 0) {
          TG.F.spend(g, amt, 'Theft losses', b.id);
          if (b.spec && b.spec.accountant && b.spec.accountant !== e && R.chance(0.4)) { e.revealed.honesty = true; TG.rep.event(g, b, 'bad', `Accountant caught ${e.name} skimming ${U.money(amt)}`, 'Dishonest manager trait'); }
        }
      }
    }
    for (const e of S.allStaff(b)) e.away = 0; // v9: training time only counts in the month it happened
    // strikes at big businesses
    const n = b.staff.length;
    if (n >= cs.strikeMinStaff) {
      const avgM = U.avg(b.staff, (e) => e.morale, 60);
      if (avgM < 45) {
        const def = TG.CONFIG.businesses[b.type];
        const red = (def.fixes.find((f) => f.id === 'fairwages') && b.fixes.fairwages) ? 0.3 : 1;
        const p = cs.strikeBase * (45 - avgM) / 10 * red;
        if (R.chance(p)) {
          const d = R.range(0.4, 1);
          ctx.down = U.clamp((ctx.down || 0) + d, 0, 1);
          TG.rep.event(g, b, 'major', `Workers went on strike (${U.pct(d)} of the month lost)`, `Average morale ${Math.round(avgM)}/100 across ${n} staff; strike chance ${U.pct(p, 1)}`, { major: 'strike' });
        }
      }
    }
  };

  // someone leaves: if a key role, managers may replace later
  S.leave = (g, b, e, why, natural) => {
    let spec = null;
    for (const k in b.spec || {}) if (b.spec[k] && b.spec[k].id === e.id) spec = k;
    if (spec) b.spec[spec] = null; else b.staff = b.staff.filter((x) => x.id !== e.id);
    const label = S.roleDef(b, e.role).label;
    const isKey = spec === 'gm' || spec === 'ops' || (TG.CONFIG.businesses[b.type].roles[e.role] || {}).licensed || e.skill >= 70;
    TG.rep.event(g, b, isKey ? 'major' : 'bad', `${e.name} (${label}) quit`, `${why[0].toUpperCase() + why.slice(1)}. Morale ${Math.round(e.morale)}, loyalty ${Math.round(e.loyalty)}, ambition ${e.ambition > 60 ? 'high' : 'normal'}`, isKey ? { major: 'keyQuit' } : null);
    TG.rep.staff(g, b, `${e.name} (${label}) quit: ${why}`);
  };

  S.payroll = (b) => U.sum(S.allStaff(b), (e) => e.wage);

  // ================= v9: market value, personalities, poaching odds, managers lending a hand =================
  // What other companies would pay for this skill here (same formula that sets applicants' asking pay).
  S.mv = (g, b, e) => {
    const C = TG.CONFIG, rd = S.roleDef(b, e.role); if (!rd || !rd.wage) return e.wage;
    const sk = (e.skill == null ? 50 : e.skill) - (e.expGain || 0) * (1 - (TG.CONFIG.staff.expMarket != null ? TG.CONFIG.staff.expMarket : 1)); /* v9: know-how learned on your job (not training) is worth less to other companies */
    const f = U.clamp(0.125 + 0.75 * (sk - 20) / 60, 0, 1.15);
    const region = b && b.region ? C.regions[b.region].wage : 1, loc = b && b.loc ? C.locations[b.loc].wage : 1;
    const labor = b && b.labor != null ? U.clamp(b.labor, 0.02, 1) : 0.5;
    return Math.round(U.lerp(rd.wage[0], rd.wage[1], f) * region * loc * (1 + (1 - labor) * 0.3) * g.world.wageIdx / 10) * 10;
  };
  S.persOf = (e) => { if (!e.pers) e.pers = e.ambition > 65 ? 'climber' : e.ambition < 30 ? 'loyal' : 'steady'; return e.pers; };
  S.persDef = (e) => TG.CONFIG.staff.pers[S.persOf(e)] || TG.CONFIG.staff.pers.steady;
  // monthly odds another company hires them away, with the reasons. guess=true ignores a personality you have not seen yet
  S.poachOdds = (g, b, e, guess) => {
    const cs = TG.CONFIG.staff, P = cs.poach; const mv = S.mv(g, b, e); const gap = (mv - e.wage) / Math.max(1, mv);
    const isSpec = !!(TG.CONFIG.specialists[e.role] || e.role === 'ceo' || e.role === 'rem');
    const demand = U.clamp((e.skill - P.skillFrom) / P.skillSpan, isSpec ? 0.2 : 0, 1);
    const pd = guess && !e.persSeen ? cs.pers.steady : S.persDef(e); const hr = !!S.hrOf(b);
    const loyalF = 1.2 - e.loyalty / 125; const moraleF = e.morale < 45 ? 1.3 : 1;
    let p = demand * (P.base + P.gapK * Math.max(0, gap - (P.tol || 0))) * pd.poach * loyalF * moraleF * (hr ? 0.8 : 1);
    if (gap < -0.1) p *= 0.5;
    p = U.clamp(p, 0, P.max);
    const reasons = [];
    if (gap > 0.02 && gap <= (P.tol || 0)) reasons.push(`a gap under ${U.pct(P.tol)} is too small for most people to move for`);
    reasons.unshift(gap > 0.02 ? `paid ${U.pct(gap)} under market (${U.money(e.wage)} vs about ${U.money(mv)})` : gap < -0.02 ? `paid ${U.pct(-gap)} over market (about ${U.money(mv)})` : `paid about market (${U.money(mv)})`);
    reasons.push(demand >= 0.7 ? `skill ${Math.round(e.skill)}: lots of companies want them` : demand >= 0.3 ? `skill ${Math.round(e.skill)}: some companies want them` : `skill ${Math.round(e.skill)}: few offers at this skill`);
    reasons.push(e.persSeen || !guess ? `${pd.icon} ${pd.label.toLowerCase()}` : '❓ personality not known yet');
    reasons.push(`loyalty ${Math.round(e.loyalty)}/100`);
    if (e.morale < 45) reasons.push(`unhappy (morale ${Math.round(e.morale)})`);
    if (hr) reasons.push('HR keeps in touch (x0.8)');
    return { p, mv, gap, demand, reasons, tone: p >= 0.06 ? 'bad' : p >= cs.poach.warnAt ? 'warn' : 'good' };
  };
  // managers who lend a hand on the job (GM, Ops), in "regular worker" units, already scaled by the fraction
  S.mgrHelpers = (b) => { const cs = TG.CONFIG.staff; const out = []; for (const r of cs.mgrWorkRoles) { const e = b.spec && b.spec[r]; if (e) out.push({ role: r, e, frac: cs.mgrWorkFrac }); } return out; };
  S.mgrW = (b) => U.sum(S.mgrHelpers(b), (x) => x.frac * TG.M.staffEff(x.e));
  S.mgrNote = (b) => { const h = S.mgrHelpers(b); if (!h.length) return ''; return ` Managers lend a hand: ${h.map((x) => `${TG.CONFIG.specialists[x.role].label} works at ${Math.round(x.frac * 100)}% of a worker`).join(', ')}.`; };
  // v8 -> v9 save: the Shift lead role is gone. A lead becomes the Ops manager (same pay and skill) if that seat is empty, else a crew member.
  S.v9Migrate = (g) => {
    const notes = [];
    for (const b of g.businesses || []) {
      for (const e of S.allStaff(b)) {
        S.persOf(e); if (e.persSeen == null) e.persSeen = (e.months || 0) >= 3; if (e.away == null) e.away = 0;
        // old saves: count their extra skill as learned on your job, so nobody is suddenly "underpaid" by the new market-value rule
        const mv = S.mv(g, b, e); const k = 1 - TG.CONFIG.staff.expMarket;
        if (mv > e.wage && k > 0 && e.expGain == null) { const per = (S.mv(g, b, Object.assign({}, e, { skill: e.skill + 10 })) - mv) / 10; if (per > 0) e.expGain = Math.min(e.skill, (mv - e.wage) / per / k); }
      }
      const lead = b.spec && b.spec.lead; if (b.spec && 'lead' in b.spec) delete b.spec.lead; if (!lead) continue;
      if (!b.spec.ops) { lead.role = 'ops'; lead.trait = lead.trait || 'steady'; b.spec.ops = lead; notes.push(`${lead.name} (${b.name}) is now your Ops manager: same pay, orders supplies and also works at ${Math.round(TG.CONFIG.staff.mgrWorkFrac * 100)}% of a worker.`); }
      else { const kr = TG.M.keyRole(TG.CONFIG.businesses[b.type]); lead.role = kr; delete lead.trait; b.staff.push(lead); notes.push(`${lead.name} (${b.name}) moved from Shift lead to the crew (your Ops manager already orders supplies).`); }
    }
    for (const e of [g.ceo, g.re && g.re.manager]) if (e) S.persOf(e);
    if (notes.length) g.v9notes = notes;
  };
  TG.S = S;
})();
