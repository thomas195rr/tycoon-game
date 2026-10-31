/* ledger.js - v7: where every dollar went, and WHO it belongs to.
   Every cash move (F.earn / F.spend) is recorded against an owner: a business ('b:id'), a rental property ('r:id'),
   a business building not in use ('p:id'), shared real estate costs ('rePort'), investments ('inv'), crime ('crime')
   or you personally ('you': income tax, personal loans, the credit line, CEO pay...).
   The monthly money report is built from this, so the lines always add up to your real cash change. */
(function () {
  const TG = globalThis.TG; const U = TG.U;
  const LG = {};
  // ---------- owners ----------
  LG.resolve = (g, key) => {
    if (key && key.slice(0, 2) === 'p:') { const p = g.properties.find((x) => x.id === key.slice(2)); if (p && p.bizId) return 'b:' + p.bizId; }
    return key || 'you';
  };
  LG.nameOf = (g, key) => {
    const id = key.slice(2);
    if (key.slice(0, 2) === 'b:') { const b = g.businesses.find((x) => x.id === id); if (b) return { n: b.name, i: TG.CONFIG.businesses[b.type].icon, grp: 'biz' }; return null; }
    if (key.slice(0, 2) === 'r:') { const h = (g.re.holdings || []).find((x) => x.id === id) || (g.re.listings || []).find((x) => x.id === id); if (h) return { n: h.name, i: TG.CONFIG.realEstate.kinds[h.kind].icon, grp: 're' }; return null; }
    if (key.slice(0, 2) === 'p:') { const p = g.properties.find((x) => x.id === id) || g.listings.find((x) => x.id === id); if (p) return { n: p.name || 'Building', i: '🏢', grp: 'prop' }; return null; }
    if (key === 'rePort') return { n: 'All rentals (shared costs)', i: '🏘️', grp: 're' };
    if (key === 'inv') return { n: 'Investments & bets', i: '📈', grp: 'inv' };
    if (key === 'crime') return { n: 'Crime', i: '🕶️', grp: 'crime' };
    return { n: 'You (personal & company costs)', i: '👤', grp: 'you' };
  };
  LG.setName = (g, key, nm) => { const a = g.acc || (g.acc = TG.F.newAcc()); a.names = a.names || {}; a.names[key] = nm; };
  // who owns a loan's payments
  LG.loanOwner = (g, l) => {
    if (l.bizId && g.businesses.some((b) => b.id === l.bizId)) return 'b:' + l.bizId;
    const c = l.collateral;
    if (c && c.kind === 'property') {
      if ((g.re.holdings || []).some((h) => h.id === c.id)) return 'r:' + c.id;
      const p = g.properties.find((x) => x.id === c.id); if (p) return LG.resolve(g, 'p:' + p.id);
    }
    if (c && c.kind === 'equip') { const b = g.businesses.find((x) => x.equip.some((e) => e.id === c.id)); if (b) return 'b:' + b.id; }
    return 'you';
  };
  // record one cash move (delta > 0 = money in)
  LG.rec = (g, delta, label, bizId) => {
    if (!delta || !Number.isFinite(delta)) return;
    const a = g.acc; if (!a) return; a.led = a.led || {}; a.names = a.names || {};
    const k = LG.resolve(g, bizId ? 'b:' + bizId : g._own);
    const o = a.led[k] || (a.led[k] = { i: {}, o: {} });
    if (delta > 0) o.i[label] = (o.i[label] || 0) + delta; else o.o[label] = (o.o[label] || 0) - delta;
    if (!a.names[k]) { const nm = LG.nameOf(g, k); if (nm) a.names[k] = nm; }
  };
  LG.within = (g, key, fn) => { const prev = g._own; g._own = key; try { return fn(); } finally { g._own = prev; } };
  LG.net = (led) => { let t = 0; for (const k in led || {}) { for (const l in led[k].i) t += led[k].i[l]; for (const l in led[k].o) t -= led[k].o[l]; } return t; };
  // run a module's functions "on behalf of" an owner, so the money they move lands on the right line
  const wrap = (obj, keyFn) => {
    for (const name of Object.keys(obj)) {
      const f = obj[name]; if (typeof f !== 'function' || f.__lg) continue;
      const w = function (g, a1) {
        if (!g || typeof g !== 'object' || !Array.isArray(g.businesses)) return f.apply(this, arguments);
        const key = keyFn(name, g, a1); if (!key) return f.apply(this, arguments);
        const prev = g._own; g._own = key; try { return f.apply(this, arguments); } finally { g._own = prev; }
      };
      w.__lg = true; obj[name] = w;
    }
  };
  const idOf = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' && typeof x.id === 'string' ? x.id : null);
  LG.install = () => {
    if (TG.RE) wrap(TG.RE, (n, g, a) => { if (n === 'month') return 'rePort'; const id = idOf(a); return id ? 'r:' + id : null; });
    if (TG.I) wrap(TG.I, () => 'inv');
    if (TG.CR) wrap(TG.CR, () => 'crime');
    if (TG.P) wrap(TG.P, (n, g, a) => { const id = idOf(a); return id && (g.properties.some((p) => p.id === id) || g.listings.some((p) => p.id === id)) ? LG.resolve(g, 'p:' + id) : null; });
  };

  // ---------- categories (Thomas's layout: money in first, then expense groups with subtotals) ----------
  LG.IN = [
    ['sales', '🛒', 'Sales'], ['rent', '🔑', 'Rent from tenants'], ['inv', '📈', 'Investments'],
    ['borrow', '🏦', 'Borrowed money (loans, credit line, investors)'], ['sold', '🏷️', 'Things you sold (machines, buildings, businesses)'], ['other', '✨', 'Other money in'],
  ];
  LG.OUT = [
    ['loans', '🏦', 'Loans'], ['property', '🏠', 'Property'], ['wages', '👥', 'Wages'], ['product', '📦', 'Cost of product'],
    ['equip', '🛠️', 'Equipment'], ['buy', '🏗️', 'Buying property & businesses'], ['tax', '🧾', 'Taxes'], ['inv', '📈', 'Investing & bets'], ['other', '📎', 'Other'],
  ];
  const T = (re) => (l) => re.test(l);
  const IN_RULES = [
    ['rent', T(/^Rent$/)],
    ['borrow', T(/Loan proceeds|Credit line draw|Refinance cash-out|Investor funding|IPO proceeds|Fund raise/)],
    ['inv', T(/Trading gains|Gambling winnings|Investments sold|Angel exits|Angel stakes sold/)],
    ['sold', T(/Asset sales|Business sales|Fire-sale|Property sales|Real estate sales|Repossession surplus|Lease deposits returned|Buy-out payment/)],
    ['sales', T(/Revenue|sales|Subscriptions|Royalties|Franchise fees|Freight/i)],
  ];
  const OUT_RULES = [
    ['loans', T(/Loan|Credit line|Margin|Refinance fees|Late fees/)],
    ['tax', T(/Income tax|Tax audit/)],
    ['property', T(/Real estate (property tax|upkeep|insurance|repairs)|Tenant|Disaster damage|Evictions|Property manager|Handyman|Unit turnover|^Rent|Property tax|Building upkeep|Code violation/)],
    ['wages', T(/Wages|Payroll tax|Bonuses|Severance|Training|Seasonal labor|CEO salary|CEO profit share|Background checks|HR /)],
    ['product', T(/Supplies|cost of sales|Raw materials|Feed|Seed|Inventory orders|Fuel|Materials|Spray|Planting|Orchard care|Livestock|Hosting|Shipping|Storage$|Spoiled|Tolls/)],
    ['equip', T(/Equipment|Repairs|Maintenance|Inspections|Storage construction/)],
    ['buy', T(/Business setup|Property purchases|Real estate purchases|Land purchases|Land conversion|Renovations|Permits|Development|Lease deposits|Share buy-back|Pivot/)],
    ['inv', T(/Investments bought|Angel investments|Trading|Gambling|Cash moved to the street/)],
  ];
  LG.catIn = (l) => { for (const [c, f] of IN_RULES) if (f(l)) return c; return 'other'; };
  LG.catOut = (l) => { for (const [c, f] of OUT_RULES) if (f(l)) return c; return 'other'; };
  // friendlier names for a few lines that are capital, not running costs
  LG.NOTE = { 'Loan principal': 'paid down what you owe', 'Loan payoff': 'paid off early', 'Loan prepayment': 'extra payment', 'Credit line repayment': 'paid down the line', 'Loan proceeds': 'borrowed', 'Credit line draw': 'borrowed on the line', 'Equipment purchases': 'new machines', 'Property purchases': 'down payment / price', 'Real estate purchases': 'down payment / price' };

  // build the report from a ledger: totals by group, by owner, and the bottom line
  LG.summary = (g, led, names, cashStart, cashEnd) => {
    names = names || {};
    const inG = {}, outG = {}; for (const [k] of LG.IN) inG[k] = { t: 0, lines: {} }; for (const [k] of LG.OUT) outG[k] = { t: 0, lines: {} };
    const owners = []; let tin = 0, tout = 0;
    for (const k in led || {}) {
      const L = led[k]; let oi = 0, oo = 0; const og = {};
      for (const l in L.i) { const v = L.i[l]; const c = LG.catIn(l); inG[c].t += v; inG[c].lines[l] = (inG[c].lines[l] || 0) + v; oi += v; og['+' + c] = (og['+' + c] || 0) + v; }
      for (const l in L.o) { const v = L.o[l]; const c = LG.catOut(l); outG[c].t += v; outG[c].lines[l] = (outG[c].lines[l] || 0) + v; oo += v; og['-' + c] = (og['-' + c] || 0) + v; }
      tin += oi; tout += oo;
      const nm = names[k] || LG.nameOf(g, k) || { n: k.slice(0, 2) === 'b:' ? 'Closed business' : k.slice(0, 2) === 'r:' ? 'Sold property' : 'Other', i: '•', grp: k.slice(0, 2) === 'b:' ? 'biz' : k.slice(0, 2) === 'r:' ? 're' : 'you' };
      const borrowed = og['+borrow'] || 0;
      owners.push({ k, n: nm.n, i: nm.i, grp: nm.grp, in: oi, out: oo, net: oi - oo, borrowed, groups: og, lines: L });
    }
    owners.sort((a, b) => (LG.GRP_ORDER.indexOf(a.grp) - LG.GRP_ORDER.indexOf(b.grp)) || b.net - a.net);
    const net = tin - tout;
    return { inG, outG, tin, tout, net, owners, cashStart, cashEnd, diff: cashEnd - cashStart - net };
  };
  LG.GRP_ORDER = ['biz', 'prop', 're', 'inv', 'crime', 'you'];
  // add one month's ledger into a running total (skips)
  LG.add = (into, led) => { for (const k in led || {}) { const t = into[k] || (into[k] = { i: {}, o: {} }); for (const l in led[k].i) t.i[l] = (t.i[l] || 0) + led[k].i[l]; for (const l in led[k].o) t.o[l] = (t.o[l] || 0) + led[k].o[l]; } return into; };
  LG.ownerNets = (led) => { const o = {}; for (const k in led || {}) { let t = 0; for (const l in led[k].i) t += led[k].i[l]; for (const l in led[k].o) t -= led[k].o[l]; o[k] = Math.round(t); } return o; };
  TG.LG = LG;
  LG.install(); // loaded after realestate / invest / crime / property
})();
