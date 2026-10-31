// Rental yields: buy each building kind with a 30-year mortgage (20-25% down), fill units yourself, fix repairs and answer
// cards like a sensible player, hold 5 years while the world runs. Per month: rent, running costs (tax, upkeep, insurance,
// repairs, searches, turnover, evictions, legal), NOI = rent - running costs, the loan payment and its rate, and the cap rate
// (NOI x 12 / price). "Covers" = NOI pays the mortgage.  node tools/re-yield.js [seeds=24]
const TG = require('../test/load')(); const U = TG.U; const bots = require('../test/bots')(TG);
const SEEDS = Number(process.argv[2] || 24);
const LOAN = /^Loan /, BUY = /purchases$/;
for (const kind of ['duplex', 'smallapt', 'apartment']) {
  let rent = 0, run = 0, pay = 0, rate = 0, cap = 0, covers = 0, n = 0, months = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: 2600 + s * 31 }); TG.G = g; g.cash = 4e7;
    for (let i = 0; i < 3; i++) TG.Game.nextMonth(g); g.loans = [];
    const L = TG.RE.gen(g, kind, { distressed: false }); g.re.listings = [L];
    const r = TG.RE.buy(g, L.id, true, 360); if (!r || r.ok === false) continue;
    const h = r.h; const loan = g.loans.find((l) => l.id === h.mortgageId); let R = 0, X = 0;
    for (let m = 0; m < 60; m++) {
      for (let u = 0; u < h.tenants.length; u++) if (!h.tenants[u]) { if (!TG.RE.current(g, h, u)) TG.RE.search(g, h.id, null, u); let x; while ((x = TG.RE.current(g, h, u)) && !h.tenants[u]) TG.RE.decide(g, h.id, true, u); }
      for (const it of h.issues.slice()) TG.RE.fixIssue(g, h.id, it.id);
      const rep = TG.Game.nextMonth(g); g.cash = Math.max(g.cash, 1e6); bots.resolveSmart(g);
      const o = rep.led['r:' + h.id]; if (!o) continue;
      for (const k in o.i) R += o.i[k]; for (const k in o.o) if (!LOAN.test(k) && !BUY.test(k)) X += o.o[k];
    }
    n++; rent += R / 60; run += X / 60; pay += loan.payment; rate += loan.rate; cap += (R - X) / 5 / L.price; if ((R - X) / 60 >= loan.payment) covers++;
  }
  console.log(`${kind.padEnd(10)} ${n} buys/mo: rent ${U.money(rent / n)}, running costs ${U.money(run / n)}, NOI ${U.money((rent - run) / n)}, loan ${U.money(pay / n)} at ${U.pct(rate / n, 1)} · cap rate ${U.pct(cap / n, 1)} · NOI covers the loan ${covers}/${n}`);
}
