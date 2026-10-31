// v5 save migration: old single-enterprise farms (v4) load into the new area layout and keep running.
const load = require('./load.js'); let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL: ' + msg); } };
for (const ent of ['crops', 'cattle', 'dairy', 'orchard']) {
  const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: 42 + ent.length }); g.cash = 3e6; TG.G = g;
  const b = bots.startBiz(g, 'farm'); for (let i = 0; i < 2; i++) TG.Game.nextMonth(g);
  // replace with a v4-style farm object
  b.farm = { ent, acres: 400, irrigated: ent === 'cattle' ? 0 : 130, storageCap: 200, stored: ent === 'cattle' || ent === 'dairy' ? 0 : 75, seeds: ent === 'crops' ? 300 : 0, autoSeeds: false, seasonYield: 1, planted: 0, toHarvest: 0,
    futures: ent === 'crops' ? [{ qty: 50, price: 400, done: 0, month: 1 }] : [], herd: ent === 'cattle' || ent === 'dairy' ? 120 : 0, cows: ent === 'cattle' || ent === 'dairy' ? 60 : 0, young: [], ready: 4, orchardAge: ent === 'orchard' ? 999 : 0,
    sellPolicy: 'store', landType: 'flat', soil: 0.66, water: 0.5, yearTons: 0, lastHarvest: null, plantBroken: false, m: {} };
  b.equip = b.equip.filter((x) => !/^spr/.test(x.type)); b.ask = 123;
  const g2 = TG.Game.deserialize(TG.Game.serialize(g)); TG.G = g2; const b2 = g2.businesses.find((x) => x.id === b.id); const f = b2.farm;
  const k0 = ent === 'cattle' || ent === 'dairy' ? 'cows' : ent;
  ok(f.areas && f.areas[k0].acres === 400, `${ent}: acres went to the ${k0} area`);
  ok(TG.M.farmFree(f) === 0, `${ent}: no stray free acres`);
  ok(Math.abs(f.areas[k0].soil - 0.66) < 1e-9, `${ent}: soil kept`);
  if (k0 === 'cows') { const a = f.areas.cows; ok(Math.abs(a.herd - 120) <= 1 && a.kind == null && a.st, `${ent}: herd kept as one mixed herd (${a.herd})`);
    ok(ent === 'dairy' ? a.st.milker > a.st.steer : a.st.ready + a.st.steer > 0, `${ent}: stages fit the old herd type`); ok(a.st.bull >= 1, `${ent}: has a bull`); ok(f.feed > 0, `${ent}: got a month of feed`); ok(f.orders.cows, `${ent}: cow orders`); }
  if (ent === 'crops') { ok(f.stored.grain === 75 && f.seeds === 300 && f.futures.length === 1 && f.futures[0].mk === 'grain', 'crops: stock, seed and price locks kept'); ok(f.orders.seed === false, 'crops: auto-seed off kept'); }
  if (ent === 'orchard') { ok(f.stored.fruit === 75 && f.areas.orchard.age >= TG.CONFIG.businesses.farm.farm.enterprises.orchard.rampMonths, 'orchard: fruit and grown trees kept'); }
  const spr = b2.equip.filter((x) => /^spr/.test(x.type)).length; ok(k0 === 'cows' ? spr === 0 : spr >= 1, `${ent}: old irrigation became ${spr} sprinklers`);
  ok(b2.ask == null && f.sellPolicy === 'store', `${ent}: price reset to market per area, harvest policy kept`);
  ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), `${ent}: migrated save round-trips`);
  try { for (let i = 0; i < 36; i++) { bots.careful(g2, b2); TG.Game.nextMonth(g2); } } catch (e) { ok(false, `${ent}: crash after migration ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  ok(Number.isFinite(g2.cash), `${ent}: cash finite`);
}
// ---- v6: v5 saves -> mechanics, credit, tenants, industries, no auto-fix/auto-service ----
{ const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: 77 }); g.cash = 3e6; TG.G = g;
  const b = bots.startBiz(g, 'carwash'); for (let i = 0; i < 2; i++) TG.Game.nextMonth(g);
  const fb = bots.startBiz(g, 'farm', { ent: 'cows' });
  const s = JSON.parse(TG.Game.serialize(g)); s.v = 5;
  // make it look like a v5 save
  delete s.player.cr; delete s.world.ind; s.loc = { balance: 0, rate: 0.1 }; s.settings = Object.assign({}, s.settings, { autoCredit: true, autoFix: true, serviceAt: 60 });
  const sb = s.businesses.find((x) => x.id === b.id); sb.spec = Object.assign({}, sb.spec, { mechanic: { id: 'm1', name: 'Old Mech', role: 'mechanic', wage: 4000, skill: 60, quals: 50, morale: 60, loyalty: 60 } }); sb.orders = Object.assign({}, sb.orders, { maint: true, fixNow: true, svcAt: 70 });
  const sf = s.businesses.find((x) => x.id === fb.id); const a = sf.farm.areas.cows; const tot = a.herd || 100; delete a.st; a.herd = tot; a.kind = 'dairy'; a.cows = Math.round(tot * 0.7); a.young = [{ n: 10, age: 3 }]; sf.farm.feed = undefined; delete sf.farm.orders.cows;
  sf.equip.push({ id: 'oldspr', type: 'sprCow', tier: 'standard', wear: 10, age: 5, broken: null });
  s.re.holdings = s.re.holdings || []; if (!s.re.holdings.length) { const l = TG.RE.gen(g, 'house', { distressed: false }); s.re.holdings.push(Object.assign({}, l, { id: 'reX', mode: 'rent', tenants: [{ name: 'T', bad: true, rent: 1200, late: 0 }, null] })); }
  let g2; try { g2 = TG.Game.deserialize(JSON.stringify(s)); } catch (e) { ok(false, 'v5 save failed to load: ' + e.message); }
  if (g2) { TG.G = g2;
    ok(g2.v >= 6, 'version bumped'); ok(g2.player.cr && TG.CREDIT.score(g2).score >= 300 && TG.CREDIT.score(g2).score <= 850, 'credit record built'); ok(g2.loc.limit >= 0 && !('autoCredit' in g2.settings), 'credit line limit set, auto-credit gone');
    ok(g2.world.ind && Object.keys(g2.world.ind).length === Object.keys(TG.CONFIG.industries).length, 'industries added');
    const b2 = g2.businesses.find((x) => x.id === b.id); ok(!b2.spec.mechanic && b2.staff.some((e) => e.role === 'mech'), 'old mechanic specialist became a staff mechanic');
    ok(!('maint' in (b2.orders || {})) && !('fixNow' in (b2.orders || {})) && !('svcAt' in (b2.orders || {})) && !('autoFix' in g2.settings), 'auto-fix and auto-service orders removed: ' + JSON.stringify(b2.orders) + JSON.stringify(g2.settings));
    const f2 = g2.businesses.find((x) => x.id === fb.id).farm; const a2 = f2.areas.cows; ok(a2.st && !a2.kind && Math.abs(a2.herd - tot) <= 2, `old dairy herd split into stages (${a2.herd} of ${tot})`); ok(f2.feed > 0 && f2.orders.cows, 'feed + cow orders added');
    ok(!g2.businesses.find((x) => x.id === fb.id).equip.some((x) => x.type === 'sprCow'), 'cow sprinklers removed (sold)');
    const h = g2.re.holdings.find((x) => (x.tenants || []).some((t) => t)); if (h) ok(h.tenants.filter((t) => t).every((t) => typeof t.rel === 'number'), 'tenants got a reliability');
    ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), 'v5->v6 save round-trips');
    try { for (let i = 0; i < 24; i++) { bots.careful(g2, b2); TG.Game.nextMonth(g2); } } catch (e) { ok(false, 'crash after v6 migration ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  } }
// ---- v7: v6 saves -> per-unit searches, ledger, amortizing loan fields, closed-shop counter ----
{ const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: 88 }); g.cash = 3e6; TG.G = g;
  const b = bots.startBiz(g, 'cafe'); for (let i = 0; i < 2; i++) TG.Game.nextMonth(g);
  const l = TG.RE.gen(g, 'smallapt', { distressed: false }); g.re.listings = [l]; TG.RE.buy(g, l.id, true); TG.F.takeLoan(g, 'business', 30000);
  const s = JSON.parse(TG.Game.serialize(g)); s.v = 6; delete s.cashMark; delete s.acc.led; delete s.acc.names;
  const sh = s.re.holdings[0]; sh.tenants = sh.tenants.map((t, i) => (i === 0 ? t : null)); delete sh.searches; delete sh.issues; sh.search = { m: s.month, rent: 1500, list: [{ name: 'A', income: 3, credit: 700, evictions: 0, rel: 0.9 }], i: 0 };
  for (const x of s.loans) { delete x.intPaid; delete x.prinPaid; } for (const x of s.businesses) delete x.shut;
  let g2; try { g2 = TG.Game.deserialize(JSON.stringify(s)); } catch (e) { ok(false, 'v6 save failed to load: ' + e.message); }
  if (g2) { TG.G = g2; ok(g2.v === TG.VERSION && g2.v >= 7, 'version bumped to current');
    const h = g2.re.holdings[0]; ok(!h.search && h.searches && Object.keys(h.searches).length === 1 && Array.isArray(h.issues), 'old building-wide search moved to one empty unit');
    const u = Number(Object.keys(h.searches)[0]); ok(!h.tenants[u], 'search sits on a vacant unit');
    ok(typeof g2.cashMark === 'number' && g2.acc.led, 'ledger + cash mark added'); ok(g2.loans.every((x) => typeof x.intPaid === 'number' && typeof x.prinPaid === 'number'), 'loan interest/principal counters added');
    ok(g2.businesses.every((x) => typeof x.shut === 'number'), 'closed counter added');
    ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), 'v6->v7 save round-trips');
    try { for (let i = 0; i < 12; i++) { bots.careful(g2, g2.businesses[0]); const r = TG.Game.nextMonth(g2); ok(Math.abs(r.money.diff) < 1, `month ${i} after migration does not reconcile (${r.money.diff})`); } } catch (e) { ok(false, 'crash after v7 migration ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  } }
// ---- v8: v7 saves -> whole cattle, stop-on-trouble on, supplies warning on ----
{ const TG = load(); const bots = require('./bots')(TG); const g = TG.Game.newGame({ seed: 91 }); g.cash = 3e6; TG.G = g;
  const b = bots.startBiz(g, 'farm', { ent: 'cows' }); for (let i = 0; i < 3; i++) TG.Game.nextMonth(g);
  const s = JSON.parse(TG.Game.serialize(g)); s.v = 7; s.settings.stopOnMajor = false; delete s.settings.warnSupplies; s.settings.majorTypes = { breakdown: true };
  const a0 = s.businesses[0].farm.areas.cows; a0.st.calf += 0.37; a0.st.milker += 0.61; delete a0.rem;
  let g2; try { g2 = TG.Game.deserialize(JSON.stringify(s)); } catch (e) { ok(false, 'v7 save failed to load: ' + e.message); }
  if (g2) { TG.G = g2; ok(g2.v >= 9, 'version bumped to current (v9+)'); const a = g2.businesses[0].farm.areas.cows;
    ok(Object.values(a.st).every((x) => Number.isInteger(x)), 'cattle are whole numbers after migration: ' + JSON.stringify(a.st));
    ok(g2.settings.stopOnMajor === true && g2.settings.majorTypes.closed && g2.settings.majorTypes.cash && g2.settings.majorTypes.crime && g2.settings.majorTypes.breakdown, 'skip stops on trouble by default, old choices kept');
    ok(g2.settings.warnSupplies === true, 'supplies warning on');
    try { for (let i = 0; i < 12; i++) { bots.careful(g2, g2.businesses[0]); const r = TG.Game.nextMonth(g2); ok(Math.abs(r.money.diff) < 1, `v8 month ${i} does not reconcile`); ok(Object.values(a.st).every((x) => Number.isInteger(x)), 'cattle stay whole'); } } catch (e) { ok(false, 'crash after v8 migration ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
    ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), 'v7->v8 save round-trips');
  } }
console.log(fails ? `${fails} MIGRATION CHECK(S) FAILED` : 'ALL MIGRATION CHECKS PASSED'); process.exit(fails ? 1 : 0);
