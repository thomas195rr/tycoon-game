/* industry.js - v6: every industry goes through its own booms and slumps (mean-reverting, partly tied to the economy).
   x = how good things are (0 = normal), v = which way it is heading. Visible on the Industry Outlook screen with reasons. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const IN = {};
  const CF = () => TG.CONFIG.industryCycle;
  // a random spot on the cycle (so a new game, or a new start year, can begin anywhere)
  IN.randomState = () => { const a = R.range(0, Math.PI * 2), amp = R.range(0.03, 0.2); return { x: amp * Math.cos(a), v: -amp * Math.sin(a) * Math.sqrt(CF().pull), news: [], hist: [], state: null, lastNews: -99 }; };
  IN.init = (g) => {
    g.world.ind = {};
    for (const k in TG.CONFIG.industries) { g.world.ind[k] = IN.randomState(); g.world.ind[k].state = IN.state(g.world.ind[k]).label; }
    g.world.econPrev = g.world.econ;
  };
  IN.ensure = (g) => { if (!g.world.ind) IN.init(g); for (const k in TG.CONFIG.industries) if (!g.world.ind[k]) g.world.ind[k] = IN.randomState(); return g.world.ind; };
  IN.state = (s) => { for (const [lo, label, tone] of TG.CONFIG.indStates) if (s.x >= lo) return { label, tone }; return { label: 'Slump', tone: 'bad' }; };
  IN.arrow = (s) => (s.v > 0.004 ? '⬆️' : s.v < -0.004 ? '⬇️' : '➡️');
  IN.dir = (s) => (s.v > 0.004 ? 'getting better' : s.v < -0.004 ? 'getting worse' : 'holding steady');
  const X = (g, k) => { if (!k || !g.world) return 0; const ind = g.world.ind || IN.ensure(g); return ind[k] ? ind[k].x : 0; };
  // multipliers used by the game
  IN.demand = (g, k) => (k ? Math.exp(X(g, k) * TG.CONFIG.industries[k].demandK) : 1);
  IN.price = (g, k) => (k ? Math.exp(X(g, k) * TG.CONFIG.industries[k].priceK) : 1);
  IN.cost = (g, k) => (k ? Math.exp(X(g, k) * TG.CONFIG.industries[k].costK) : 1);
  IN.ofBiz = (b) => (b ? TG.CONFIG.indOf[b.type] : null);
  IN.ofMarket = (id) => TG.CONFIG.marketInd[id] || null;
  IN.score = (g, k) => X(g, k); // for loans: lenders like industries that are doing well
  IN.month = (g) => {
    const cf = CF(), w = g.world, ind = IN.ensure(g);
    const shared = R.normal(0, 1); const de = (w.econ - (w.econPrev == null ? w.econ : w.econPrev)); w.econPrev = w.econ;
    for (const k in TG.CONFIG.industries) {
      const s = ind[k], d = TG.CONFIG.industries[k];
      const e = cf.shared * shared + Math.sqrt(1 - cf.shared * cf.shared) * R.normal(0, 1);
      s.v = cf.keep * s.v - cf.pull * s.x + cf.noise * e + cf.econLink * de;
      s.x = U.clamp(s.x + s.v, -cf.max, cf.max);
      if (Math.abs(s.x) >= cf.max) s.v *= 0.5;
      s.hist.push(Math.round(s.x * 1000) / 1000); if (s.hist.length > 60) s.hist.shift();
      const st = IN.state(s);
      if (st.label !== s.state) {
        const better = TG.CONFIG.indStates.findIndex((x) => x[1] === st.label) < TG.CONFIG.indStates.findIndex((x) => x[1] === s.state);
        const why = R.pick(better ? d.up : d.down);
        s.news.unshift({ m: g.month, text: `${d.label}: ${st.label.toLowerCase()} (${why.toLowerCase()})`, why, tone: better ? 'good' : 'bad' }); if (s.news.length > 4) s.news.pop();
        if (st.label === 'Boom' || st.label === 'Slump' || g.month - s.lastNews > 6) { TG.rep.news(g, `${d.icon} ${d.label} ${better ? 'is picking up' : 'is cooling off'}: ${why}`, better ? 'good' : 'warn'); s.lastNews = g.month; }
        s.state = st.label;
      }
    }
  };
  // a world event shock to one industry (replaces the old 'trend' events)
  IN.shock = (g, k, d) => { const s = IN.ensure(g)[k]; if (!s) return; s.x = U.clamp(s.x + d * 0.25, -CF().max, CF().max); s.v += d * 0.008; };
  IN.list = (g) => { IN.ensure(g); return Object.keys(TG.CONFIG.industries).map((k) => { const s = g.world.ind[k], st = IN.state(s); return { k, d: TG.CONFIG.industries[k], s, st, demand: IN.demand(g, k), price: IN.price(g, k), cost: IN.cost(g, k) }; }); };
  TG.IN = IN;
})();
