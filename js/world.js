/* world.js - economy cycles, interest rates, inflation, weather, world events, supply & demand markets, news. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const W = {};

  W.init = (g) => {
    const C = TG.CONFIG;
    const phase = R.pick(['boom', 'slowdown', 'recovery', 'recovery']);
    const ph = C.economy.phases[phase];
    g.world = {
      phase, phaseLeft: R.int(ph.dur[0], ph.dur[1]), econ: ph.econ, baseRate: ph.rate + R.range(-0.005, 0.005),
      priceIdx: 1, wageIdx: 1, fuel: 1, housing: 1, trends: {}, weather: {}, rentCap: 0, emissions: 0,
      crime: 0, shortage: {}, driverShortage: 0, hoursReg: 0, licenseFees: {}, recessionMonths: 0,
    };
    for (const cat of C.trendCats) g.world.trends[cat] = 1;
    for (const r in C.regions) g.world.weather[r] = { kind: 'mild', sev: 0 };
    g.markets = {};
    for (const id in C.markets) {
      const m = C.markets[id];
      g.markets[id] = { demand12: m.demand12, comp: R.range(0.9, 1.1), player12: 0, sales: [], price: m.base, hist: [] };
      g.markets[id].price = W.price(g, id, 0);
    }
  };

  // market price given an extra amount of player supply this year
  W.price = (g, id, extra) => {
    const C = TG.CONFIG, m = C.markets[id], st = g.markets[id];
    const share = U.clamp((st.player12 + (extra || 0)) / st.demand12, 0, 1.5);
    const curve = Math.max(0.12, 1 - m.drop * Math.pow(share, m.shape));
    const trend = g.world.trends[m.trendCat] || 1;
    const p = m.base * Math.pow(g.world.econ, m.sens) * trend * Math.pow(st.comp, -m.compElast) * curve * g.world.priceIdx;
    return Math.max(0.01, p);
  };
  W.share = (g, id) => U.clamp(g.markets[id].player12 / g.markets[id].demand12, 0, 2);
  // record player sales into a market (rolling 12 months)
  W.sell = (g, id, qty) => {
    const st = g.markets[id];
    st.cur = (st.cur || 0) + qty;
  };

  W.month = (g) => {
    const C = TG.CONFIG, w = g.world, ec = C.economy;
    // economy phase
    w.phaseLeft--;
    if (w.phaseLeft <= 0) {
      const next = R.weighted(ec.phases[w.phase].next);
      w.phase = next; const ph = ec.phases[next];
      w.phaseLeft = R.int(ph.dur[0], ph.dur[1]);
      TG.rep.news(g, `Economy enters a ${ph.label.toLowerCase()}`, next === 'recession' ? 'bad' : next === 'boom' ? 'good' : 'info');
    }
    const ph = ec.phases[w.phase];
    w.econ += (ph.econ - w.econ) * 0.15 + R.normal(0, 0.006);
    w.econ = U.clamp(w.econ, 0.7, 1.25);
    if (w.phase === 'recession') w.recessionMonths++;
    w.baseRate += (ph.rate - w.baseRate) * ec.rateDrift + R.normal(0, ec.rateNoise);
    w.baseRate = U.clamp(w.baseRate, ec.rateMin, ec.rateMax);
    w.priceIdx *= 1 + ec.inflationPerMonth * (w.phase === 'boom' ? 1.4 : w.phase === 'recession' ? 0.4 : 1);
    w.wageIdx *= 1 + ec.inflationPerMonth * (w.phase === 'boom' ? 1.3 : 0.8);
    w.fuel = U.clamp(w.fuel + (1 - w.fuel) * 0.06 + R.normal(0, ec.fuelNoise), 0.6, 2.2);
    w.housing *= 1 + ph.housing + R.normal(0, ec.housingNoise) - (w.baseRate - 0.04) * 0.05;
    if (R.chance(ec.crashChance * (w.phase === 'slowdown' || w.phase === 'recession' ? 3 : 0.5))) {
      const d = R.range(ec.crashDrop[0], ec.crashDrop[1]); w.housing *= 1 - d;
      TG.rep.news(g, `Housing market crash: property values fall ${U.pct(d)}`, 'bad', true);
    }
    w.housing = U.clamp(w.housing, 0.3, 6);
    // timers
    ['rentCap', 'emissions', 'crime', 'driverShortage', 'hoursReg'].forEach((k) => { if (w[k] > 0) w[k]--; });
    for (const k in w.shortage) { w.shortage[k]--; if (w.shortage[k] <= 0) delete w.shortage[k]; }
    for (const k in w.trends) w.trends[k] += (1 - w.trends[k]) * 0.04;
    // weather per region
    const moy = U.moy(g.month);
    for (const r in C.regions) {
      const cl = C.regions[r].climate; let kind = 'mild', sev = 0;
      for (const k in C.weather.kinds) {
        const wk = C.weather.kinds[k];
        if (wk.months && wk.months.indexOf(moy) < 0) continue;
        if (R.chance(wk.base * (cl[k] || 1))) { if (wk.sev > sev) { kind = k; sev = wk.sev; } }
      }
      w.weather[r] = { kind, sev };
      if (sev >= 0.6) TG.rep.news(g, `${C.weather.kinds[kind].label} in ${C.regions[r].label}`, 'warn');
    }
    // world events
    const freq = C.difficulty.eventFreq[g.settings.eventFreq] || 1;
    for (const ev of C.worldEvents) {
      if (!R.chance(ev.p * freq)) continue;
      const e = ev.effect; let txt = ev.label;
      if (e.wageIdx) { const d = R.range(e.wageIdx[0], e.wageIdx[1]); w.wageIdx *= 1 + d; W.minWage(g, d); txt += `: wages up ${U.pct(d)}`; }
      if (e.licenseFee) { const ids = Object.keys(C.businesses); const t = R.pick(ids); const fee = Math.round(R.range(e.licenseFee[0], e.licenseFee[1])); w.licenseFees[t] = fee; txt += ` for ${C.businesses[t].name} (${U.money(fee)} fee per business)`; W.chargeLicense(g, t, fee); }
      if (e.rentCap) { w.rentCap = R.int(e.rentCap[0], e.rentCap[1]); txt += ` (${U.yrsMo(w.rentCap)})`; }
      if (e.emissions) { w.emissions = R.int(e.emissions[0], e.emissions[1]); txt += ' hits factories and fleets'; }
      if (e.rate) { const d = R.range(e.rate[0], e.rate[1]); w.baseRate = U.clamp(w.baseRate + d, ec.rateMin, ec.rateMax); txt += ` (base rate now ${U.pct(w.baseRate, 1)})`; W.repriceVariable(g); }
      if (e.trend) { const cat = R.pick(C.trendCats); const d = R.range(e.trend[0], e.trend[1]); w.trends[cat] = U.clamp(w.trends[cat] + d, 0.5, 1.8); txt += `: ${cat} demand ${d > 0 ? 'up' : 'down'} ${U.pct(Math.abs(d))}`; }
      if (e.crime) w.crime = R.int(e.crime[0], e.crime[1]);
      if (e.shortage) { const cat = R.pick(['food', 'auto', 'home', 'health', 'fashion']); w.shortage[cat] = R.int(e.shortage[0], e.shortage[1]); txt += ` in ${cat} supplies`; }
      if (e.fuel) { const d = R.range(e.fuel[0], e.fuel[1]); w.fuel = U.clamp(w.fuel * (1 + d), 0.6, 2.5); txt += ` (+${U.pct(d)})`; }
      if (e.driverShortage) w.driverShortage = R.int(e.driverShortage[0], e.driverShortage[1]);
      if (e.hoursReg) w.hoursReg = R.int(e.hoursReg[0], e.hoursReg[1]);
      TG.rep.news(g, txt, e.trend && e.trend[0] > 0 ? 'good' : 'warn');
    }
    // markets
    const mr = C.marketRules;
    for (const id in g.markets) {
      const st = g.markets[id], m = C.markets[id];
      st.sales.push(st.cur || 0); st.cur = 0; if (st.sales.length > 12) st.sales.shift();
      st.player12 = U.sum(st.sales);
      st.demand12 *= 1 + mr.demandGrowth + (w.econ - 1) * 0.004;
      const p = W.price(g, id, 0);
      const rel = p / (m.base * g.world.priceIdx);
      if (rel > 1.05) st.comp = Math.min(mr.compMax, st.comp * (1 + mr.compReactUp * (rel - 1) * 4));
      else if (rel < 0.85) {
        st.comp = Math.max(mr.compMin, st.comp * (1 - mr.compReactDown * (1 - rel) * 4));
        if (R.chance(0.05)) TG.rep.news(g, `Low ${m.label.toLowerCase()} prices push a competitor into bankruptcy`, 'info');
      }
      st.comp = U.clamp(st.comp + R.normal(0, 0.004), mr.compMin, mr.compMax);
      st.price = W.price(g, id, 0);
      st.hist.push(Math.round(st.price * 100) / 100); if (st.hist.length > 120) st.hist.shift();
    }
  };

  W.minWage = (g, d) => {
    for (const b of g.businesses) for (const e of TG.S.allStaff(b)) {
      const rd = TG.S.roleDef(b, e.role); if (!rd) continue;
      const floor = rd.wage[0] * g.world.wageIdx;
      if (e.wage < floor) e.wage = Math.round(floor);
    }
  };
  W.chargeLicense = (g, type, fee) => {
    for (const b of g.businesses) if (b.type === type) { TG.F.spend(g, fee, 'Licenses & permits', b.id); TG.rep.event(g, b, 'bad', `New license rules cost ${U.money(fee)}`, 'Regulation change (world event)'); }
  };
  W.repriceVariable = (g) => { if (g.loc) g.loc.rate = TG.F.rateFor(g, 'loc'); };

  W.phaseLabel = (g) => TG.CONFIG.economy.phases[g.world.phase].label;
  W.econMult = (g, sens) => Math.pow(g.world.econ, sens == null ? 1 : sens);
  W.weatherOf = (g, region) => g.world.weather[region] || { kind: 'mild', sev: 0 };
  TG.W = W;
})();
