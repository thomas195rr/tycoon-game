// Diagnostic: node tools/diag.js <type> <seed> <careful|reckless> [months]
const TG = require("../test/load")(); const bots = require('../test/bots')(TG); const U = TG.U;
const [type = 'cafe', seed = '1', style = 'careful', months = '240'] = process.argv.slice(2);
const g = TG.Game.newGame({ seed: process.env.BSEED ? Number(seed) * 104729 + type.length * 7 : Number(seed) });
const tier = TG.CONFIG.businesses[type].tier; g.cash = tier === 'small' ? 250000 : tier === 'between' ? 600000 : 5000000;
const biz = bots.startBiz(g, type);
const p = g.properties[0];
console.log('start', type, 'prop', p.kind, p.loc, 'suit', TG.P.suit(p, type).toFixed(2), 'price', p.price, p.owned ? 'owned' : 'leased', 'cash after setup', Math.round(g.cash), 'equip', biz.equip.length, 'staff', biz.staff.length);
let yr = { lines: {}, rev: 0, cost: 0, majors: [] };
for (let i = 0; i < Number(months); i++) {
  if (biz && g.businesses.includes(biz)) bots[style](g, biz);
  const r = TG.Game.nextMonth(g);
  for (const b of r.biz) if (b.id === biz.id) { yr.rev += b.rev; yr.cost += b.cost; }
  if (biz.hist.length) { const h = biz.hist[biz.hist.length - 1]; for (const k in h.lines) yr.lines[k] = (yr.lines[k] || 0) + h.lines[k]; }
  for (const e of r.events) if (e.type === 'major') yr.majors.push(e.text.slice(0, 70));
  if ((i + 1) % 12 === 0 || !g.businesses.includes(biz)) {
    const top = Object.entries(yr.lines).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 9).map(([k, v]) => k + ' ' + Math.round(v / 1000) + 'k').join(', ');
    console.log(`Y${(i + 1) / 12 | 0} cash ${Math.round(g.cash / 1000)}k nw ${Math.round(g.lastNW / 1000)}k rev ${Math.round(yr.rev / 1000)}k profit ${Math.round((yr.rev - yr.cost) / 1000)}k rep ${Math.round(biz.rep)} staff ${biz.staff.length}+${Object.values(biz.spec).filter(Boolean).length} equip ${biz.equip.length} debt ${Math.round(TG.F.debt(g) / 1000)}k | ${top}`);
    console.log('   ctx', JSON.stringify(biz.lastCtx), 'majors:', yr.majors.slice(0, 6).join(' / '));
    yr = { lines: {}, rev: 0, cost: 0, majors: [] };
    if (!g.businesses.includes(biz)) { console.log('BUSINESS GONE', g.log.slice(-8).map((e) => e.text).join(' / ')); break; }
  }
}
