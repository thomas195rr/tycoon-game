// v15: merged manager roles, GM+mechanic auto repair, crime corner, street boss training.
// node test/v15.test.js
const TG = require('./load')(); const bots = require('./bots')(TG);
let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };

ok(!TG.CONFIG.specialists.ops && !TG.CONFIG.specialists.safety, 'Ops manager and Safety officer are gone');
ok(TG.CONFIG.specialists.gm && TG.CONFIG.specialists.hr && TG.CONFIG.specialists.people && TG.CONFIG.specialists.ads && TG.CONFIG.specialists.lawyer, 'GM, HR, people, ads and lawyer stay');
ok(TG.D.COVER.hire[0] === 'hr' && TG.D.COVER.stock[0] === 'gm' && TG.D.COVER.broken[0] === 'gm', 'HR hires first, GM runs supplies and machines');

{
  const g = TG.Game.newGame({ seed: 3, scenario: 'rich' }); g.cash = 5e6; TG.G = g;
  const b = bots.startBiz(g, 'cafe', {});
  const ops = Object.assign(TG.S.candidate(g, b, 'gm', 0.7), { role: 'ops', skill: 77, skillSeen: 77, wage: 9000, months: 14 });
  b.spec.ops = ops; delete b.spec.gm;
  const safety = Object.assign(TG.S.candidate(g, b, 'gm', 0.7), { role: 'safety', skill: 64, wage: 7000, months: 8 });
  b.spec.safety = safety;
  g.v = 14; delete g.v15notes;
  const g2 = TG.Game.migrate(JSON.parse(JSON.stringify(g)));
  const b2 = g2.businesses[0];
  ok(b2.spec.gm && b2.spec.gm.skill === 77 && !b2.spec.ops, 'Ops manager becomes the GM and keeps skill');
  ok(b2.spec.people && b2.spec.people.skill === 64 && !b2.spec.safety, 'Safety officer becomes the people manager and keeps skill');
  ok(g2.v === 15 && g2.v15notes && g2.v15notes.length >= 2, 'v14 save gets a v15 note');
}

{
  const g = TG.Game.newGame({ seed: 8, scenario: 'rich' }); g.cash = 2e6; TG.G = g;
  const b = bots.startBiz(g, 'carwash', {});
  const gm = TG.S.candidate(g, b, 'gm', 0.8); gm.skill = 70; TG.S.hire(g, b, gm, 'test');
  if (!b.staff.some((e) => e.role === 'mech')) TG.S.hire(g, b, TG.S.candidate(g, b, 'mech', 0.7), 'test');
  const it = b.equip.find((x) => !x.leased) || b.equip[0];
  it.broken = 'major'; it.wear = 40; it.warranty = 0; it.age = 30;
  const cash0 = g.cash; const n0 = g.decisions.length;
  TG.E.queueBroken(g, b, it);
  ok(!it.broken && g.cash < cash0 && g.decisions.length === n0, `GM + mechanic repair immediately, cash drops (${Math.round(cash0 - g.cash)}), no decision card`);
  ok(g.log.some((e) => /Repaired/.test(e.text) && /GM/.test(e.by || e.text)), 'the repair and its cost are in the report');
  it.broken = 'destroyed';
  b.orders = b.orders || {}; b.orders.replaceLike = true; const tier = it.tier;
  TG.E.queueBroken(g, b, it);
  ok(!b.equip.some((x) => x.id === it.id && x.broken === 'destroyed'), 'a destroyed machine is replaced without asking');
  ok(b.equip.some((x) => x.type === it.type && x.tier === tier), 'like-for-like replacement kept the quality');
}

{
  const g = TG.Game.newGame({ seed: 2, settings: { crime: true } }); g.cash = 200000; TG.G = g;
  TG.CR.withdraw(g, 30000);
  ok(g.crime.clients >= 20, 'a new corner already has regulars');
  const pool = TG.CR.bossPool(g); TG.CR.hireBoss(g, pool[0].id);
  const boss = g.crime.mgr.boss; const skill0 = boss.skill; const dirty0 = g.crime.dirty;
  const prev = TG.V15.bossTrainPreview(g, 'basic');
  ok(prev.after >= prev.now && prev.cost > 0, 'training preview shows a better order rate before you pay');
  const r = TG.V15.bossTrain(g, 'basic');
  ok(r.ok && boss.skill >= skill0 && g.crime.dirty < dirty0, 'training spends street cash and can raise skill');
  const w0 = boss.wage; TG.V15.bossRaise(g);
  ok(boss.wage > w0, 'a raise increases the street boss pay');
}

console.log(pass + ' passed, ' + fails.length + ' failed');
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
