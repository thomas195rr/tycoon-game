/* models2.js - brand (e-commerce), factory, projects (construction), tech, franchise models. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U; const M = TG.M;
  const B = () => TG.B;
  const poisson = (l) => { let k = 0, p = Math.exp(-Math.min(l, 50)), s = p; const u = R.next(); while (u > s && k < 200) { k++; p *= l / k; s += p; } return k; };

  // ============ BRAND / E-COMMERCE ============
  M.models.brand = {
    init(g, b) { b.brand = { stock: 0, stockCost: 0, incoming: [], followers: 0, lastOrders: 0, lostSales: 0 }; },
    needs() { return { equip: [{ type: 'shelving', count: 1 }], staff: [] }; },
    baseRev(g, b) { return Math.max(25000, (b.brand ? b.brand.lastOrders : 0) * 42) * g.world.priceIdx; },
    month(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses.brand, br = d.brand, s = b.brand, fo = b.fixesOn || {};
      // arrivals
      for (const inc of s.incoming.slice()) {
        if (inc.due > g.month) continue;
        s.incoming = s.incoming.filter((x) => x !== inc);
        let units = inc.units;
        const pIssue = br.factoryIssue * (b.fixes.inspect ? 0.3 : 1);
        if (R.chance(pIssue)) { const x = R.range(br.defect[0], br.defect[1]); const lost = Math.round(units * x); units -= lost; TG.rep.event(g, b, 'bad', `Factory quality issue: ${lost.toLocaleString()} of ${inc.units.toLocaleString()} items unsellable`, `${U.pct(pIssue)} chance per batch${b.fixes.inspect ? ' (inspections cut it)' : '; no factory inspections'}`); }
        s.stock += units; s.stockCost += inc.cost; s.arrivedM = (s.arrivedM || 0) + units;
        TG.rep.event(g, b, 'info', `Batch of ${units.toLocaleString()} items arrived`, `Ordered ${br.leadMonths} months ago`);
      }
      const share = TG.W.share(g, 'apparel');
      const adMgr = b.spec.ads;
      const adVisitors = b.ads.budget > 0 ? (b.ads.budget / (br.cpv * (1 + 3 * share) * g.world.priceIdx)) * (adMgr ? 1 + adMgr.skill / 150 : 1) * (b.rep < 30 ? 0.6 : 1) : 0;
      const flop = b.ads.budget > 0 && R.chance(C.reputation.adChannels[b.ads.channel].flop * (adMgr ? 0.5 : 1));
      const visitors = adVisitors * (flop ? 0.2 : 1) + b.rep * br.organicPerRep;
      if (flop) TG.rep.event(g, b, 'bad', 'Ad spend burned with almost no sales', `${C.reputation.adChannels[b.ads.channel].label} campaigns flop ${U.pct(C.reputation.adChannels[b.ads.channel].flop)} of the time${adMgr ? '' : '; no experienced ads manager'}`);
      const qualF = 0.8 + 0.4 * ctx.quality / 100;
      const dm = B().demandMult(g, b, ctx, { noAds: true });
      const r = TG.PR.ratio(g, b);
      let orders = (visitors * br.conv * qualF + s.followers * br.followerConv) * dm * (1 - share * 0.5) * TG.PR.demandF(r);
      if (R.chance(br.viral * (0.5 + b.rep / 100))) { const x = R.range(br.viralMult[0], br.viralMult[1]); orders *= x; TG.rep.event(g, b, 'good', `Went viral! Orders x${x.toFixed(1)} this month`, 'Rare viral moment'); }
      let packCap = U.sum(ctx.key, (e) => d.roles.packer.cap * M.staffEff(e)) * (fo.packerMult || 1) + (ctx.own ? 900 : 0);
      if (b.equip.some((x) => x.type === 'shelving' && !x.broken)) packCap *= 1.15;
      packCap *= 1 + TG.E.boost(b, 'staffBoost');
      packCap *= M.paceMult(b) * (1 - ctx.down);
      const sold = Math.max(0, Math.floor(Math.min(orders, s.stock, packCap)));
      const lost = Math.max(0, orders - sold);
      if (lost > 200 && lost > orders * 0.25) TG.rep.event(g, b, 'bad', `Missed ${Math.round(lost).toLocaleString()} orders`, sold >= s.stock - 1 ? 'Stock ran out' : `Fulfilment capacity ${Math.round(packCap)} orders`);
      const avgCost = s.stock > 0 ? s.stockCost / s.stock : 0;
      const price = b.ask != null ? TG.PR.ask(g, b) : TG.W.price(g, 'apparel', sold * 6);
      TG.F.earn(g, Math.round(sold * price), 'Online sales', b.id); TG.W.sell(g, 'apparel', sold);
      TG.F.book(g, Math.round(sold * avgCost), 'Cost of goods sold', b.id);
      s.stockCost -= sold * avgCost; s.stock -= sold;
      TG.F.spend(g, Math.round(sold * br.shipPerUnit * g.world.priceIdx), 'Shipping', b.id);
      const room = M.brandRoom(b);
      // out-of-season fade
      const faded = Math.floor(s.stock * br.fade); const fadeCost = s.stock > 0 ? s.stockCost * faded / s.stock : 0;
      if (faded > 0) { s.stock -= faded; s.stockCost -= fadeCost; TG.F.book(g, Math.round(fadeCost), 'Out-of-season stock', b.id); }
      const FL = TG.FL; FL.start(b); const arrived = s.arrivedM || 0; s.arrivedM = 0;
      FL.row(b, '📥', 'Arrived', arrived, 'items', arrived ? 'g' : '');
      FL.row(b, '👕', 'Sold', sold, 'items', 'g', `at ${U.money(price)} each`);
      if (lost > 0.5) FL.row(b, '🚪', 'Missed orders', lost, '', lost > orders * 0.2 ? 'r' : 'y', sold >= s.stock + sold - 1 ? 'Out of stock' : 'Packing capacity');
      if (faded > 0) FL.row(b, '🍂', 'Went out of season', faded, 'items', faded > sold * 0.3 ? 'r' : 'y', `${U.pct(br.fade, 1)} of stock fades each month`);
      FL.row(b, '📦', 'In stock', s.stock, '/' + Math.round(room), s.stock > room ? 'r' : s.stock < orders ? 'y' : 'g', s.stock > room ? 'Over storage: costs triple' : '');
      const inc = U.sum(s.incoming.filter((x) => x.due === g.month + 1), (x) => x.units);
      FL.next(b, '🧲', 'Orders expected', s.avgOrders == null ? orders : s.avgOrders * 0.7 + orders * 0.3, '', 'g');
      if (inc) FL.next(b, '🚚', 'Arriving', inc, 'items', 'g');
      FL.next(b, '🍂', 'Will fade', s.stock * br.fade, 'items', 'y');
      const storage = s.stock * br.storagePerUnit * (s.stock > room ? 3 : 1) * g.world.priceIdx;
      TG.F.spend(g, Math.round(storage), 'Storage', b.id);
      s.followers = Math.max(0, s.followers + sold * br.followerRate - s.followers * br.followerChurn);
      s.lastOrders = orders; s.lostSales = lost; s.avgOrders = s.avgOrders == null ? orders : s.avgOrders * 0.7 + orders * 0.3;
      TG.WK.add(ctx, 'staff', '📦', 'Packers', ctx.key.length + (ctx.own ? 1 : 0), packCap, sold, 'orders', [], `Each packs and ships about ${d.roles.packer.cap.toLocaleString()} orders a month. Packing stations and shelving speed them up.`);
      TG.WK.add(ctx, 'space', '🏬', 'Warehouse room', 1, M.brandRoom(b), s.stock, 'units', ['shelving', 'racking'], 'How many clothes fit. Racking adds room.');
      ctx.cap = Math.round(packCap); ctx.demand = Math.round(orders); ctx.served = sold;
      ctx.util = packCap > 0 ? orders / packCap : 1.5; ctx.busy = U.clamp(sold / Math.max(1, packCap), 0, 1.3);
      if (s.stock === 0 && !s.incoming.length) ctx.note = 'No stock and nothing on order: order a batch';
      else if (s.stock > orders * 8 && orders > 0) ctx.note = 'Warehouse full of slow-moving stock: consider a clearance sale';
    },
    inventoryValue(g, b) { return Math.round(b.brand.stockCost * 0.8 + U.sum(b.brand.incoming, (x) => x.cost) * 0.9); },
    extraRisks(g, b) { const br = TG.CONFIG.businesses.brand.brand; return [{ label: 'Next batch has a factory quality issue', p: br.factoryIssue * (b.fixes.inspect ? 0.3 : 1), why: b.fixes.inspect ? 'factory inspections' : 'no factory inspections' }]; },
  };
  M.brandRoom = (b) => b.sqft * TG.CONFIG.businesses.brand.brand.unitsPerSqft + TG.E.sumField(b, 'storeUnits');
  M.brandOrder = (g, b, units, test) => {
    const br = TG.CONFIG.businesses.brand.brand; units = Math.round(units);
    const min = test ? br.testBatch : br.minBatch;
    if (test && !b.fixes.test) return { ok: false, msg: 'Enable small test batches first.' };
    if (units < min) return { ok: false, msg: `Minimum batch is ${min}.` };
    const unit = br.unitCost * g.world.priceIdx * (test ? br.testMarkup : 1) * (1 - ((b.fixesOn && b.fixesOn.unitCostCut) || 0)) * (b.fixes.inspect ? 1.02 : 1) * Math.max(0.8, 1 - Math.log10(units / 500) * 0.06);
    const cost = Math.round(units * unit);
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Inventory orders', b.id, true);
    b.brand.incoming.push({ units, cost, due: g.month + br.leadMonths });
    return { ok: true, cost };
  };
  M.brandClearance = (g, b, pct) => {
    const s = b.brand; const units = Math.floor(s.stock * pct); if (units <= 0) return { ok: false };
    const rev = Math.round(units * TG.W.price(g, 'apparel', units) * 0.4);
    const costPart = s.stockCost * units / s.stock;
    s.stock -= units; s.stockCost -= costPart; TG.W.sell(g, 'apparel', units);
    TG.F.earn(g, rev, 'Clearance sales', b.id); TG.F.book(g, Math.round(costPart), 'Cost of goods sold', b.id); b.rep = U.clamp(b.rep - 1, 0, 100);
    return { ok: true, rev, units };
  };

  // ============ FACTORY ============
  M.models.factory = {
    init(g, b) { b.factory = { stock: 0, policy: 'hold', premium: 0 }; },
    lines(b) { return b.equip.filter((x) => x.type === 'line'); },
    maxLines(b) { return Math.max(1, Math.floor(b.sqft / TG.CONFIG.businesses.factory.factory.sqftPerLine)); },
    needs(g, b) { const n = Math.max(1, this.lines(b).length); const d = TG.CONFIG.businesses.factory; return { equip: [{ type: 'line', count: n }, { type: 'forklift', count: 1 }].concat(TG.ST.cap({ type: 'factory', sqft: b.sqft, equip: [] }) < n * d.equip[0].cap * 1.05 ? [{ type: 'rawsilo', count: Math.ceil((n * d.equip[0].cap * 1.05 - TG.ST.cap({ type: 'factory', sqft: b.sqft, equip: [] })) / 20000) }] : []), staff: [{ role: 'worker', count: Math.ceil(n * d.equip[0].cap / d.roles.worker.cap * (1 - ((b.fixesOn && b.fixesOn.workerCut) || 0))) }] }; },
    baseRev(g, b) { return Math.max(1, this.lines(b).length) * 12000 * TG.CONFIG.markets.goods.base * g.world.priceIdx; },
    month(g, b, ctx) {
      const C = TG.CONFIG, d = C.businesses.factory, fd = d.factory, f = b.factory, fo = b.fixesOn || {};
      const lineCap = TG.E.capacity(b, 'line');
      const wc = (fo.workerCut || 0);
      const workerUnits = U.sum(ctx.key, (e) => d.roles.worker.cap * M.staffEff(e)) / Math.max(0.2, 1 - wc) * (1 + TG.E.boost(b, 'staffBoost'));
      let prod = Math.max(0, Math.min(lineCap, workerUnits) * M.paceMult(b) * (1 - ctx.down));
      const bulk = b.fixes.bulk && b.fixes.bulk.until > g.month;
      if (b.fixes.bulk && !bulk) { delete b.fixes.bulk; TG.rep.event(g, b, 'info', 'Bulk supplier contract ended', 'Contract term over'); }
      // raw materials: ordered into the raw-material store, then used by the lines
      // managers slow the lines when finished stock piles up (workers still get paid)
      if (f.stock > prod * fd.maxStockMonths) { const cut = U.clamp(1 - (f.stock - prod * fd.maxStockMonths) / Math.max(1, prod * 2), 0.25, 1); prod *= cut; }
      TG.ST.ensure(b); TG.ST.restock(g, b, prod);
      const want = prod; prod = TG.ST.use(b, prod);
      if (fo.materialAdd) TG.F.spend(g, Math.round(prod * fd.materialCost * g.world.priceIdx * fo.materialAdd), 'Raw materials', b.id);
      if (g.world.shortage.home) TG.F.spend(g, Math.round(prod * fd.materialCost * g.world.priceIdx * 0.05), 'Raw materials', b.id);
      f.stock += prod;
      if (fo.rnd && R.chance(fo.rnd)) { f.premium = Math.min(0.3, f.premium + 0.04); g.markets.goods.demand12 *= 1.02; TG.rep.event(g, b, 'good', 'R&D launched a new product line (+4% price premium)', '3% monthly chance with an R&D department'); }
      const pNow = TG.W.price(g, 'goods', f.stock * 6) * (1 + f.premium) * (0.9 + 0.2 * ctx.quality / 100);
      const floor = fd.materialCost * g.world.priceIdx * 1.5;
      let sell = f.stock;
      if (f.policy === 'hold' && pNow < floor && b.ask == null) sell = Math.max(0, f.stock - prod * fd.maxStockMonths);
      sell = Math.min(sell, f.stock);
      const r = b.ask != null ? U.clamp(b.ask / Math.max(0.01, pNow), 0.3, 4) : 1;
      // business buyers switch suppliers fast: factory goods are more price-sensitive than farm commodities
      // above market, buyers only take a share of a normal month's volume (a stockpile does not create extra buyers)
      const offered = sell; if (r > 1) sell = Math.min(sell, Math.floor(Math.max(prod, lineCap * 0.5) * Math.pow(TG.PR.sellF(r), TG.CONFIG.pricing.factorySens || 1)));
      const price = b.ask != null ? b.ask : pNow;
      if (sell > 0) { TG.F.earn(g, Math.round(sell * price), 'Product sales', b.id); TG.W.sell(g, 'goods', sell); f.stock -= sell; }
      TG.F.spend(g, Math.round(f.stock * fd.storagePerUnit * g.world.priceIdx), 'Storage', b.id);
      const spoiledRaw = TG.ST.spoil(b);
      ctx.priceR = r;
      const FL = TG.FL; FL.start(b);
      FL.row(b, '📥', 'Raw materials in', b.stock.inM, 'units', 'g', 'Ordered by ' + (b.stock.lastBy || 'nobody'));
      FL.row(b, '🏭', 'Made', prod, 'units', prod < want * 0.95 ? 'y' : 'g', prod < want * 0.95 ? 'Not enough raw materials' : '');
      FL.row(b, '🛒', 'Sold', sell, 'units', 'g', `at ${U.money(price)} each`);
      if (offered - sell > 0.5) FL.row(b, '🚫', 'Buyers said no', offered - sell, 'units', 'r', 'Your price is over market');
      FL.row(b, '📦', 'Finished stock', f.stock, 'units', f.stock > prod * 3 ? 'y' : 'g', `Storage ${U.money(fd.storagePerUnit * g.world.priceIdx)}/unit/mo`);
      FL.row(b, '🪨', 'Raw left', b.stock.qty, '/' + TG.ST.cap(b), 'g');
      FL.next(b, '🏭', 'Can make', Math.min(lineCap, workerUnits), 'units', 'g');
      FL.next(b, '🏷️', 'Market price', pNow, '$', pNow < floor ? 'r' : 'g', pNow < floor ? 'Below cost-plus: oversupply' : '');
      TG.WK.add(ctx, 'eq', '🏭', 'Production lines', this.lines(b).filter((x) => !x.broken).length, lineCap, prod, 'units', ['line'], 'Each line makes about 12,000 units a month. Busy lines wear faster.');
      TG.WK.add(ctx, 'staff', '👷', 'Line workers', ctx.key.length + (ctx.own ? 1 : 0), workerUnits, prod, 'units', [], `Each runs about ${d.roles.worker.cap} units a month. A robot arm makes them faster.`);
      ctx.cap = Math.round(lineCap); ctx.served = Math.round(prod); ctx.demand = Math.round(lineCap);
      ctx.util = lineCap > 0 ? prod / lineCap : 0; ctx.busy = U.clamp(workerUnits > 0 ? lineCap / workerUnits : 1.3, 0, 1.3);
      if (lineCap === 0) ctx.note = 'All production lines are down';
      else if (workerUnits < lineCap * 0.9) ctx.note = `Short on line workers: running at ${U.pct(prod / lineCap)}`;
      if (pNow < floor) ctx.note = (ctx.note ? ctx.note + '. ' : '') + 'Market price is below cost-plus: oversupply';
    },
    inventoryValue(g, b) { return Math.round(b.factory.stock * Math.min(TG.CONFIG.businesses.factory.factory.materialCost * g.world.priceIdx * 1.3, TG.W.price(g, 'goods', b.factory.stock * 6) * 0.6)); },
    extraRisks(g, b, ctx) {
      if (b.staff.length < TG.CONFIG.staff.strikeMinStaff) return [];
      const m = U.avg(b.staff, (e) => e.morale, 60);
      return m < 45 ? [{ label: 'Union strike', p: TG.CONFIG.staff.strikeBase * (45 - m) / 10 * (b.fixes.fairwages ? 0.3 : 1), why: `average morale ${Math.round(m)}` }] : [];
    },
  };

  // ============ PROJECTS (CONSTRUCTION) ============
  M.models.projects = {
    init(g, b) { b.proj = { offers: [], active: [], done: 0, markup: 'normal', autoBid: true }; this.offers(g, b); },
    cfg() { return TG.CONFIG.businesses.construction.projects; },
    offers(g, b) {
      const P = this.cfg(); b.proj.offers = b.proj.offers.filter((o) => o.expires > g.month);
      const n = R.int(P.offers[0], P.offers[1]);
      for (let i = 0; i < n; i++) {
        const sizes = Object.keys(P.sizes).filter((k) => b.rep >= P.sizes[k].minRep || R.chance(0.15));
        const k = R.pick(sizes); const s = P.sizes[k];
        b.proj.offers.push({ id: U.uid('o'), size: k, label: `${s.label}: ${R.pick(['school', 'warehouse', 'offices', 'homes', 'retail center', 'clinic', 'apartments', 'road works', 'parking garage'])}`,
          cost: Math.round(R.range(s.value[0], s.value[1]) * g.world.priceIdx / 1000) * 1000, months: R.int(s.months[0], s.months[1]), crew: R.int(s.crew[0], s.crew[1]), heavy: s.heavy, crane: s.crane, bond: !!s.bond, expires: g.month + 2 });
      }
      if (b.proj.offers.length > 8) b.proj.offers = b.proj.offers.slice(-8);
    },
    winChance(g, b, o, markup) { const P = this.cfg(); return U.clamp(P.winChance[markup] * (0.6 + b.rep / 100) * (b.fixes.contingency ? P.contingencyWinMult : 1) * Math.pow(g.world.econ, 0.5), 0.02, 0.95); },
    needs(g, b) { const need = b && b.proj ? Math.ceil(U.sum(b.proj.active, (p) => p.crew)) : 0; return { equip: [{ type: 'tools', count: Math.max(1, Math.ceil(need / 60)) }], staff: [{ role: 'laborer', count: Math.max(6, need) }] }; },
    baseRev(g, b) { return Math.max(150000, U.sum(b.proj ? b.proj.active : [], (p) => p.price / p.months)); },
    crew(b, ctx) { return U.sum(ctx.key, M.staffEff) / 0.8; },
    month(g, b, ctx) {
      const C = TG.CONFIG, P = this.cfg(), pr = b.proj;
      const toolsCap = TG.E.capacity(b, 'tools');
      let crew = Math.min(this.crew(b, ctx) + (ctx.own ? 1 : 0), toolsCap) * M.paceMult(b) * (1 - ctx.down);
      let heavy = b.equip.filter((x) => x.type === 'excavator' && !x.broken).length;
      let cranes = b.equip.filter((x) => x.type === 'crane' && !x.broken).length;
      const moy = U.moy(g.month); const season = C.businesses.construction.season[moy] * (1 - ctx.weather.sev * 0.4);
      const totalCrewNeed = U.sum(pr.active, (p) => p.crew); let used = 0;
      for (const p of pr.active.slice()) {
        p.elapsed++;
        const assign = Math.min(Math.max(0, crew), p.crew); crew -= assign; used += assign;
        const hf = p.heavy ? U.clamp(heavy / p.heavy, 0, 1) : 1; heavy = Math.max(0, heavy - p.heavy);
        const cf = p.crane ? (cranes > 0 ? 1 : 0.2) : 1; if (p.crane) cranes = Math.max(0, cranes - 1);
        const rate = (assign / p.crew) * (0.4 + 0.6 * hf) * cf;
        const dp = Math.min(1 - p.progress, rate / p.months * season * (0.85 + 0.3 * ctx.skill / 100));
        p.progress += dp;
        const mat = p.cost * P.materialShare * dp * (g.world.shortage.home ? 1.2 : 1) * (1 + p.overrun * (b.fixes.contingency ? 0.5 : 1));
        TG.F.spend(g, Math.round(mat), 'Materials & subcontractors', b.id);
        B().addRecv(g, b, p.price * dp, P.billingDelay, p.id);
        // risks per project
        const pmF = b.fixes.pm ? 0.5 : 1;
        if (R.chance(P.overrunChance * pmF * (1.6 - ctx.skill / 100) * ctx.streakMult)) { const x = R.range(P.overrunPct[0], P.overrunPct[1]); p.overrun += x; TG.rep.event(g, b, 'bad', `${p.label} is running over budget (+${U.pct(x)} material costs)`, `${U.pct(P.overrunChance * pmF, 1)} monthly overrun chance${b.fixes.pm ? ' with project managers' : ', no dedicated project manager'}${b.fixes.contingency ? '; contingency absorbs half' : ''}`); }
        if (R.chance(P.inspectFail * (b.fixes.pm ? 0.6 : 1) * (1.6 - ctx.skill / 100) * ctx.streakMult)) { const c = Math.round(p.cost * R.range(P.reworkPct[0], P.reworkPct[1])); TG.F.spend(g, c, 'Rework', b.id); p.progress = Math.max(0, p.progress - 0.03); TG.rep.event(g, b, 'bad', `${p.label} failed a building inspection (${U.money(c)} rework)`, `Crew skill ${Math.round(ctx.skill)}`); }
        if (R.chance(P.clientBankrupt * (g.world.phase === 'recession' ? 2.5 : 1))) {
          const lostRecv = U.sum(b.recv.filter((r) => r.label === p.id), (r) => r.amt);
          b.recv = b.recv.filter((r) => r.label !== p.id);
          pr.active = pr.active.filter((x) => x !== p);
          TG.rep.event(g, b, 'major', `Client went bankrupt mid-project: ${p.label} cancelled (${U.money(lostRecv)} unpaid)`, `${U.pct(P.clientBankrupt * (g.world.phase === 'recession' ? 2.5 : 1), 1)} monthly chance; ${TG.W.phaseLabel(g).toLowerCase()} economy`, { major: 'cash' });
          continue;
        }
        if (p.elapsed > p.deadline && (p.penalty || 0) < p.price * P.latePenaltyCap) { const pen = Math.round(Math.min(p.price * P.latePenaltyPct, p.price * P.latePenaltyCap - (p.penalty || 0))); p.penalty = (p.penalty || 0) + pen; TG.F.spend(g, pen, 'Late penalties', b.id); if (p.elapsed === p.deadline + 1) TG.rep.event(g, b, 'bad', `${p.label} is late: ${U.money(pen)}/month penalty`, `Planned ${p.months} months; crew assigned ${Math.round(assign)} of ${p.crew}`); }
        if (p.progress >= 0.999) {
          pr.active = pr.active.filter((x) => x !== p); pr.done++;
          const late = p.elapsed > p.deadline; const dr = late ? -R.range(1, 4) : R.range(1, 5); b.rep = U.clamp(b.rep + dr, 0, 100);
          TG.rep.event(g, b, late ? 'bad' : 'good', `Completed ${p.label}${late ? ' late' : ' on time'}`, `Contract ${U.money(p.price)}; reputation ${dr > 0 ? '+' : ''}${Math.round(dr)}`);
        }
      }
      this.offers(g, b);
      { const FL = TG.FL; FL.start(b); const doneNow = pr.done - (pr.doneSeen || 0); pr.doneSeen = pr.done;
        FL.row(b, '🏗️', 'Jobs in progress', pr.active.length, '', 'g'); FL.row(b, '🦺', 'Crew working', used, '/' + Math.round(totalCrewNeed), used < totalCrewNeed * 0.9 ? 'y' : 'g', used < totalCrewNeed * 0.9 ? 'Not enough crew or crew gear' : '');
        if (doneNow > 0) FL.row(b, '✅', 'Jobs finished', doneNow, '', 'g');
        const late = pr.active.filter((p) => p.elapsed > p.deadline).length; if (late) FL.row(b, '⏰', 'Jobs late', late, '', 'r', 'Paying late penalties');
        FL.row(b, '📨', 'New offers', pr.offers.length, '', '');
        FL.next(b, '✅', 'Jobs finishing', pr.active.filter((p) => p.progress > 1 - 1.2 / p.months).length, '', 'g'); }
      const avail = this.crew(b, ctx);
      TG.WK.add(ctx, 'staff', '🦺', 'Crew', ctx.key.length + (ctx.own ? 1 : 0), this.crew(b, ctx) + (ctx.own ? 1 : 0), totalCrewNeed, 'workers', [], 'Each job needs a set crew. Short crew = jobs run late.');
      TG.WK.add(ctx, 'eq', '🧰', 'Tool sets & vans', b.equip.filter((x) => (x.type === 'tools' || x.type === 'skid') && !x.broken).length, toolsCap, totalCrewNeed, 'workers', ['tools'], 'Each tool set equips about 12 workers; a crew van 4 more.');
      for (const hv of ['excavator', 'crane']) { const n = b.equip.filter((x) => x.type === hv && !x.broken).length; const need = pr.active.filter((p) => (hv === 'crane' ? p.crane : p.heavy)).length; if (n || need) TG.WK.add(ctx, 'eq', hv === 'crane' ? '🏗️' : '🚧', hv === 'crane' ? 'Cranes' : 'Excavators', n, n, need, 'jobs', [hv], 'One machine per job that needs it. Jobs without one wait.'); }
      ctx.cap = Math.round(avail); ctx.demand = Math.round(totalCrewNeed); ctx.served = Math.round(used);
      ctx.util = avail > 0 ? totalCrewNeed / avail : (totalCrewNeed ? 1.5 : 0); ctx.busy = U.clamp(ctx.util, 0, 1.3);
      if (!pr.active.length) ctx.note = 'No active projects: crews are idle (bid on contracts)';
      else if (totalCrewNeed > avail * 1.1) ctx.note = 'Over-committed: projects will run late';
    },
    extraRisks(g, b) { const P = this.cfg(); const n = b.proj.active.length; if (!n) return []; return [{ label: 'A project runs over budget', p: 1 - Math.pow(1 - P.overrunChance * (b.fixes.pm ? 0.5 : 1), n), why: `${n} active projects` }, { label: 'A client goes bankrupt', p: 1 - Math.pow(1 - P.clientBankrupt, n), why: 'economy dependent' }]; },
  };
  M.bid = (g, b, offerId, markup, by) => {
    const P = TG.CONFIG.businesses.construction.projects; const m = M.models.projects;
    const o = b.proj.offers.find((x) => x.id === offerId); if (!o) return { ok: false, msg: 'Offer expired.' };
    if (o.bond && !b.fixes.bonds) return { ok: false, msg: 'Large projects require performance bonds.' };
    if (b.proj.active.length >= P.maxActive) return { ok: false, msg: 'Too many active projects.' };
    b.proj.offers = b.proj.offers.filter((x) => x !== o);
    const win = m.winChance(g, b, o, markup);
    if (!R.chance(win)) { TG.rep.decision(g, b, by, `Lost the bid on ${o.label} (${U.pct(win)} odds)`, 'ok'); return { ok: true, won: false, win }; }
    const price = Math.round(o.cost * (1 + P.markups[markup] + (b.fixes.contingency ? P.contingency : 0)));
    if (o.bond) TG.F.spend(g, Math.round(price * P.bondPct), 'Performance bonds', b.id);
    b.proj.active.push({ id: o.id, label: o.label, size: o.size, cost: o.cost, price, months: o.months, crew: o.crew, heavy: o.heavy, crane: o.crane, progress: 0, elapsed: 0, deadline: Math.round(o.months * 1.15), overrun: 0 });
    TG.rep.decision(g, b, by, `Won the bid on ${o.label} at ${U.money(price)} (${U.pct(win)} odds)`, 'good');
    return { ok: true, won: true, win, price };
  };

  // ============ TECH ============
  M.models.tech = {
    init(g, b) {
      const T = TG.CONFIG.businesses.tech.tech;
      b.tech = { phase: 'build', dev: 0, pmf: U.clamp(Math.pow(R.next(), 1.7), 0.02, 0.98), pmfEst: null, users: 0, researched: false, peak: 0 };
    },
    needs() { return { equip: [{ type: 'server', count: 1 }], staff: [{ role: 'engineer', count: 3 }] }; },
    baseRev(g, b) { return Math.max(40000, b.tech.users * TG.CONFIG.businesses.tech.tech.arpu * g.world.priceIdx); },
    month(g, b, ctx) {
      const C = TG.CONFIG, T = C.businesses.tech.tech, t = b.tech;
      const engEff = (U.sum(ctx.key, (e) => 0.5 + e.skill / 100) + (ctx.own ? 0.4 : 0)) * (1 + TG.E.boost(b, 'staffBoost'));
      if (t.phase === 'build') {
        t.dev += engEff * M.paceMult(b) * (1 - ctx.down);
        ctx.cap = Math.round(t.dev); ctx.demand = T.devPoints; ctx.served = 0; ctx.util = 1; ctx.busy = 1;
        ctx.note = `Building the product: ${Math.min(100, Math.round(t.dev / T.devPoints * 100))}% done`;
        { const FL = TG.FL; FL.start(b); FL.row(b, '🧑‍💻', 'Build progress', Math.min(100, t.dev / T.devPoints * 100), '%', 'g'); FL.next(b, '🚀', 'Months to launch', Math.max(0, (T.devPoints - t.dev) / Math.max(0.1, engEff * M.paceMult(b))), '', 'g'); }
        if (t.dev >= T.devPoints) { t.phase = 'live'; t.users = Math.round(300 + 3000 * t.pmf * (0.5 + b.rep / 100)); TG.rep.event(g, b, 'good', `Product launched with ${t.users.toLocaleString()} early users`, t.pmfEst != null ? `Research estimated product-market fit around ${U.pct(t.pmfEst)}` : 'No market research: fit unknown until users show up'); }
        return;
      }
      const share = U.clamp(t.users / g.markets.software.demand12, 0, 1);
      const cac = T.cacBase * (1 + 4 * Math.pow(share, 1.5)) * g.world.priceIdx;
      const adMgr = b.spec.ads; const flop = b.ads.budget > 0 && R.chance(C.reputation.adChannels[b.ads.channel].flop * (adMgr ? 0.5 : 1));
      if (flop) TG.rep.event(g, b, 'bad', 'Ad campaign flopped', 'Campaigns can flop');
      let paid = b.ads.budget > 0 ? (b.ads.budget / cac) * (0.3 + 1.4 * t.pmf) * (adMgr ? 1 + adMgr.skill / 150 : 1) * (flop ? 0.2 : 1) : 0;
      let organic = t.users * T.organic * t.pmf * 2 * (b.rep / 50) + 150 * t.pmf;
      let hit = 1; for (const h of b.hits) hit *= h.mult; if (b.boost) hit *= b.boost.mult;
      let newU = (paid + organic) * hit * TG.W.econMult(g, 0.5) * (g.world.trends.tech || 1) * (1 - share) * TG.PR.demandF(TG.PR.ratio(g, b));
      const engNeed = 2 + t.users / 150000;
      const engCov = U.clamp(engEff / engNeed, 0, 1);
      const serverCap = TG.E.capacity(b, 'server');
      TG.WK.add(ctx, 'eq', '🖥️', 'Servers', b.equip.filter((x) => (x.type === 'server' || x.type === 'cdn') && !x.broken).length, serverCap, t.users, 'users', ['server'], 'Each server handles about 60,000 users. Over 100% = outages and users leave.');
      TG.WK.add(ctx, 'staff', '🧑‍💻', 'Engineers', ctx.key.length + (ctx.own ? 1 : 0), engEff, engNeed, 'eng. needed', [], 'Fix bugs and keep users happy: about 2 + 1 per 150,000 users needed.');
      const overload = t.users > serverCap;
      const pOut = T.outageBase * (overload ? 5 : 1) * (b.fixes.backup ? 0.3 : 1) * ctx.streakMult;
      if (t.users > 0 && R.chance(pOut)) { const x = R.range(0.03, 0.08); t.users = Math.round(t.users * (1 - x)); b.rep = U.clamp(b.rep - R.range(3, 8), 0, 100); TG.rep.event(g, b, 'bad', `Server outage: ${U.pct(x)} of users left`, `${U.pct(pOut)} outage chance: ${overload ? `servers overloaded (${t.users.toLocaleString()} users, capacity ${Math.round(serverCap).toLocaleString()})` : 'normal load'}${b.fixes.backup ? ', backup servers' : ', no backup servers'}`); }
      const churnRate = Math.max(0.01, T.churnBase - 0.07 * t.pmf + (1 - engCov) * 0.05 + (TG.PR.ratio(g, b) > 1 ? (TG.PR.ratio(g, b) - 1) * C.pricing.techChurnPerOver * 2.5 : -(1 - TG.PR.ratio(g, b)) * 0.02));
      const prevU = t.users;
      const churn = t.users * churnRate;
      t.users = Math.max(0, Math.round(t.users + newU - churn));
      t.peak = Math.max(t.peak, t.users);
      g.markets.software.cur = (g.markets.software.cur || 0) + t.users / 12;
      const rev = t.users * TG.PR.ask(g, b);
      const FL = TG.FL; FL.start(b);
      FL.row(b, '🙋', 'New users', newU, '', 'g'); FL.row(b, '👋', 'Users lost', churn, '', churn > newU ? 'r' : 'y', `${U.pct(churnRate, 1)} leave each month`);
      FL.row(b, '📱', 'Users now', t.users, '/' + Math.round(serverCap), overload ? 'r' : 'g', overload ? 'Servers overloaded: outages' : '');
      FL.row(b, '💵', 'Price', TG.PR.ask(g, b), '$/user', TG.PR.tone(TG.PR.ratio(g, b)));
      FL.next(b, '📱', 'Users expected', Math.max(0, t.users + newU - t.users * churnRate), '', 'g');
      FL.next(b, '👋', 'Will leave', t.users * churnRate, '', 'y');
      TG.F.earn(g, Math.round(rev), 'Subscriptions', b.id);
      TG.F.spend(g, Math.round(t.users * T.serverCostPerUser * g.world.priceIdx), 'Hosting', b.id);
      ctx.cap = Math.round(serverCap); ctx.demand = Math.round(t.users); ctx.served = Math.round(newU);
      ctx.util = serverCap > 0 ? t.users / serverCap : 1.5; ctx.busy = U.clamp(1 / Math.max(0.3, engCov), 0, 1.3);
      ctx.note = `${t.users.toLocaleString()} users, ${U.pct(churnRate, 1)} monthly churn, customer cost ${U.money(cac)}`;
      if (engCov < 0.8) ctx.note += '; engineering team stretched thin';
    },
    extraRisks(g, b) { const T = TG.CONFIG.businesses.tech.tech; if (b.tech.phase !== 'live') return []; const over = b.tech.users > TG.E.capacity(b, 'server'); return [{ label: 'Server outage', p: T.outageBase * (over ? 5 : 1) * (b.fixes.backup ? 0.3 : 1), why: over ? 'servers overloaded' : 'normal load' }]; },
  };
  M.techResearch = (g, b) => {
    const T = TG.CONFIG.businesses.tech.tech, t = b.tech;
    if (t.researched) return; t.researched = true;
    if (t.phase === 'build') t.pmf = U.clamp(t.pmf + (1 - t.pmf) * 0.3, 0, 0.98);
    t.pmfEst = U.clamp(t.pmf + R.normal(0, T.pmfNoise * 0.5), 0, 1);
    TG.rep.event(g, b, 'info', `Market research: estimated product-market fit ${U.pct(t.pmfEst)}`, 'Research improves the product and gives a rough estimate (not exact)');
  };
  M.techPivot = (g, b) => {
    const t = b.tech; const cost = Math.round(100000 * g.world.priceIdx);
    if (g.cash < cost) return { ok: false, msg: `Pivot costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Pivot', b.id, true);
    t.phase = 'build'; t.dev = 0; t.users = Math.round(t.users * 0.2); t.pmf = U.clamp(Math.pow(R.next(), 1.5), 0.02, 0.98); t.pmfEst = null; t.researched = false;
    return { ok: true, cost };
  };

  // ============ FRANCHISE ============
  M.models.franchise = {
    init(g, b, prop, opts) {
      const fr = TG.CONFIG.businesses.franchise.franchise;
      b.fr = { concept: opts.concept || 'cafe', locations: [], apps: [] };
      if (opts.fromBiz) { const src = B().get(g, opts.fromBiz); if (src) { b.rep = Math.max(b.rep, src.rep * 0.8); b.fr.concept = src.type; b.fr.source = src.id; } }
    },
    needs() { return { equip: [{ type: 'systems', count: 1 }], staff: [{ role: 'regional', count: 1 }] }; },
    baseRev(g, b) { const fr = TG.CONFIG.businesses.franchise.franchise; return Math.max(20000, b.fr.locations.length * fr.avgSales * fr.royalty * g.world.priceIdx); },
    month(g, b, ctx) {
      const C = TG.CONFIG, fr = C.businesses.franchise.franchise, s = b.fr, fo = b.fixesOn || {};
      // applications
      const lam = b.rep * fr.appsPerRep * TG.W.econMult(g, 1) * (fo.appMult || 1) * (b.ads.budget > 0 ? 1 + Math.min(1, b.ads.budget / 20000) : 1);
      const n = poisson(lam);
      s.apps = s.apps.filter((a) => a.expires > g.month);
      for (let i = 0; i < n && s.apps.length < 8; i++) {
        const bad = R.chance(fr.badFranchisee);
        const q = bad ? R.range(0.15, 0.5) : R.range(0.5, 1);
        s.apps.push({ id: U.uid('a'), name: TG.S.name(), q, bad, signal: U.clamp(q + R.normal(0, 0.2), 0, 1), capital: Math.round(R.range(150000, 900000) / 1000) * 1000, expires: g.month + 2 });
      }
      // locations
      const open = s.locations.filter((l) => l.status === 'open');
      const regCap = (U.sum(ctx.key, (e) => C.businesses.franchise.roles.regional.cap * M.staffEff(e)) + (ctx.own ? 4 : 0)) * (1 + TG.E.boost(b, 'staffBoost'));
      const cov = open.length ? U.clamp(regCap / open.length, 0, 1) : 1;
      const sat = open.length / (fr.perRegion * Object.keys(C.regions).length);
      const cannibal = 1 / (1 + Math.pow(sat, 1.5) * (fo.cannibalCut ? 0.5 : 1));
      const concept = C.businesses[s.concept];
      const conceptMult = concept && concept.svc ? U.clamp(concept.svc.baseDemand * concept.svc.ticket / 30000, 0.5, 1.6) : 1;
      let royalty = 0;
      for (const l of s.locations) {
        l.age++;
        if (l.status === 'building') { if (l.age >= 3) { l.status = 'open'; } continue; }
        const sales = fr.avgSales * conceptMult * (0.6 + 0.8 * l.q) * TG.W.econMult(g, C.businesses.franchise.econSens) * (0.6 + b.rep / 125) * cannibal * g.world.priceIdx;
        royalty += sales * fr.royalty;
        if (R.chance(l.bad ? 0.02 : fr.closeChance * (g.world.phase === 'recession' ? 2 : 1))) { l.status = 'closed'; TG.rep.event(g, b, 'bad', `Franchisee ${l.name} closed their location`, l.bad ? 'Weak franchisee (hidden quality revealed)' : 'Normal franchise turnover'); }
        if (l.bad && R.chance(fr.scandalPerBad * (fo.scandalCut || 1) * ctx.streakMult)) {
          const x = R.range(10, 20); b.rep = U.clamp(b.rep - x, 0, 100); l.revealed = true;
          TG.rep.event(g, b, 'major', `Scandal at franchisee ${l.name} hurts the whole brand (reputation -${Math.round(x)})`, `Bad franchisee; ${b.fixes.standards ? 'strict standards' : 'no strict standards'}${b.fixes.mystery ? ', mystery shoppers' : ''}`);
          for (const ob of g.businesses) if (ob.type === s.concept) ob.rep = U.clamp(ob.rep - x * C.reputation.chainSpill, 0, 100);
        }
      }
      const closedNow = s.locations.filter((l) => l.status === 'closed').length;
      s.locations = s.locations.filter((l) => l.status !== 'closed');
      { const FL = TG.FL; FL.start(b); const openedNow = s.locations.filter((l) => l.status === 'open' && l.age === 3).length;
        FL.row(b, '📨', 'Applications', n, '', 'g'); FL.row(b, '🏬', 'Opened', openedNow, '', openedNow ? 'g' : ''); if (closedNow) FL.row(b, '🚪', 'Closed', closedNow, '', 'r', 'Franchise turnover');
        FL.row(b, '🏪', 'Open stores', s.locations.filter((l) => l.status === 'open').length, '', 'g'); FL.row(b, '💵', 'Royalties', royalty, '$', 'g');
        FL.next(b, '🏗️', 'Opening soon', s.locations.filter((l) => l.status === 'building' && l.age === 2).length, '', 'g'); FL.next(b, '🚪', 'Expected closures', open.length * fr.closeChance, '', 'y'); }
      TG.F.earn(g, Math.round(royalty), 'Royalties', b.id);
      TG.F.spend(g, Math.round(open.length * fr.supportPerLoc * g.world.priceIdx), 'Franchise support', b.id);
      const pDrift = (1 - cov) * 0.12 * (fo.driftCut ? 1 - fo.driftCut : 1);
      if (open.length && R.chance(pDrift)) { const x = R.range(3, 8); b.rep = U.clamp(b.rep - x, 0, 100); for (const l of s.locations) l.q = Math.max(0.1, l.q - 0.03); TG.rep.event(g, b, 'bad', `Quality drifting across stores (reputation -${Math.round(x)})`, `Regional manager coverage ${U.pct(cov)} (${s.locations.length} locations)`); }
      const pSuit = fr.suitPerLoc * open.length * (b.spec.lawyer ? 0.6 : 1.1) * (b.fixes.standards ? 0.7 : 1);
      if (R.chance(pSuit)) B().lawsuit(g, b, 'Franchisee lawsuit', Math.max(C.lawsuits.suitMin, R.range(1, 3) * Math.max(royalty, 20000)), 'liability', `${open.length} franchisees; ${U.pct(pSuit, 1)} monthly chance`);
      TG.WK.add(ctx, 'staff', '🧭', 'Area managers', ctx.key.length + (ctx.own ? 1 : 0), regCap, open.length, 'shops', [], `Each checks on about ${C.businesses.franchise.roles.regional.cap} shops. Unchecked shops slip.`);
      TG.WK.add(ctx, 'eq', '💻', 'Franchise systems', b.equip.filter((x) => x.type === 'systems' && !x.broken).length, TG.E.capacity(b, 'systems'), open.length, 'shops', ['systems'], 'Ordering and reporting software: about 60 shops per system.');
      ctx.cap = Math.round(regCap); ctx.demand = open.length; ctx.served = open.length; ctx.util = open.length / Math.max(1, regCap); ctx.busy = U.clamp(ctx.util, 0, 1.3);
      ctx.note = `${open.length} open locations, ${s.locations.length - open.length} being built, ${s.apps.length} applications waiting; regional coverage ${U.pct(cov)}`;
      if (cannibal < 0.85) ctx.note += `; locations cannibalizing each other (sales x${cannibal.toFixed(2)})`;
    },
    extraRisks(g, b) { const fr = TG.CONFIG.businesses.franchise.franchise; const bad = b.fr.locations.filter((l) => l.bad).length; return bad ? [{ label: 'A franchisee scandal', p: 1 - Math.pow(1 - fr.scandalPerBad * ((b.fixesOn && b.fixesOn.scandalCut) || 1), bad), why: 'some franchisees are weak (hidden)' }] : []; },
  };
  M.franchiseApprove = (g, b, appId, by) => {
    const fr = TG.CONFIG.businesses.franchise.franchise; const a = b.fr.apps.find((x) => x.id === appId); if (!a) return { ok: false };
    b.fr.apps = b.fr.apps.filter((x) => x !== a);
    const open = Math.round(fr.openCost * g.world.priceIdx);
    TG.F.earn(g, Math.round(fr.fee * g.world.priceIdx), 'Franchise fees', b.id);
    TG.F.spend(g, open, 'Location launch support', b.id);
    b.fr.locations.push({ id: a.id, name: a.name, q: a.q, bad: a.bad, age: 0, status: 'building' });
    TG.rep.decision(g, b, by, `Approved franchisee ${a.name} (looked ${a.signal > 0.7 ? 'strong' : a.signal > 0.45 ? 'okay' : 'weak'})`, a.bad ? 'bad' : 'good');
    return { ok: true };
  };
  M.franchiseReject = (g, b, appId) => { b.fr.apps = b.fr.apps.filter((x) => x.id !== appId); return { ok: true }; };
})();
