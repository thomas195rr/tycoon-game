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
  if (k0 === 'cows') { ok(f.areas.cows.herd === 120 && f.areas.cows.kind === (ent === 'dairy' ? 'dairy' : 'beef'), `${ent}: herd kept`); }
  if (ent === 'crops') { ok(f.stored.grain === 75 && f.seeds === 300 && f.futures.length === 1 && f.futures[0].mk === 'grain', 'crops: stock, seed and price locks kept'); ok(f.orders.seed === false, 'crops: auto-seed off kept'); }
  if (ent === 'orchard') { ok(f.stored.fruit === 75 && f.areas.orchard.age >= TG.CONFIG.businesses.farm.farm.enterprises.orchard.rampMonths, 'orchard: fruit and grown trees kept'); }
  const spr = b2.equip.filter((x) => /^spr/.test(x.type)).length; ok(ent === 'cattle' ? spr === 0 : spr >= 1, `${ent}: old irrigation became ${spr} sprinklers`);
  ok(b2.ask == null && f.sellPolicy === 'store', `${ent}: price reset to market per area, harvest policy kept`);
  ok(TG.Game.serialize(TG.Game.deserialize(TG.Game.serialize(g2))) === TG.Game.serialize(g2), `${ent}: migrated save round-trips`);
  try { for (let i = 0; i < 36; i++) { bots.careful(g2, b2); TG.Game.nextMonth(g2); } } catch (e) { ok(false, `${ent}: crash after migration ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  ok(Number.isFinite(g2.cash), `${ent}: cash finite`);
}
console.log(fails ? `${fails} MIGRATION CHECK(S) FAILED` : 'ALL MIGRATION CHECKS PASSED'); process.exit(fails ? 1 : 0);
