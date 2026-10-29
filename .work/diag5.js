const TG = require('../test/load')(); const bots = require('../test/bots')(TG);
const s = Number(process.argv[2] || 2);
const g = TG.Game.newGame({ seed: s * 104729 + 4 * 7 }); g.cash = 600000;
const b = bots.startBiz(g, 'farm');
for (let i = 0; i < 120; i++) { if (!g.businesses.includes(b)) { console.log('gone at', g.month, 'cash', Math.round(g.cash), 'bk', g.player.bankruptcies); break; } bots.careful(g, b); TG.Game.nextMonth(g); if (i % 6 === 0) console.log(g.month, 'cash', Math.round(g.cash), 'nw', Math.round(g.lastNW), 'loans', Math.round(TG.U.sum(g.loans, (l) => l.balance)), 'acres', b.farm.acres, 'equip', b.equip.length, 'staff', b.staff.length); }
const r = (g.reports || []).slice(-3); console.log(JSON.stringify(r).slice(0, 1500));
