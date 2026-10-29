  M.farmBuyCattle = (g, b, head) => {
    const e = M.models.farm.e(b); head = Math.round(head); if (!(head > 0)) return { ok: false, msg: 'Pick how many.' };
    const cost = Math.round(head * e.stockCost * g.world.priceIdx);
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Livestock purchases', b.id, true);
    if (b.farm.cows == null) M.herdInit(b.farm, b.farm.herd || 0);
    b.farm.cows += head; M.herdSync(b.farm); return { ok: true, cost };
  };
  // sell animals now at market: the ready pool, or breeding cows (at a discount)
  M.farmSellCattle = (g, b, head, which) => {
    const f = b.farm; if (f.cows == null) M.herdInit(f, f.herd || 0);
    head = Math.max(0, Math.round(head)); const pool = which === 'cows' ? f.cows : f.ready; head = Math.min(head, Math.floor(pool));
    if (!head) return { ok: false, msg: which === 'cows' ? 'No cows to sell.' : 'No animals at market age yet.' };
    const p = TG.W.price(g, 'beef', head / 2) * (which === 'cows' ? 0.75 : 1); const rev = Math.round(head * p);
    if (which === 'cows') f.cows -= head; else f.ready -= head;
    TG.F.earn(g, rev, 'Cattle sales', b.id, true); TG.W.sell(g, 'beef', head); M.herdSync(f);
    return { ok: true, rev, head };
  };
  M.farmBuySeeds = (g, b, acres) => { const n = M.models.farm.buySeeds(g, b, acres, 0); return n > 0 ? { ok: true, acres: n } : { ok: false, msg: M.farmStoreFree(b) < 1 ? 'Storage is full.' : 'Not enough cash.' }; };
  M.farmSellSeeds = (g, b, acres) => { const f = b.farm; acres = Math.min(Math.round(acres), Math.floor(f.seeds || 0)); if (acres <= 0) return { ok: false, msg: 'No seed.' }; const v = Math.round(acres * M.models.farm.seedCost(g, b) * 0.5); f.seeds -= acres; TG.F.earn(g, v, 'Asset sales', b.id, true); return { ok: true, rev: v }; };
  M.farmSwitch = (g, b, ent) => {
    const fd = TG.CONFIG.businesses.farm.farm; if (ent === b.farm.ent) return { ok: false };
    let cost = 0; const prop = g.properties.find((p) => p.id === b.propId);
    const pr = prop || { acres: b.farm.acres, water: b.farm.water, soil: b.farm.soil };
    const cowsFor = (en) => Math.round(M.farmHerdCap(pr, fd.enterprises[en]) * 0.4 / 2.07);
    if (ent === 'orchard') cost = b.farm.acres * fd.enterprises.orchard.establishPerAcre * g.world.priceIdx;
    if (ent === 'cattle' || ent === 'dairy') cost = cowsFor(ent) * fd.enterprises[ent].stockCost * g.world.priceIdx;
    cost = Math.round(cost);
    if (g.cash < cost) return { ok: false, msg: `Switching costs ${U.money(cost)}.` };
    TG.F.spend(g, cost, 'Farm conversion', b.id, true);
    if (M.isLivestock(b.farm) && b.farm.herd > 0) { const v = Math.round(b.farm.herd * TG.W.price(g, 'beef', b.farm.herd / 2) * 0.7); TG.F.earn(g, v, 'Cattle sales', b.id, true); }
    Object.assign(b.farm, { ent, planted: 0, toHarvest: 0, seasonYield: 1, futures: [], herd: 0, cows: 0, young: [], ready: 0 }); b.ask = null;
    if (ent === 'orchard') b.farm.orchardAge = 0;
    if (ent === 'cattle' || ent === 'dairy') { b.farm.cows = cowsFor(ent); M.herdSync(b.farm); }
    return { ok: true, cost };
  };

