/* property.js - property market: listings, suitability per business (a guide only), pros/cons, value, buy/lease/sell. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const P = {};
  const STREETS = ['Oak', 'Main', 'Mill', 'River', 'Cedar', 'Station', 'Market', 'Lake', 'Hill', 'Church', 'Ridge', 'Elm', 'Harbor', 'Quarry', 'Orchard', 'Prairie', 'Canyon', 'Pine', 'Willow', 'Bridge'];
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  P.gen = (g, opts) => {
    const C = TG.CONFIG; opts = opts || {};
    const kindId = opts.kind || R.weighted({ storefront: 5, office: 3, lot: 3, warehouse: 2.5, farmland: 3.5, ranch: 1.5, hillside: 1.5, hotelbldg: 1, medical: 1 });
    const k = C.propertyKinds[kindId];
    const loc = opts.loc && k.locs.indexOf(opts.loc) >= 0 ? opts.loc : R.pick(k.locs);
    const L = C.locations[loc];
    const region = opts.region || R.pick(Object.keys(C.regions));
    let landType = 'urban';
    if (kindId === 'farmland') landType = R.weighted({ flat: 0.35, floodplain: 0.15, frostvalley: 0.15, dry: 0.15, grassland: 0.2 });
    else if (kindId === 'ranch') landType = R.weighted({ grassland: 0.55, dry: 0.45 });
    else if (kindId === 'hillside') landType = 'hillside';
    else if (loc === 'rural' || loc === 'remote') landType = R.weighted({ dry: 0.4, grassland: 0.4, urban: 0.2 });
    if (opts.landType) landType = opts.landType;
    const lt = C.landTypes[landType];
    const sizeT = Math.pow(R.next(), 1.6);
    const sqft = Math.round(U.lerp(k.sqft[0], k.sqft[1], opts.big ? R.range(0.5, 1) : sizeT) / 10) * 10;
    let acres = U.lerp(k.acres[0], k.acres[1], opts.big ? R.range(0.5, 1) : Math.pow(R.next(), 1.5));
    acres = acres >= 10 ? Math.round(acres) : Math.round(acres * 100) / 100;
    const soil = R.range(lt.soil[0], lt.soil[1]), water = R.range(lt.water[0], lt.water[1]);
    const roadR = { city: [0.85, 1], suburb: [0.7, 0.95], town: [0.5, 0.85], rural: [0.25, 0.7], remote: [0.05, 0.35] }[loc];
    const road = R.range(roadR[0], roadR[1]);
    const cl = C.regions[region].climate;
    const climate = U.clamp(1 - (cl.drought - 0.6) * 0.25 - (cl.frost * lt.frost - 0.6) * 0.25 - lt.flood * 3 - (landType === 'dry' ? 0.15 : 0), 0, 1);
    const cond = R.range(0.4, 1);
    const farmKind = kindId === 'farmland' || kindId === 'ranch' || kindId === 'hillside';
    const orchard = kindId === 'hillside' && R.chance(0.35);
    let price = sqft * L.pps * (0.6 + 0.6 * cond) + acres * L.ppa * (farmKind ? 0.75 + 0.5 * soil : 1) + (orchard ? acres * 1500 : 0);
    price *= C.regions[region].price * R.range(0.85, 1.15) * (g.world ? g.world.housing : 1);
    price = Math.round(price / 1000) * 1000;
    const p = {
      id: U.uid('p'), kind: kindId, loc, region, landType, sqft, acres, soil, water, road, climate, cond, orchard,
      traffic: R.range(L.traffic[0], L.traffic[1]), labor: R.range(L.labor[0], L.labor[1]),
      price, tax: L.tax * R.range(0.8, 1.25), listed: g.month || 0,
      name: `${R.int(10, 9800)} ${R.pick(STREETS)} ${R.pick(['Rd', 'St', 'Ave', 'Ln', 'Way', 'Pike'])}`,
    };
    return p;
  };

  // which property kinds / locations fit a business best (for targeted listing generation)
  P.idealFor = (type) => {
    const d = TG.CONFIG.businesses[type];
    let kind = 'storefront';
    if (type === 'farm') kind = R.pick(['farmland', 'farmland', 'ranch', 'hillside']);
    else if (type === 'hotel') kind = 'hotelbldg';
    else if (type === 'clinic') kind = 'medical';
    else if (type === 'factory' || type === 'brand') kind = 'warehouse';
    else if (type === 'freight' || type === 'construction') kind = 'lot';
    else if (type === 'law' || type === 'tech' || type === 'franchise') kind = 'office';
    else if (d.space.ideal >= 4000) kind = R.pick(['warehouse', 'storefront', 'lot']);
    else if (d.svc && d.svc.mobile) kind = R.pick(['lot', 'storefront']);
    const locs = Object.keys(d.locPref).sort((a, b) => d.locPref[b] - d.locPref[a]);
    const allowed = TG.CONFIG.propertyKinds[kind].locs;
    const loc = locs.find((l) => allowed.indexOf(l) >= 0 && R.chance(0.7)) || locs.find((l) => allowed.indexOf(l) >= 0);
    return { kind, loc };
  };

  P.spaceFit = (p, d) => {
    const v = d.space.unit === 'acres' ? p.acres : p.sqft;
    const { min, ideal } = d.space;
    if (v < min) return 0.15 * v / min;
    if (v <= ideal) return 0.6 + 0.4 * (v - min) / Math.max(1, ideal - min);
    if (v <= ideal * 4) return 1 - 0.3 * (v - ideal) / (ideal * 3);
    return 0.6;
  };

  // factor scores 0..1 for a property & business
  P.factors = (p, type) => {
    const d = TG.CONFIG.businesses[type];
    const f = { traffic: p.traffic, labor: p.labor, road: p.road, soil: p.soil, water: p.water, climate: p.climate, space: P.spaceFit(p, d), loc: d.locPref[p.loc] };
    if (type === 'farm') {
      const ents = d.farm.enterprises; let best = 0;
      for (const k in ents) if (ents[k].best === p.landType) best = 0.12;
      f.soil = U.clamp(p.soil + best, 0, 1);
      if (p.landType === 'dry') f.water = Math.min(f.water, 0.3);
    }
    return f;
  };
  P.suit = (p, type) => {
    const d = TG.CONFIG.businesses[type];
    const f = P.factors(p, type); let s = 0, tot = 0;
    for (const k in d.site) { s += d.site[k] * (f[k] == null ? 0.5 : f[k]); tot += d.site[k]; }
    s = s / tot;
    if (f.space < 0.15) s *= 0.5; // far too small is a deal-breaker
    if (f.loc < 0.1) s *= 0.7;
    const noise = (hash(p.id + type) - 0.5) * 2 * TG.CONFIG.property.suitNoise;
    return U.clamp(s + noise, 0, 1);
  };
  P.suitLabel = (s) => { for (const [t, label, tone] of TG.CONFIG.property.suitBands) if (s >= t) return { label, tone }; return { label: 'Poor', tone: 'bad' }; };

  P.prosCons = (p, type) => {
    const C = TG.CONFIG, d = C.businesses[type], f = P.factors(p, type);
    const pros = [], cons = [];
    const w = d.site;
    const licensed = Object.values(d.roles).some((r) => r.licensed);
    if ((w.traffic || 0) >= 0.1) { if (f.traffic >= 0.7) pros.push('Busy area: lots of passing customers'); else if (f.traffic <= 0.3) cons.push('Little foot traffic: few walk-in customers'); }
    if ((w.labor || 0) >= 0.1) { if (f.labor >= 0.7) pros.push('Large skilled labor pool: easier hiring'); else if (f.labor <= 0.35) cons.push(licensed ? 'Tiny labor pool: licensed pros rarely want to move here' : 'Small labor pool: harder to hire and keep staff'); }
    if ((w.road || 0) >= 0.1) { if (f.road >= 0.8) pros.push('Close to highways'); else if (f.road <= 0.4) cons.push('Poor road access: slower routes, more fuel and wear'); }
    if ((w.soil || 0) >= 0.1) { if (f.soil >= 0.75) pros.push('Rich soil raises full-harvest odds'); else if (f.soil <= 0.45) cons.push('Poor soil lowers crop yields'); }
    if ((w.water || 0) >= 0.1) { if (f.water >= 0.75) pros.push('Reliable water (wells / creek)'); else if (f.water <= 0.35) cons.push('Little water: high drought risk unless irrigated'); }
    if ((w.climate || 0) >= 0.1) { if (f.climate >= 0.75) pros.push('Mild climate'); else if (f.climate <= 0.45) cons.push('Harsh climate: frost or drought prone'); }
    if (f.space < 0.15) cons.push(`Far too small for a ${d.name.toLowerCase()} (${d.space.unit === 'acres' ? p.acres + ' acres' : p.sqft.toLocaleString() + ' sq ft'})`);
    else if (f.space < 0.6) cons.push('Smaller than ideal: caps how big this can get');
    else if (f.space > 0.95) pros.push('Good size for the business');
    else if ((d.space.unit === 'acres' ? p.acres : p.sqft) > d.space.ideal * 4) cons.push('Much more space than needed: you pay tax on unused space');
    else if ((d.space.unit === 'acres' ? p.acres : p.sqft) > d.space.ideal) pros.push('Room to expand later');
    if (f.loc >= 0.85) pros.push(`${C.locations[p.loc].label} location suits a ${d.name.toLowerCase()}`);
    else if (f.loc <= 0.3) cons.push(`${C.locations[p.loc].label} location is a poor fit for a ${d.name.toLowerCase()}`);
    if (type === 'farm') {
      if (p.landType === 'floodplain') { pros.push('Flood plain soil is excellent'); cons.push('Real chance of losing a season to flooding'); }
      if (p.landType === 'frostvalley') cons.push('Frost-prone valley: early frost can wipe out a harvest');
      if (p.landType === 'hillside') pros.push('Hillside drainage: good for orchards, less so for field crops');
      if (p.landType === 'grassland') pros.push('Grassland: healthy herd and low feed costs for cattle');
      if (p.landType === 'dry') cons.push('Dry land: ranching at best without irrigation');
      if (p.orchard) pros.push('Mature orchard already planted (no 30-month wait)');
      if (p.loc === 'remote') cons.push('Remote: seasonal workers are hard to find');
    }
    if (p.cond < 0.55) cons.push('Building needs work (higher upkeep)');
    if (p.tax > C.locations[p.loc].tax * 1.12) cons.push('High local tax rate');
    else if (p.tax < C.locations[p.loc].tax * 0.9) pros.push('Low local tax rate');
    return { pros, cons };
  };

  P.value = (g, p) => Math.round((p.baseValue || p.price) * (g.world.housing / (p.housingAtBuy || 1)) * (p.improve || 1));
  P.monthlyTax = (g, p) => Math.round(P.value(g, p) * p.tax / 12);
  P.leaseRent = (g, p) => { const C = TG.CONFIG.property; return Math.round(p.price * (C.landLeaseKinds.includes(p.kind) ? C.landLeaseRatePerMonth : C.leaseRatePerMonth)); };

  P.initListings = (g) => {
    const C = TG.CONFIG; g.listings = [];
    for (const type in C.businesses) for (let i = 0; i < 2; i++) { const id = P.idealFor(type); g.listings.push(P.gen(g, id)); }
    while (g.listings.length < C.start.listings) g.listings.push(P.gen(g));
    // make sure some cheap starter listings exist
    for (let i = 0; i < 3; i++) g.listings.push(P.gen(g, { kind: 'lot', loc: R.pick(['town', 'rural']) }));
  };
  P.month = (g) => {
    const C = TG.CONFIG;
    g.listings = g.listings.filter((p) => g.month - p.listed < 14 || R.chance(0.5));
    for (let i = 0; i < C.start.newListingsPerMonth; i++) {
      const t = R.pick(Object.keys(C.businesses));
      g.listings.push(R.chance(0.5) ? P.gen(g, P.idealFor(t)) : P.gen(g));
    }
    if (R.chance(0.08)) g.listings.push(P.gen(g, { kind: R.pick(['farmland', 'warehouse', 'hotelbldg']), big: true }));
    while (g.listings.length > C.start.maxListings) g.listings.shift();
  };

  // Buy a listing: mode 'cash' | 'mortgage' | 'lease'
  P.acquire = (g, listingId, mode) => {
    const C = TG.CONFIG; const p = g.listings.find((x) => x.id === listingId);
    if (!p) return { ok: false, msg: 'Listing is gone.' };
    const fees = Math.round(p.price * C.property.buyCostPct);
    if (mode === 'lease') {
      const rent = P.leaseRent(g, p), dep = rent * C.property.leaseDeposit;
      if (g.cash < dep + rent) return { ok: false, msg: `Need ${U.money(dep + rent)} for deposit and first month.` };
      TG.F.spend(g, dep + rent, 'Lease deposits', null, true);
      p.leased = true; p.rent = rent; p.deposit = dep;
    } else if (mode === 'mortgage') {
      const down = Math.round(p.price * C.property.mortgageDown);
      if (g.cash < down + fees) return { ok: false, msg: `Need ${U.money(down + fees)} for the down payment and fees.` };
      const ok = TG.CREDIT.apply(g, 'mortgage', p.price - down, { collateral: { kind: 'property', id: p.id }, label: 'Mortgage: ' + p.name, noCash: true, ltv: (p.price - down) / p.price, asset: p.price });
      if (!ok.ok) return { ok: false, msg: ok.msg };
      TG.F.spend(g, down + fees, 'Property purchases', null, true); const loan = ok.loan;
      p.owned = true; p.mortgageId = loan.id;
    } else {
      if (g.cash < p.price + fees) return { ok: false, msg: `Need ${U.money(p.price + fees)}.` };
      TG.F.spend(g, p.price + fees, 'Property purchases', null, true);
      p.owned = true;
    }
    p.baseValue = p.price; p.housingAtBuy = g.world.housing; p.bought = g.month;
    g.listings = g.listings.filter((x) => x.id !== listingId);
    g.properties.push(p);
    return { ok: true, prop: p };
  };

  P.sell = (g, propId) => {
    const C = TG.CONFIG; const p = g.properties.find((x) => x.id === propId); if (!p) return 0;
    if (p.bizId) return -1;
    if (p.leased) { g.properties = g.properties.filter((x) => x !== p); TG.F.earn(g, p.deposit || 0, 'Lease deposits returned', null, true); return 0; }
    const v = Math.round(P.value(g, p) * (1 - C.property.sellCostPct));
    TG.F.earn(g, v, 'Property sales', null, true);
    if (p.mortgageId) TG.F.payoff(g, p.mortgageId, true);
    g.properties = g.properties.filter((x) => x !== p);
    return v;
  };
  P.locLabel = (p) => `${TG.CONFIG.locations[p.loc].label}, ${TG.CONFIG.regions[p.region].label}`;
  P.sizeLabel = (p) => (p.acres >= 5 ? `${p.acres.toLocaleString()} acres` : `${p.sqft.toLocaleString()} sq ft${p.acres >= 0.3 ? ' on ' + p.acres + ' ac' : ''}`);
  TG.P = P;
})();
