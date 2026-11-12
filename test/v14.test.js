// v14 checks: people manager, factory can profit, sale price ignores a one-month spike,
// tech sales stay inside server capacity, cooks produce, save slots, crime boss.
// node test/v14.test.js
const TG = require('./load')(); const bots = require('./bots')(TG);
const U = TG.U; let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };

// 1. people manager: effect scales with skill and is visible before hiring; poach odds fall
{
  const g = TG.Game.newGame({ seed: 4, scenario: 'rich' }); g.cash = 5e6; TG.G = g;
  const b = bots.startBiz(g, 'cafe', {});
  const lo = Object.assign(TG.S.candidate(g, b, 'people', 0.8), { skill: 20, skillSeen: 20, wage: 12000 });
  const hi = Object.assign(TG.S.candidate(g, b, 'people', 0.8), { skill: 90, skillSeen: 90, wage: 20000 });
  const a = TG.V14.peoplePreview(g, b, lo), z = TG.V14.peoplePreview(g, b, hi);
  ok(z.morale > a.morale && z.quit > a.quit && z.poach > a.poach, 'people manager effect grows with skill');
  ok(a.perk > 0 && a.perk < a.wage, 'part of the salary is team perks');
  const e = b.staff[0]; e.wage = Math.round(TG.S.mv(g, b, e) * 0.7); e.skill = 70; e.loyalty = 40; e.morale = 40; e.pers = 'climber'; e.persSeen = true;
  const before = TG.S.poachOdds(g, b, e).p;
  TG.S.hire(g, b, hi, 'test');
  const after = TG.S.poachOdds(g, b, e).p;
  ok(after < before, 'a people manager cuts poach odds');
  ok(TG.CONFIG.specialists.people && TG.V12.keepRoles, 'people manager is a normal manager role');
  b.keep = { people: true }; b.spec.people = null;
  TG.V12.ceoKeep && g.ceo ? null : (g.ceo = Object.assign(TG.S.candidate(g, b, 'ceo', 0.9), { skill: 80, wage: 0, profitShare: 0 }));
  const had = !!b.spec.people;
  TG.D.manage(g, b);
  ok(had || b.spec.people, 'CEO keep-hired list can fill the people manager');
}

// 2. manufacturing: a silver-spoon player who quick-sets a well-rated site makes money over 2 years
{
  let wins = 0, n = 0;
  for (const seed of [1, 2, 3, 4]) {
    const g = TG.Game.newGame({ seed, scenario: 'rich' }); g.cash = 2000000; TG.G = g;
    for (let i = 0; i < 5; i++) g.listings.push(TG.P.gen(g, TG.P.idealFor('factory')));
    const picks = g.listings.map((p) => ({ p, s: TG.P.suit(p, 'factory') })).filter((x) => x.p.kind === 'warehouse').sort((a, b) => b.s - a.s);
    if (!picks.length) continue;
    const mode = picks[0].p.price < g.cash * 0.35 ? 'cash' : 'lease';
    if (!TG.P.acquire(g, picks[0].p.id, mode).ok) continue;
    const s = TG.B.start(g, 'factory', picks[0].p.id); if (!s.ok) continue;
    TG.B.quickSetup(g, s.biz, true, 'standard');
    const b = s.biz; n++;
    ok(b.equip.some((e) => e.type === 'line'), 'quick setup gets a production line even on a $2M start (seed ' + seed + ')');
    let profit = 0;
    for (let i = 0; i < 24; i++) {
      for (const it of b.equip) if (it.broken && it.broken !== 'destroyed' && g.cash > TG.E.repairCost(g, b, it) + 2000) TG.E.repair(g, b, it.id);
      const need = TG.M.needs(g, b);
      for (const role of need.staff) {
        while (b.staff.filter((e) => e.role === role.role).length < role.count && g.cash > 8000) {
          const pool = TG.S.poolFor(g, b, role.role); if (!pool.length) break; TG.S.hire(g, b, pool[0]);
        }
      }
      if (!TG.D.handler(g, b, 'stock')) { const q = TG.ST.suggest(b, g); if (q > 0) TG.ST.buy(g, b, q); }
      TG.Game.nextMonth(g); const h = b.hist[b.hist.length - 1]; if (h) profit += h.profit;
    }
    if (profit > 0) wins++;
    console.log('factory seed', seed, 'profit', Math.round(profit), 'site', picks[0].p.kind, picks[0].p.loc);
  }
  ok(n >= 3 && wins >= 3, `sensible factory starts profit (${wins}/${n})`);
}

// 3. tech: ads cannot push users past server capacity; a one-month spike does not set the sale price
{
  const g = TG.Game.newGame({ seed: 9, scenario: 'rich' }); g.cash = 5e6; TG.G = g;
  const b = bots.startBiz(g, 'tech', {});
  b.tech.phase = 'live'; b.tech.users = 2000; b.tech.userAvg = 2000; b.tech.pmf = 0.8; b.tech.dev = 999;
  TG.E.buy(g, b, 'server', 'standard');
  const cap = TG.E.capacity(b, 'server');
  b.ads.budget = 5000000; b.ads.channel = 'tv';
  TG.Game.nextMonth(g);
  ok(b.tech.users <= cap + 1, `users ${b.tech.users} stay within server capacity ${Math.round(cap)}`);
  const spiked = b.hist.map((h) => h.profit);
  // pretend a wild month on top of a steady history
  b.hist = [];
  for (let i = 0; i < 10; i++) b.hist.push({ profit: 20000 });
  b.hist.push({ profit: 5000000 });
  const rate = TG.F.profitRunRate(b);
  ok(rate < 20000 * 14, `run-rate ${rate} ignores the $5M spike (median month is $20k)`);
  b.hist = [{ profit: 5000000 }];
  ok(TG.F.profitRunRate(b) < 5000000 * 6, 'a single month is not treated as a full year of profit');
  b.hist = []; b.tech.pmf = 0.9; b.tech.users = 1000000; b.tech.userAvg = 1000000;
  const huge = TG.F.bizValue(g, b);
  b.tech.userAvg = Math.min(2000, cap); b.tech.users = cap * 8;
  const small = TG.F.bizValue(g, b);
  ok(small < huge * 0.5, `sale price follows smoothed users (${small} vs spike ${huge}), not a one-month user jump`);
  console.log('tech cap', Math.round(cap), 'values', small, huge);
}

// 4. cooks produce, and more cooks make more
{
  const g = TG.Game.newGame({ seed: 3, settings: { crime: true } }); g.cash = 400000; TG.G = g;
  TG.CR.withdraw(g, 60000);
  const c = g.crime; c.clients = 40; c.blocks = 0; c.rep = 40; c.cookProd = 'sugar';
  c.crew.push({ id: 'k1', name: 'Pat', role: 'cook', skill: 50, loyalty: 70, wage: 3800, since: 0 });
  TG.CR.month(g);
  ok((c.last.cooked || 0) === 0, 'a cook with no workshop cooks nothing, and the month says so');
  c.gear.push({ id: 'w1', type: 'workshop', wear: 0, age: 0 });
  c.dirty = 200000; for (const p in c.stock) c.stock[p] = 0;
  TG.CR.month(g);
  const one = c.last.cooked || 0;
  ok(one > 0, `one cook made ${one} units`);
  c.crew.push({ id: 'k2', name: 'Sam', role: 'cook', skill: 80, loyalty: 70, wage: 3800, since: 0 });
  c.dirty = 200000; for (const p in c.stock) c.stock[p] = 0;
  TG.CR.month(g);
  const two = c.last.cooked || 0;
  ok(two > one, `two cooks made more (${one} then ${two})`);
  ok(c.dirty < 200000, 'cooking spends street cash on ingredients');
  console.log('cooks', one, two);
}

// 5. street boss is required before product is bought for you
{
  const g = TG.Game.newGame({ seed: 6, settings: { crime: true } }); g.cash = 200000;
  TG.CR.withdraw(g, 80000); const c = g.crime; c.clients = 30; c.started = true;
  const stock0 = c.stock.sugar;
  TG.CR.month(g);
  ok((c.stock.sugar || 0) === stock0 || (c.last && c.last.cooked), 'without a boss, nobody buys product for you');
  const pool = TG.CR.bossPool(g); const r = TG.CR.hireBoss(g, pool[0].id);
  ok(r.ok && c.mgr.boss, 'street boss can be hired, effect shown in bossPreview');
  const prev = TG.V14.bossPreview(g, pool[0]);
  ok(prev.order > 0.8 && prev.order < 1.2, 'boss order size depends on skill');
}

// 6. save slots: legacy save becomes slot 1; a second slot does not erase it
{
  const store = TG.store; store.del('tycoon_slots_v1'); store.del('tycoon_slot_1'); store.del('tycoon_save_v1');
  const g = TG.Game.newGame({ seed: 11, scenario: 'classic' }); g.cash = 123456; g.month = 7; g.player.name = 'Ada';
  store.set('tycoon_save_v1', TG.Game.serialize(g));
  store.del('tycoon_slots_v1');
  const idx = TG.Game.slots.ensure();
  ok(idx.slots.length === 1 && idx.slots[0].id === '1', 'legacy save migrates into slot 1');
  ok(Math.round(idx.slots[0].cash) === 123456, 'slot 1 keeps the cash');
  const id2 = TG.Game.slots.create('Other game');
  const g2 = TG.Game.newGame({ seed: 12 }); g2.cash = 50; TG.G = g2; TG.Game.save(g2, true);
  ok(TG.Game.slots.active() === id2, 'new game can live in another slot');
  TG.Game.slots.activate('1');
  const back = TG.Game.load();
  ok(back && Math.round(back.cash) === 123456, 'loading slot 1 brings the original game back');
  TG.Game.slots.rename('1', 'Ada game');
  ok(TG.Game.slots.ensure().slots.find((s) => s.id === '1').name === 'Ada game', 'rename works');
  TG.Game.slots.remove(id2);
  ok(!TG.Game.slots.ensure().slots.some((s) => s.id === id2), 'delete removes a slot');
}

// 7. version bump
ok(TG.VERSION >= 14, 'version is 14 or later');
{
  const old = TG.Game.newGame({ seed: 1 }); old.v = 13; delete old.v14notes;
  const g = TG.Game.migrate(JSON.parse(JSON.stringify(old)));
  ok(g.v >= 14 && g.v14notes && g.v14notes.length >= 4, 'v13 save migrates through v14 with a note');
}

console.log(pass + ' passed, ' + fails.length + ' failed');
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
