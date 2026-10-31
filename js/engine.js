/* engine.js - game creation, the monthly turn, time skip, reports, achievements, leaderboard, save/load. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const VERSION = 10;
  TG.VERSION = VERSION;

  // ================= REPORT HELPERS =================
  const rep = {};
  rep.newBuf = (m) => ({ month: m, events: [], staff: [], decisions: [], news: [], warns: [] });
  const buf = (g) => (g.cur = g.cur || rep.newBuf(g.month));
  const logPush = (g, e) => { g.log.push(e); if (g.log.length > TG.CONFIG.maxLog) g.log.splice(0, g.log.length - TG.CONFIG.maxLog); };
  rep.event = (g, b, type, text, why, opts) => {
    const e = { m: g.month, type, text, why: why || '', biz: b ? b.name : null, bizId: b ? b.id : null, major: opts && opts.major ? opts.major : null };
    buf(g).events.push(e); logPush(g, e);
    if (b && (type === 'bad' || type === 'major')) { b.bad = (b.bad || []).filter((m) => g.month - m <= 6); b.bad.push(g.month); }
  };
  rep.staff = (g, b, text) => { const e = { m: g.month, type: 'staff', text, biz: b ? b.name : null }; buf(g).staff.push(e); logPush(g, e); };
  rep.decision = (g, b, by, text, outcome) => { const e = { m: g.month, type: 'decision', by: by || 'You', text, outcome: outcome || null, biz: b ? b.name : null }; buf(g).decisions.push(e); logPush(g, e); };
  rep.news = (g, text, tone, big) => { const e = { m: g.month, type: 'news', text, tone: tone || 'info', big: !!big }; buf(g).news.push(e); logPush(g, e); g.newsFeed = g.newsFeed || []; g.newsFeed.push(e); if (g.newsFeed.length > 200) g.newsFeed.shift(); };
  rep.warn = (g, b, text, why, p) => { buf(g).warns.push({ m: g.month, text, why, p, biz: b ? b.name : null }); };
  TG.rep = rep;

  // ================= NEW GAME =================
  const E = {};
  E.scenarios = {
    classic:  { label: 'Classic start', desc: 'Random savings and credit. Buy a property and start a business.' },
    farm:     { label: 'Inherit a failing farm', desc: 'A worn-out farm with old equipment, debt, and a bad reputation. Turn it around.' },
    recession:{ label: 'Start in a recession', desc: 'Normal savings, but the economy just turned down. Cheap assets, weak demand.' },
    rebuild:  { label: 'Rebuild after bankruptcy', desc: '$6,000, bad credit, no loans for 18 months. Lease a cheap lot and claw back.' },
    rich:     { label: 'Silver spoon', desc: '$2 million to start. Big moves are possible, and so are big mistakes.' },
  };
  E.newGame = (opts) => {
    opts = opts || {};
    const C = TG.CONFIG;
    const seed = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) >>> 0;
    const g = {
      v: VERSION, gameId: 'g' + seed.toString(36) + Date.now().toString(36).slice(-4), seed, rngState: seed || 1, month: 0, nextId: 1,
      cash: 0, player: { name: opts.name || 'You', credit: 700, bankruptcies: 0, noLoanUntil: 0, ownerBiz: null, exp: {} },
      properties: [], listings: [], businesses: [], loans: [], loc: { balance: 0, rate: 0 }, lawsuits: [], decisions: [], log: [], history: [],
      acc: TG.F.newAcc(), taxLoss: 0, taxPaid: [], negMonths: 0, ceo: null, scenario: opts.scenario || 'classic', reports: [], newsFeed: [],
      settings: Object.assign({ gambling: true, crime: true, habit: true, stopOnMajor: true, majorTypes: { closed: true, cash: true, crime: true, breakdown: true, keyQuit: true, lawsuit: true, strike: true, harvest: false, weather: false }, eventFreq: 'normal', ceoBigMoves: false, confirmPending: true, warnSupplies: true }, opts.settings || {}),
      achievements: {}, stats: { peakNW: 0, reached: {}, recessionProfitYears: 0 }, started: Date.now(),
    };
    TG.G = g;
    const mult = C.difficulty.startMoney[opts.money || 'random'] || 1;
    g.cash = Math.round(R.range(C.start.cash[0], C.start.cash[1]) * mult / 1000) * 1000;
    g.player.credit = R.int(C.start.credit[0], C.start.credit[1]);
    TG.W.init(g); TG.P.initListings(g); TG.RE.init(g); TG.I.init(g);
    rep.newBuf(0); g.cur = rep.newBuf(0);
    const sc = g.scenario;
    if (sc === 'recession') { const ph = C.economy.phases.recession; Object.assign(g.world, { phase: 'recession', phaseLeft: R.int(ph.dur[0], ph.dur[1]), econ: ph.econ, baseRate: ph.rate }); g.world.housing = 0.9; }
    if (sc === 'rebuild') { const B = C.finance.bankruptcy; g.cash = B.keepCash; g.player.credit = R.int(B.credit[0], B.credit[1]); g.player.bankruptcies = 1; g.player.noLoanUntil = B.noLoanMonths; }
    if (sc === 'rich') g.cash = 2000000;
    TG.CREDIT.ensure(g); TG.CREDIT.sync(g);
    if (sc === 'farm') {
      const p = TG.P.gen(g, TG.P.idealFor('farm')); if (p.acres > 320 || p.acres < 60) { const a2 = R.int(80, 300); p.price = Math.round(p.price * a2 / Math.max(1, p.acres)); p.acres = a2; } /* v8: a family farm, not a 3,000-acre ranch run by 2 farmhands */ p.owned = true; p.baseValue = p.price; p.housingAtBuy = 1; p.bought = 0; g.properties.push(p);
      g.cash = 1e9; const r = TG.B.start(g, 'farm', p.id, { name: 'Family Farm' }); if (!r.biz) throw new Error('farm start: ' + r.msg); const b = r.biz;
      TG.B.quickSetup(g, b, true, 'used');
      for (const it of b.equip) { it.wear = R.range(55, 80); it.age = R.int(100, 200); it.warranty = 0; }
      b.rep = 18; for (const e of b.staff) { e.morale = R.range(30, 45); }
      g.cash = 22000; g.acc = TG.F.newAcc();
      TG.F.newLoan(g, 'business', 140000, { label: 'Inherited farm debt', noCash: true, bizId: b.id });
      g.cur = rep.newBuf(0);
      rep.event(g, b, 'major', 'You inherited a struggling farm', 'Old, worn equipment, unhappy workers, a weak reputation and $140,000 of debt. Your call.');
    }
    g.stats.startCash = g.cash; g.lastNW = TG.F.netWorth(g); g.stats.peakNW = g.lastNW;
    g.acc = TG.F.newAcc(); g.cashMark = g.cash; // v7: the money report counts every dollar from here
    return g;
  };

  // ================= THE MONTH =================
  const sumObj = (o) => U.sum(Object.values(o || {}));
  E.nextMonth = (g) => {
    TG.G = g;
    const C = TG.CONFIG; const m = g.month;
    TG.D.autoResolve(g);
    const nwStart = g.lastNW != null ? g.lastNW : TG.F.netWorth(g);
    const pre = g.acc || TG.F.newAcc(); // money moved by the player's own actions between months
    // v7: the month starts where last month ended, so money you moved between months is in this report too
    const cashStart = g.cashMark != null ? g.cashMark : g.cash - TG.LG.net(pre.led);
    // v6: running costs you paid between months (supplies, feed, seed, repairs) belong to this month's profit and tax
    g.acc = TG.F.newAcc(); g.acc.inc = Object.assign({}, pre.inc); g.acc.exp = Object.assign({}, pre.exp);
    g.acc.led = JSON.parse(JSON.stringify(pre.led || {})); g.acc.names = Object.assign({}, pre.names || {});
    TG.W.month(g); TG.P.month(g);
    for (const p of g.properties) if (!p.bizId) TG.LG.within(g, 'p:' + p.id, () => { if (p.leased) TG.F.spend(g, p.rent, 'Rent (unused property)'); else TG.F.spend(g, TG.P.monthlyTax(g, p), 'Property tax (unused property)'); });
    TG.RE.month(g); TG.I.month(g);
    const bizRows = [];
    for (const b of g.businesses.slice()) {
      if (!g.businesses.includes(b)) continue;
      const before = b.rep;
      const ctx = TG.B.month(g, b);
      if (g.businesses.includes(b)) TG.D.manage(g, b);
      bizRows.push(E.bizWhy(g, b, ctx, before));
    }
    TG.CR.month(g);
    TG.B.monthSuits(g); TG.F.monthLoans(g);
    const opPre = sumObj(g.acc.inc) - sumObj(g.acc.exp);
    TG.D.ceoMonth(g, opPre);
    const opProfit = sumObj(g.acc.inc) - sumObj(g.acc.exp);
    const tax = TG.F.monthTax(g, opProfit);
    TG.F.monthEnd(g);
    const inc = Object.assign({}, g.acc.inc), exp = Object.assign({}, g.acc.exp);
    const profit = sumObj(inc) - sumObj(exp);
    // v7: who made or lost money, counting EVERYTHING (machines bought, loan payments, damage...); adds up to the cash change
    const led = g.acc.led || {}; const money = TG.LG.summary(g, led, g.acc.names, cashStart, g.cash); const nets = TG.LG.ownerNets(led);
    for (const b of g.businesses) { const h = b.hist[b.hist.length - 1]; if (h && h.m === m) h.cash = nets['b:' + b.id] || 0; }
    for (const h of g.re.holdings) { h.lastNet = nets['r:' + h.id] || 0; h.lastNetM = m; }
    for (const b of bizRows) b.cash = nets['b:' + b.id] || 0;
    const nw = TG.F.netWorth(g);
    g.history.push({ m, cash: Math.round(g.cash), nw: Math.round(nw), profit: Math.round(profit), inc: Math.round(sumObj(inc)), exp: Math.round(sumObj(exp)), phase: g.world.phase });
    if (g.history.length > C.maxHistory) g.history.shift();
    g.lastNW = nw; g.stats.peakNW = Math.max(g.stats.peakNW, nw);
    const ach = E.checkAchievements(g, profit);
    const b0 = g.cur || rep.newBuf(m);
    const report = {
      m, date: U.dateStr(m), cashStart, cashEnd: g.cash, nwStart, nw, profit, tax, inc, exp, capIn: g.acc.capIn, capOut: g.acc.capOut,
      pre: { inc: sumObj(pre.capIn), exp: sumObj(pre.capOut) },
      biz: bizRows, re: g.re.holdings.length ? { rev: g.re.m.rev, cost: g.re.m.cost, units: TG.RE.unitsOwned(g) } : null, money, led, names: Object.assign({}, g.acc.names),
      events: b0.events, staff: b0.staff, decisions: b0.decisions, news: b0.news, warns: b0.warns, ach,
      world: { phase: TG.W.phaseLabel(g), econ: g.world.econ, rate: g.world.baseRate, inflation: g.world.priceIdx },
      majors: b0.events.filter((e) => e.major).map((e) => ({ kind: e.major, text: e.text })),
      pending: g.decisions.length,
    };
    g.reports.push(E.slimReport(report)); if (g.reports.length > 24) g.reports.shift();
    g.lastReport = report;
    g.month++;
    g.cur = rep.newBuf(g.month);
    g.acc = TG.F.newAcc(); g.cashMark = g.cash;
    TG.LB.record(g);
    return report;
  };
  E.slimReport = (r) => ({ m: r.m, date: r.date, profit: r.profit, nw: r.nw, cashEnd: r.cashEnd, events: r.events.slice(0, 40), decisions: r.decisions.slice(0, 30), news: r.news, majors: r.majors, biz: r.biz.map((x) => ({ name: x.name, profit: x.profit, cash: x.cash })), net: r.money ? Math.round(r.money.net) : null });

  // explain WHY a business did what it did this month, with numbers
  E.bizWhy = (g, b, ctx, repBefore) => {
    const h = b.hist[b.hist.length - 1] || { rev: 0, cost: 0, profit: 0 }; const prev = b.hist[b.hist.length - 2];
    const why = [];
    const lc = b.lastCtx || {};
    if (b.licensePending > 0) why.push(`Waiting for license: ${b.licensePending} months left, costs keep running`);
    if (lc.demand != null && lc.cap != null) why.push(`Demand ${Math.round(lc.demand).toLocaleString()} vs capacity ${Math.round(lc.cap).toLocaleString()} (served ${Math.round(lc.served || 0).toLocaleString()})`);
    if (ctx && ctx.down > 0.01) why.push(`Downtime cut capacity by ${U.pct(ctx.down)}`);
    const dr = b.rep - repBefore; if (Math.abs(dr) >= 0.5) why.push(`Reputation ${dr > 0 ? 'rose' : 'fell'} ${Math.abs(dr).toFixed(1)} to ${Math.round(b.rep)}`);
    why.push(`Quality ${lc.quality}/100 (staff skill ${lc.skill}, morale ${lc.morale})`);
    if (g.world.econ !== 1) why.push(`Economy: ${TG.W.phaseLabel(g)} (demand x${g.world.econ.toFixed(2)})`);
    if (lc.adBoost) why.push(`Ads added about ${U.pct(lc.adBoost)} demand`);
    if (prev) { const d = h.profit - prev.profit; if (Math.abs(d) > Math.max(500, Math.abs(prev.profit) * 0.15)) why.push(`Profit ${d > 0 ? 'up' : 'down'} ${U.money(Math.abs(d))} vs last month`); }
    if (lc.note) why.push(lc.note);
    const lines = Object.entries(h.lines || {}).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 8);
    return { id: b.id, name: b.name, type: b.type, rev: h.rev, cost: h.cost, profit: h.profit, why, lines };
  };

  // ================= TIME SKIP =================
  E.yrsMo = (n) => U.yrsMo(n);
  E.skip = (g, n, opts) => {
    opts = opts || {};
    n = Math.max(1, Math.floor(n));
    const startM = g.month, cash0 = g.cash, nw0 = g.lastNW != null ? g.lastNW : TG.F.netWorth(g);
    const inc = {}, exp = {}; const majors = [], decisions = [], bizTot = {}; let profit = 0, done = 0, stopped = null, events = 0;
    const ledAll = {}, names = {}, months = []; const cashStart0 = g.cashMark != null ? g.cashMark : g.cash - TG.LG.net((g.acc || {}).led);
    const stopOn = opts.stopOnMajor != null ? opts.stopOnMajor : g.settings.stopOnMajor;
    const types = opts.majorTypes || g.settings.majorTypes;
    for (let i = 0; i < n; i++) {
      const r = E.nextMonth(g); done++;
      profit += r.profit; events += r.events.length;
      for (const k in r.inc) inc[k] = (inc[k] || 0) + r.inc[k];
      for (const k in r.exp) exp[k] = (exp[k] || 0) + r.exp[k];
      for (const b of r.biz) { const t = bizTot[b.name] || (bizTot[b.name] = { rev: 0, cost: 0, profit: 0, cash: 0 }); t.rev += b.rev; t.cost += b.cost; t.profit += b.profit; t.cash += b.cash || 0; }
      TG.LG.add(ledAll, r.led); Object.assign(names, r.names);
      months.push({ m: r.m, date: r.date, in: Math.round(r.money.tin), out: Math.round(r.money.tout), net: Math.round(r.money.net), cash: Math.round(r.cashEnd), own: TG.LG.ownerNets(r.led) });
      for (const e of r.events) if (e.type === 'major') majors.push(Object.assign({ date: r.date }, e));
      for (const d of r.decisions) if (d.by && d.by !== 'You') decisions.push(Object.assign({ date: r.date }, d));
      if (stopOn && i < n - 1) {
        const hit = r.majors.find((x) => types[x.kind]);
        if (hit) { stopped = { date: r.date, text: hit.text, kind: hit.kind }; break; }
        if (types.cash !== false && g.cash < 0) { stopped = { date: r.date, text: `Cash fell below zero (${U.money(g.cash)})`, kind: 'cash' }; break; }
      }
      if (opts.onProgress) opts.onProgress(i + 1, n);
    }
    const money = TG.LG.summary(g, ledAll, names, cashStart0, g.cash);
    return { money, perMonth: months, names, months: done, asked: n, from: U.dateStr(startM), to: U.dateStr(g.month - 1), cash0: cashStart0, cash1: g.cash, nw0, nw1: g.lastNW, profit, inc, exp, majors: majors.slice(-60), majorCount: majors.length, decisions: decisions.slice(-60), decisionCount: decisions.length, bizTot, stopped, events, pending: g.decisions.length };
  };

  // ================= ACHIEVEMENTS =================
  E.checkAchievements = (g, profit) => {
    const A = g.achievements, got = [];
    const give = (id) => { if (!A[id]) { A[id] = g.month; got.push(id); rep.event(g, null, 'good', `Achievement: ${TG.CONFIG.achievements[id]}`, 'Unlocked'); } };
    const nw = g.lastNW;
    if (profit > 0) give('first_profit');
    if (nw >= 1e6) give('nw_1m'); if (nw >= 1e7) give('nw_10m'); if (nw >= 1e8) give('nw_100m'); if (nw >= 1e9) give('nw_1b');
    if (g.businesses.length >= 3) give('three_biz');
    if (new Set(g.businesses.map((b) => b.type)).size >= 5) give('five_ind');
    if (nw >= 1e6 && !g.loans.length && !g.loc.balance) give('no_loans');
    if (nw >= 1e6 && g.player.bankruptcies > 0) give('comeback');
    if (TG.RE.unitsOwned(g) >= 10) give('landlord');
    if (g.re.flipsProfit >= 5) give('flipper');
    for (const id in g.markets) if (TG.W.share(g, id) >= 0.25) give('market_share');
    const last12 = g.history.slice(-12);
    if (last12.length === 12 && last12.filter((h) => h.phase === 'recession').length >= 6 && U.sum(last12, (h) => h.profit) > 0) give('survivor');
    if (g.month + 1 >= 120) give('decade'); if (g.month + 1 >= 1200) give('century');
    for (const t of TG.CONFIG.leaderboardTargets) if (nw >= t && g.stats.reached[t] == null) g.stats.reached[t] = g.month + 1;
    return got;
  };

  // ================= STORAGE (localStorage with in-memory fallback) =================
  const mem = {};
  const store = {
    ok: (() => { try { const k = '__tg_test'; globalThis.localStorage.setItem(k, '1'); globalThis.localStorage.removeItem(k); return true; } catch (e) { return false; } })(),
    get(k) { try { if (store.ok) return globalThis.localStorage.getItem(k); } catch (e) { /* fall through */ } return mem[k] == null ? null : mem[k]; },
    set(k, v) { try { if (store.ok) { globalThis.localStorage.setItem(k, v); return true; } } catch (e) { /* quota or sandbox */ } mem[k] = v; return false; },
    del(k) { try { if (store.ok) globalThis.localStorage.removeItem(k); } catch (e) { /* ignore */ } delete mem[k]; },
  };
  TG.store = store;
  const SAVE_KEY = 'tycoon_save_v1';
  E.serialize = (g) => JSON.stringify(g);
  E.validate = (g) => {
    if (!g || typeof g !== 'object') throw new Error('Not a save file');
    if (g.v == null || g.v > VERSION) throw new Error('Save is from a newer version');
    for (const k of ['cash', 'month', 'world', 'businesses', 'properties', 'loans', 're', 'invest', 'settings', 'player']) if (g[k] == null) throw new Error('Save is missing ' + k);
    if (!Number.isFinite(g.cash)) throw new Error('Save has a broken cash value');
    return true;
  };
  E.migrate = (g) => {
    g.reports = g.reports || []; g.newsFeed = g.newsFeed || []; g.stats = g.stats || { peakNW: 0, reached: {} };
    if (g.settings.crime === undefined) g.settings.crime = true;
    if (g.player) g.player.ownerBiz = null; // v4: no owner labor
    g.settings.majorTypes = g.settings.majorTypes || { breakdown: true, keyQuit: true, cash: true, lawsuit: true, strike: true };
    // v2: a market for every good; exact prices replace low/normal/premium
    for (const id in TG.CONFIG.markets) if (!g.markets[id]) { const m = TG.CONFIG.markets[id]; g.markets[id] = { demand12: m.demand12, comp: 1, player12: 0, sales: [], price: m.base, hist: [] }; }
    if ((g.v || 1) < 2) {
      for (const b of g.businesses) {
        if (b.price && b.price !== 'normal' && TG.PR.hasPrice(b)) { const mk = TG.PR.market(g, b); if (mk > 0) b.ask = Math.round(mk * (b.price === 'low' ? 0.9 : 1.1) * 100) / 100; }
        delete b.price; if (b.ask === undefined) b.ask = null;
      }
      g.v = 2;
    }
    // v5: farms split into cow / crop / orchard areas; old irrigation becomes sprinklers; every business gets manager orders
    for (const b of g.businesses) {
      b.orders = b.orders || {}; if (b.backlog == null) b.backlog = 0;
      if (b.farm) { TG.M.farmEnsure(b); TG.M.farmMigrateEquip(g, b); }
    }
    // v6: industry cycles, mechanics instead of auto-fix, no automation without a manager, mixed cow herds, credit record, tenant search
    if (TG.IN) TG.IN.ensure(g);
    delete g.settings.autoCredit; delete g.settings.autoFix; delete g.settings.serviceAt;
    for (const b of g.businesses) {
      if (b.spec && b.spec.mechanic) { // the old mechanic specialist becomes a staff mechanic
        const sp = b.spec.mechanic; delete b.spec.mechanic;
        if (TG.S.roleDef(b, 'mech')) b.staff.push(Object.assign(TG.S.candidate(g, b, 'mech', 0.6), { skill: sp.skill || 55, months: sp.months || 12 }));
      }
      if (b.orders) { delete b.orders.maint; delete b.orders.fixNow; delete b.orders.svcAt; }
      if (b.settings) { delete b.settings.autoFix; delete b.settings.serviceAt; }
      if (b.farm) { TG.M.herdMigrate(g, b); if (b.farm.feed == null) b.farm.feed = 0; if (b.farm.orders && b.farm.orders.spray) delete b.farm.orders.spray.cows; if (b.farm.orders && !b.farm.orders.cows) b.farm.orders.cows = TG.M.cowOrderDefaults(); }
    }
    const hadCr = !!g.player.cr;
    if (g.loc && g.loc.limit == null) { // old saves keep the credit line they had (old formula), now a fixed approved limit
      const L = TG.CONFIG.finance.loc, cr = g.player.credit || 650; const cf = U.clamp((cr - 600) / 200, 0.2, 1.3);
      g.loc.limit = cr < L.minCredit ? Math.round(g.loc.balance || 0) : Math.max(Math.round(g.loc.balance || 0), Math.round((L.limitBase + L.limitNW * Math.max(0, TG.F.netWorth(g))) * cf / 1000) * 1000);
    }
    for (const h of (g.re && g.re.holdings) || []) { if (h.rentR == null) h.rentR = 1; for (const t of h.tenants || []) if (t && t.rel == null) { t.rel = t.bad ? 0.3 : 0.72; delete t.bad; } }
    TG.CREDIT.ensure(g); if (!hadCr) TG.CREDIT.sync(g);
    if ((g.v || 1) < 6) g.v = 6;
    // v7: money ledger, per-unit tenant searches and repairs, loan history, closed shops, HR wage deals
    delete g._own;
    if (g.acc && !g.acc.led) { g.acc.led = {}; g.acc.names = {}; }
    if (g.cashMark == null) g.cashMark = g.cash - TG.LG.net((g.acc || {}).led);
    for (const h of (g.re && g.re.holdings) || []) { TG.RE.ensureUnits(h); if (h.mgrSearchM != null && typeof h.mgrSearchM !== 'object') h.mgrSearchM = {}; }
    for (const l of g.loans || []) { if (l.intPaid == null) { l.intPaid = 0; l.prinPaid = Math.max(0, (l.principal || l.balance) - l.balance); l.histUnknown = true; } }
    for (const b of g.businesses) if (b.shut == null) b.shut = 0;
    if ((g.v || 1) < 7) g.v = 7;
    // v8: skips stop on trouble by default, whole animals, supplies 'Auto' only with a manager, save revisions (two tabs)
    if (g.v < 8) {
      g.settings.stopOnMajor = true; g.settings.warnSupplies = true;
      g.settings.majorTypes = Object.assign({ closed: true, cash: true, crime: true }, g.settings.majorTypes, { closed: true, cash: true, crime: true });
      for (const b of g.businesses) { if (b.farm && b.farm.areas && b.farm.areas.cows && b.farm.areas.cows.st && TG.M.herdRound) TG.M.herdRound(b.farm.areas.cows, true); }
      g.v = 8;
    }
      if (g.settings.warnSupplies == null) g.settings.warnSupplies = true;
    // v9: Shift lead role removed (managers order supplies, crew works the site); personalities and market pay for every worker
    if (g.v < 9) { TG.S.v9Migrate(g); g.v = 9; }
    return g;
  };
  E.deserialize = (s) => { const g = JSON.parse(s); E.validate(g); return E.migrate(g); };
  E.saveText = (txt) => { try { return store.set(SAVE_KEY, txt); } catch (e) { return false; } };
  E.saveState = { ok: null, at: 0, where: '', err: '' };
  const IDB = {
    db: null, failed: false,
    open() {
      if (IDB.db || IDB.failed) return Promise.resolve(IDB.db);
      return new Promise((res) => {
        try {
          const f = globalThis.indexedDB; if (!f) { IDB.failed = true; return res(null); }
          const rq = f.open('tycoon', 1);
          rq.onupgradeneeded = () => { try { rq.result.createObjectStore('saves'); } catch (e) { res(null); } };
          rq.onsuccess = () => { IDB.db = rq.result; res(IDB.db); };
          rq.onerror = () => { IDB.failed = true; res(null); };
          rq.onblocked = () => { IDB.failed = true; res(null); };
        } catch (e) { IDB.failed = true; res(null); }
      });
    },
    put(k, v) {
      return IDB.open().then((db) => new Promise((res) => { if (!db) return res(false);
        try { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(v, k);
          tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false);
        } catch (e) { res(false); } })); },
    get(k) { return IDB.open().then((db) => new Promise((res) => { if (!db) return res(null);
        try { const rq = db.transaction('saves', 'readonly').objectStore('saves').get(k);
          rq.onsuccess = () => res(rq.result == null ? null : rq.result); rq.onerror = () => res(null);
        } catch (e) { res(null); } })); },
    del(k) { return IDB.open().then((db) => { if (!db) return;
      return IDB.put(k, null); }); },
  };
  TG.IDB = IDB;
  // v8: two tabs on one save. Every save bumps a shared revision number; a tab that did not see the latest
  // revision (another tab saved after it loaded) refuses to save and asks you to reload, so it cannot wipe that progress.
  const META_KEY = 'tycoon_save_meta';
  E.TAB = Math.random().toString(36).slice(2, 10);
  E.meta = () => { try { return JSON.parse(store.get(META_KEY) || 'null') || {}; } catch (e) { return {}; } };
  E.seenRev = null; E.stale = false;
  E.markSeen = () => { E.seenRev = E.meta().rev || 0; E.stale = false; };
  E.save = (g, force) => {
    const mt = E.meta();
    if (!force && E.seenRev != null && (mt.rev || 0) !== E.seenRev && mt.tab && mt.tab !== E.TAB) { E.stale = true; E.saveState = { ok: false, at: Date.now(), where: '', err: 'stale', stale: true }; if (E.onStale) E.onStale(); return false; }
    const rev = (mt.rev || 0) + 1;
    let txt; try { g.savedAt = Date.now(); txt = E.serialize(g); } catch (e) { E.saveState = { ok: false, at: Date.now(), where: '', err: 'could not package the game' }; return false; }
    const lsOk = E.saveText(txt); if (lsOk) { try { store.set(META_KEY, JSON.stringify({ rev, tab: E.TAB, at: Date.now(), gameId: g.gameId })); } catch (e) { /* meta is best-effort */ } E.seenRev = rev; E.stale = false; } const st = { ok: lsOk, at: Date.now(), where: lsOk ? 'device' : 'memory only', err: lsOk ? '' : 'browser storage blocked or full' }; E.saveState = st;
    E.saveIdb(txt, st);
    if (E.onSaved) E.onSaved(st); return lsOk; };
  E.loadAsync = () => IDB.get(SAVE_KEY).then((s2) => { let a = null, b = null; const s1 = store.get(SAVE_KEY);
    try { if (s1) a = E.deserialize(s1); } catch (e) { a = null; } try { if (s2) b = E.deserialize(s2); } catch (e) { b = null; }
    const g = a && b ? ((b.savedAt || 0) > (a.savedAt || 0) ? b : a) : a || b; if (g) TG.G = g; E.markSeen(); return g; });
  E.saveIdb = (txt, st) => IDB.put(SAVE_KEY, txt).then((ok) => {
    if (ok && !st.ok) { st.ok = true; st.where = 'device (database)'; st.err = ''; } if (E.onSaved) E.onSaved(st); return ok; });
  E.load = () => { E.markSeen(); const s = store.get(SAVE_KEY); if (!s) return null; try { const g = E.deserialize(s); TG.G = g; return g; } catch (e) { return null; } };
  E.clearSave = () => store.del(SAVE_KEY);
  const b64e = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
  const b64d = (s) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));
  E.exportCode = (g) => 'TYC1:' + b64e(E.serialize(g));
  E.importCode = (code) => {
    code = String(code || '').trim(); if (code.startsWith('TYC1:')) code = code.slice(5);
    let s; try { s = b64d(code); } catch (e) { throw new Error('That code is not valid'); }
    const g = E.deserialize(s); TG.G = g; return g;
  };

  // ================= LOCAL LEADERBOARD =================
  const LB = {};
  const LB_KEY = 'tycoon_leaderboard_v1';
  LB.all = () => { try { return JSON.parse(store.get(LB_KEY) || '[]'); } catch (e) { return []; } };
  LB.record = (g) => {
    if (g.month % 6 !== 0 && !Object.keys(g.stats.reached).length) return;
    const list = LB.all(); let e = list.find((x) => x.id === g.gameId);
    if (!e) { e = { id: g.gameId, name: g.player.name, scenario: g.scenario }; list.push(e); }
    Object.assign(e, { peak: Math.round(g.stats.peakNW), nw: Math.round(g.lastNW), months: g.month, bankruptcies: g.player.bankruptcies, reached: g.stats.reached, when: Date.now() });
    list.sort((a, c) => c.peak - a.peak); store.set(LB_KEY, JSON.stringify(list.slice(0, 30)));
  };
  TG.LB = LB;
  TG.Game = E;
})();
