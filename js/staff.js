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
    if (role === 'rem') return { label: 'Property manager', wage: [3500, 8000], specialist: true };
    return TG.CONFIG.businesses[b.type].roles[role];
  };

  // Generate a candidate. labor = property labor pool (0..1)
  S.candidate = (g, b, role, labor) => {
    const C = TG.CONFIG, rd = S.roleDef(b, role);
    labor = U.clamp(labor == null ? 0.5 : labor, 0.02, 1);
    const quals = U.clamp(Math.pow(R.next(), 1.25 - labor * 0.6), 0, 1);
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

  S.train = (g, b, empId, level) => {
    const C = TG.CONFIG, t = level === 'advanced' ? C.staff.trainAdvanced : C.staff.trainBasic;
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return null;
    if (g.cash < t.cost) return null;
    TG.F.spend(g, t.cost, 'Training', b.id, true);
    if (S.spam(g, e, 'train')) return { gain: 0, att: 0, spam: true };
    const growth = (b.fixesOn && b.fixesOn.skillGrowth) || 1;
    const gain = Math.round(R.range(t.skill[0], t.skill[1]) * e.learning * growth);
    const att = Math.round(R.range(t.attitude[0], t.attitude[1]) * e.learning);
    e.skill = U.clamp(e.skill + gain, 1, 99); e.skillSeen = e.skill; e.attitude = U.clamp(e.attitude + att, 1, 99);
    e.morale = U.clamp(e.morale + 4, 0, 100);
    return { gain, att };
  };

  // true when this click is past the monthly limit: it backfires (morale down) and gives nothing
  S.spam = (g, e, kind) => {
    const C = TG.CONFIG.staff; const n = TG.USES.take(e, kind, g.month);
    if (n <= C.perMonth[kind]) return false;
    e.morale = U.clamp(e.morale - C.spamMorale, 0, 100); return true;
  };
  S.usesLeft = (g, e, kind) => TG.USES.left(e, kind, g.month, TG.CONFIG.staff.perMonth[kind]);
  S.raise = (g, b, empId) => {
    const e = S.allStaff(b).find((x) => x.id === empId); if (!e) return;
    if (S.spam(g, e, 'raise')) return { spam: true };
    e.wage = Math.round(e.wage * (1 + TG.CONFIG.staff.raisePct)); e.morale = U.clamp(e.morale + TG.CONFIG.staff.raiseMorale, 0, 100); e.loyalty = U.clamp(e.loyalty + 5, 0, 100);
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
      if (e.months >= 3) e.revealed.reliability = true;
      if (e.months >= 2) e.skillSeen = e.skill;
      // experience growth
      const growth = (b.fixesOn && b.fixesOn.skillGrowth) || 1;
      if (e.skill < 95 && R.chance(0.5)) e.skill = U.clamp(e.skill + (cs.expSkillPerYear / 6) * e.learning * growth * (e.skill > 80 ? 0.4 : 1), 1, 99);
      e.loyalty = U.clamp(e.loyalty + 0.6, 0, 100);
      // morale target
      const rd = S.roleDef(b, e.role) || { wage: [e.wage, e.wage] };
      const fair = U.lerp(rd.wage[0], rd.wage[1], e.skill / 100) * g.world.wageIdx;
      const payDelta = U.clamp((e.wage * (1 + payrollAdd) - fair) / fair, -0.5, 0.5);
      let target = 58 + payDelta * 60 + (hasHR ? 8 : 0) + (hasGM ? 4 : 0) + fixMorale - Math.max(0, (ctx.busy || 0) - 0.95) * 60;
      if (ctx.missedPayroll) target -= 30;
      if (b.ownerOp) target += 3;
      target = U.clamp(target, 0, 100);
      e.morale = U.clamp(e.morale + (target - e.morale) * cs.moraleDrift + R.normal(0, 2), 0, 100);
      if (ctx.missedPayroll) e.morale = U.clamp(e.morale + cs.missedPayrollMorale * 0.5, 0, 100);
    }
    // quitting
    for (const e of all.slice()) {
      const low = e.morale < 35 ? cs.quitLowMorale * (35 - e.morale) / 35 : 0;
      let p = (cs.quitBase + low) * (0.6 + e.ambition / 100) * (1.2 - e.loyalty / 125) * (hasHR ? 0.75 : 1);
      if (ctx.missedPayroll) p += 0.1;
      if (R.chance(p)) {
        S.leave(g, b, e, e.morale < 35 ? `low morale (${Math.round(e.morale)}/100)` : 'personal reasons / better offer', true);
        continue;
      }
      // poaching
      if (e.skill >= cs.poachSkill && R.chance(cs.poachBase * (1.3 - e.loyalty / 100))) {
        TG.D.add(g, { kind: 'poach', bizId: b.id, empId: e.id, title: `${e.name} is being poached`,
          text: `A competitor offered ${e.name} (${S.roleDef(b, e.role).label}, skill ${Math.round(e.skill)}) about ${Math.round(cs.counterOfferPct * 100)}% more pay.`,
          why: `High skill (${Math.round(e.skill)}) makes them a target; loyalty ${Math.round(e.loyalty)}/100.`,
          options: [{ id: 'counter', label: `Counter-offer (+${Math.round(cs.counterOfferPct * 100)}% pay)` }, { id: 'let', label: 'Let them go' }], def: 'let' });
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
    TG.rep.event(g, b, isKey ? 'major' : 'bad', `${e.name} (${label}) quit`, `Why: ${why}. Morale ${Math.round(e.morale)}, loyalty ${Math.round(e.loyalty)}, ambition ${e.ambition > 60 ? 'high' : 'normal'}`, isKey ? { major: 'keyQuit' } : null);
    TG.rep.staff(g, b, `${e.name} (${label}) quit: ${why}`);
  };

  S.payroll = (b) => U.sum(S.allStaff(b), (e) => e.wage);
  TG.S = S;
})();
