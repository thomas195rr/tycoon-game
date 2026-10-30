// Crime-side bots used by tools/crime-balance.js and the exploit tests.
module.exports = (TG) => {
  const CR = TG.CR, U = TG.U; const K = () => TG.CONFIG.crime;
  const hireBest = (g, role, n) => { for (let i = 0; i < n; i++) { const k = CR.candidates(g).filter((x) => x.role === role).sort((a, b) => b.skill + b.loyalty - a.skill - a.loyalty)[0]; if (!k || !CR.hire(g, k.id).ok) break; } };
  const stockUp = (g, sups, cover) => {
    const c = g.crime; const need = {};
    for (const p in K().products) { if (!CR.unlocked(g, K().products[p].unlock)) continue; need[p] = c.clients * K().products[p].want * (0.5 + c.rep / 100) * Math.pow(1 / CR.ratio(g, p), K().elasticity) * cover - c.stock[p]; }
    const wages = U.sum(c.crew, (e) => e.wage); const budget = Math.max(0, c.dirty - wages * 1.2);
    const cost = {}; let tot = 0;
    for (const p in need) { if (need[p] < 5) continue; const s = sups.find((x) => K().suppliers[x].goods.includes(p) && CR.unlocked(g, K().suppliers[x].unlock) && (!K().suppliers[x].minOrder || CR.orderCost(g, x, p, need[p]) >= K().suppliers[x].minOrder)); if (!s) continue; cost[p] = [s, CR.orderCost(g, s, p, need[p])]; tot += cost[p][1]; }
    const f = tot > 0 ? Math.min(1, budget / tot) : 0;
    for (const p in cost) { const q = Math.floor(need[p] * f); if (q > 5) CR.buy(g, cost[p][0], p, q); }
  };
  const B = {};
  B.careful = (g, opt) => {
    opt = opt || {}; const c = CR.ensure(g); if (CR.jailed(g)) return;
    if (!c.started) { CR.withdraw(g, opt.seed || 40000); c.putIn = opt.seed || 40000; }
    { const want = U.sum(c.crew, (e) => e.wage) * 1.5 + c.clients * 250; const lim = (opt.maxIn || 120000) - (c.putIn || 0);
      if (c.dirty < want && lim > 0 && g.cash > 50000) { const x = Math.min(want - c.dirty, lim, g.cash - 40000); if (x > 1000) { CR.withdraw(g, x); c.putIn = (c.putIn || 0) + x; } } }
    for (const p in K().products) CR.setAsk(g, p, opt.ask ? CR.street(g, p) * opt.ask : null);
    const cap = CR.capacity(g); const need = (c.last.workNeed || c.clients * 6) * 1.1;
    if (cap.deal < need && c.dirty > 8000) hireBest(g, 'dealer', 1);
    if (cap.run < need && c.dirty > 8000) hireBest(g, 'runner', 1);
    if (c.heat > 15 && cap.watch < c.blocks * 1.5 && c.dirty > 5000) hireBest(g, 'lookout', 1);
    if (c.blocks > 1 && cap.guard < c.blocks && c.dirty > 10000) hireBest(g, 'enforcer', 1);
    if (CR.room(g) < (c.clients * 6) * 1.4 && c.dirty > 40000) CR.buyGear(g, 'stash');
    if (c.dirty > 30000 && !c.gear.some((x) => x.type === 'safe')) CR.buyGear(g, 'safe');
    if (c.dirty > 50000 && !c.gear.some((x) => x.type === 'cameras')) CR.buyGear(g, 'cameras');
    if (c.dirty > 40000 && !c.gear.some((x) => x.type === 'phones' && !x.broken)) CR.buyGear(g, 'phones');
    for (const it of c.gear.filter((x) => x.broken)) CR.sellGear(g, it.id);
    c.lawyer = c.dirty > 60000 || c.heat > 30 ? 'public' : 'none';
    c.bribe = c.heat > 45 && c.dirty > 60000 ? 'cop' : 'none';
    for (const e of c.crew) if (e.loyalty < 45) CR.bonus(g, e.id);
    if (c.heat < (opt.heatCap || 35) && c.clients > (60 + c.blocks * K().perBlock) * 0.8 && c.dirty > CR.turfCost(g) * 2.5) CR.expand(g);
    stockUp(g, ['plug', 'harbor', 'connect'], c.heat > 60 ? 0.8 : 1.2);
    const L = CR.launderCap(g); c.launder = Math.round(Math.max(0, Math.min(c.dirty - 30000, L.total * 0.5 + (L.total ? 0 : L.shady))));
  };
  B.reckless = (g) => {
    const c = CR.ensure(g); if (CR.jailed(g)) return;
    if (!c.started || (c.dirty < 5000 && g.cash > 20000)) CR.withdraw(g, Math.min(g.cash * 0.5, 100000));
    for (const p in K().products) CR.setAsk(g, p, CR.street(g, p) * 1.3);
    hireBest(g, 'dealer', 2); hireBest(g, 'runner', 1); if (c.blocks > 2) hireBest(g, 'enforcer', 1);
    if (c.dirty > 60000 && CR.count(g, 'cook') < 2) { if (!c.gear.some((x) => x.type === 'workshop')) CR.buyGear(g, 'workshop'); hireBest(g, 'cook', 1); }
    CR.buyGear(g, 'stash'); CR.expand(g); c.racket = true;
    stockUp(g, ['newguy', 'connect', 'harbor', 'plug'], 2);
    if (!c.plan) { const t = c.crew.length >= 7 ? 'vault' : c.crew.length >= 4 ? 'city' : 'branch'; CR.heist(g, t, 0, 1, 0); }
    CR.theft(g); c.launder = c.dirty;
    for (const b of g.businesses) CR.sabotage(g, b.id, 'wreck');
  };
  B.heister = (g) => { // pulls the best-planned bank jobs it can afford, nothing else
    const c = CR.ensure(g); if (CR.jailed(g) || c.plan) return;
    if (!c.started) CR.withdraw(g, 60000);
    if (c.crew.length < 4 && c.dirty > 10000) hireBest(g, 'enforcer', 1);
    for (const t of ['vault', 'city', 'branch']) { for (const [gear, pros] of [[3, 2], [2, 1], [1, 0]]) { if (c.dirty >= CR.heistCost(g, t, gear, pros) * 1.2 && c.crew.length + 1 >= K().heists[t].crew * 0.8) { CR.heist(g, t, 2, gear, pros); return; } } }
    const L = CR.launderCap(g); c.launder = Math.round(Math.max(0, Math.min(c.dirty - 50000, L.total * 0.5 + (L.total ? 0 : L.shady))));
  };
  return B;
};
