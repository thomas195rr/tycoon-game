// v10 checks: what the game is EXPECTED to do (each line is one promise to the player).
// node test/v10.test.js
const load = require('./load.js'); const TG = load(); const bots = require('./bots.js')(TG);
const U = TG.U, C = TG.CONFIG, V = TG.V10; let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1 : t);
const fresh = (seed, cash) => { const g = TG.Game.newGame({ seed: seed || 1 }); TG.G = g; if (cash != null) g.cash = cash; return g; };

// ---------- 9. new rentals start EMPTY, every unit its own rent ----------
{
  const g = fresh(3, 5e7); g.player.credit = 840; TG.CREDIT.sync && TG.CREDIT.sync(g);
  for (const mode of [false, true]) {
    const l = g.re.listings.find((x) => x.units > 1 && !g.re.holdings.includes(x)) || g.re.listings.find((x) => x.units);
    const r0 = TG.R.chance; TG.R.chance = () => true; let r; try { r = TG.RE.buy(g, l.id, mode, 300, mode ? 0.3 : 0); } finally { TG.R.chance = r0; } ok(r.ok, `RE.buy ${mode ? 'mortgage' : 'cash'} works (${r.msg || ''})`);
    if (!r.ok) continue; const h = r.h;
    ok(h.tenants.length === h.units && h.tenants.every((t) => t === null), `${mode ? 'mortgaged' : 'cash'} ${h.kind}: all ${h.units} units empty on purchase`);
    if (mode) { const loan = g.loans.find((x) => x.id === h.mortgageId); ok(loan && near(loan.principal || loan.balance, h.price * 0.7, h.price * 0.011), `30% down payment gives a 70% loan (${loan && Math.round(loan.principal || loan.balance)} vs ${Math.round(h.price * 0.7)})`); }
    if (h.units > 1) {
      h.unitR = { 1: 1.2 }; const mr = TG.RE.marketRent(g, h);
      ok(near(TG.RE.askRent(g, h, 1), mr * 1.2, 1) && near(TG.RE.askRent(g, h, 0), mr * (h.rentR || 1), 1), 'each unit has its own asking rent (unit 2 at 120%)');
      const s = TG.RE.search(g, h.id, 1); const a = TG.RE.current(g, h, 1);
      if (a) { TG.RE.accept(g, h.id, 1); ok(h.tenants[1] && near(h.tenants[1].rent, TG.RE.askRent(g, h, 1), 1), `tenant in unit 2 pays unit 2's rent (${h.tenants[1] && h.tenants[1].rent})`); ok(!h.tenants[0], 'unit 1 stays empty'); }
      else ok(s != null, 'search ran for unit 2');
    }
  }
}
// ---------- 10. listings stay 3-7 months, then new ones replace them ----------
{
  const g = fresh(4, 2e5); const L = C.v10.listingLife;
  ok(g.re.listings.every((l) => l.life >= L[0] && l.life <= L[1]), 'every home listing lasts 3-7 months');
  ok(g.listings.every((l) => l.life >= L[0] && l.life <= L[1]), 'every business-property listing lasts 3-7 months');
  const re0 = g.re.listings.map((x) => x.id), p0 = g.listings.map((x) => x.id);
  for (let i = 0; i < 8; i++) TG.Game.nextMonth(g);
  ok(!g.re.listings.some((x) => re0.includes(x.id)), 'after 8 months every old home listing is gone');
  ok(!g.listings.some((x) => p0.includes(x.id)), 'after 8 months every old business-property listing is gone');
  ok(g.re.listings.length >= C.realEstate.listingCount, `homes for sale refilled (${g.re.listings.length})`);
  ok(g.listings.length >= 30, `business properties refilled (${g.listings.length})`);
  for (const type of Object.keys(C.businesses)) ok(g.listings.some((p) => TG.P.suit(p, type) >= 0.6), `a good place for a ${type} is always listed`);
}
// ---------- 11. no bet limit, same odds ----------
{
  const g = fresh(5, 1e7); g.settings.gambling = true;
  ok(TG.I.betLimit(g) === Infinity, 'no table limit');
  let n = 0; for (let i = 0; i < 40; i++) { if (TG.I.canBet(g, 100) === null) { TG.I.casinoBet(g, 'red', 100); n++; } }
  ok(n === 40, `40 bets in one month all allowed (${n})`);
  ok(TG.I.canBet(g, 2e6) === null, 'a $2M bet is allowed with the cash');
  ok(TG.I.canBet(g, g.cash + 1) !== null, 'cannot bet more than your cash');
  const G = C.casino.games; ok(G.red.p === 18 / 37 && G.red.pays === 1 && G.dozen.p === 12 / 37 && G.dozen.pays === 2 && G.num.p === 1 / 37 && G.num.pays === 35 && G.dice.p === 15 / 36 && G.dice.pays === 1.3 && G.slots.rtp === 0.92, 'casino odds unchanged');
  ok(C.casino.horses.overround === 1.2 && C.casino.sports.vig === 0.048, 'track and bookmaker cut unchanged');
}
// ---------- 2. bonuses build loyalty ----------
{
  const g = fresh(6, 3e6); const b = bots.startBiz(g, 'cafe'); const e = b.staff[0]; e.loyalty = 30;
  const pv = TG.S.bonusPreview(g, b, e); const p0 = TG.S.poachOdds(g, b, e, true).p;
  const r = TG.S.bonus(g, b, e.id); ok(r && r.loyalty && r.loyalty[1] > 30, `bonus raises loyalty (${r && r.loyalty})`);
  ok(Math.round(e.loyalty) === pv.to, 'preview matched the real loyalty change');
  ok(TG.S.poachOdds(g, b, e, true).p < p0, 'poach odds drop after a bonus');
  e.loyalty = 95; const add = V.bonusLoyalty(e); ok(add >= C.v10.bonusLoyaltyMin && add < V.bonusLoyalty({ loyalty: 10 }), 'loyal people gain less from each bonus');
}
// ---------- 6. machines: mechanic, insurance, replacement ----------
{
  const g = fresh(7, 3e6); const b = bots.startBiz(g, 'carwash'); const it = b.equip.find((x) => TG.E.def(b, x.type).price > 2000) || b.equip[0];
  ok(!b.equip.some((x) => x.maint && !x.leased), 'no maintenance plans on owned machines');
  const val = V.machineNew(g, b); ok(near(TG.F.premium(g, b, 'equipment'), Math.max(C.v10.machineIns.min * g.world.priceIdx, val * C.v10.machineIns.pct), 1), 'machine insurance premium = % of new price of your machines');
  b.ins.equipment = true; const c0 = g.cash; const newP = TG.E.price(g, b, it.type, it.tier === 'used' ? 'budget' : it.tier);
  it.broken = null; const ctx = TG.B.ctx(g, b);
  // force a total loss through the real code path
  const R = TG.R; const w0 = R.weighted; R.weighted = () => 'catastrophic'; let paid = 0;
  try { const e0 = g.cash; TG.E.breakItem(g, b, it, TG.E.breakChance(g, b, it), ctx); paid = g.cash - e0; } finally { R.weighted = w0; }
  ok(it.broken === 'destroyed', 'machine destroyed'); ok(near(paid, Math.round((newP - C.finance.insDeductible * g.world.priceIdx) * C.finance.insCover), 2), `insurance paid ${paid} for a destroyed machine (new price ${newP})`);
  void c0;
  // no manager: waits for you
  delete b.spec.gm; delete b.spec.ops; g.ceo = null; g.month++; TG.D.autoResolve(g);
  ok(g.decisions.some((d) => d.kind === 'broken' && d.itemId === it.id) && b.equip.find((x) => x.id === it.id && x.broken === 'destroyed'), 'no manager: the destroyed machine waits for you');
  // with an Ops manager + like-for-like order
  const cand = TG.S.poolFor(g, b, 'ops')[0]; TG.S.hire(g, b, cand); b.orders = b.orders || {}; b.orders.replaceLike = true; const tier = it.tier; g.month++;
  const R2 = TG.R; const roll = TG.D.roll; TG.D.roll = () => 'good'; try { TG.D.autoResolve(g); } finally { TG.D.roll = roll; }
  ok(!b.equip.some((x) => x.broken === 'destroyed'), 'Ops manager replaced the destroyed machine');
  ok(b.equip.some((x) => x.type === it.type && x.tier === tier && x.id !== it.id), `like-for-like order: same kind and quality (${tier})`); void R2;
  ok(TG.D.roleEdge('ops', 'broken') > 0 && TG.D.roleEdge('gm', 'broken') < 0 && TG.D.roleEdge('gm', 'poach') > 0 && TG.D.roleEdge('ops', 'poach') < 0, 'GM is better at people jobs, Ops at machine jobs');
}
// ---------- 4. take over a struggling business (any type) + failing-business new games ----------
for (const type of Object.keys(C.businesses)) {
  const g = fresh(20 + type.length, 2e7); const p = TG.P.gen(g, TG.P.idealFor(type)); g.listings.push(p); TG.P.acquire(g, p.id, 'lease');
  const prev = g.cash; g.cashMark = g.cash; g.acc = TG.F.newAcc();
  const r = V.takeover(g, type, p.id, {}); ok(r.ok, `${type}: takeover works (${r.msg || ''})`); if (!r.ok) continue;
  const b = r.biz; ok(r.quote.price < r.quote.full * 0.5, `${type}: takeover costs less than half of new`); ok(b.rep <= C.v10.takeover.rep[1], `${type}: weak reputation`);
  ok(g.loans.some((l) => l.bizId === b.id), `${type}: old owner's debt is a loan`); ok(b.equip.length > 0 || !TG.B.def(b).equip.some((e) => e.critical), `${type}: comes with gear`);
  const rep = TG.Game.nextMonth(g); ok(rep.money && near(rep.cashEnd - prev, rep.money.net, 2), `${type}: money report reconciles after a takeover (${rep.money && Math.round(rep.money.net)} vs ${Math.round(rep.cashEnd - prev)})`);
  const g2 = TG.Game.newGame({ seed: 40 + type.length, scenario: 'failing', failType: type }); TG.G = g2;
  ok(g2.businesses.length === 1 && g2.businesses[0].type === type && g2.businesses[0].rep < 30 && g2.loans.length > 0 && g2.cash > 0, `${type}: "take over a failing business" new game`);
  const prev2 = g2.cash; const r2 = TG.Game.nextMonth(g2); ok(near(r2.cashEnd - prev2, r2.money.net, 2), `${type}: failing start first month reconciles`);
}
// ---------- 8. play time across restarts and saves ----------
{
  const store = {}; TG.store.get = (k) => store[k] || null; TG.store.set = (k, v) => { store[k] = v; return true; };
  const g = TG.Game.newGame({ seed: 9 }); TG.G = g; for (let i = 0; i < 14; i++) TG.Game.nextMonth(g);
  ok(V.playMonths(g) === 14 + (g.playBefore || 0), 'play time counts months');
  const before = V.playMonths(g); const g2 = TG.Game.newGame({ seed: 10 }); TG.G = g2;
  ok(V.playMonths(g2) === before, `a new game keeps the play time (${V.playMonths(g2)} vs ${before})`);
  TG.Game.nextMonth(g2); const s = TG.Game.serialize(g2); const g3 = TG.Game.deserialize(s);
  ok(V.playMonths(g3) === before + 1, 'play time survives save + load');
  ok(V.playText(25) === '2 yrs 1 mo' && V.playText(12) === '1 yr' && V.playText(5) === '5 mo', 'play time shown in game years');
}
// ---------- migration v9 -> v10 ----------
{
  const g = fresh(11, 3e6); const b = bots.startBiz(g, 'farm', { ent: 'cows' }); for (const it of b.equip) it.maint = true; b.ads.budget = 500; g.v = 9; delete g.playBefore;
  for (const l of g.re.listings) delete l.life;
  const g2 = TG.Game.deserialize(JSON.stringify(g));
  ok(g2.v === 10, 'save upgraded to v10'); ok(g2.businesses[0].equip.every((x) => !x.maint || x.leased), 'maintenance plans cancelled');
  ok(g2.businesses[0].ads.budget === 0, 'farm ad budget stopped (ads cannot sell at market price)'); ok(g2.re.listings.every((l) => l.life >= 3), 'old listings get a lifetime');
  ok(g2.playBefore === 0 || g2.playBefore > 0, 'play time field added'); ok(g2.v10notes && g2.v10notes.length >= 2, 'update notes shown');
}
// ---------- 12. upgrades: more of them, each with a payback ----------
{
  const OLD = {"cafe":5,"foodtruck":4,"bakery":3,"salon":3,"carwash":3,"lawn":2,"auto":4,"gym":4,"farm":3,"freight":3,"brand":4,"hotel":3,"law":3,"clinic":3,"construction":3,"factory":8,"tech":5,"franchise":3}; /* v9 counts */
  for (const [type, d] of Object.entries(C.businesses)) {
    ok(d.fixes.length >= (OLD[type] || 4) + 4, `${type}: ${d.fixes.length} upgrades (more than before)`);
    ok(d.fixes.every((f) => f.ic), `${type}: every upgrade has an icon`);
    ok((d.customers || []).length >= 2 && near(U.sum(d.customers, (c) => c.share), 1, 0.02), `${type}: has its own customers`);
  }
  const g = fresh(12, 3e6); const b = bots.startBiz(g, 'cafe'); for (let i = 0; i < 4; i++) { bots.careful(g, b); TG.Game.nextMonth(g); }
  const c0 = g.cash, r0 = g.rngState; for (const f of TG.B.def(b).fixes) { const x = V.fixGain(g, b, f.id); ok(x && Number.isFinite(x.net) && x.cost >= 0, `cafe ${f.id}: payback estimate`); }
  ok(g.cash === c0 && g.rngState === r0, 'payback estimates do not change the game');
  // ads measured
  b.ads.budget = 3000; TG.Game.nextMonth(g); ok(b.adLast && b.adLast.extra >= 0 && b.adLast.spent === 3000, `cafe: ads measured (${b.adLast && Math.round(b.adLast.extra)} extra)`);
}
// ---------- 12. sales vary month to month (buzz + wobble) ----------
{
  const g = fresh(13, 3e6); const b = bots.startBiz(g, 'gym'); const sw = [];
  for (let i = 0; i < 24; i++) { bots.careful(g, b); TG.Game.nextMonth(g); sw.push((1 + (b.buzz || 0)) * (1 + (b.wob || 0))); }
  const sd = Math.sqrt(U.avg(sw, (x) => (x - U.avg(sw)) ** 2)); ok(sd > 0.02 && sd < 0.2, `sales swing month to month (sd ${sd.toFixed(3)})`);
}
console.log(`${pass}/${pass + fails.length} v10 checks passed`);
if (fails.length) { console.log('V10 TEST FAILED'); process.exit(1); } else console.log('ALL V10 CHECKS PASSED');
