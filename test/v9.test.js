// v9 checks: training, poaching & raises, managers working at a fraction, Shift-lead migration, cheaper fixed costs,
// higher rents, tech funding rounds, and the live preview never breaking machines.
//   node test/v9.test.js
const load = require('./load');
let fails = 0, n = 0; const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL: ' + msg); } };
const setup = (type, seed) => { const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: seed || 7 }); g.cash = 5e6; TG.G = g; const b = bots.startBiz(g, type || 'salon'); return { TG, bots, g, b }; };
const key = (TG, b) => TG.M.keyRole(TG.CONFIG.businesses[b.type]);
const worker = (TG, g, b, over) => { const c = TG.S.candidate0(g, b, key(TG, b), 0.5); Object.assign(c, over || {}); TG.S.hire(g, b, c); return b.staff.find((x) => x.id === c.id); };

// 1) training: costs money, takes part of the month, gains fall inside the shown range, market value rises, gains shrink above 60
{ const { TG, g, b } = setup('salon', 3); const S = TG.S, C = TG.CONFIG.staff;
  let inRange = 0, tries = 0;
  for (let i = 0; i < 40; i++) {
    const e = worker(TG, g, b, { skill: 30, learning: 1, learnSeen: true, morale: 70 });
    const p = S.trainPreview(g, b, e, 'basic'); const cash0 = g.cash; const eff0 = TG.M.staffEff(e);
    const r = S.train(g, b, e.id, 'basic'); tries++;
    ok(Math.round(cash0 - g.cash) === p.cost, 'basic training charges the shown cost');
    if (r.gain >= p.lo && r.gain <= p.hi) inRange++;
    ok(e.away > 0 && TG.M.staffEff(e) < eff0, 'a trainee is away part of the month (less work done)');
    ok(r.mv1 >= r.mv0, 'market value does not fall after training');
    S.fire(g, b, e.id, 'test');
  }
  ok(inRange === tries, `training gains fall inside the shown range (${inRange}/${tries})`);
  ok(S.trainDim(80) < S.trainDim(50) && S.trainDim(50) === 1, 'gains shrink above skill 60');
  const slow = worker(TG, g, b, { skill: 30, learning: 0.1, learnSeen: true }); const pv = S.trainPreview(g, b, slow, 'advanced');
  ok(pv.hi <= 3 && pv.noStick === 1, 'a known slow learner is shown as barely gaining');
  // away resets after the month
  const e2 = worker(TG, g, b, { skill: 30 }); S.train(g, b, e2.id, 'basic'); TG.Game.nextMonth(g); const e2b = TG.S.allStaff(b).find((x) => x.id === e2.id);
  ok(!e2b || !e2b.away, 'time away for training ends with the month');
  // trainees are cheap and low-skill
  const pool = []; for (let i = 0; i < 200; i++) pool.push(S.candidate0(g, b, key(TG, b), 0.5, { trainee: true }));
  const avgSk = pool.reduce((a, c) => a + c.skill, 0) / pool.length; const under = pool.filter((c) => c.wage < S.mv(g, b, c)).length / pool.length;
  ok(avgSk < 35, `trainees start low-skill (avg ${avgSk.toFixed(0)})`); ok(under > 0.9, `trainees ask less than their market value (${(under * 100).toFixed(0)}%)`);
  ok(pool.every((c) => c.trainee), 'trainees are tagged'); }

// 2) poaching & raises: odds rise with the pay gap and skill, depend on personality, a raise lowers them, a fair wage is safe
{ const { TG, g, b } = setup('salon', 4); const S = TG.S;
  const e = worker(TG, g, b, { skill: 75, loyalty: 20, morale: 60, pers: 'steady', persSeen: true }); const mv = S.mv(g, b, e);
  e.wage = Math.round(mv * 0.7); const under = S.poachOdds(g, b, e).p;
  e.wage = mv; const fair = S.poachOdds(g, b, e).p;
  ok(under > fair * 3, `underpaid 30% is much riskier than market pay (${(under * 100).toFixed(1)}% vs ${(fair * 100).toFixed(2)}%)`);
  e.wage = Math.round(mv * 0.95); ok(S.poachOdds(g, b, e).p < 0.01, 'a small pay gap (under the tolerance) carries little risk');
  e.wage = Math.round(mv * 0.7);
  const low = Object.assign({}, e, { skill: 25 }); ok(S.poachOdds(g, b, low).p < under / 3, 'low-skill workers rarely get offers');
  const climber = Object.assign({}, e, { pers: 'climber' }), loyal = Object.assign({}, e, { pers: 'loyal' });
  ok(S.poachOdds(g, b, climber).p > S.poachOdds(g, b, loyal).p * 3, 'climbers are far likelier to leave than loyal people');
  const po = S.poachOdds(g, b, e); ok(po.reasons.length >= 3 && /under market/.test(po.reasons[0]), 'poach odds come with reasons');
  const rp = S.raisePreview(g, b, e, 'market'); ok(rp.pAfter < rp.pNow && rp.to >= mv && rp.cost > 0, 'raise preview: to market lowers the odds and shows the cost');
  const r = S.raise(g, b, e.id, 'market'); ok(r && e.wage === rp.to, 'raise to market sets the previewed wage');
  ok(S.poachOdds(g, b, e).p < under / 3, 'after the raise the odds are low');
  // over many months an underpaid star gets an offer card; matching sets the offered wage
  const mk = () => worker(TG, g, b, { skill: 85, loyalty: 5, pers: 'climber', persSeen: true, morale: 60, ambition: 20 }); let star = mk();
  let card = null; const add0 = TG.D.add; TG.D.add = (gg, d) => { const r = add0(gg, d); if (d.kind === 'poach' && !card) card = JSON.parse(JSON.stringify(r)); return r; };
  for (let i = 0; i < 60 && !card; i++) { if (!TG.S.allStaff(b).includes(star)) star = mk(); star.wage = Math.round(S.mv(g, b, star) * 0.6); star.morale = 60; star.loyalty = 5; TG.Game.nextMonth(g); }
  TG.D.add = add0;
  ok(!!card, 'an underpaid star gets a job-offer card');
  if (card) { ok(card.offer > 0 && /stay/.test(card.options[0].label), 'the card shows the offer and the odds they stay');
    const e3 = worker(TG, g, b, { skill: 80, pers: 'loyal', persSeen: true }); const dec = TG.D.add(g, Object.assign({}, card, { id: null, empId: e3.id, offer: e3.wage + 500 }));
    TG.D.resolve(g, dec, 'counter'); const still = TG.S.allStaff(b).find((x) => x.id === e3.id); ok(!still || still.wage >= e3.wage, 'matching pays the offer'); ok(!still || still.wage === dec.offer, 'matched wage = offer'); }
  // a warning before the card: warnAt odds produce a heads-up event
  ok(TG.CONFIG.staff.poach.warnAt > 0 && TG.CONFIG.staff.poach.warnAt < 0.1, 'there is a heads-up threshold'); }

// 3) managers work at a fraction of a worker: capacity goes up by about that much
{ const { TG, g, b } = setup('salon', 5); const S = TG.S, frac = TG.CONFIG.staff.mgrWorkFrac;
  ok(frac > 0 && frac < 0.5, 'managers work at a fraction of a worker');
  ok(!TG.CONFIG.specialists.lead, 'the Shift lead role is gone');
  const ctx0 = TG.B.ctx(g, b); const cap0 = TG.M.models.service.caps(g, b, ctx0).keyCap;
  const gm = S.candidate0(g, b, 'gm', 0.5); gm.skill = 50; S.hire(g, b, gm);
  ok(S.mgrW(b) > 0 && Math.abs(S.mgrW(b) - frac * TG.M.staffEff(b.spec.gm)) < 1e-9, 'GM work = fraction x their efficiency');
  const ctx1 = TG.B.ctx(g, b); const cap1 = TG.M.models.service.caps(g, b, ctx1).keyCap; const per = TG.CONFIG.businesses.salon.roles[key(TG, b)].cap;
  ok(cap1 > cap0 && Math.abs((cap1 - cap0) - per * S.mgrW(b)) < per * 0.05, `capacity rises by the manager's share (${Math.round(cap1 - cap0)} vs ~${Math.round(per * S.mgrW(b))})`);
  ok(/25% of a worker/.test(S.mgrNote(b)), 'the work card explains the manager share');
  TG.Game.nextMonth(g); const w = (b.work || []).find((x) => x.kind === 'staff' && x.role === key(TG, b)); ok(w && w.mw > 0 && /Managers lend a hand/.test(w.tip), 'the Work card shows the manager share'); }

// 4) v8 save with a Shift lead migrates: lead -> Ops manager (or crew if Ops is taken), with a note; nothing breaks
{ const { TG, g, b } = setup('cafe', 6); const S = TG.S;
  const lead = S.candidate0(g, b, 'gm', 0.5); lead.role = 'lead'; b.spec.lead = lead; delete b.spec.ops;
  const { g: g2x, b: c2 } = (() => { const b2 = require('./bots')(TG).startBiz(g, 'salon'); const l2 = S.candidate0(g, b2, 'gm', 0.5); l2.role = 'lead'; b2.spec.lead = l2; const o2 = S.candidate0(g, b2, 'ops', 0.5); b2.spec.ops = o2; return { g, b: b2 }; })();
  const s = JSON.parse(TG.Game.serialize(g)); s.v = 8; for (const bb of s.businesses) for (const e of [].concat(bb.staff, Object.values(bb.spec || {}).filter(Boolean))) { delete e.pers; delete e.persSeen; delete e.expGain; }
  let g2; try { g2 = TG.Game.deserialize(JSON.stringify(s)); } catch (e) { ok(false, 'v8 save failed to load: ' + e.message); }
  if (g2) { TG.G = g2; const a = g2.businesses.find((x) => x.id === b.id), z = g2.businesses.find((x) => x.id === c2.id);
    ok(g2.v === 9, 'save is now v9'); ok(!('lead' in a.spec) && !('lead' in z.spec), 'no Shift lead seat left');
    ok(a.spec.ops && a.spec.ops.id === lead.id && a.spec.ops.role === 'ops', 'lead became the Ops manager when that seat was free');
    ok(z.staff.some((e) => e.name === c2.spec.lead.name && e.role === key(TG, z)), 'lead joined the crew when Ops was taken');
    ok(Array.isArray(g2.v9notes) && g2.v9notes.length === 2, 'the player gets a note for each change');
    ok(TG.S.allStaff(a).every((e) => e.pers), 'everyone has a personality after migration');
    const gaps = TG.S.allStaff(a).concat(TG.S.allStaff(z)).map((e) => (TG.S.mv(g2, a, e) - e.wage) / TG.S.mv(g2, a, e));
    ok(gaps.every((x) => x < 0.13), 'migrated workers are not suddenly underpaid (no poach wave)');
    for (let i = 0; i < 6; i++) TG.Game.nextMonth(g2); ok(g2.businesses.length >= 1, 'migrated save keeps playing');
    ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), 'v9 save round-trips'); } }

// 5) cheaper fixed costs for food truck & lawn; lawn off-season pay; higher apartment rents; tech funding rounds
{ const TG = load(); const BZ = TG.CONFIG.businesses;
  ok(BZ.foodtruck.fixedCut < 1 && BZ.lawn.fixedCut < 1 && BZ.foodtruck.fixedCutWhy && BZ.lawn.fixedCutWhy, 'food truck & lawn have explained lower fixed costs');
  ok(BZ.lawn.offSeason && BZ.lawn.offSeason.pay < 1 && BZ.lawn.offSeason.why, 'lawn crew works short hours in the off-season (explained)');
  ok(TG.CONFIG.realEstate.kinds.smallapt.rentPct >= 0.0097 && TG.CONFIG.realEstate.kinds.apartment.rentPct >= 0.009, 'apartment rents raised ~10%');
  ok(Array.isArray(BZ.tech.tech.rounds) && BZ.tech.tech.rounds.length >= 2 && BZ.tech.tech.rounds.every((r) => r.users > 0 && r.pct > 0), 'tech has milestone funding rounds'); }

// 6) the live preview (instant recompute) never breaks or steals machines, so the Now page shows what you own
{ const { TG, g, b } = setup('farm', 8); for (const it of b.equip) it.wear = 99.9; const before = b.equip.map((x) => x.broken || '').join();
  let seen = 0; for (let i = 0; i < 30; i++) { g.rngState = 1000 + i; TG.B.liveReset(b); const L = TG.B.live(g, b); const t = L.work.find((w) => w.t === 'Tractors'); if (t && t.own === b.equip.filter((x) => x.type === 'tractor').length && t.n === t.own) seen++; }
  ok(seen === 30, `preview keeps every tractor working (${seen}/30)`); ok(b.equip.map((x) => x.broken || '').join() === before, 'preview does not change the real game'); }

console.log(`${n - fails}/${n} v9 checks passed`);
if (fails) { console.log('V9 TEST FAILED'); process.exit(1); } else console.log('V9 TEST PASSED');
