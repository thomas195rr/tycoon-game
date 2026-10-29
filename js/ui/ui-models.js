/* ui-models.js - the special panel for each business model (farm, freight, brand, construction, factory, tech, franchise). */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const biz = () => TG.B.get(TG.G, UI.bizId);
  const P = (UI.modelPanel = {});
  const after = (r, msg) => { UI.res(r, msg); UI.refresh(); };

  // ---------- FARM ----------
  P.farm = { label: 'Farm', render(g, b) {
    const f = b.farm, fd = TG.CONFIG.businesses.farm.farm, e = fd.enterprises[f.ent];
    const price = TG.W.price(g, e.market, 0); const st = g.markets[e.market];
    let o = `<div class="card"><div class="kv"><span>Enterprise</span><span>${esc(e.label)}</span><span>Land</span><span>${f.acres.toLocaleString()} acres (${f.irrigated.toLocaleString()} irrigated)</span>
      ${f.ent === 'cattle' ? `<span>Herd</span><span>${Math.round(f.herd).toLocaleString()} head (land supports ~${TG.M.farmHerdCap({ acres: f.acres, water: f.water, soil: f.soil }, e).toLocaleString()})</span>` : `<span>Season</span><span>${f.planted ? `${Math.round(f.planted).toLocaleString()} acres planted` : 'not planted'}${f.ent === 'orchard' ? ` · orchard age ${f.orchardAge >= 999 ? 'mature' : Math.round(f.orchardAge) + '/' + e.rampMonths + ' mo'}` : ''}</span>`}
      <span>Storage</span><span>${Math.round(f.stored).toLocaleString()} / ${f.storageCap.toLocaleString()} tons</span>
      <span>${esc(e.market)} price now</span><span>${m(price)}${st && st.hist && st.hist.length > 12 ? ` (yr ago ${m(st.hist[st.hist.length - 13])})` : ''}</span>
      ${f.lastHarvest ? `<span>Last harvest</span><span>${esc(typeof f.lastHarvest === 'object' ? `${Math.round(f.lastHarvest.tons || 0).toLocaleString()} tons, ${U.dateStr(f.lastHarvest.m || 0)}` : f.lastHarvest)}</span>` : ''}</div>
      ${st && st.hist ? UI.spark(st.hist.slice(-60), '#a16207') : ''}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Selling</h3><select data-change="farmPol">${[['sell', 'Sell at harvest'], ['store', 'Store and wait for better prices'], ['auto', 'Let my manager decide each month']].map(([v, l]) => `<option value="${v}"${f.sellPolicy === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="mute">Stored crops cost ${m(e.storageCost || 0)}/ton/mo and some spoil (${U.pct(e.spoil || 0, 1)}/mo).</div>
      ${f.ent !== 'cattle' ? `<div class="row" style="margin-top:6px"><span class="small">Lock a futures price (${U.pct(fd.futuresDiscount)} of today) for</span><input type="number" id="futQty" placeholder="tons">${UI.btn('Lock', 'farmDo', 'futures', 'sm')}</div><div class="mute">Locked: ${U.sum(f.futures, (x) => x.qty - (x.done || 0)).toLocaleString()} tons. Max ${U.pct(fd.futuresMax)} of expected harvest. A bad harvest still owes delivery.</div>` : ''}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Invest in the land</h3>
      <div class="row"><input type="number" id="farmAc" placeholder="acres"><span class="small">Neighbouring land ~${m(TG.M.farmLandPrice(g, b))}/acre</span></div>
      <div class="btns">${UI.btn('Buy land (cash)', 'farmDo', 'land', 'sm')}${UI.btn('Buy land (mortgage)', 'farmDo', 'landM', 'sm')}${UI.btn(`Irrigate (${m(fd.irrigationPerAcre * g.world.priceIdx)}/acre)`, 'farmDo', 'irr', 'sm')}</div>
      <div class="row" style="margin-top:6px"><input type="number" id="farmSt" placeholder="tons">${UI.btn(`Build storage (${m(20 * g.world.priceIdx)}/ton)`, 'farmDo', 'stor', 'sm')}</div>
      ${f.ent === 'cattle' ? `<div class="row" style="margin-top:6px"><input type="number" id="farmHd" placeholder="head">${UI.btn(`Buy cattle (${m(e.stockCost * g.world.priceIdx)}/head)`, 'farmDo', 'cattle', 'sm')}</div>` : ''}
      <div class="mute">Irrigation cuts drought losses by ${U.pct(fd.irrigationDroughtCut)}. Crop insurance is under Upgrades.</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Switch what you farm</h3><div class="btns">${Object.entries(fd.enterprises).filter(([k]) => k !== f.ent).map(([k, x]) => UI.btn(`Switch to ${esc(x.label)}`, 'farmSw', k, 'sm')).join('')}</div><div class="mute">Switching to an orchard means planting trees and waiting ~${fd.enterprises.orchard.rampMonths} months; cattle means buying a herd.</div></div>`;
    return o;
  } };
  UI.A.farmPol = (v) => { biz().farm.sellPolicy = v; UI.refresh(); };
  UI.A.farmDo = (k) => {
    const g = TG.G, b = biz();
    if (k === 'futures') { const r = TG.M.farmFutures(g, b, UI.num('futQty', 0)); return after(r, r.ok ? `Locked ${r.qty} tons at ${m(r.price)}.` : null); }
    if (k === 'land' || k === 'landM') return after(TG.M.farmBuyLand(g, b, UI.num('farmAc', 0), k === 'landM'), 'Land bought.');
    if (k === 'irr') return after(TG.M.farmIrrigate(g, b, UI.num('farmAc', 0) || b.farm.acres), 'Irrigation installed.');
    if (k === 'stor') return after(TG.M.farmStorage(g, b, UI.num('farmSt', 0)), 'Storage built.');
    if (k === 'cattle') return after(TG.M.farmBuyCattle(g, b, UI.num('farmHd', 0)), 'Cattle bought.');
  };
  UI.A.farmSw = (k) => after(TG.M.farmSwitch(TG.G, biz(), k), 'Switched.');

  // ---------- FREIGHT ----------
  P.freight = { label: 'Fleet', render(g, b) {
    const trucks = b.equip.filter((x) => x.type === 'truck'); const drivers = b.staff.filter((e) => e.role === 'driver');
    const st = g.markets.freight; const lc = b.lastCtx || {};
    return `<div class="card"><div class="kv"><span>Trucks (working)</span><span>${trucks.length} (${trucks.filter((x) => !x.broken).length})</span><span>Drivers</span><span>${drivers.length}</span>
      <span>Loads last month</span><span>${(lc.served || 0).toLocaleString()} of ${(lc.cap || 0).toLocaleString()} possible</span><span>Rate per load now</span><span>${m(TG.W.price(g, 'freight', 0))}</span><span>Fuel index</span><span>x${g.world.fuel.toFixed(2)}</span>
      <span>Fuel hedge</span><span>${b.hedge && b.hedge.until > g.month ? `locked at x${b.hedge.idx.toFixed(2)} until ${U.dateStr(b.hedge.until)}` : 'none'}</span></div>
      ${st && st.hist ? `<div class="mute" style="margin-top:6px">Freight rates</div>${UI.spark(st.hist.slice(-60), '#a16207')}` : ''}
      <div class="btns">${UI.btn('Hedge fuel for 12 months', 'frHedge', null, 'sm')}${UI.btn('Buy a truck', 'tab', 'biz:equip', 'sm')}${UI.btn('Hire drivers', 'tab', 'biz:staff', 'sm')}</div>
      <div class="mute">Each truck needs about one driver. Too many trucks in the market pushes rates down for everyone (including you). Hedging locks fuel slightly above today's price: it wins if fuel spikes, loses if it falls.</div></div>`;
  } };
  UI.A.frHedge = () => { const r = TG.M.freightHedge(TG.G, biz()); after(r, r.ok ? `Hedged for ${m(r.cost)}.` : null); };

  // ---------- BRAND ----------
  P.brand = { label: 'Inventory', render(g, b) {
    const s = b.brand, br = TG.CONFIG.businesses.brand.brand;
    return `<div class="card"><div class="kv"><span>In stock</span><span>${Math.round(s.stock).toLocaleString()} units (${m(s.stockCost)} at cost)</span><span>Arriving</span><span>${s.incoming.map((x) => `${x.units.toLocaleString()} in ${x.due - g.month} mo`).join(', ') || 'nothing'}</span>
      <span>Orders last month</span><span>${Math.round(s.lastOrders || 0).toLocaleString()}${s.lostSales > 0 ? ` (${Math.round(s.lostSales).toLocaleString()} lost: out of stock)` : ''}</span><span>Avg monthly orders</span><span>${Math.round(s.avgOrders || 0).toLocaleString()}</span>
      <span>Followers</span><span>${Math.round(s.followers).toLocaleString()}</span><span>Retail price now</span><span>${m(TG.W.price(g, 'apparel', 0))}</span></div></div>
      <div class="card"><h3 style="margin-top:0">Order from the factory</h3><div class="row"><input type="number" id="brUnits" placeholder="units" value="${Math.max(br.minBatch, Math.round((s.avgOrders || 300) * 3 / 100) * 100)}">${UI.btn('Order batch', 'brOrder', '0', 'sm pri')}${UI.btn(`Test batch (${br.testBatch}+)`, 'brOrder', '1', 'sm')}</div>
      <div class="mute">~${m(br.unitCost * g.world.priceIdx)}/unit, min ${br.minBatch}, arrives in ${br.leadMonths} months. Over-order and cash sits in a warehouse; under-order and you lose sales. ${U.pct(br.factoryIssue)} of batches have a quality issue unless you add factory inspections.</div></div>
      <div class="card"><h3 style="margin-top:0">Clearance sale</h3><div class="btns">${[0.25, 0.5, 1].map((p) => UI.btn(`Clear ${U.pct(p)} at ~40% of price`, 'brClear', p, 'sm')).join('')}</div><div class="mute">Turns dead stock into cash at a loss and dents reputation slightly.</div></div>`;
  } };
  UI.A.brOrder = (t) => { const r = TG.M.brandOrder(TG.G, biz(), UI.num('brUnits', 0), t === '1'); after(r, r.ok ? `Ordered for ${m(r.cost)}.` : null); };
  UI.A.brClear = (p) => { const r = TG.M.brandClearance(TG.G, biz(), Number(p)); after(r.ok ? r : { ok: false, msg: 'Nothing to clear.' }, r.ok ? `Cleared ${r.units} units for ${m(r.rev)}.` : null); };

  // ---------- CONSTRUCTION ----------
  P.projects = { label: 'Projects', render(g, b) {
    const pr = b.proj, PC = TG.CONFIG.businesses.construction.projects; const M = TG.M.models.projects;
    const crew = b.staff.filter((e) => e.role === 'laborer').length;
    let o = `<div class="card"><div class="kv"><span>Crew</span><span>${crew} laborers</span><span>Heavy gear</span><span>${b.equip.filter((x) => x.type === 'excavator').length} excavators, ${b.equip.filter((x) => x.type === 'crane').length} cranes</span><span>Completed projects</span><span>${pr.done || 0}</span></div>
      <div class="kv" style="margin-top:6px"><span>Bid markup</span><span><select data-change="cxMarkup">${Object.keys(PC.markups).map((k) => `<option value="${k}"${pr.markup === k ? ' selected' : ''}>${k} (+${U.pct(PC.markups[k])})</option>`).join('')}</select></span>
      <span>Managers bid for me</span><span>${UI.btn(pr.autoBid ? 'On (turn off)' : 'Off (turn on)', 'cxAuto', null, 'sm')}</span></div>
      <div class="mute">Higher markup = more profit per job but fewer wins. Taking more than your crew can handle makes projects late (penalties).</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Active (${pr.active.length}/${PC.maxActive})</h3>${pr.active.map((p) => `<div class="ev ${p.elapsed > p.deadline ? 'bad' : ''}"><div class="row sp"><b>${esc(p.label)}</b><span>${m(p.price)}</span></div><div class="small">${Math.round(p.progress * 100)}% done · month ${p.elapsed}/${p.months} (deadline ${p.deadline}) · needs ${p.crew} crew${p.heavy ? ', excavator' : ''}${p.crane ? ', crane' : ''}${p.overrun ? ` · overrun ${m(p.overrun)}` : ''}</div>${UI.bar(p.progress, 1)}</div>`).join('') || '<div class="mute">No active projects: your crew is idle.</div>'}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Open bids</h3>${pr.offers.map((x) => { const w = M.winChance(g, b, x, pr.markup); return `<div class="ev"><div class="row sp"><b>${esc(x.label)}</b><span>${m(x.cost)} cost</span></div><div class="small">${x.months} months · ${x.crew} crew${x.heavy ? ' · excavator' : ''}${x.crane ? ' · crane' : ''}${x.bond ? ' · bond required' : ''} · expires ${U.dateStr(x.expires)}</div>
      <div class="btns">${UI.btn(`Bid at ${pr.markup} markup (${U.pct(w)} win)`, 'cxBid', x.id, 'sm pri')}</div></div>`; }).join('') || '<div class="mute">No offers this month.</div>'}</div>`;
    return o;
  } };
  UI.A.cxMarkup = (v) => { biz().proj.markup = v; UI.refresh(); };
  UI.A.cxAuto = () => { const b = biz(); b.proj.autoBid = !b.proj.autoBid; UI.refresh(); };
  UI.A.cxBid = (id) => { const b = biz(); const r = TG.M.bid(TG.G, b, id, b.proj.markup, 'You'); if (!UI.res(r)) return UI.refresh(); UI.toast(r.won ? `Won! Contract ${m(r.price)}.` : `Lost the bid (${U.pct(r.win)} odds).`, !r.won); UI.refresh(); };

  // ---------- FACTORY ----------
  P.factory = { label: 'Production', render(g, b) {
    const f = b.factory, fd = TG.CONFIG.businesses.factory.factory, M = TG.M.models.factory; const lc = b.lastCtx || {};
    return `<div class="card"><div class="kv"><span>Production lines</span><span>${M.lines(b).length} of max ${M.maxLines(b)} (space)</span><span>Made last month</span><span>${(lc.served || 0).toLocaleString()} of ${(lc.cap || 0).toLocaleString()} capacity</span>
      <span>Warehouse stock</span><span>${Math.round(f.stock).toLocaleString()} units</span><span>Price now</span><span>${m(TG.W.price(g, 'goods', 0) * (1 + f.premium))}${f.premium ? ` (+${U.pct(f.premium)} R&D premium)` : ''}</span><span>Material cost</span><span>${m(fd.materialCost * g.world.priceIdx)}/unit</span></div>
      ${g.markets.goods.hist ? UI.spark(g.markets.goods.hist.slice(-60), '#a16207') : ''}
      <div class="kv" style="margin-top:6px"><span>When prices are weak</span><span><select data-change="facPol"><option value="hold"${f.policy === 'hold' ? ' selected' : ''}>Hold stock (up to ${fd.maxStockMonths} months)</option><option value="sell"${f.policy !== 'hold' ? ' selected' : ''}>Always sell everything</option></select></span></div>
      <div class="mute">Holding waits for better prices but costs storage. Flooding the market pushes prices down.</div></div>`;
  } };
  UI.A.facPol = (v) => { biz().factory.policy = v; UI.refresh(); };

  // ---------- TECH ----------
  P.tech = { label: 'Product', render(g, b) {
    const t = b.tech, T = TG.CONFIG.businesses.tech.tech;
    return `<div class="card"><div class="kv"><span>Stage</span><span>${t.phase === 'build' ? `Building: ${Math.min(100, Math.round(t.dev / T.devPoints * 100))}%` : 'Live'}</span><span>Users</span><span>${t.users.toLocaleString()} (peak ${t.peak.toLocaleString()})</span>
      <span>Product-market fit</span><span>${t.pmfEst != null ? `~${U.pct(t.pmfEst)} (estimate)` : 'unknown'}</span><span>Revenue per user</span><span>${m(T.arpu * g.world.priceIdx)}/mo</span><span>Server capacity</span><span>${Math.round(TG.E.capacity(b, 'server')).toLocaleString()} users</span></div>
      ${t.phase === 'build' ? UI.bar(t.dev, T.devPoints) : ''}
      <div class="btns">${t.researched ? '' : UI.btn(`Market research (${m(T.researchCost * g.world.priceIdx)})`, 'fix', 'research|1', 'sm')}${UI.btn(`Pivot (${m(100000 * g.world.priceIdx)}, lose 80% of users)`, 'techPivot', null, 'sm badb')}</div>
      <div class="mute">Most startups never find fit. Engineers speed up building and keep users happy; ads buy users (getting pricier as you grow); servers must keep up or outages drive users away. Research improves fit before launch and gives a rough estimate.</div></div>`;
  } };
  UI.A.techPivot = () => UI.confirm('Pivot the product? You restart development with a new, unknown fit.', 'techPivotGo');
  UI.A.techPivotGo = () => { const r = TG.M.techPivot(TG.G, biz()); UI.closeModal(); after(r, 'Pivoted. Back to building.'); };

  // ---------- FRANCHISE ----------
  P.franchise = { label: 'Franchisees', render(g, b) {
    const s = b.fr, fr = TG.CONFIG.businesses.franchise.franchise; const C = TG.CONFIG;
    const open = s.locations.filter((l) => l.status === 'open'), building = s.locations.filter((l) => l.status === 'building'), closed = s.locations.filter((l) => l.status === 'closed');
    return `<div class="card"><div class="kv"><span>Concept</span><span>${C.businesses[s.concept] ? C.businesses[s.concept].icon + ' ' + esc(C.businesses[s.concept].name) : esc(s.concept)}</span><span>Locations open</span><span>${open.length}${building.length ? ` (+${building.length} opening)` : ''}${closed.length ? `, ${closed.length} closed` : ''}</span>
      <span>Royalty</span><span>${U.pct(fr.royalty)} of franchisee sales</span><span>Fee per approval</span><span>${m(fr.fee * g.world.priceIdx)} (launch support costs ${m(fr.openCost * g.world.priceIdx)})</span><span>Regional managers</span><span>${b.staff.filter((e) => e.role === 'regional').length} (each oversees ~${C.businesses.franchise.roles.regional.cap} locations)</span></div>
      <div class="mute">Weak franchisees look fine on paper. Their hidden quality shows later, sometimes as a scandal that hurts the whole brand. Mystery shoppers and strict standards (Upgrades) help.</div></div>
      <div class="card"><h3 style="margin-top:0">Applications (${s.apps.length})</h3>${s.apps.map((a) => `<div class="ev"><div class="row sp"><b>${esc(a.name)}</b>${UI.pill(a.signal > 0.7 ? 'looks strong' : a.signal > 0.45 ? 'looks okay' : 'looks weak', a.signal > 0.7 ? 'good' : a.signal > 0.45 ? 'warn' : 'bad')}</div><div class="small">Capital ${m(a.capital)} · expires ${U.dateStr(a.expires)}</div><div class="btns">${UI.btn('Approve', 'frApp', a.id, 'sm goodb')}${UI.btn('Reject', 'frRej', a.id, 'sm')}</div></div>`).join('') || '<div class="mute">No applications. Reputation and ads attract applicants.</div>'}</div>`;
  } };
  UI.A.frApp = (id) => after(TG.M.franchiseApprove(TG.G, biz(), id, 'You'), 'Approved: opening in ~3 months.');
  UI.A.frRej = (id) => after(TG.M.franchiseReject(TG.G, biz(), id), 'Rejected.');
})();
