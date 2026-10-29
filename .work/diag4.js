const TG = require('../test/load')(); const bots = require('../test/bots')(TG); const U = TG.U;
const g = TG.Game.newGame({ seed: 7 * 104729 + 4 * 7 }); g.cash = 600000;
const b = bots.startBiz(g, 'farm');
for (let i = 0; i < 30; i++) { bots.careful(g, b); TG.Game.nextMonth(g); const f = b.farm; const h = b.hist[b.hist.length - 1];
  console.log(g.month, 'moy', TG.U.moy(g.month - 1), 'planted', Math.round(f.planted), 'toH', Math.round(f.toHarvest), 'seeds', Math.round(f.seeds), 'stored', Math.round(f.stored), 'cap', TG.M.farmStoreCap(b), 'profit', h.profit, JSON.stringify(f.m, (k, v) => typeof v === 'number' ? Math.round(v) : v), f.sellPolicy, 'tractors', b.equip.filter((x) => x.type === 'tractor').length, 'staff', b.staff.length, 'yield', f.seasonYield.toFixed(2)); }
