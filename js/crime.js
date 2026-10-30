/* crime.js - the optional crime side: street empire (fictional goods), crew, turf, heat, raids, jail, laundering, one-off jobs.
   Money from crime is "dirty" (g.crime.dirty) and can only become normal cash through laundering. Every bad event has odds and a reason. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const K = () => TG.CONFIG.crime;
  const CR = {};
  const N = (x) => Math.round(x).toLocaleString();

  CR.on = (g) => g.settings.crime !== false;
  CR.ensure = (g) => {
    if (g.crime) return g.crime;
    const c = (g.crime = { started: false, dirty: 0, heat: 0, rep: 40, clients: 0, blocks: 0, stock: {}, ask: {}, idx: {}, crew: [], gear: [], cands: [], candM: -1,
      supplier: 'plug', lawyer: 'none', bribe: 'none', racket: false, launder: 0, laund: {}, jail: 0, record: 0, plan: null, cd: {}, flow: [], next: [], hist: [],
      last: {}, stats: { earned: 0, seized: 0, laundered: 0, raids: 0, arrests: 0, heists: 0, jailMonths: 0 }, selfDeal: true });
    for (const p in K().products) { c.stock[p] = 0; c.ask[p] = null; c.idx[p] = 1; }
    return c;
  };
  CR.jailed = (g) => !!(g.crime && g.crime.jail > 0);
  CR.started = (g) => !!(g.crime && g.crime.started);

  // ---------- prices & stock ----------
  CR.street = (g, p) => K().products[p].street * CR.ensure(g).idx[p] * g.world.priceIdx;
  CR.wholesale = (g, p) => K().products[p].buy * CR.ensure(g).idx[p] * g.world.priceIdx;
  CR.price = (g, p) => { const a = CR.ensure(g).ask[p]; return a != null ? a : CR.street(g, p); };
  CR.ratio = (g, p) => CR.price(g, p) / Math.max(0.01, CR.street(g, p));
  CR.unlocked = (g, u) => { const c = CR.ensure(g); return c.blocks >= (u.turf || 0) && c.rep >= (u.rep || 0); };
  CR.units = (g) => U.sum(Object.values(CR.ensure(g).stock), (x) => x);
  CR.room = (g) => K().baseStore + U.sum(CR.ensure(g).gear.filter((x) => x.type === 'stash'), () => K().gear.stash.store);
  CR.setAsk = (g, p, v) => { const c = CR.ensure(g); if (!K().products[p]) return; c.ask[p] = v == null || !(v > 0) ? null : Math.round(Math.min(v, CR.street(g, p) * 4)); };
  CR.stockValue = (g) => U.sum(Object.keys(K().products), (p) => CR.ensure(g).stock[p] * CR.wholesale(g, p));

  // move normal cash into dirty cash (always allowed; big amounts get noticed)
  CR.withdraw = (g, amt) => {
    const c = CR.ensure(g); amt = Math.floor(Math.min(amt, Math.max(0, g.cash))); if (!(amt > 0)) return { ok: false, msg: 'No cash to move.' };
    TG.F.spend(g, amt, 'Cash moved to the street', null, true); c.dirty += amt; c.started = true;
    const h = Math.max(0, (amt - 10000) / 50000) * 2; c.heat = U.clamp(c.heat + h, 0, 100);
    return { ok: true, heat: h };
  };

  // ---------- buying from a supplier: the order may arrive full, short, not at all, or be a police sting ----------
  CR.supOdds = (g, s) => { const S = K().suppliers[s]; const none = Math.max(0, 1 - S.ok - S.short - S.sting); return { ok: S.ok, short: S.short, none, sting: S.sting }; };
  CR.orderCost = (g, s, p, q) => Math.round(q * CR.wholesale(g, p) * K().suppliers[s].mult);
  CR.buy = (g, s, p, q) => {
    const c = CR.ensure(g), S = K().suppliers[s], P = K().products[p];
    if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if (!S || !P) return { ok: false, msg: 'Pick a supplier and a product.' };
    if (!CR.unlocked(g, S.unlock)) return { ok: false, msg: `${S.label} only deals with crews holding ${S.unlock.turf}+ blocks and ${S.unlock.rep}+ street rep.` };
    if (!CR.unlocked(g, P.unlock)) return { ok: false, msg: `${P.label} needs ${P.unlock.turf}+ blocks and ${P.unlock.rep}+ street rep.` };
    if (!S.goods.includes(p)) return { ok: false, msg: `${S.label} does not sell ${P.label}.` };
    q = Math.floor(Math.min(q, S.maxOrder, CR.room(g) - CR.units(g)));
    if (!(q > 0)) return { ok: false, msg: 'No room in your stash. Get a stash house or sell first.' };
    const cost = CR.orderCost(g, s, p, q);
    if (S.minOrder && cost < S.minOrder) return { ok: false, msg: `${S.label} wants orders of at least ${U.money(S.minOrder)}.` };
    if (c.dirty < cost) return { ok: false, msg: `Costs ${U.money(cost)} in street cash. Move cash to the street first.` };
    c.dirty -= cost; c.started = true; c.last.spent = (c.last.spent || 0) + cost;
    if (S.orderHeat) c.heat = U.clamp(c.heat + S.orderHeat, 0, 100);
    const o = CR.supOdds(g, s); const r = R.next();
    if (r < o.sting) { c.heat = U.clamp(c.heat + 25, 0, 100); CR.log(g, 'bad', `The ${S.label} deal was a police sting! Lost ${U.money(cost)}`, `${U.pct(o.sting)} sting odds with ${S.label}`); CR.raid(g, 'a sting deal', 0.25); return { ok: true, got: 0, cost, out: 'sting' }; }
    if (r < o.sting + o.none) { const back = Math.round(cost * (1 - K().noShowLoss)); c.dirty += back; CR.log(g, 'bad', `${S.label} never showed. Got back ${U.money(back)} of ${U.money(cost)}`, `${U.pct(o.none)} no-show odds`); return { ok: true, got: 0, cost: cost - back, out: 'none' }; }
    let got = q; if (r < o.sting + o.none + o.short) { got = Math.floor(q * R.range(0.4, 0.8)); }
    c.stock[p] += got;
    return { ok: true, got, cost, out: got < q ? 'short' : 'ok' };
  };
  CR.dump = (g, p, q) => {
    const c = CR.ensure(g); q = Math.floor(Math.min(q, c.stock[p] || 0)); if (!(q > 0)) return { ok: false, msg: 'Nothing to sell back.' };
    const v = Math.round(q * CR.wholesale(g, p) * K().sellBackShare); c.stock[p] -= q; c.dirty += v; return { ok: true, v };
  };

  // ---------- crew ----------
  const capOf = (e) => K().crew[e.role].cap * (0.6 + 0.8 * e.skill / 100) * (e.inj ? 0.5 : 1);
  CR.capOf = capOf;
  CR.candidates = (g) => {
    const c = CR.ensure(g);
    if (c.candM !== g.month) {
      c.candM = g.month; c.cands = [];
      for (const role in K().crew) for (let i = 0; i < 2; i++) {
        const skill = Math.round(U.clamp(R.normal(45 + c.rep / 5, 15), 5, 95)); const loyal = Math.round(U.clamp(R.normal(55, 18), 5, 95));
        c.cands.push({ id: U.uid('k'), name: TG.S.name(), role, skill, loyalty: loyal, wage: Math.round(K().crew[role].wage * (0.75 + skill / 200)) });
      }
    }
    return c.cands;
  };
  CR.hire = (g, id) => {
    const c = CR.ensure(g); if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    const k = c.cands.find((x) => x.id === id); if (!k) return { ok: false, msg: 'They moved on.' };
    const fee = Math.round(k.wage * K().hireCost); if (c.dirty < fee) return { ok: false, msg: `Needs ${U.money(fee)} street cash up front.` };
    c.dirty -= fee; c.cands = c.cands.filter((x) => x !== k); c.crew.push(Object.assign({}, k, { since: g.month })); c.started = true;
    return { ok: true };
  };
  CR.fire = (g, id) => { const c = CR.ensure(g); const e = c.crew.find((x) => x.id === id); if (!e) return; c.crew = c.crew.filter((x) => x !== e); for (const o of c.crew) o.loyalty = U.clamp(o.loyalty - 2, 0, 100); };
  // anti-spam: 1 training and 1 bonus per person per month; more backfires (loyalty down, no gain)
  CR.train = (g, id) => {
    const c = CR.ensure(g); const e = c.crew.find((x) => x.id === id); if (!e) return { ok: false };
    if (c.dirty < K().trainCost) return { ok: false, msg: `Costs ${U.money(K().trainCost)} street cash.` };
    c.dirty -= K().trainCost;
    if (TG.USES.take(e, 'train', g.month) > K().trainPerMonth) { e.loyalty = U.clamp(e.loyalty - 3, 0, 100); return { ok: true, spam: true }; }
    const x = Math.round(R.range(K().trainSkill[0], K().trainSkill[1])); e.skill = U.clamp(e.skill + x, 1, 99); return { ok: true, gain: x };
  };
  CR.bonus = (g, id) => {
    const c = CR.ensure(g); const e = c.crew.find((x) => x.id === id); if (!e) return { ok: false };
    const v = Math.round(e.wage * 0.5); if (c.dirty < v) return { ok: false, msg: `Costs ${U.money(v)} street cash.` };
    c.dirty -= v;
    if (TG.USES.take(e, 'bonus', g.month) > K().bonusPerMonth) { e.loyalty = U.clamp(e.loyalty - 3, 0, 100); return { ok: true, spam: true }; }
    e.loyalty = U.clamp(e.loyalty + 10, 0, 100); return { ok: true };
  };
  CR.count = (g, role) => CR.ensure(g).crew.filter((e) => e.role === role).length;
  CR.capacity = (g) => {
    const c = CR.ensure(g); const J = CR.jailed(g) ? 0.5 : 1; const me = !CR.jailed(g) && c.selfDeal;
    const sum = (r) => U.sum(c.crew.filter((e) => e.role === r), capOf);
    const vans = c.gear.filter((x) => x.type === 'van' && !x.broken).length;
    const shops = c.gear.filter((x) => x.type === 'workshop' && !x.broken).length * K().gear.workshop.cap;
    return {
      deal: (sum('dealer') + (me ? K().youDeal : 0)) * J, run: (sum('runner') + vans * K().gear.van.cap + (me ? K().youRun : 0)) * J,
      guard: sum('enforcer'), watch: sum('lookout'), cooks: Math.min(CR.count(g, 'cook'), shops), shops, vans,
    };
  };
  CR.cover = (g, kind) => { const c = CR.ensure(g); const cap = CR.capacity(g); return U.clamp((kind === 'guard' ? cap.guard : cap.watch) / Math.max(1, c.blocks), 0, 1); };

  // ---------- gear ----------
  CR.buyGear = (g, t) => {
    const c = CR.ensure(g), G = K().gear[t]; if (!G) return { ok: false }; if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if (t === 'safe' && c.gear.some((x) => x.type === 'safe')) return { ok: false, msg: 'One safe is enough.' };
    const p = Math.round(G.price * g.world.priceIdx); if (c.dirty < p) return { ok: false, msg: `Costs ${U.money(p)} street cash.` };
    c.dirty -= p; c.gear.push({ id: U.uid('q'), type: t, wear: 0, age: 0 }); c.started = true; return { ok: true };
  };
  CR.gearValue = (g, it) => Math.round(K().gear[it.type].price * g.world.priceIdx * 0.4 * (1 - it.wear / 100));
  CR.sellGear = (g, id) => { const c = CR.ensure(g); const it = c.gear.find((x) => x.id === id); if (!it) return { ok: false }; const v = CR.gearValue(g, it); c.gear = c.gear.filter((x) => x !== it); c.dirty += v; return { ok: true, v }; };

  // ---------- turf ----------
  CR.turfCost = (g) => Math.round(K().turfCost * Math.pow(CR.ensure(g).blocks + 1, K().turfGrow) * g.world.priceIdx);
  CR.turfOdds = (g) => { const c = CR.ensure(g); const cap = CR.capacity(g); const need = c.blocks + 1; return U.clamp(K().turfWinBase * (0.5 + 0.5 * Math.min(1, cap.guard / need)) * (0.7 + c.rep / 160), 0.1, 0.85); };
  CR.expand = (g) => {
    const c = CR.ensure(g); if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if (TG.USES.used(c, 'turf', g.month) >= 1) return { ok: false, msg: 'One turf move a month.' };
    const cost = CR.turfCost(g); if (c.dirty < cost) return { ok: false, msg: `Costs ${U.money(cost)} street cash.` };
    TG.USES.take(c, 'turf', g.month); c.dirty -= cost; c.started = true; const p = CR.turfOdds(g);
    c.heat = U.clamp(c.heat + 3, 0, 100);
    if (R.chance(p)) { c.blocks++; return { ok: true, won: true, p }; }
    c.heat = U.clamp(c.heat + 5, 0, 100); CR.hurt(g, 1, 'turf fight');
    CR.log(g, 'bad', 'Lost the fight for a new block', `${U.pct(p)} odds: more enforcers and street rep raise them`); return { ok: true, won: false, p };
  };
  CR.hurt = (g, n, why) => { const c = CR.ensure(g); for (let i = 0; i < n && c.crew.length; i++) { const e = R.pick(c.crew); if (R.chance(0.5)) { c.crew = c.crew.filter((x) => x !== e); CR.log(g, 'bad', `${e.name} quit after a ${why}`, 'Crew get hurt in fights'); } else e.inj = 2; } };

  // ---------- law ----------
  CR.lawyer = (g) => K().lawyers[CR.ensure(g).lawyer] || K().lawyers.none;
  CR.bribeDef = (g) => K().bribes[CR.ensure(g).bribe] || K().bribes.none;
  CR.convictOdds = (g) => Math.max(K().convictMin, K().convict - CR.lawyer(g).cut - (CR.bribeDef(g).judge || 0) + Math.min(0.1, CR.ensure(g).record * 0.03));
  CR.jailMonths = (g) => { const J = K().jail, c = CR.ensure(g); return Math.round(U.clamp((J.base + c.heat * J.perHeat + c.record * J.perRecord) * CR.lawyer(g).jail, 1, J.max)); };
  CR.seizeOdds = (g, b) => { const S = K().seize; const l = CR.ensure(g).laund[b.id] || 0; if (l < 1) return 0; return U.clamp(S.base + S.perLaunder * l / Math.max(50000, TG.F.bizValue(g, b)), 0, S.max); };
  CR.arrest = (g, why, extra) => {
    const c = CR.ensure(g); c.stats.arrests++;
    const p = U.clamp(CR.convictOdds(g) + (extra || 0), 0, 0.95);
    if (!R.chance(p)) { const bill = Math.round(CR.lawyer(g).cost * 2 + 15000); TG.F.spend(g, bill, 'Legal defense'); CR.log(g, 'warn', `You were arrested for ${why}, but the case fell apart (legal bill ${U.money(bill)})`, `${U.pct(p)} conviction odds; lawyers and judges lower them`, true); return false; }
    const months = CR.jailMonths(g); const J = K().jail;
    const fine = Math.round(Math.max(0, g.cash) * R.range(J.fine[0], J.fine[1]));
    TG.F.spend(g, fine, 'Court fines'); c.record++; c.jail = months; c.stats.jailMonths += months;
    // the street business is taken: stash, gear and most dirty cash; turf shrinks
    const safe = c.gear.some((x) => x.type === 'safe') ? 0.4 : 0; const lostD = Math.round(c.dirty * (1 - safe));
    c.stats.seized += lostD + CR.stockValue(g); c.dirty -= lostD; for (const k in c.stock) c.stock[k] = 0; c.gear = c.gear.filter((x) => x.type === 'safe');
    c.blocks = Math.floor(c.blocks / 2); c.clients = Math.floor(c.clients / 2); c.plan = null; c.racket = false;
    for (const e of c.crew) e.loyalty = U.clamp(e.loyalty - 15, 0, 100);
    const lost = [];
    for (const b of g.businesses.slice()) { const sp = CR.seizeOdds(g, b); if (sp > 0 && R.chance(sp)) { lost.push(b.name + ` (${U.pct(sp)} odds)`); CR.seizeBiz(g, b); } }
    c.laund = {};
    CR.log(g, 'major', `Convicted for ${why}: ${months} months in jail, fine ${U.money(fine)}. Stash, gear and ${U.money(lostD)} seized${lost.length ? '. Also seized: ' + lost.join(', ') : ''}`, `${U.pct(p)} conviction odds. Jail time grows with heat and record; a good lawyer shortens it. Businesses used for laundering can be taken.`, true);
    return true;
  };
  CR.seizeBiz = (g, b) => {
    const prop = g.properties.find((p) => p.id === b.propId);
    b.equip = []; TG.B.close(g, b, 'seized by the state (tied to dirty money)', true);
    if (prop) { if (prop.mortgageId) g.loans = g.loans.filter((l) => l.id !== prop.mortgageId); g.properties = g.properties.filter((p) => p !== prop); }
  };

  // ---------- laundering ----------
  CR.launderCap = (g) => {
    const rows = g.businesses.map((b) => ({ b, cap: Math.round(Math.max(0, b.revAvg || 0) * (K().cashShare[b.type] || 0.1)) }));
    return { rows, total: U.sum(rows, (r) => r.cap), shady: K().shadyCap };
  };
  CR.auditOdds = (g, amt) => { const A = K().audit, c = CR.ensure(g); const cap = CR.launderCap(g).total; const r = cap > 0 ? amt / cap : 0; return U.clamp(A.base + A.k * r * r + A.heat * c.heat / 100, 0, 0.6); };

  // ---------- one-off jobs ----------
  CR.heistOdds = (g, t, months, gear, pros) => {
    const H = K().heists[t], c = CR.ensure(g); const crew = c.crew.length + 1;
    const skill = c.crew.length ? U.avg(c.crew, (e) => e.skill) : 40;
    let p = H.odds + K().heistPlan.perMonth * months + K().heistGear[gear][1] + K().heistPros[pros][1] + (skill - 50) / 400;
    p *= Math.min(1, crew / H.crew); if (c.heat > 50) p *= 1 - (c.heat - 50) / 150;
    return U.clamp(p, 0.02, H.max);
  };
  CR.heistCost = (g, t, gear, pros) => { const H = K().heists[t]; return Math.round(K().heistGear[gear][0] * g.world.priceIdx + K().heistPros[pros][0] * (H.pay[0] + H.pay[1]) / 2); };
  CR.heist = (g, t, months, gear, pros) => {
    const c = CR.ensure(g), H = K().heists[t]; if (!H) return { ok: false }; if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if (c.plan) return { ok: false, msg: 'A job is already being planned.' };
    if ((c.cd.heist || 0) > g.month) return { ok: false, msg: `Lie low: next job possible in ${c.cd.heist - g.month} months.` };
    months = U.clamp(Math.floor(months || 0), 0, K().heistPlan.maxMonths);
    const cost = CR.heistCost(g, t, gear, pros); if (c.dirty < cost) return { ok: false, msg: `Needs ${U.money(cost)} street cash for gear and pros.` };
    c.dirty -= cost; c.started = true; c.cd.heist = g.month + K().heistCooldown + months;
    c.plan = { t, left: months, gear, pros, cost };
    if (months === 0) return CR.runHeist(g);
    return { ok: true, planned: true };
  };
  CR.runHeist = (g) => {
    const c = CR.ensure(g), P = c.plan, H = K().heists[P.t]; c.plan = null; c.stats.heists++;
    const p = CR.heistOdds(g, P.t, P.months0 || 0, P.gear, P.pros); const r = R.next();
    c.heat = U.clamp(c.heat + H.heat, 0, 100);
    if (r < p) { const v = Math.round(R.range(H.pay[0], H.pay[1]) * g.world.priceIdx); c.dirty += v; c.stats.earned += v; CR.log(g, 'good', `${H.label} job worked: ${U.money(v)} street cash`, `${U.pct(p)} odds. Heat +${H.heat}`, true); return { ok: true, won: true, v, p }; }
    if (r < p + (1 - p) * K().heistPartial) { const v = Math.round(R.range(H.pay[0], H.pay[1]) * 0.25 * g.world.priceIdx); c.dirty += v; c.stats.earned += v; CR.hurt(g, 1, 'botched job'); CR.log(g, 'warn', `${H.label} job went wrong: escaped with only ${U.money(v)}`, `${U.pct(p)} odds of a clean job`, true); return { ok: true, won: false, partial: true, v, p }; }
    CR.hurt(g, 2, 'failed job');
    if (R.chance(K().heistArrest)) CR.arrest(g, 'a bank job', 0.1);
    else CR.log(g, 'bad', `${H.label} job failed. Everyone ran.`, `${U.pct(p)} odds; ${U.pct(K().heistArrest)} odds of arrest when it fails`, true);
    return { ok: true, won: false, p };
  };
  CR.sabotage = (g, bizId, kind) => {
    const c = CR.ensure(g), S = K().sabotage[kind], b = TG.B.get(g, bizId); if (!S || !b) return { ok: false }; if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if ((c.cd['sab' + b.id] || 0) > g.month) return { ok: false, msg: `Wait ${c.cd['sab' + b.id] - g.month} months before targeting ${b.name}'s rivals again.` };
    const cost = Math.round(S.cost * g.world.priceIdx); if (c.dirty < cost) return { ok: false, msg: `Costs ${U.money(cost)} street cash.` };
    c.dirty -= cost; c.started = true; c.cd['sab' + b.id] = g.month + K().sabCooldown; c.heat = U.clamp(c.heat + S.heat / 3, 0, 100);
    const ok = R.chance(S.ok); const why = `${U.pct(S.ok)} odds it works, ${U.pct(S.caught)} odds you get caught, ${U.pct(S.revenge)} odds they hit back`;
    if (ok) { b.sab = { mult: S.boost, until: g.month + S.months }; CR.log(g, 'good', `${S.label} hurt ${b.name}'s rival: your demand x${S.boost} for ${S.months} months`, why); }
    else CR.log(g, 'warn', `${S.label} against ${b.name}'s rival did nothing`, why);
    if (R.chance(S.caught)) {
      c.heat = U.clamp(c.heat + S.heat, 0, 100); b.rep = U.clamp(b.rep - 10, 0, 100);
      TG.B.lawsuit(g, b, `Rival sues ${b.name} over ${S.label.toLowerCase()}`, R.range(S.suit[0], S.suit[1]) * g.world.priceIdx, null, 'You were caught sabotaging a competitor');
      CR.log(g, 'bad', `Caught! The rival is suing ${b.name} and its reputation fell 10`, why);
      if (S.arrest && R.chance(S.arrest)) CR.arrest(g, 'sabotage');
    }
    if (R.chance(S.revenge)) { const x = R.range(4, 10); b.rep = U.clamp(b.rep - x, 0, 100); b.hits = b.hits || []; b.hits.push({ mult: 0.92, months: 2, label: 'rival payback' }); CR.log(g, 'bad', `The rival hit back at ${b.name}: reputation -${Math.round(x)}, demand -8% for 2 months`, why); }
    return { ok: true, worked: ok };
  };
  CR.insiderProbe = (g, amt) => U.clamp(K().insider.probe + K().insider.probePer * amt / 250000, 0, 0.5);
  CR.insider = (g, amt) => {
    const c = CR.ensure(g), I = K().insider; if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if ((c.cd.insider || 0) > g.month) return { ok: false, msg: `Wait ${c.cd.insider - g.month} months: regulators watch repeat trades.` };
    amt = Math.floor(Math.min(amt, I.max, Math.max(0, g.cash))); if (!(amt >= 1000)) return { ok: false, msg: 'Stake at least $1,000 of normal cash.' };
    c.cd.insider = g.month + I.cooldown; c.started = true; const probe = CR.insiderProbe(g, amt);
    let gain; if (R.chance(I.odds)) gain = Math.round(amt * R.range(I.up[0], I.up[1])); else gain = -Math.round(amt * R.range(I.down[0], I.down[1]));
    if (gain >= 0) TG.F.earn(g, gain, 'Trading gains'); else TG.F.spend(g, -gain, 'Trading losses');
    const why = `${U.pct(I.odds)} odds the tip is right, ${U.pct(probe)} odds of an investigation (bigger trades = more)`;
    CR.log(g, gain >= 0 ? 'good' : 'bad', `Insider trade ${gain >= 0 ? 'made' : 'lost'} ${U.money(Math.abs(gain))}`, why);
    if (R.chance(probe)) { const fine = Math.round(Math.max(0, gain) * I.fine + amt * 0.2); TG.F.spend(g, fine, 'Regulator fines'); c.heat = U.clamp(c.heat + I.heat, 0, 100); CR.log(g, 'bad', `Regulators caught the trade: fine ${U.money(fine)}`, why, true); if (R.chance(I.arrest)) CR.arrest(g, 'insider trading'); }
    return { ok: true, gain };
  };
  CR.theft = (g) => {
    const c = CR.ensure(g), T = K().theft; if (CR.jailed(g)) return { ok: false, msg: 'You are in jail.' };
    if (TG.USES.used(c, 'theft', g.month) >= 1) return { ok: false, msg: 'One theft run a month.' };
    TG.USES.take(c, 'theft', g.month); c.started = true;
    const n = Math.min(T.maxCrew, c.crew.length + 1); c.heat = U.clamp(c.heat + T.heat, 0, 100);
    const why = `${U.pct(T.ok)} odds it works, ${U.pct(T.arrest)} odds someone is caught`;
    if (R.chance(T.ok)) { const v = Math.round(R.range(T.pay[0], T.pay[1]) * n * g.world.priceIdx); c.dirty += v; c.stats.earned += v; CR.log(g, 'good', `Car theft run: ${U.money(v)} street cash`, why); return { ok: true, v }; }
    if (R.chance(T.arrest / (1 - T.ok))) { if (c.crew.length && !R.chance(T.youShare)) { const e = R.pick(c.crew); c.crew = c.crew.filter((x) => x !== e); CR.log(g, 'bad', `${e.name} was caught stealing a car and is gone`, why); } else CR.arrest(g, 'car theft', -0.2); }
    else CR.log(g, 'warn', 'Car theft run came back empty', why);
    return { ok: true, v: 0 };
  };

  // ---------- odds of every bad event this month, with reasons (shown in the UI) ----------
  CR.odds = (g) => {
    const c = CR.ensure(g), k = K(); const watch = CR.cover(g, 'watch'), guard = CR.cover(g, 'guard'); const br = CR.bribeDef(g).lvl;
    const has = (t) => c.gear.some((x) => x.type === t && !x.broken);
    const big = c.blocks > 0 || CR.units(g) > 0 || c.crew.length > 0;
    const raid = big || c.dirty > 0 ? Math.max(k.raid.min, (k.raid.base + k.raid.k * Math.pow(c.heat / 100, 2)) * (1 - k.raid.lookout * watch) * (1 - k.raid.bribe * br)) : 0;
    const val = c.dirty + CR.stockValue(g);
    const rob = val > 5000 ? (k.rob.base + k.rob.k * Math.log10(val / 5000)) * (1 - k.rob.enforcer * guard) * (has('cameras') ? 1 - k.rob.cameras : 1) : 0;
    const snitch = 1 - c.crew.reduce((a, e) => a * (1 - (k.snitch.base + k.snitch.low * Math.max(0, (60 - e.loyalty) / 60)) * (0.3 + c.heat / 100)), 1);
    const war = c.blocks > 0 ? k.war.base * Math.sqrt(c.blocks) * (1 - k.war.enforcer * guard) : 0;
    const shopsUsed = c.gear.filter((x) => x.type === 'workshop').length && CR.count(g, 'cook') ? k.bust * (c.last.cookUtil || 0.5) * c.gear.filter((x) => x.type === 'workshop').length : 0;
    const scandal = br ? k.bribeScandal * (1 + br * 2) : 0;
    const lc = Math.min(c.launder, c.dirty);
    const audit = lc > 0 ? CR.auditOdds(g, lc) : 0;
    return [
      { id: 'raid', i: '🚔', t: 'Police raid', p: raid, why: `Heat ${Math.round(c.heat)}/100 drives it. Lookouts cover ${U.pct(watch)} of your blocks${br ? `, bribes cut ${U.pct(k.raid.bribe * br)}` : ''}. Never zero.` },
      { id: 'rob', i: '🔫', t: 'Rivals rob you', p: rob, why: `You hold ${U.money(val)} in cash and product. Enforcers guard ${U.pct(guard)} of blocks${has('cameras') ? '; cameras help' : ''}.` },
      { id: 'snitch', i: '🐀', t: 'Someone snitches', p: snitch, why: 'Unhappy or new crew talk, more when heat is high. Pay well and use bonuses.' },
      { id: 'war', i: '⚔️', t: 'Turf war', p: war, why: `More blocks = more fights. Enforcers guard ${U.pct(guard)}.` },
      { id: 'bust', i: '🔥', t: 'Workshop bust or fire', p: shopsUsed, why: 'Busier workshops are riskier.' },
      { id: 'scandal', i: '💸', t: 'Bribe scandal', p: scandal, why: 'Someone you pay may talk. Bigger bribes = bigger risk.' },
      { id: 'audit', i: '🧾', t: 'Laundering audit', p: audit, why: 'Cleaning more of what your businesses could plausibly earn draws auditors.' },
    ];
  };

  // ---------- the month ----------
  CR.log = (g, type, text, why, major) => TG.rep.event(g, null, type === 'warn' ? 'warn' : type, '🕶️ ' + text, why, major ? { major: 'crime' } : null);
  const row = (c, i, t, v, u, tone, tip) => c.flow.push({ i, t, v, u, tone, tip });
  const nrow = (c, i, t, v, u, tone, tip) => c.next.push({ i, t, v, u, tone, tip });
  CR.month = (g) => {
    const c = g.crime; if (!c) return; const k = K(); c.flow = []; c.next = []; c.last = { spent: 0 };
    for (const p in k.products) { // street prices wander; rare shortages and gluts
      let x = c.idx[p] * Math.exp(R.normal(0, k.priceVol)) ; if (R.chance(k.priceShock)) x *= R.chance(0.5) ? R.range(1.25, 1.5) : R.range(0.65, 0.8);
      c.idx[p] = U.clamp(1 + (x - 1) * 0.9, 0.5, 2);
    }
    if (c.jail > 0) { c.jail--; if (c.jail === 0) CR.log(g, 'good', 'You are out of jail', 'Your sentence is over'); }
    for (const e of c.crew) if (e.inj) e.inj--;
    if (!c.started) { c.heat = Math.max(0, c.heat * (1 - k.heatDecay) - k.heatFlat); return; }
    const active = CR.on(g);
    const cap = CR.capacity(g); const J = CR.jailed(g);
    // cooks make product (needs workshops and money)
    let made = 0;
    if (active && cap.cooks > 0) {
      const p = ['void', 'haze', 'glow', 'sugar'].find((x) => CR.unlocked(g, k.products[x].unlock)) || 'sugar';
      const cooks = c.crew.filter((e) => e.role === 'cook').slice(0, cap.cooks);
      let q = U.sum(cooks, (e) => k.cookMakes[p] * (0.6 + 0.8 * e.skill / 100)) * (J ? 0.5 : 1);
      q = Math.min(q, CR.room(g) - CR.units(g)); const cost = q * CR.wholesale(g, p) * k.cookCostShare;
      if (q > 0 && c.dirty >= cost) { c.dirty -= cost; c.stock[p] += Math.floor(q); made = Math.floor(q); row(c, '🧪', `Cooked ${k.products[p].label}`, made, 'units', 'g', `Cost ${U.money(cost)}: about ${U.pct(k.cookCostShare)} of buying it`); }
      c.last.cookUtil = cap.shops ? cap.cooks / cap.shops : 0;
    }
    // demand: clients x what they want, cheaper = more
    const dem = {}; let workNeed = 0;
    for (const p in k.products) {
      if (!CR.unlocked(g, k.products[p].unlock)) { dem[p] = 0; continue; }
      dem[p] = active ? c.clients * k.products[p].want * (0.5 + c.rep / 100) * Math.pow(1 / Math.max(0.2, CR.ratio(g, p)), k.elasticity) : 0; workNeed += dem[p] * k.products[p].work;
    }
    const workCap = Math.min(cap.deal, cap.run);
    const f = workNeed > 0 ? Math.min(1, workCap / workNeed) : 0;
    let rev = 0, heatS = 0, wsum = 0, rsum = 0, out = 0, wanted = 0, sold = 0; c.last.sold = {};
    for (const p in k.products) {
      const want = dem[p] * f; const s = Math.floor(Math.min(want, c.stock[p])); if (dem[p] > 0.5 && c.stock[p] < want) out += want - c.stock[p];
      c.stock[p] -= s; const pr = CR.price(g, p); rev += s * pr; c.last.sold[p] = s; wanted += dem[p]; sold += s;
      heatS += s * k.products[p].heat * Math.pow(CR.ratio(g, p), 2); if (s > 0) { wsum += s * pr; rsum += s * pr * CR.ratio(g, p); }
    }
    c.dirty += rev; c.stats.earned += rev; c.last.rev = rev; c.last.wanted = wanted; c.last.sold_ = sold;
    c.last.workNeed = workNeed; c.last.cap = cap; c.last.limit = sold >= wanted - 0.5 ? 'demand' : out > 0.5 ? 'stock' : cap.deal <= cap.run ? 'dealers' : 'runners';
    const r = wsum > 0 ? rsum / wsum : U.avg(Object.keys(k.products).filter((p) => CR.unlocked(g, k.products[p].unlock)), (p) => CR.ratio(g, p)) || 1;
    // clients and street rep
    // rivals poach clients when you charge over the street price: fewer clients fit on your blocks
    const room = Math.round((60 + c.blocks * k.perBlock) * (r > 1 ? Math.pow(1 / r, k.dearRoom) : 1)); c.last.room = room;
    if (active) {
      const add = (1 + c.blocks) * k.newPerBlock * Math.sqrt(c.rep / 50) * Math.pow(1 / r, k.cheapGrowth) * (sold > 0 ? 1 : 0.3);
      const churn = c.clients * k.churn * Math.pow(r, k.dearChurn) * (out > wanted * 0.2 ? 1.6 : 1);
      c.clients = Math.max(0, Math.min(c.clients + Math.min(add, Math.max(0, room - c.clients)) - churn, Math.max(room, c.clients * 0.9)));
      const target = U.clamp(50 + 40 * (1 - r) - (out > wanted * 0.2 ? k.outOfStockRep : 0), 5, 95);
      c.rep = U.clamp(c.rep + (target - c.rep) * k.repDrift, 0, 100);
    }
    c.last.ratio = r;
    // wages, upkeep, law costs
    const wages = U.sum(c.crew, (e) => e.wage); const pay = Math.min(wages, Math.max(0, c.dirty)); c.dirty -= pay;
    if (pay < wages - 1) { for (const e of c.crew) e.loyalty = U.clamp(e.loyalty - 20, 0, 100); const q = c.crew.filter(() => R.chance(0.25)); c.crew = c.crew.filter((e) => !q.includes(e)); CR.log(g, 'bad', `Couldn't pay the crew in full${q.length ? `: ${q.length} walked` : ''}`, 'Wages come out of street cash'); }
    const up = U.sum(c.gear, (x) => k.gear[x.type].upkeep || 0); c.dirty = Math.max(0, c.dirty - up);
    const lw = CR.lawyer(g).cost; if (lw) TG.F.spend(g, lw * g.world.priceIdx, 'Legal retainer');
    const bb = CR.bribeDef(g).cost; let bribed = true; if (bb) { if (c.dirty >= bb) c.dirty -= bb; else bribed = false; }
    // gear wear: vans wear with how busy they are; everything ages
    const runUtil = cap.run > 0 ? Math.min(1.5, sold > 0 ? workNeed * f / cap.run : 0) : 0;
    for (const it of c.gear) { const G = k.gear[it.type]; it.age++; it.wear = U.clamp(it.wear + 100 / G.life * (G.wear ? TG.WK.wearMult(it.type === 'van' ? runUtil : (c.last.cookUtil || 0)) : 1), 0, 100); if (it.wear >= 100 && !it.broken) { it.broken = true; CR.log(g, 'warn', `${G.label} wore out`, `Lasts about ${Math.round(G.life / 12)} years; busy use wears it faster`); } }
    // racket
    let rk = 0; if (active && c.racket && c.blocks > 0 && !J) { rk = c.blocks * k.racket.perBlock * (cap.guard >= c.blocks / 2 ? 1 : 0.5) * g.world.priceIdx; c.dirty += rk; c.stats.earned += rk; }
    // laundering
    let cleaned = 0;
    if (active && c.launder > 0 && c.dirty > 0) {
      const L = CR.launderCap(g); const want = Math.min(c.launder, c.dirty); let viaBiz = Math.min(want, L.total);
      const shady = Math.min(want - viaBiz, L.shady);
      const auditP = CR.auditOdds(g, viaBiz);
      c.dirty -= viaBiz + shady;
      const net = viaBiz * (1 - k.launderFee) + shady * (1 - k.shadyFee);
      if (net > 0) TG.F.earn(g, Math.round(net), 'Laundered income');
      cleaned = net; c.stats.laundered += net;
      for (const x of L.rows) if (L.total > 0) c.laund[x.b.id] = (c.laund[x.b.id] || 0) * 0.92 + viaBiz * x.cap / L.total;
      if (viaBiz > 0 && R.chance(auditP)) {
        const tot = U.sum(Object.values(c.laund), (x) => x); const fine = Math.round(tot * k.audit.fine);
        TG.F.spend(g, fine, 'Tax fraud fines'); c.heat = U.clamp(c.heat + 15, 0, 100);
        const top = L.rows.slice().sort((a, b2) => b2.cap - a.cap)[0];
        CR.log(g, 'bad', `Auditors found laundering: fine ${U.money(fine)}`, `${U.pct(auditP)} audit odds this month: you cleaned ${U.money(viaBiz)} of ${U.money(L.total)} capacity`, true);
        if (top && R.chance(k.audit.seize)) { CR.log(g, 'major', `${top.b.name} was seized by the state`, `${U.pct(k.audit.seize)} odds after a failed audit`, true); CR.seizeBiz(g, top.b); }
      }
    }
    // heat: sales, crew, turf, workshops, racket; decays slowly
    const shops = c.gear.filter((x) => x.type === 'workshop' && !x.broken).length;
    const gain = heatS + c.crew.length * k.crewHeat + c.blocks * k.blockHeat + shops * k.gear.workshop.heat + (rk ? c.blocks * k.racket.heat : 0);
    const cool = c.heat * k.heatDecay + k.heatFlat + cap.watch / 2 * k.lookoutCool + (J ? 2 : 0);
    const h0 = c.heat; c.heat = U.clamp(c.heat + gain - cool, 0, 100);
    // bad events
    const O = CR.odds(g); const P = {}; for (const o of O) P[o.id] = o.p; if (!bribed) P.scandal = 0;
    if (R.chance(P.raid)) CR.raid(g, `heat ${Math.round(c.heat)}`);
    if (R.chance(P.rob)) { const t = R.range(k.rob.take[0], k.rob.take[1]); const safe = c.gear.some((x) => x.type === 'safe') ? 0.6 : 1; const d = Math.round(c.dirty * t * safe); c.dirty -= d; let su = 0; for (const p in c.stock) { const q = Math.floor(c.stock[p] * t); c.stock[p] -= q; su += q; } CR.hurt(g, 1, 'robbery'); CR.log(g, 'bad', `Rivals robbed you: ${U.money(d)} and ${N(su)} units gone`, `${U.pct(P.rob)} odds: ${O.find((o) => o.id === 'rob').why}`, true); }
    if (c.crew.length && R.chance(P.snitch)) { const e = c.crew.slice().sort((a, b2) => a.loyalty - b2.loyalty)[0]; c.crew = c.crew.filter((x) => x !== e); c.heat = U.clamp(c.heat + 15, 0, 100); CR.log(g, 'bad', `${e.name} (loyalty ${Math.round(e.loyalty)}) snitched to the police`, `${U.pct(P.snitch)} odds: low loyalty and high heat`, true); if (R.chance(0.5)) CR.raid(g, 'a snitch', 0.15); }
    if (R.chance(P.war)) { const lost = c.blocks > 0 && R.chance(0.6) ? 1 : 0; c.blocks -= lost; c.clients = Math.min(c.clients, 60 + c.blocks * k.perBlock); c.heat = U.clamp(c.heat + 6, 0, 100); CR.hurt(g, 1, 'turf war'); CR.log(g, 'bad', `Turf war${lost ? ': lost a block' : ': held on'}`, `${U.pct(P.war)} odds`); }
    if (R.chance(P.bust)) { const w = c.gear.find((x) => x.type === 'workshop'); if (w) { c.gear = c.gear.filter((x) => x !== w); c.heat = U.clamp(c.heat + 20, 0, 100); CR.log(g, 'bad', 'A workshop burned down and police came', `${U.pct(P.bust)} odds`, true); if (R.chance(0.4)) CR.raid(g, 'the workshop', 0.1); } }
    if (R.chance(P.scandal)) { c.heat = U.clamp(c.heat + 20, 0, 100); c.bribe = 'none'; CR.log(g, 'bad', 'A bribed official talked. Bribes stopped, heat +20', `${U.pct(P.scandal)} odds`, true); }
    // crew loyalty and skill drift
    for (const e of c.crew) { const tgt = 55 + (e.wage / k.crew[e.role].wage - 1) * 60 + (c.rep - 50) / 4 - c.heat / 6 - (J ? 15 : 0); e.loyalty = U.clamp(e.loyalty + (tgt - e.loyalty) * 0.1 + R.normal(0, 2), 0, 100); e.skill = U.clamp(e.skill + 0.25, 1, 99); }
    // jobs being planned
    if (c.plan && !J) { if (c.plan.left > 0) { c.plan.months0 = (c.plan.months0 || 0) + 1; c.plan.left--; if (R.chance(K().heistPlan.leak)) { c.plan = null; c.heat = U.clamp(c.heat + 10, 0, 100); CR.log(g, 'bad', 'Word of your planned job leaked. Called off.', `${U.pct(K().heistPlan.leak)} leak odds per month of planning`); } else if (c.plan.left === 0) CR.runHeist(g); } }
    // This month / Next month rows
    row(c, '💵', 'Street sales', rev, '$', rev > 0 ? 'g' : 'y', `${N(sold)} of ${N(wanted)} units wanted. Held back by: ${c.last.limit}`);
    if (rk) row(c, '🛡️', 'Protection money', rk, '$', 'g', '');
    row(c, '👥', 'Crew wages', -wages, '$', 'y', '');
    if (up) row(c, '🏚️', 'Gear upkeep', -up, '$', 'y', '');
    if (bb) row(c, '💸', 'Bribes', -bb, '$', 'y', '');
    if (cleaned) row(c, '🧼', 'Laundered to clean cash', cleaned, '$', 'g', `Fee ${U.pct(k.launderFee)}; counts as business income and is taxed`);
    row(c, '🚨', 'Heat', c.heat - h0, '', c.heat > h0 ? 'r' : 'g', `+${gain.toFixed(1)} from sales, crew, turf; -${cool.toFixed(1)} cooling`);
    const nf = Math.min(1, Math.min(cap.deal, cap.run) / Math.max(1, workNeed));
    nrow(c, '🧲', 'Clients', c.clients, '/' + N(room), c.clients > room * 0.9 ? 'y' : 'g', 'More blocks hold more clients');
    nrow(c, '🛒', 'Expected sales', U.sum(Object.keys(k.products), (p) => Math.min(c.stock[p], dem[p] * nf) * CR.price(g, p)), '$', 'g', 'If your stock lasts');
    nrow(c, '👥', 'Wages due', -wages, '$', c.dirty < wages ? 'r' : 'y', c.dirty < wages ? 'Not enough street cash: crew will be angry' : '');
    nrow(c, '🚔', 'Raid odds', P.raid * 100, '%', P.raid > 0.08 ? 'r' : P.raid > 0.03 ? 'y' : 'g', '');
    c.hist.push({ m: g.month, rev: Math.round(rev), dirty: Math.round(c.dirty), heat: Math.round(c.heat), clients: Math.round(c.clients) }); if (c.hist.length > 60) c.hist.shift();
  };
  CR.raid = (g, why, extraArrest) => {
    const c = CR.ensure(g), k = K().raid; c.stats.raids++;
    const watch = CR.cover(g, 'watch'); const cam = c.gear.some((x) => x.type === 'cameras' && !x.broken) ? 0.15 : 0;
    const sh = R.range(k.stash[0], k.stash[1]) * (1 - 0.3 * watch - cam); let su = 0; for (const p in c.stock) { const q = Math.floor(c.stock[p] * sh); c.stock[p] -= q; su += q; }
    const safe = c.gear.some((x) => x.type === 'safe') ? 0.6 : 1; const d = Math.round(c.dirty * R.range(k.dirty[0], k.dirty[1]) * safe); c.dirty -= d; c.stats.seized += d;
    let gone = 0; for (let i = R.int(k.crew[0], k.crew[1]); i > 0 && c.crew.length; i--) { c.crew.splice(Math.floor(R.next() * c.crew.length), 1); gone++; }
    c.gear = c.gear.filter((x) => x.type !== 'workshop' || R.chance(0.5));
    const pYou = U.clamp((k.you + (extraArrest || 0)) * (1 - 0.4 * watch) * (c.gear.some((x) => x.type === 'phones' && !x.broken) ? 0.85 : 1) * (c.selfDeal ? 1.3 : 1), 0.03, 0.9);
    CR.log(g, 'bad', `Police raid (${why}): ${N(su)} units and ${U.money(d)} seized, ${gone} crew arrested`, `Raid odds come from heat. ${U.pct(pYou)} odds they get you too (lookouts, burner phones and not dealing yourself lower it)`, true);
    if (!CR.jailed(g) && R.chance(pYou)) CR.arrest(g, 'dealing');
  };
  // net worth share: dirty cash at face, stock at half wholesale, gear resale
  CR.value = (g) => { const c = g.crime; if (!c) return 0; return Math.max(0, c.dirty) * 0.6 + CR.stockValue(g) * 0.4 + U.sum(c.gear, (x) => CR.gearValue(g, x)); };
  TG.CR = CR;
})();
