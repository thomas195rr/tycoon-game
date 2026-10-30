/* pricing.js - v2: live market prices with player-set sale prices (TG.P) and supplies/stock (TG.ST).
   Price effects are deliberately steep above market so a huge price is never the winning move. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const P = {};
  const cfg = () => TG.CONFIG.pricing;
  // the good a business sells (farm depends on enterprise)
  P.good = (b) => {
    const d = TG.CONFIG.businesses[b.type];
    if (b.farm) return TG.CONFIG.farmGoods[b.farm.ent] || TG.CONFIG.farmGoods.crops;
    return d.good || null;
  };
  // market price per unit right now (moves with economy, trends, competitors and everyone's supply incl. yours)
  P.market = (g, b) => {
    const gd = P.good(b); if (!gd || !g.markets[gd.market]) return 0;
    let p = TG.W.price(g, gd.market, 0);
    if (gd.base) p = p / TG.CONFIG.markets[gd.market].base * gd.base; // e.g. tech ARPU vs software index
    return p;
  };
  P.hasPrice = (b) => !!P.good(b) && !b.proj && !b.fr;
  // the player's price (null = follow market)
  P.ask = (g, b) => (b.ask != null && b.ask > 0 ? b.ask : P.market(g, b));
  P.ratio = (g, b) => {
    if (b.ask == null || !(b.ask > 0)) return 1;
    const m = P.market(g, b); if (!(m > 0)) return 1;
    return U.clamp(b.ask / m, cfg().minRatio, cfg().maxRatio);
  };
  // how many customers you keep at price ratio r (service-type goods)
  P.demandF = (r) => {
    const c = cfg();
    if (r <= 1) return Math.min(c.maxBoost, Math.pow(r, -c.elasticDown));
    let f = Math.pow(r, -c.elasticUp);
    if (r > c.collapseAt) f *= Math.exp(-c.collapseK * (r - c.collapseAt));
    return f;
  };
  // share of what you offer that buyers take at your ask (commodities: many other sellers)
  P.sellF = (r) => (r <= 1 ? 1 : Math.pow(r, -cfg().commodityUp) * (r > cfg().collapseAt ? Math.exp(-cfg().collapseK * (r - cfg().collapseAt)) : 1));
  // reputation target shift from pricing fairness
  P.fair = (r) => {
    const c = cfg();
    if (r > 1 + c.fairFreeBand) return -(r - 1 - c.fairFreeBand) * c.fairUp;
    if (r < 1 - c.fairFreeBand) return Math.min(c.fairDownMax, (1 - c.fairFreeBand - r) * c.fairDown);
    return 0;
  };
  P.set = (g, b, price) => {
    if (price == null || price === '' || !(Number(price) > 0)) { b.ask = null; return { ok: true, follow: true }; }
    const m = P.market(g, b); const p = Number(price);
    const lo = m * cfg().minRatio, hi = m * cfg().maxRatio;
    b.ask = Math.round(U.clamp(p, lo, hi) * 100) / 100;
    return { ok: true, price: b.ask };
  };
  P.label = (r) => (r > 1.25 ? 'way over market' : r > 1.05 ? 'over market' : r < 0.8 ? 'way under market' : r < 0.95 ? 'under market' : 'at market');
  P.tone = (r) => (r > 1.25 || r < 0.75 ? 'r' : r > 1.08 || r < 0.92 ? 'y' : 'g');
  TG.PR = P;

  // ================= SUPPLIES / STOCK =================
  const ST = {};
  ST.def = (b) => TG.CONFIG.businesses[b.type].supply || null;
  ST.unitCost = (g, b) => {
    const d = TG.CONFIG.businesses[b.type], s = ST.def(b); if (!s) return 0;
    let c;
    if (s.unitCostFrom === 'materialCost') c = d.factory.materialCost;
    else if (s.unitCostFrom === 'fuel') return d.freight.fuelPerLoad * (b.hedge && b.hedge.until > g.month ? b.hedge.idx : g.world.fuel) * g.world.priceIdx;
    else c = d.svc.cogs * d.svc.ticket;
    if (g.world.shortage[d.cat]) c *= 1.15;
    if (d.svc && TG.B.owner(g, b)) c *= Math.max(0.5, 1 - TG.CONFIG.owner.operatedCogsCut / d.svc.cogs);
    if (d.factory && b.fixes && b.fixes.bulk && b.fixes.bulk.until > g.month) c *= 0.85;
    c *= 1 - TG.S.perk(b, 'supplyCut');
    return c * g.world.priceIdx;
  };
  ST.cap = (b) => {
    const s = ST.def(b); if (!s) return 0;
    const d = TG.CONFIG.businesses[b.type];
    let base = s.baseStore || 0;
    if (s.perSqft) base += b.sqft * s.perSqft;
    else if (s.perTruck) base += s.perTruck * b.equip.filter((x) => x.type === 'truck' && x.broken !== 'destroyed').length;
    else if (d.svc) {
      // built-in storage (shelves, the truck's own fridge...) holds about 3/4 of what your machines can serve in a month
      const pools = TG.E.pools(b); let eq = Infinity; for (const p of pools) eq = Math.min(eq, TG.E.capacity(b, p.pool));
      if (!pools.length) eq = 0; const sp = d.svc.mobile ? Infinity : b.sqft * d.svc.perSpace;
      base = Math.max(base, 0.75 * Math.min(eq, sp));
    }
    let add = 0;
    for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (ed && ed.store && !it.broken) add += ed.store; }
    return Math.round(base + add);
  };
  ST.ensure = (b) => { if (ST.def(b) && !b.stock) b.stock = { qty: 0, auto: true, inM: 0, usedM: 0, spoilM: 0, wasteM: 0, lots: [] }; const st = b.stock; if (st && !st.lots) st.lots = st.qty > 0 ? [{ a: 0, q: st.qty }] : []; return st; };
  // stock is kept in lots by age (months) so you can see fresh vs old; oldest are used / sold / spoil first
  const takeOld = (st, n) => { let left = n; st.lots.sort((x, y) => y.a - x.a); for (const l of st.lots) { const t = Math.min(l.q, left); l.q -= t; left -= t; if (left <= 0) break; } st.lots = st.lots.filter((l) => l.q > 0.01); };
  ST.shelf = (b) => { const s = ST.def(b); return (s && s.shelf) || 999; };
  ST.ages = (b) => { const st = ST.ensure(b); if (!st) return []; const sh = ST.shelf(b); const out = { fresh: 0, aging: 0, old: 0 }; for (const l of st.lots) { if (l.a >= sh * 0.75 && sh < 999) out.old += l.q; else if (l.a >= 1) out.aging += l.q; else out.fresh += l.q; } return out; };
  // buy supplies; premium = extra % paid (staff ordering without a manager); returns qty bought
  ST.buy = (g, b, qty, premium, label) => {
    const st = ST.ensure(b); if (!st) return 0;
    const room = Math.max(0, ST.cap(b) - st.qty);
    qty = Math.max(0, Math.min(Math.round(qty), room));
    const unit = ST.unitCost(g, b) * (1 + (premium || 0));
    if (qty * unit > Math.max(0, g.cash)) qty = Math.max(0, Math.floor(Math.max(0, g.cash) / unit));
    if (qty <= 0) return 0;
    TG.F.spend(g, Math.round(qty * unit), label || ST.def(b).costLabel || 'Supplies & cost of sales', b.id);
    st.qty += qty; st.inM = (st.inM || 0) + qty; const l0 = st.lots.find((l) => l.a === 0); if (l0) l0.q += qty; else st.lots.push({ a: 0, q: qty });
    return qty;
  };
  // sell leftover supplies back (half price)
  ST.sell = (g, b, qty) => {
    const st = ST.ensure(b); if (!st) return 0; qty = Math.max(0, Math.min(Math.round(qty), Math.floor(st.qty)));
    if (!qty) return 0;
    const v = Math.round(qty * ST.unitCost(g, b) * TG.CONFIG.supply.sellBack);
    st.qty -= qty; takeOld(st, qty); TG.F.earn(g, v, 'Asset sales', b.id, true); return v;
  };
  // monthly restock before serving. need = units expected to be used this month.
  ST.restock = (g, b, need) => {
    const st = ST.ensure(b); if (!st) return null;
    st.inM = 0; st.usedM = 0; st.spoilM = 0; st.wasteM = 0;
    if (!st.auto) return { by: 'off' };
    const S = TG.CONFIG.supply;
    let who = null, mult, prem = 0, out = 'ok';
    const h = TG.D.handler(g, b, 'stock');
    const own = TG.B.owner(g, b);
    if (h && !(own && h.role === 'ceo')) { out = TG.D.roll(h); who = h.label; mult = out === 'good' ? R.range(1.04, 1.1) : out === 'ok' ? R.range(0.98, 1.14) : (R.chance(0.5) ? R.range(0.75, 0.9) : R.range(1.25, 1.4)); }
    else if (own) { who = 'You'; mult = R.range(1.0, 1.1); }
    else { who = 'Staff'; mult = R.range(S.staffReorderCover[0], S.staffReorderCover[1]); prem = S.staffReorderPremium; }
    const want = Math.max(0, need * mult - st.qty);
    const got = ST.buy(g, b, want, prem);
    st.lastBy = who; st.lastOut = out; st.short = got < want - 0.5 ? (ST.cap(b) - st.qty < 1 ? 'room' : 'cash') : '';
    if (out === 'bad' && h && got > 0 && R.chance(0.4)) TG.rep.decision(g, b, h.label, mult > 1 ? `Over-ordered ${TG.CONFIG.businesses[b.type].supply.label.toLowerCase()} (${Math.round(mult * 100)}% of need)` : `Under-ordered ${TG.CONFIG.businesses[b.type].supply.label.toLowerCase()} (${Math.round(mult * 100)}% of need)`, 'bad');
    return { by: who, got, prem };
  };
  // use stock; returns units actually used
  ST.use = (b, n) => { const st = b.stock; if (!st) return n; ST.ensure(b); const u = Math.min(st.qty, Math.max(0, n)); st.qty -= u; st.usedM += u; takeOld(st, u); return u; };
  // end of month: a share of leftovers spoils (oldest first), everything ages a month, anything past shelf life is thrown out
  ST.spoil = (b) => {
    const st = b.stock, s = ST.def(b); if (!st || !s) return 0; ST.ensure(b);
    let x = st.qty * s.spoil; takeOld(st, x);
    for (const l of st.lots) l.a++;
    const sh = ST.shelf(b); let exp = 0; for (const l of st.lots) if (l.a > sh) { exp += l.q; l.q = 0; }
    st.lots = st.lots.filter((l) => l.q > 0.01); x += exp; st.expM = exp;
    st.qty = Math.max(0, st.qty - x); st.spoilM = x; return x;
  };
  ST.value = (g, b) => (b.stock ? b.stock.qty * ST.unitCost(g, b) * 0.8 : 0);
  // cheapest storage item per unit of space
  ST.bestStore = (b) => TG.CONFIG.businesses[b.type].equip.filter((x) => x.store).sort((x, y) => x.price / x.store - y.price / y.store)[0] || null;
  // buy enough storage to hold `need` units; returns count bought
  ST.addStorage = (g, b, need, tier) => {
    const it = ST.bestStore(b); if (!it) return 0; let n = 0;
    while (ST.cap(b) < need && n < 20) { const x = TG.E.buy(g, b, it.id, tier || 'standard'); if (!x) break; n++; }
    return n;
  };
  TG.ST = ST;

  // ================= FLOW (this month / next month) =================
  // rows: {i: icon, t: label, v: value, u: unit, c: 'g'|'y'|'r'|'' , why}
  const FL = {};
  FL.start = (b) => { b.flowNew = { rows: [], next: [] }; return b.flowNew; };
  FL.row = (b, i, t, v, u, c, why) => { if (!b.flowNew) FL.start(b); b.flowNew.rows.push({ i, t, v: Math.round(v), u: u || '', c: c || '', why: why || '' }); };
  FL.next = (b, i, t, v, u, c, why) => { if (!b.flowNew) FL.start(b); b.flowNew.next.push({ i, t, v: Math.round(v), u: u || '', c: c || '', why: why || '' }); };
  FL.commit = (g, b) => { if (b.flowNew) { b.flow = Object.assign({ m: g.month }, b.flowNew); b.flowNew = null; } };
  TG.FL = FL;
})();
