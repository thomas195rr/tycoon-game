/* realestate.js - the real estate path: rentals, tenants, vacancies, repairs, flipping, development,
   refinancing, property managers, neighborhoods, market cycles, and a late-game fund. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const RE = {};
  const RC = () => TG.CONFIG.realEstate;
  const STREETS = ['Maple', 'Birch', 'Sunset', 'Park', 'Grove', 'Union', 'Liberty', 'Spring', 'Garden', 'Highland', 'Bay', 'Summit'];
  const condF = (c) => 0.7 + 0.5 * c / 100;

  RE.init = (g) => { g.re = { holdings: [], listings: [], manager: null, handyman: false, fund: null, flipsDone: 0, flipsProfit: 0, m: { rev: 0, cost: 0 }, hist: [] }; RE.refill(g, RC().listingCount); RE.ensureStarter(g); };

  RE.gen = (g, kindId, opts) => {
    const C = TG.CONFIG, k = RC().kinds[kindId]; opts = opts || {};
    const region = R.pick(Object.keys(C.regions));
    const loc = kindId === 'land' ? R.pick(['suburb', 'town', 'rural']) : R.weighted({ city: 2, suburb: 3, town: 2, rural: 0.7 });
    const grade = R.weighted({ A: 1, B: 2, C: 1.5 });
    const distressed = opts.distressed != null ? opts.distressed : (kindId === 'house' || kindId === 'condo' || kindId === 'duplex') && R.chance(0.3);
    const units = Array.isArray(k.units) ? R.int(k.units[0], k.units[1]) : k.units;
    const pr = R.range(0, 1); const uf = Array.isArray(k.units) && k.units[1] > k.units[0] ? (units - k.units[0]) / (k.units[1] - k.units[0]) : pr; /* v8: more units = pricier building, so rent per unit stays sensible */
    let price = (k.price[0] + (k.price[1] - k.price[0]) * (Array.isArray(k.units) ? 0.75 * uf + 0.25 * pr : pr)) * C.regions[region].price * (grade === 'A' ? 1.25 : grade === 'C' ? 0.78 : 1) * g.world.housing;
    const cond = distressed ? R.range(15, 40) : R.range(45, 95);
    const nb = R.range(0.9, 1.1);
    const trend = R.range(-1, 1);
    price *= condF(cond) / condF(70);
    if (distressed) price *= R.range(RC().flip.distressDiscount[0], RC().flip.distressDiscount[1]);
    price = Math.round(price / 1000) * 1000;
    const acres = kindId === 'land' ? Math.round(R.range(2, 40)) : 0;
    return { id: U.uid('r'), kind: kindId, name: `${R.int(1, 999)} ${R.pick(STREETS)} ${R.pick(['St', 'Ave', 'Ct', 'Blvd'])}`, region, loc, grade, units, price, cond, nb, trend, distressed, acres,
      age: R.int(2, 80), hidden: R.chance(RC().flip.hiddenProblem * (distressed ? 1.5 : 0.6)) ? R.range(RC().flip.hiddenCost[0], RC().flip.hiddenCost[1]) : 0, listed: g.month,
      life: R.int(TG.CONFIG.v10.listingLife[0], TG.CONFIG.v10.listingLife[1]) }; /* v10: on the market 3-7 months, then gone */
  };
  // v10: a first rental is always possible: keep at least one ordinary home and one small multi-unit building on the market
  RE.ensureStarter = (g) => {
    const L = g.re.listings, ok = (l) => !l.distressed;
    if (!L.some((l) => ok(l) && (l.kind === 'house' || l.kind === 'condo'))) L.push(RE.gen(g, R.chance(0.5) ? 'house' : 'condo', { distressed: false }));
    if (!L.some((l) => ok(l) && l.units > 1 && l.units <= 20)) L.push(RE.gen(g, R.chance(0.6) ? 'duplex' : 'smallapt', { distressed: false }));
  };
  RE.refill = (g, n) => {
    for (let i = 0; i < n; i++) {
      const w = { condo: 3, house: 4, duplex: 2.5, smallapt: 1.6, apartment: 0.8, strip: 0.6, officebldg: 0.4, warehouse: 0.5, land: 0.8, tower: 0.15 };
      g.re.listings.push(RE.gen(g, R.weighted(w)));
    }
  };
  RE.marketRent = (g, h) => {
    const k = RC().kinds[h.kind]; if (!k.rentPct) return 0;
    const perUnit = (h.basePrice || h.price) * k.rentPct / Math.max(1, h.units);
    return Math.round(perUnit * Math.pow(g.world.housing / (h.housingAtBuy || g.world.housing), 0.6) * h.nb * condF(h.cond) / condF(70) * (h.rentBump || 1));
  };
  // v6: the rent YOU set (share of market rent), applicants and tenant search
  const TC = () => TG.CONFIG.tenants;
  // v10: every unit can have its own rent (h.unitR[u] = share of market rent); otherwise the building's default (h.rentR)
  RE.unitRentR = (h, u) => (u != null && h.unitR && h.unitR[u] != null ? h.unitR[u] : (h.rentR || 1));
  RE.askRent = (g, h, u) => Math.round(RE.marketRent(g, h) * RE.unitRentR(h, u));
  RE.estRent = (g, l) => Math.round(RE.marketRent(g, l) * Math.max(1, l.units || 0) * 0.92);
  RE.vacant = (h) => (h.tenants || []).filter((t) => !t).length;
  // v7: ONE tenant per home / unit. Every empty unit is filled by its own search (one applicant at a time).
  const mgrSkill = (g) => (g.re.manager ? (g.re.manager.skill || 50) : null);
  RE.mgrCostMult = (g) => { const s = mgrSkill(g); return s == null ? 1 : U.clamp(1.2 - s / 250, 0.8, 1.2); }; // a skilled manager gets better vendor prices
  RE.searchCost = (g, h, byMgr, u) => { const S = TC().search; return Math.round((S.base + S.perRent * RE.askRent(g, h, u)) * g.world.priceIdx * (byMgr ? RE.mgrCostMult(g) : 1)); };
  RE.poolPreview = (g, h, byMgr, unit) => { // what ONE unit's search is likely to bring, shown before you pay
    const T = TC(), r = RE.unitRentR(h, unit), k = RC().kinds[h.kind];
    const n = Math.min(T.pool.max, T.pool.atMarket * Math.exp(-(r - 1) * T.pool.slope) * (k.lease ? T.pool.commercial : 1));
    const sk = byMgr ? mgrSkill(g) : null;
    const q = U.clamp(T.quality.atMarket + T.quality.slope * (1 - r) + (h.cond - 60) * T.quality.cond + (sk != null ? (sk - 50) / 500 : 0), 0.1, 0.88);
    return { n, q, label: q >= 0.65 ? 'great' : q >= 0.5 ? 'good' : q >= 0.35 ? 'mixed' : 'risky' };
  };
  RE.ensureUnits = (h) => {
    h.searches = h.searches || {}; h.issues = h.issues || [];
    if (h.search) { const u = (h.tenants || []).findIndex((t) => !t); if (u >= 0 && h.search.list) h.searches[u] = h.search; delete h.search; } // v6 saves: one search per building
    return h;
  };
  RE.unitIssues = (h, u) => (h.issues || []).filter((x) => x.unit === u);
  // which unit a call is about: the one asked for, or the first empty unit (with an open search when one is wanted)
  RE.pickUnit = (g, h, unit, wantSearch) => {
    RE.ensureUnits(h);
    if (unit != null && unit !== '') return Number(unit);
    if (wantSearch) { for (let i = 0; i < h.tenants.length; i++) if (!h.tenants[i] && RE.current(g, h, i)) return i; }
    for (let i = 0; i < h.tenants.length; i++) if (!h.tenants[i] && !RE.current(g, h, i) && !RE.unitIssues(h, i).length) return i;
    for (let i = 0; i < h.tenants.length; i++) if (!h.tenants[i]) return i;
    return -1;
  };
  RE.search = (g, hid, by, unit) => {
    const h = g.re.holdings.find((x) => x.id === hid); if (!h || !RC().kinds[h.kind].rentPct || h.flip || h.dev || h.mode === 'sale') return { ok: false, msg: 'Not a rental right now.' };
    RE.ensureUnits(h); const u = RE.pickUnit(g, h, unit, false);
    if (u < 0 || h.tenants[u]) return { ok: false, msg: 'No empty units.' };
    if (RE.unitIssues(h, u).length) return { ok: false, msg: 'Fix the repair in this unit first: nobody signs a lease for a broken home.' };
    const byMgr = !!(by && g.re.manager);
    const cost = RE.searchCost(g, h, byMgr, u); if (g.cash < cost) return { ok: false, msg: `A tenant search costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Tenant search'); g.re.m.cost = (g.re.m.cost || 0) + cost;
    const pv = RE.poolPreview(g, h, byMgr, u); const n = Math.max(0, Math.round(pv.n * R.range(0.55, 1.35)));
    const list = []; for (let i = 0; i < n; i++) list.push(RE.applicant(g, h, R.normal(pv.q, TC().quality.sd)));
    h.searches[u] = { m: g.month, rent: RE.askRent(g, h, u), list, i: 0 };
    if (by) TG.rep.decision(g, null, by, `Paid ${U.money(cost)} for a tenant search for unit ${u + 1} at ${h.name}: ${n} applicant(s)`);
    return { ok: true, n, cost, unit: u };
  };
  RE.current = (g, h, unit) => {
    if (!h) return null; RE.ensureUnits(h);
    if (unit == null) { for (const k in h.searches) { const a = RE.current(g, h, Number(k)); if (a && !h.tenants[k]) return a; } return null; }
    const s = h.searches[unit]; if (!s || g.month - s.m > TC().search.expires) return null; return s.list[s.i] || null;
  };
  RE.decide = (g, hid, accept, unit) => {
    const h = g.re.holdings.find((x) => x.id === hid); if (!h) return { ok: false };
    const u = RE.pickUnit(g, h, unit, true); if (u < 0) return { ok: false, msg: 'No empty units.' };
    const s = h.searches[u]; const a = RE.current(g, h, u); if (!s || !a) return { ok: false, msg: 'No applicants left.' };
    s.i++; // no going back either way
    if (!accept) return { ok: true, left: s.list.length - s.i, unit: u };
    if (h.tenants[u]) return { ok: false, msg: 'That unit is already rented.' };
    h.tenants[u] = RE.makeTenant(g, h, a, s.rent); delete h.searches[u];
    return { ok: true, tenant: h.tenants[u], left: 0, unit: u };
  };
  RE.leaseLeft = (g, t) => { const held = g.month - t.since; if (held < t.lease) return t.lease - held; const x = 12 - ((held - t.lease) % 12); return x; };
  RE.quality = (t) => (t.rel >= 0.65 ? { label: 'reliable', tone: 'good', stars: 3 } : t.rel >= 0.45 ? { label: 'okay', tone: 'warn', stars: 2 } : { label: 'risky', tone: 'bad', stars: 1 });
  // repairs: with a property manager they are paid at once; without one they wait for YOU (tap Fix)
  RE.addIssue = (g, h, unit, what, cost, big) => {
    RE.ensureUnits(h); const mgr = g.re.manager;
    if (mgr) {
      const c = Math.round(cost * RE.mgrCostMult(g) * (g.re.handyman ? 0.8 : 1));
      TG.F.spend(g, c, 'Real estate repairs'); g.re.m.cost += c; if (big) h.cond = U.clamp(h.cond + 6, 0, 100);
      TG.rep.decision(g, null, 'Property manager ' + mgr.name, `Fixed ${what} at ${h.name}${unit != null ? ' (unit ' + (unit + 1) + ')' : ''} for ${U.money(c)}`);
      return null;
    }
    const it = { id: U.uid('i'), unit: unit == null ? null : unit, what, cost: Math.round(cost), m: g.month, big: !!big };
    h.issues.push(it);
    TG.rep.event(g, null, big ? 'major' : 'bad', `${h.name}${unit != null && h.units > 1 ? ' unit ' + (unit + 1) : ''} needs a repair: ${what} (~${U.money(cost)})`, 'No property manager: it waits until you tap Fix. Unfixed repairs annoy tenants, wear the building and can bring city fines.');
    return it;
  };
  RE.fixCost = (g, it) => Math.round(it.cost * (g.re.handyman ? 0.8 : 1));
  RE.fixIssue = (g, hid, iid) => {
    const h = g.re.holdings.find((x) => x.id === hid); if (!h) return { ok: false }; RE.ensureUnits(h);
    const it = h.issues.find((x) => x.id === iid); if (!it) return { ok: false, msg: 'Already fixed.' };
    const c = RE.fixCost(g, it); if (g.cash < c) return { ok: false, msg: `The repair costs ${U.money(c)}.` };
    TG.F.spend(g, c, 'Real estate repairs'); g.re.m.cost += c; h.issues = h.issues.filter((x) => x !== it);
    if (it.big) h.cond = U.clamp(h.cond + 6, 0, 100);
    return { ok: true, cost: c };
  };
  const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Jamie', 'Drew', 'Avery', 'Quinn', 'Rosa', 'Omar', 'Mei', 'Luis', 'Priya', 'Ben', 'Nia'];
  const LAST = ['Lee', 'Patel', 'Garcia', 'Smith', 'Nguyen', 'Brown', 'Khan', 'Lopez', 'Clark', 'Young', 'Diaz', 'Hill'];
  const BIZN = ['Corner Deli', 'Bright Dental', 'QuickPrint', 'Zen Yoga', 'Metro Phones', 'Sunny Nails', 'Pro Tax', 'Bean Cafe', 'City Logistics', 'Apex Labs'];
  RE.applicant = (g, h, q) => {
    const k = RC().kinds[h.kind]; const T = TC();
    q = U.clamp(q, 0.02, 0.98);
    const ev = R.chance(Math.pow(1 - q, 2) * 1.1) ? 1 + (R.chance((1 - q) * 0.5) ? 1 : 0) : 0;
    const inc = U.clamp(1.6 + 3.2 * q + R.normal(0, 0.5), 0.8, 8);
    const cs = Math.round(U.clamp(470 + 360 * q + R.normal(0, 45), 350, 840));
    return { name: ['strip', 'officebldg', 'warehouse'].indexOf(h.kind) >= 0 ? R.pick(BIZN) : `${R.pick(FIRST)} ${R.pick(LAST)}${R.chance(0.3) ? ' & family' : ''}`, evictions: ev, income: Math.round(inc * 10) / 10, credit: cs, rel: U.clamp(q + R.normal(0, 0.12), 0.02, 0.98) };
  };
  RE.applicantMarks = (a) => [ // good / okay / bad markers the player reads
    { label: 'Past evictions', val: String(a.evictions), mark: a.evictions === 0 ? 'good' : 'bad' },
    { label: 'Income vs rent', val: a.income.toFixed(1) + 'x', mark: a.income >= 3 ? 'good' : a.income >= 2.3 ? 'ok' : 'bad' },
    { label: 'Credit score', val: String(a.credit), mark: a.credit >= 680 ? 'good' : a.credit >= 600 ? 'ok' : 'bad' },
  ];
  RE.makeTenant = (g, h, a, rent) => {
    const k = RC().kinds[h.kind];
    return { name: a.name, rel: a.rel, ev: a.evictions, inc: a.income, cs: a.credit, rent: rent || RE.askRent(g, h), late: 0, evict: 0, since: g.month, lease: k.lease || (a.rel > 0.65 && R.chance(0.5) ? 24 : 12) };
  };
  // property manager: runs searches and screens applicants for you (better skill = better reading of the signals)
  RE.mgrFill = (g, h) => {
    const mgr = g.re.manager; if (!mgr || !RE.vacant(h) || h.mode !== 'rent') return;
    RE.ensureUnits(h);
    const bar = 0.42 + mgr.skill / 600; const err = 0.22 - mgr.skill / 600;
    for (let u = 0; u < h.tenants.length; u++) {
      if (h.tenants[u]) continue;
      if (!RE.current(g, h, u)) { const k = 'u' + u; h.mgrSearchM = h.mgrSearchM && typeof h.mgrSearchM === 'object' ? h.mgrSearchM : {}; if (h.mgrSearchM[k] === g.month) continue; h.mgrSearchM[k] = g.month; const r = RE.search(g, h.id, 'Property manager ' + mgr.name, u); if (!r.ok) continue; }
      let a; while (!h.tenants[u] && (a = RE.current(g, h, u))) {
        const seen = 0.5 * (a.credit - 470) / 360 + 0.3 * U.clamp((a.income - 1.6) / 3.2, 0, 1) + 0.2 * (a.evictions ? 0 : 1) + R.normal(0, err);
        RE.decide(g, h.id, seen >= bar, u);
      }
    }
  };
  RE.value = (g, h) => Math.round((h.base || h.price) * g.world.housing * h.nb * condF(h.cond) * (h.over ? 0.92 : 1));
  RE.totalValue = (g) => (g.re ? U.sum(g.re.holdings, (h) => RE.value(g, h)) : 0);
  RE.unitsOwned = (g) => U.sum(g.re.holdings, (h) => h.units || 0);

  RE.maxLtv = (l) => (RC().kinds[l.kind].commercial ? 0.75 : 0.8);
  RE.buy = (g, listingId, mortgage, term, downPct) => {
    const C = TG.CONFIG; const l = g.re.listings.find((x) => x.id === listingId); if (!l) return { ok: false, msg: 'Listing gone.' };
    const fees = Math.round(l.price * C.property.buyCostPct);
    if (mortgage) {
      const ltv = Math.min(RE.maxLtv(l), downPct ? 1 - downPct : 1); const down = Math.round(l.price * (1 - ltv)); /* v10: you can put more down for a smaller payment */
      if (g.cash < down + fees) return { ok: false, msg: `Need ${U.money(down + fees)} down.` };
      const ok = TG.CREDIT.apply(g, 'mortgage', l.price - down, { collateral: { kind: 'property', id: l.id }, label: 'Mortgage: ' + l.name, noCash: true, ltv, asset: l.price, extraIncome: RE.estRent(g, l), term });  if (!ok.ok) return ok;
      TG.F.spend(g, down + fees, 'Real estate purchases', null, true); const loan = ok.loan;
      l.mortgageId = loan.id;
    } else { if (g.cash < l.price + fees) return { ok: false, msg: `Need ${U.money(l.price + fees)}.` }; TG.F.spend(g, l.price + fees, 'Real estate purchases', null, true); }
    g.re.listings = g.re.listings.filter((x) => x !== l);
    l.base = l.price / (g.world.housing * l.nb * condF(l.cond)); l.basePrice = l.price; l.housingAtBuy = g.world.housing; l.bought = g.month; l.paid = l.price + fees;
    l.tenants = []; for (let i = 0; i < l.units; i++) l.tenants.push(null); /* v10: every unit starts EMPTY: you find and pick each tenant (and can set each unit's rent) */
    l.rentR = 1; l.unitR = {}; l.searches = {}; l.issues = [];
    l.screen = false; l.upkeep = 'normal'; l.insured = true; l.taxMult = 1; l.mode = l.distressed ? 'hold' : 'rent'; l.spent = 0; l.inspected = false;
    g.re.holdings.push(l);
    return { ok: true, h: l };
  };
  // tenants that come with a building you buy: you did not pick them (unknown, mixed quality)
  RE.newTenant = (g, h) => { const a = RE.applicant(g, h, R.normal(0.5, 0.22)); const t = RE.makeTenant(g, h, a, RE.marketRent(g, h)); t.since = g.month - R.int(0, 11); t.inherited = true; return t; };
  RE.inspect = (g, listingId) => {
    const l = g.re.listings.find((x) => x.id === listingId); if (!l || l.inspected) return null;
    TG.F.spend(g, RC().flip.inspectionCost * g.world.priceIdx, 'Inspections', null, true);
    l.inspected = true; l.found = l.hidden > 0 && R.chance(RC().flip.inspectReveal);
    return l.found ? `Inspection found a problem: about ${U.money(l.hidden * l.price)} of hidden repairs (mold, foundation or wiring)` : 'Inspection found nothing major (it can still miss things)';
  };

  RE.startFlip = (g, hid, level, contractor, contingency) => {
    const F = RC().flip; const h = g.re.holdings.find((x) => x.id === hid); if (!h || h.flip) return { ok: false };
    const L = F.levels[level], K = F.contractors[contractor];
    const budget = Math.round(RE.value(g, h) / condF(h.cond) * condF(70) * L.cost * K.costMult * g.world.priceIdx / g.world.housing * g.world.housing);
    const total = Math.round(budget * (contingency ? 1 + F.contingencyPct : 1));
    if (g.cash < total * 0.3) return { ok: false, msg: `Need at least ${U.money(total * 0.3)} to start (30% upfront).` };
    TG.F.spend(g, Math.round(total * 0.3), 'Renovations', null, true);
    h.flip = { level, contractor, months: L.months, left: L.months, budget, contingency: contingency ? Math.round(budget * F.contingencyPct) : 0, paid: Math.round(total * 0.3), overrun: 0 };
    h.mode = 'reno'; for (let i = 0; i < h.tenants.length; i++) h.tenants[i] = null; h.searches = {}; h.issues = []; // the renovation fixes everything
    return { ok: true, budget };
  };
  RE.list = (g, hid, askMult) => { const h = g.re.holdings.find((x) => x.id === hid); if (!h || h.flip || h.dev) return; h.mode = 'sale'; h.ask = Math.round(RE.value(g, h) * (askMult || 1)); };
  RE.unlist = (g, hid) => { const h = g.re.holdings.find((x) => x.id === hid); if (h && h.mode === 'sale') h.mode = 'rent'; };
  RE.sell = (g, hid, mult) => {
    const C = TG.CONFIG; const h = g.re.holdings.find((x) => x.id === hid); if (!h) return 0;
    const v = Math.round((h.mode === 'sale' && h.ask && !mult ? h.ask : RE.value(g, h) * (mult || 1)) * (1 - C.property.sellCostPct));
    TG.F.earn(g, v, 'Real estate sales', null, true);
    if (h.mortgageId) { const l = g.loans.find((x) => x.id === h.mortgageId); if (l) TG.F.payoff(g, l.id); }
    g.re.holdings = g.re.holdings.filter((x) => x !== h);
    if (h.flipped) { const prof = v - h.paid - h.spent; g.re.flipsDone++; if (prof > 0) g.re.flipsProfit++; TG.rep.event(g, null, prof > 0 ? 'good' : 'bad', `Flip of ${h.name} ${prof > 0 ? 'made' : 'lost'} ${U.money(Math.abs(prof))}`, `Bought ${U.money(h.paid)}, renovation ${U.money(h.spent)}, sold ${U.money(v)} after fees`); }
    return v;
  };
  RE.refinance = (g, hid) => {
    const C = RC(); const h = g.re.holdings.find((x) => x.id === hid); if (!h) return { ok: false };
    const v = RE.value(g, h); const old = h.mortgageId ? g.loans.find((x) => x.id === h.mortgageId) : null;
    const bal = old ? old.balance : 0; const newAmt = Math.round(v * C.refinanceLtv);
    const cashOut = newAmt - bal - Math.round(newAmt * C.refinanceFee);
    if (cashOut < 5000) return { ok: false, msg: 'Not enough equity to refinance.' };
    const ok = TG.CREDIT.apply(g, 'mortgage', newAmt, { collateral: { kind: 'property', id: h.id }, label: 'Refi mortgage: ' + h.name, noCash: true, ltv: C.refinanceLtv }); if (!ok.ok) return ok;
    if (old) g.loans = g.loans.filter((x) => x !== old);
    const loan = ok.loan;
    h.mortgageId = loan.id; const fee = Math.round(newAmt * C.refinanceFee); TG.F.earn(g, cashOut + fee, 'Refinance cash-out', null, true); TG.F.spend(g, fee, 'Refinance fees', null, true); /* v8: the fee shows in the money report */
    return { ok: true, cashOut };
  };
  RE.develop = (g, hid, units) => {
    const D = RC().develop; const h = g.re.holdings.find((x) => x.id === hid); if (!h || h.kind !== 'land' || h.dev) return { ok: false };
    units = Math.round(U.clamp(units, 4, Math.min(D.maxUnits, h.acres * D.unitsPerAcre)));
    const cpu = R.range(D.costPerUnit[0], D.costPerUnit[1]) * g.world.priceIdx;
    h.dev = { stage: 'permit', left: R.int(D.permitMonths[0], D.permitMonths[1]), units, cpu, cost: Math.round(units * cpu), paid: 0, buildMonths: R.int(D.buildMonths[0], D.buildMonths[1]) };
    TG.F.spend(g, Math.round(25000 * g.world.priceIdx + units * 800), 'Permits & architects', null, true);
    return { ok: true, dev: h.dev };
  };
  RE.hireManager = (g, cand) => { g.re.manager = cand; TG.rep.staff(g, null, `Hired ${cand.name} as property manager (${U.money(cand.wage)}/mo + ${U.pct(RC().managerFeePct)} of rent)`); };
  RE.managerPool = (g) => {
    g.re.pool = g.re.pool && g.re.pool.month === g.month ? g.re.pool : { month: g.month, list: [0, 1, 2, 3].map(() => TG.S.candidate(g, { region: 'harbor', loc: 'suburb' }, 'rem', 0.6)) };
    return g.re.pool.list;
  };
  RE.raiseFund = (g) => {
    const F = RC().fund; const v = RE.totalValue(g);
    if (g.re.fund) return { ok: false, msg: 'Fund already raised.' };
    if (v < F.minPortfolio) return { ok: false, msg: `Needs a ${U.money(F.minPortfolio)} portfolio.` };
    const cash = Math.round(v * F.raisePct); g.re.fund = { share: F.investorShare, raised: cash, since: g.month };
    TG.F.earn(g, cash, 'Fund raise', null, true);
    return { ok: true, cash };
  };

  RE.month = (g) => {
    const C = TG.CONFIG, rc = RC(), w = g.world; const mgr = g.re.manager;
    g.re.m = { rev: 0, cost: 0 };
    const earn = (amt, label) => { amt = Math.round(amt); if (amt <= 0) return; TG.F.earn(g, amt, label); g.re.m.rev += amt; };
    const spend = (amt, label) => { amt = Math.round(amt); if (amt <= 0) return; TG.F.spend(g, amt, label); g.re.m.cost += amt; };
    const units = RE.unitsOwned(g);
    const overSelf = !mgr ? Math.max(0, units - rc.selfManageLimit) : 0;
    // shared costs are split over the properties by units, so each property's line shows its true result
    const share = (h) => (units > 0 ? Math.max(0, h.units || 0) / units : 1 / Math.max(1, g.re.holdings.length));
    if (mgr) { mgr.months++; mgr.morale = U.clamp(mgr.morale + R.normal(0, 3), 0, 100); }
    const mgrWage = mgr ? mgr.wage : 0, handy = g.re.handyman && g.re.holdings.length ? Math.round(RC().handymanFee * g.world.priceIdx) : 0;
    for (const h of g.re.holdings.slice()) {
      if (!g.re.holdings.includes(h)) continue;
      const prevOwn = g._own; g._own = 'r:' + h.id;
      try { RE.holdingMonth(g, h, { C, rc, w, mgr, earn, spend, overSelf, mgrPart: mgrWage * share(h), handyPart: handy * share(h) }); } finally { g._own = prevOwn; }
    }
    if (mgr && !g.re.holdings.length) spend(mgrWage, 'Property manager');
    if (mgr && R.chance(0.01 * (mgr.morale < 40 ? 4 : 1))) { TG.rep.event(g, null, 'bad', `Property manager ${mgr.name} quit`, `Morale ${Math.round(mgr.morale)}`, { major: 'keyQuit' }); g.re.manager = null; }
    // fund distributions
    const net = g.re.m.rev - g.re.m.cost;
    if (g.re.fund && net > 0) spend(net * g.re.fund.share, 'Fund investor distributions');
    g.re.hist.push({ m: g.month, rev: Math.round(g.re.m.rev), cost: Math.round(g.re.m.cost) }); if (g.re.hist.length > 120) g.re.hist.shift();
    // listings
    // v10: each listing stays 3-7 months, then a new one takes its place, so the market keeps changing
    for (const l of g.re.listings) if (l.life == null) l.life = R.int(TG.CONFIG.v10.listingLife[0], TG.CONFIG.v10.listingLife[1]);
    const gone = g.re.listings.filter((l) => g.month - l.listed >= l.life).length;
    g.re.listings = g.re.listings.filter((l) => g.month - l.listed < l.life);
    RE.refill(g, Math.max(gone, rc.listingCount - g.re.listings.length));
    while (g.re.listings.length > 20) g.re.listings.shift();
    RE.ensureStarter(g);
  };
  RE.holdingMonth = (g, h, X) => {
    const { C, rc, w, mgr, earn, spend, overSelf } = X; const k = rc.kinds[h.kind];
    RE.ensureUnits(h);
    if (X.mgrPart) spend(X.mgrPart, 'Property manager');
    if (X.handyPart) spend(X.handyPart, 'Handyman retainer');
    // neighborhood & condition
    h.trend = U.clamp(h.trend + R.normal(0, 0.08), -1, 1);
    h.nb = U.clamp(h.nb * (1 + h.trend * rc.neighborhoodShift / 6), 0.5, 2);
    const decay = rc.conditionDecay * (h.upkeep === 'low' ? 1.8 : h.upkeep === 'high' ? 0.4 : 1);
    h.cond = U.clamp(h.cond - decay * R.range(0.5, 1.5) - 0.6 * h.issues.length / Math.sqrt(Math.max(1, h.units || 1)), 0, 100); // open repairs wear the building faster
    const v = RE.value(g, h);
    spend(v * rc.propertyTax / 12 * h.taxMult, 'Real estate property tax');
    spend(v * rc.upkeepPct * (h.upkeep === 'low' ? 0.4 : h.upkeep === 'high' ? 2.2 : 1), 'Real estate upkeep');
    if (h.upkeep === 'high') h.cond = U.clamp(h.cond + 0.4, 0, 100);
    if (h.insured) spend(v * rc.insurancePct, 'Real estate insurance');
    if (R.chance(rc.taxHikeChance)) { h.taxMult *= 1.2; TG.rep.event(g, null, 'bad', `Property tax hike on ${h.name} (+20%)`, 'Local tax reassessment'); }
    if (h.flip) { RE.flipMonth(g, h, spend); return; }
    if (h.dev) { RE.devMonth(g, h, spend); return; }
    if (h.mode === 'sale') {
      const pChance = rc.flip.saleChanceBase * Math.pow(w.econ, 2) * Math.pow(h.ask / Math.max(1, RE.value(g, h)), -4) * (w.baseRate > 0.06 ? 0.7 : 1);
      if (R.chance(U.clamp(pChance, 0.01, 0.9))) { const sold = RE.sell(g, h.id); TG.rep.event(g, null, 'good', `Sold ${h.name} for ${U.money(sold)} (after fees)`, `Asking price ${U.money(h.ask)}`); }
      return;
    }
    if (!k.rentPct) return; // land
    const rentCapOn = w.rentCap > 0; const T = TC();
    // a manager pays for open repairs right away; without one they wait for you, and old ones bring city fines
    if (mgr && h.issues.length) for (const it of h.issues.slice()) { h.issues = h.issues.filter((x) => x !== it); RE.addIssue(g, h, it.unit, it.what, it.cost, it.big); }
    for (const it of h.issues) if (g.month - it.m >= 3 && R.chance(0.35)) { const f = Math.round(it.cost * 0.25 + 150 * g.world.priceIdx); spend(f, 'Code violation fines'); TG.rep.event(g, null, 'bad', `City fined you ${U.money(f)}: unfixed ${it.what} at ${h.name}`, `Open for ${g.month - it.m} months. Fix it (Money → Real estate) or hire a property manager.`); }
    if (mgr) RE.mgrFill(g, h); // with no manager, empty units stay empty until YOU run a search
    for (let i = 0; i < h.tenants.length; i++) {
      const t = h.tenants[i]; if (!t) continue;
      if (t.rel == null) t.rel = t.bad ? 0.3 : 0.72;
      if (t.evict > 0) { t.evict--; if (t.evict === 0) { h.tenants[i] = null; spend(t.rent * TC().turnover * 2, 'Unit turnover'); TG.rep.event(g, null, 'info', `Eviction completed at ${h.name}${h.units > 1 ? ' unit ' + (i + 1) : ''}`, 'Unit is empty again: run a tenant search'); } continue; }
      if (R.chance(T.lifeEvent)) { t.rel = Math.max(0.05, t.rel - T.lifeDrop); t.life = true; }
      const broken = RE.unitIssues(h, i).length + h.issues.filter((x) => x.unit == null).length;
      if (broken) t.rel = Math.max(0.05, t.rel - 0.01 * broken); // living with a broken home wears down even good tenants
      const lateP = (T.late.base + T.late.k * Math.pow(1 - t.rel, T.late.pow)) * (w.phase === 'recession' ? T.late.recession : 1) * (overSelf ? 1.3 : 1);
      const fee = mgr ? 1 - rc.managerFeePct : 1;
      const withhold = broken && R.chance(0.3) ? 0.5 : 0;
      if (R.chance(lateP)) {
        const miss = R.chance(T.late.missShare[0] + T.late.missShare[1] * (1 - t.rel));
        if (miss) { t.late++; if (t.late >= 2 && !t.evict) RE.evictCard(g, h, i); }
        else { earn(t.rent * (1 + T.lateFee) * fee * (1 - withhold), 'Rent'); t.lates = (t.lates || 0) + 1; }
      } else { earn(t.rent * fee * (1 - withhold), 'Rent'); t.late = Math.max(0, t.late - 1); }
      if (withhold) TG.rep.event(g, null, 'bad', `Tenant at ${h.name}${h.units > 1 ? ' unit ' + (i + 1) : ''} paid only half the rent`, 'They are waiting for a repair to be fixed.');
      if (mgr && R.chance(0.02) && mgr.honesty < 40) { const sk = Math.round(t.rent * 0.5); spend(sk, 'Theft losses'); }
      if (R.chance(T.damage.base + T.damage.k * Math.pow(1 - t.rel, 2))) { const c = v / Math.max(1, h.units) * R.range(rc.damageCost[0], rc.damageCost[1]) * 4; h.cond = U.clamp(h.cond - 5 / Math.max(1, h.units), 0, 100); /* v9: one unit's damage wears the building by 1/units (a 100-unit block used to drop to 0% in a year) */ RE.addIssue(g, h, i, t.rel < 0.45 ? 'damage left by a risky tenant' : 'accidental damage', c); }
      // lease end: they may leave; rent resets to YOUR asking rent (capped by rent control)
      const held = g.month - t.since;
      if (held >= t.lease && held % 12 === t.lease % 12) {
        const ask = RE.askRent(g, h, i), mr = RE.marketRent(g, h);
        const leaveP = T.leave.base + T.leave.k * (1 - t.rel) + (ask > mr * 1.08 ? T.leave.overRent * (ask / mr - 1.08) * 5 : 0) + 0.2 * Math.min(2, broken);
        if (R.chance(U.clamp(leaveP, 0, 0.95))) { h.tenants[i] = null; spend(t.rent * T.turnover, 'Unit turnover'); TG.rep.event(g, null, 'info', `A tenant moved out of ${h.name}${h.units > 1 ? ' unit ' + (i + 1) : ''}`, `Lease ended${ask > mr * 1.08 ? '; your rent is above market' : ''}${broken ? '; repairs were left unfixed' : ''}. ${mgr ? 'Your manager will find a new one.' : 'Run a tenant search to fill it.'}`); continue; }
        t.rent = rentCapOn ? Math.round(Math.min(ask, t.rent * 1.02)) : ask;
      }
    }
    // repairs & disasters (repairs go through the manager, or wait for you)
    const nUnits = Math.max(1, h.units);
    const repP = rc.repairChance * Math.sqrt(nUnits) * (1.6 - h.cond / 100) * (h.upkeep === 'low' ? 1.5 : h.upkeep === 'high' ? 0.6 : 1);
    if (R.chance(repP)) { const c = v * R.range(rc.repairCost[0], rc.repairCost[1]) / Math.sqrt(nUnits); RE.addIssue(g, h, nUnits > 1 ? R.int(0, nUnits - 1) : 0, R.pick(['water heater', 'furnace', 'roof leak', 'plumbing', 'appliances']), c); }
    if (R.chance(rc.bigRepairChance * (1.6 - h.cond / 100))) { const c = v * R.range(rc.bigRepairCost[0], rc.bigRepairCost[1]); RE.addIssue(g, h, null, R.pick(['roof replacement', 'foundation work', 'boiler replacement', 'sewer line']), c, true); }
    if (R.chance(rc.injuryChance * nUnits * (1.5 - h.cond / 100))) TG.B.lawsuit(g, null, `Tenant injury at ${h.name}`, R.range(rc.injurySuit[0], rc.injurySuit[1]) * w.priceIdx, null, `Condition ${Math.round(h.cond)}%`);
    if (R.chance(rc.disasterChance)) { const c = v * R.range(rc.disasterCost[0], rc.disasterCost[1]); const cov = h.insured ? c * C.finance.insCover : 0; spend(c - cov, 'Disaster damage'); h.cond = U.clamp(h.cond - 30, 0, 100); TG.rep.event(g, null, 'major', `${R.pick(['Fire', 'Flood', 'Storm'])} damaged ${h.name} (${U.money(c)}${h.insured ? ', insurance paid ' + U.money(cov) : ', NOT insured'})`, 'Rare disaster'); }
  };
  RE.evictCard = (g, h, i) => {
    const rc = RC(); const t = h.tenants[i];
    if (g.re.manager) { RE.evict(g, h.id, i, 'Property manager ' + g.re.manager.name); return; }
    TG.D.add(g, { kind: 'evict', reId: h.id, unit: i, title: `Tenant behind on rent at ${h.name}`, text: `A tenant is ${t.late} months behind.`, why: t.rel < 0.45 ? 'Risky tenants are far more likely to miss rent.' : 'Even good tenants fall behind sometimes, more often in a recession.',
      options: [{ id: 'evict', label: `Start eviction (${U.money(rc.evictionCost[0])}-${U.money(rc.evictionCost[1])}, ${rc.evictionMonths[0]}-${rc.evictionMonths[1]} months)` }, { id: 'wait', label: 'Wait and hope they pay' }], def: 'wait' });
  };
  RE.evict = (g, hid, i, by) => {
    const rc = RC(); const h = g.re.holdings.find((x) => x.id === hid); if (!h || !h.tenants[i]) return;
    const lawyer = g.businesses.some((b) => b.spec && b.spec.lawyer);
    const cost = Math.round(R.range(rc.evictionCost[0], rc.evictionCost[1]) * g.world.priceIdx * (lawyer ? 1 - rc.lawyerEvictionCut : 1));
    TG.F.spend(g, cost, 'Evictions'); g.re.m.cost += cost;
    h.tenants[i].evict = R.int(rc.evictionMonths[0], rc.evictionMonths[1]);
    TG.rep.decision(g, null, by, `Started an eviction at ${h.name} (${U.money(cost)})`);
  };
  RE.flipMonth = (g, h, spend) => {
    const F = RC().flip, f = h.flip, K = F.contractors[f.contractor], L = F.levels[f.level];
    const per = f.budget * 0.7 / f.months;
    spend(per, 'Renovations'); h.spent += per; f.paid += per;
    if (R.chance(K.vanish / f.months * 2)) { const lost = Math.round(f.budget * 0.25); spend(lost, 'Renovations'); h.spent += lost; f.left += 2; TG.rep.event(g, null, 'major', `Contractor disappeared with a ${U.money(lost)} deposit at ${h.name}`, `${K.label}: ${U.pct(K.vanish)} chance per job`); return; }
    if (h.hidden > 0 && R.chance(0.35)) { const c = Math.round(h.hidden * h.basePrice); const cov = Math.min(c, f.contingency); f.contingency -= cov; spend(c - cov, 'Renovations'); h.spent += c; TG.rep.event(g, null, 'bad', `Hidden problem found at ${h.name}: ${R.pick(['mold', 'foundation cracks', 'old wiring', 'rotten joists'])} (${U.money(c)})`, `${h.inspected ? 'The inspection missed it' : 'No pre-purchase inspection'}${cov ? '; contingency covered ' + U.money(cov) : ''}`); h.hidden = 0; }
    if (R.chance(K.overrun / f.months)) { const c = Math.round(f.budget * R.range(0.08, 0.25)); const cov = Math.min(c, f.contingency); f.contingency -= cov; spend(c - cov, 'Renovations'); h.spent += c; TG.rep.event(g, null, 'bad', `Renovation cost overrun at ${h.name} (${U.money(c)})`, `${K.label}; ${cov ? 'contingency covered ' + U.money(cov) : 'no contingency budget'}`); }
    if (R.chance(K.delay / f.months)) { f.left += R.int(1, 2); TG.rep.event(g, null, 'bad', `Contractor delay at ${h.name}`, `${K.label}; holding costs keep piling up`); }
    f.left--;
    if (f.left <= 0) {
      h.cond = U.clamp(h.cond + L.cond * K.quality, 0, 100);
      if (L.overNeighborhood && h.grade !== 'A') h.over = true;
      h.base *= 1 + L.value * K.quality * 0.25;
      h.flip = null; h.mode = 'hold'; h.flipped = true;
      TG.rep.event(g, null, 'good', `Renovation finished at ${h.name}: now worth about ${U.money(RE.value(g, h))}`, `${L.label} by ${K.label.toLowerCase()}${h.over ? '; over-renovated for the neighborhood' : ''}. List it for sale or rent it out.`);
    }
  };
  RE.devMonth = (g, h, spend) => {
    const D = RC().develop, d = h.dev;
    if (d.stage === 'permit') {
      if (R.chance(D.stallChance)) { d.left += R.int(2, 6); TG.rep.event(g, null, 'bad', `Zoning approval for ${h.name} stalled (city politics)`, 'Big developments can stall for years'); }
      if (--d.left <= 0) { d.stage = 'build'; d.left = d.buildMonths; TG.rep.event(g, null, 'good', `Permits approved for ${h.name}: construction starts (${d.units} units)`, 'Permit stage complete'); }
      return;
    }
    let per = d.cost / d.buildMonths;
    if (R.chance(D.overrun / d.buildMonths * 2)) { const x = R.range(D.overrunPct[0], D.overrunPct[1]); per *= 1 + x * 3; TG.rep.event(g, null, 'bad', `Development cost overrun at ${h.name}`, 'Construction costs and delays'); }
    spend(per, 'Development construction'); d.paid += per;
    if (--d.left <= 0) {
      h.kind = d.units >= 20 ? 'apartment' : 'smallapt'; h.units = d.units; h.cond = 95; h.age = 0; h.dev = null; h.mode = 'rent';
      h.basePrice = d.cost * 1.25; h.base = (h.base * g.world.housing * h.nb * condF(h.cond) + d.cost * 1.25) / (g.world.housing * h.nb * condF(h.cond));
      h.housingAtBuy = g.world.housing; h.tenants = Array(d.units).fill(null); h.searches = {}; h.issues = [];
      TG.rep.event(g, null, 'good', `Development finished: ${h.name} now has ${d.units} units`, `Total build cost ${U.money(d.paid)}`);
    }
  };
  TG.RE = RE;
})();
