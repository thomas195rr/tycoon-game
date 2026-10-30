/* ui-models.js - icon-first stock rows ("cow rows") for every business + each model's extra panel. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const biz = () => TG.B.get(TG.G, UI.bizId);
  const P = (UI.modelPanel = {});
  const after = (r, msg) => { UI.res(r, msg); UI.refresh(); };
  const N = (x) => Math.round(x || 0).toLocaleString();
  const qty = (id, def) => `<input type="number" id="${id}" min="1" value="${Math.max(1, Math.round(def || 1))}" aria-label="how many">`;
  const FD = () => TG.CONFIG.businesses.farm.farm;

  // ================= STOCK CARD (every business) =================
  UI.stockCard = (g, b) => {
    const d = TG.B.def(b); let rows = ''; let title = '📦 What you have';
    if (b.farm) { const r = farmRows(g, b); rows = r.rows; title = r.title; }
    else if (d.model === 'service') rows = serviceRows(g, b);
    else if (b.brand) rows = brandRows(g, b);
    else if (b.factory) rows = factoryRows(g, b);
    else if (b.tech) rows = techRows(g, b);
    else if (b.proj) rows = projRows(g, b);
    else if (b.fr) rows = frRows(g, b);
    else if (d.model === 'freight') rows = freightRows(g, b);
    return rows ? `<div class="card"><h3>${title}</h3>${rows}<div class="btns">${UI.btn(b.farm && TG.M.isLivestock(b.farm) ? '🐄 See all cows' : '🔍 See all', 'detail', 'stock', 'sm')}</div></div>` : '';
  };

  // ---- services: supplies + what you sell + who you serve ----
  function serviceRows(g, b) {
    const d = TG.B.def(b), gd = TG.PR.good(b) || {}, lc = b.lastCtx || {}; let o = '';
    const s = TG.ST.def(b);
    if (s) {
      const st = TG.ST.ensure(b); const cap = TG.ST.cap(b); const uc = TG.ST.unitCost(g, b);
      const per = Math.max(1, Math.round(lc.served || cap / 3));
      o += UI.irow('sup' + b.id, s.icon, s.label, `${N(st.qty)}/${N(cap)}`, `${s.desc || 'Used up by every sale.'} ${m(uc)} each. ${U.pct(s.spoil, 0)} of leftovers spoil each month. Run out = customers turned away.`,
        qty('qSup', per) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.btn(st.auto ? '🤖 Auto ✓' : '🤖 Auto ✗', 'stAuto', null, 'xs' + (st.auto ? ' pri' : '')),
        `last month: +${N(st.inM)} in · −${N(st.usedM)} used${st.spoilM ? ' · −' + N(st.spoilM) + ' spoiled' : ''}${st.lastBy ? ' · ordered by ' + esc(st.lastBy) : ''}`);
      o += `<div style="margin:0 0 6px 48px">${UI.bar(st.qty, Math.max(cap, 1))}</div>`;
    }
    const gIcon = gd.icon || d.icon;
    if (b.type === 'gym') o += UI.irow('mem' + b.id, '🏋️', 'Members', `${N(b.members || lc.served)}/${N(lc.cap)}`, `Members pay monthly. About ${U.pct((d.svc || {}).churn || 0.045)} leave each month; new ones join if you have room and a good reputation.`);
    else if (b.type === 'hotel') { const rooms = Math.max(1, Math.round((lc.cap || 0) / 30)); o += UI.irow('rm' + b.id, '🛏️', 'Rooms filled', `${N((lc.served || 0) / 30)}/${N(rooms)}`, 'Average rooms sold per night last month. Empty rooms earn nothing.'); }
    else o += UI.irow('sv' + b.id, gIcon, gd.label ? gd.label + ' sold' : 'Sold', `${N(lc.served)}/${N(lc.cap)}`, `Last month you sold ${N(lc.served)}. You could do ${N(lc.cap)}. Customers wanted ${N(lc.demand)}.`);
    if (d.svc && d.svc.makeAhead) o += UI.irow('mk' + b.id, '🧺', 'Made fresh, not sold', N(b.stock ? b.stock.wasteM : 0), 'Fresh goods are made ahead each morning. Unsold ones go in the bin.');
    const keyR = TG.M.keyRole(d); const key = b.staff.filter((e) => e.role === keyR).length;
    o += UI.irow('kst' + b.id, '👥', (d.roles[keyR] || {}).label || 'Workers', N(key), 'Your key workers. Each can serve a set amount per month.', UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    const eq = b.equip.filter((x) => x.broken !== 'destroyed'); const br = eq.filter((x) => x.broken).length; const wear = TG.E.avgWear(b);
    o += UI.irow('eqw' + b.id, '🛠️', 'Equipment', `${eq.length - br}/${eq.length}`, `Working / total. Average wear ${Math.round(wear)}%. Worn gear breaks more often.`, UI.btn('Open', 'tab', 'biz:equip', 'xs'), br ? `<span class="bad">${br} broken</span>` : `wear ${Math.round(wear)}%`);
    return o;
  }
  UI.A.stBuy = () => { const g = TG.G, b = biz(); const n = TG.ST.buy(g, b, UI.num('qSup', 0), 0); after(n > 0 ? { ok: true } : { ok: false, msg: 'No room or not enough cash.' }, `Bought ${N(n)}.`); };
  UI.A.stSell = () => { const g = TG.G, b = biz(); const v = TG.ST.sell(g, b, UI.num('qSup', 0)); after(v > 0 ? { ok: true } : { ok: false, msg: 'Nothing to sell.' }, `Sold back for ${m(v)} (half price).`); };
  UI.A.stAuto = () => { const b = biz(); const st = TG.ST.ensure(b); st.auto = !st.auto; UI.toast(st.auto ? 'Staff/manager will reorder each month.' : 'Only you order now. Watch the count!'); UI.refresh(); };

  // ---- farm: cows / crops ----
  function farmRows(g, b) {
    const f = b.farm, fd = FD(), e = fd.enterprises[f.ent]; let o = '';
    if (TG.M.isLivestock(f)) {
      if (f.cows == null) TG.M.herdInit(f, f.herd || 0);
      const cap = TG.M.farmHeadCap(b); const cp = TG.M.cowPrice(g, b); const beef = TG.W.price(g, 'beef', 0);
      const youngN = U.sum(f.young || [], (x) => x.n); const fc = TG.M.herdForecast(g, b);
      o += UI.irow('cow' + b.id, f.ent === 'dairy' ? '🐄' : '🐄', 'Cows', `${N(f.cows)}`, `Grown-up mothers. Each has about ${U.pct(e.calving)} chance of a calf each spring. They retire at ${Math.round(e.lifespan / 12)} years. Buy ${m(cp)} each, sell ${m(beef * 0.75)}.`,
        qty('qCow', 10) + UI.btn('🛒 Buy', 'cowBuy', null, 'xs goodb') + UI.btn('Sell', 'cowSell', 'cows', 'xs'), `whole herd ${N(f.herd)}/${N(cap)} space`);
      o += `<div style="margin:0 0 6px 48px">${UI.bar(f.herd, cap, true)}</div>`;
      const bars = []; let mx = 1; for (let a = 0; a < e.matureAge; a++) { const n = U.sum((f.young || []).filter((x) => x.age === a), (x) => x.n); bars.push(n); mx = Math.max(mx, n); }
      o += UI.irow('yng' + b.id, '🐮', 'Calves & young', N(youngN), `Born Mar-May. They grow for ${e.matureAge} months, then are ready to sell (some girls stay as new cows). Calves eat less.`, null, `0 → ${e.matureAge} months old`);
      o += `<div class="age" style="margin-left:48px" title="age in months">${bars.map((n) => `<i style="height:${Math.round(n / mx * 100)}%"></i>`).join('')}<i class="rd" style="height:${Math.round(Math.min(1, (f.ready || 0) / mx) * 100)}%"></i></div><div class="mute" style="margin-left:48px">age 0 → ${e.matureAge} months · <span class="good">green = ready</span></div>`;
      o += UI.irow('rdy' + b.id, '🐂', 'Ready to sell', N(f.ready), `Market age ${e.matureAge} months. Sold each month at your price (${m(TG.PR.ask(g, b))}) if buyers agree. Market ${m(beef)}.`,
        qty('qRdy', f.ready || 1) + UI.btn('💵 Sell', 'cowSell', 'ready', 'xs goodb'));
      if (f.ent === 'dairy') { const pc = TG.M.farmParlorCap(b); o += UI.irow('mlk' + b.id, '🥛', 'Cows milked', `${N(Math.min(f.cows, pc))}/${N(f.cows)}`, `A milking parlor milks ${N(160)} cows. Unmilked cows make nothing. Milk can't be stored: unsold milk spoils.`, UI.btn('+ Parlor', 'tab', 'biz:equip', 'xs'), `about ${N(Math.min(f.cows, pc) * e.milkPerCow)} t milk / month`); }
      o += UI.irow('fd' + b.id, '🌽', 'Feed next month', m(fc.feed), 'Every animal eats every month. Pasture is cheap; barn spaces cost more.');
      o += UI.irow('lf' + b.id, '📅', 'Next month', `+${N(fc.births)} / −${N(fc.deaths + fc.culls)}`, `Births ${N(fc.births)} · reaching market age ${N(fc.matured)} · deaths ~${N(fc.deaths)} · old cows retiring ~${N(fc.culls)}.`, null, `born / lost`);
      return { title: f.ent === 'dairy' ? '🐄 Dairy herd' : '🐄 Herd', rows: o };
    }
    // crops & orchards
    const cap = TG.M.farmStoreCap(b), used = TG.M.farmStoreUsed(b); const price = TG.W.price(g, e.market, 0);
    o += UI.irow('crp' + b.id, f.ent === 'orchard' ? '🍎' : '🌾', f.ent === 'orchard' ? 'Fruit stored' : 'Grain stored', `${N(f.stored)} t`, `Harvest goes here if you don't sell it. Costs ${m(e.storageCost || 0)}/t a month and ${U.pct(e.spoil || 0, 1)} spoils. Full storage = the rest is sold cheap or rots.`,
      qty('qCrop', f.stored || 1) + UI.btn('💵 Sell', 'cropSell', null, 'xs goodb'), `market ${m(price)}/t`);
    if (f.ent === 'crops') {
      const sc = TG.M.models.farm.seedCost(g, b);
      o += UI.irow('sd' + b.id, '🌱', 'Seed', `${N(f.seeds)} / ${N(f.acres)} acres`, `You must buy seed before planting (${m(sc)} per acre). Seed takes storage space. Auto buys just enough before planting.`,
        qty('qSeed', Math.max(1, f.acres - (f.seeds || 0))) + UI.btn('🛒 Buy', 'seedBuy', null, 'xs goodb') + UI.btn('Sell', 'seedSell', null, 'xs') + UI.btn(f.autoSeeds ? '🤖 Auto ✓' : '🤖 Auto ✗', 'seedAuto', null, 'xs' + (f.autoSeeds ? ' pri' : '')));
      o += UI.irow('pl' + b.id, '🌿', 'Growing', f.planted ? `${N(f.planted)} acres` : '—', 'Planted in spring, harvested in fall.');
    } else o += UI.irow('tr' + b.id, '🌳', 'Trees', f.orchardAge >= 999 ? 'grown' : `${Math.round(f.orchardAge || 0)}/${e.rampMonths} mo`, 'Young trees give little fruit until fully grown.');
    o += UI.irow('sto' + b.id, '🏚️', 'Storage', `${N(used)}/${N(cap)} t`, 'Grain and seed share this. Add bins or silos in Equipment.', UI.btn('+ Bins', 'tab', 'biz:equip', 'xs'));
    o += `<div style="margin:0 0 6px 48px">${UI.bar(used, Math.max(cap, 1), true)}</div>`;
    o += UI.irow('pol' + b.id, '🧺', 'At harvest', null, 'Sell now, store and wait, or let your manager decide each month.', ['sell', 'store', 'auto'].map((p) => UI.btn({ sell: '💵 Sell', store: '🏚️ Store', auto: '🤖 Auto' }[p], 'farmPol', p, 'xs' + (f.sellPolicy === p ? ' pri' : ''))).join(''));
    return { title: f.ent === 'orchard' ? '🍎 Orchard' : '🌾 Crops', rows: o };
  }
  UI.A.cowBuy = () => after(TG.M.farmBuyCattle(TG.G, biz(), UI.num('qCow', 0)), 'Bought.');
  UI.A.cowSell = (w) => { const r = TG.M.farmSellCattle(TG.G, biz(), UI.num(w === 'cows' ? 'qCow' : 'qRdy', 0), w); after(r, r.ok ? `Sold ${r.head} for ${m(r.rev)}.` : null); };
  UI.A.cropSell = () => { const g = TG.G, b = biz(); const t = Math.min(UI.num('qCrop', 0), b.farm.stored); if (!(t > 0)) return UI.toast('Nothing stored.', true); const v = TG.M.models.farm.sellStored(g, b, t); UI.toast(v > 0 ? `Sold for ${m(v)}.` : 'Buyers said no at your price.', !(v > 0)); UI.refresh(); };
  UI.A.seedBuy = () => after(TG.M.farmBuySeeds(TG.G, biz(), UI.num('qSeed', 0)), 'Seed bought.');
  UI.A.seedSell = () => after(TG.M.farmSellSeeds(TG.G, biz(), UI.num('qSeed', 0)), 'Seed sold (half price).');
  UI.A.seedAuto = () => { const f = biz().farm; f.autoSeeds = !f.autoSeeds; UI.refresh(); };
  UI.A.farmPol = (v) => { biz().farm.sellPolicy = v; UI.refresh(); };

  // ---- brand ----
  function brandRows(g, b) {
    const s = b.brand, br = TG.CONFIG.businesses.brand.brand; const room = TG.M.brandRoom(b); const inc = U.sum(s.incoming, (x) => x.units);
    let o = UI.irow('bst' + b.id, '👕', 'In the warehouse', `${N(s.stock)}/${N(room)}`, `Clothes ready to ship. Out of stock = lost orders. Old stock slowly goes out of style (${U.pct(0.015, 1)} a month).`,
      qty('brUnits', Math.max(br.minBatch, Math.round((s.avgOrders || 300) * 3 / 100) * 100)) + UI.btn('🏭 Order', 'brOrder', '0', 'xs goodb') + UI.btn('🧪 Test', 'brOrder', '1', 'xs'), `about ${m(br.unitCost * g.world.priceIdx)} each · min ${br.minBatch}`);
    o += `<div style="margin:0 0 6px 48px">${UI.bar(s.stock, Math.max(1, room), true)}</div>`;
    o += UI.irow('binc' + b.id, '🚚', 'On the way', N(inc), `Orders take ${br.leadMonths} months to arrive.`, null, s.incoming.map((x) => `${N(x.units)} in ${x.due - g.month} mo`).join(' · ') || 'nothing ordered');
    o += UI.irow('bord' + b.id, '🛒', 'Orders last month', N(s.lastOrders), 'How many people bought. Lost orders mean you ran out.', null, s.lostSales > 0 ? `<span class="bad">${N(s.lostSales)} lost: out of stock</span>` : `average ${N(s.avgOrders)}`);
    o += UI.irow('bfol' + b.id, '❤️', 'Followers', N(s.followers), 'Fans bring steady orders. Ads and good reviews grow them.');
    o += UI.irow('bclr' + b.id, '🏷️', 'Clearance sale', null, 'Sell old stock fast at about 40% of price. Hurts reputation a little.', [0.25, 0.5, 1].map((p) => UI.btn(U.pct(p), 'brClear', p, 'xs')).join(''));
    return o;
  }
  UI.A.brOrder = (t) => { const r = TG.M.brandOrder(TG.G, biz(), UI.num('brUnits', 0), t === '1'); after(r, r.ok ? `Ordered for ${m(r.cost)}.` : null); };
  UI.A.brClear = (p) => { const r = TG.M.brandClearance(TG.G, biz(), Number(p)); after(r.ok ? r : { ok: false, msg: 'Nothing to clear.' }, r.ok ? `Cleared ${r.units} units for ${m(r.rev)}.` : null); };

  // ---- factory ----
  function factoryRows(g, b) {
    const f = b.factory, fd = TG.CONFIG.businesses.factory.factory, M = TG.M.models.factory; const st = TG.ST.ensure(b); const cap = TG.ST.cap(b); const lc = b.lastCtx || {};
    let o = UI.irow('fraw' + b.id, '🪨', 'Raw materials', `${N(st.qty)}/${N(cap)}`, `Every unit made uses one. ${m(TG.ST.unitCost(g, b))} each. Space depends on your building and silos.`,
      qty('qSup', Math.max(1, lc.served || 1000)) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.btn(st.auto ? '🤖 Auto ✓' : '🤖 Auto ✗', 'stAuto', null, 'xs' + (st.auto ? ' pri' : '')));
    o += `<div style="margin:0 0 6px 48px">${UI.bar(st.qty, Math.max(1, cap))}</div>`;
    o += UI.irow('fln' + b.id, '🏭', 'Production lines', `${M.lines(b).length}/${M.maxLines(b)}`, 'More lines need more space and more workers.', UI.btn('+ Line', 'tab', 'biz:equip', 'xs'), `made ${N(lc.served)} of ${N(lc.cap)} last month`);
    o += UI.irow('ffin' + b.id, '📦', 'Finished goods', N(f.stock), `Waiting to be sold. Storage costs ${m(fd.storagePerUnit * g.world.priceIdx)} each a month.`, ['hold', 'sell'].map((p) => UI.btn(p === 'hold' ? '⏸️ Hold if cheap' : '💵 Sell all', 'facPol', p, 'xs' + ((f.policy === 'hold') === (p === 'hold') ? ' pri' : ''))).join(''));
    return o;
  }
  UI.A.facPol = (v) => { biz().factory.policy = v; UI.refresh(); };

  // ---- tech ----
  function techRows(g, b) {
    const t = b.tech, T = TG.CONFIG.businesses.tech.tech; const sc = TG.E.capacity(b, 'server'); const eng = b.staff.filter((e) => e.role === TG.M.keyRole(TG.B.def(b))).length;
    let o = t.phase === 'build' ? UI.irow('tdev' + b.id, '🧱', 'App being built', `${Math.min(100, Math.round(t.dev / T.devPoints * 100))}%`, 'Engineers build the app. No users until it launches.') + `<div style="margin:0 0 6px 48px">${UI.bar(t.dev, T.devPoints)}</div>` : '';
    o += UI.irow('tus' + b.id, '📱', 'Users', `${N(t.users)}/${N(sc)}`, 'Each user pays every month. More users than servers can handle = outages and people leave.', UI.btn('+ Server', 'tab', 'biz:equip', 'xs'), `best ever ${N(t.peak)}`);
    o += UI.irow('tfit' + b.id, '🎯', 'Do people love it?', t.pmfEst != null ? '~' + U.pct(t.pmfEst) : '?', 'Product fit. Most apps never find it. Research gives a rough guess.', t.researched ? '' : UI.btn(`🔍 ${m(T.researchCost * g.world.priceIdx)}`, 'fix', 'research|1', 'xs'));
    o += UI.irow('teng' + b.id, '🧑‍💻', 'Engineers', N(eng), 'Build faster and keep users happy.', UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    o += UI.irow('tpv' + b.id, '🔄', 'Start over (pivot)', null, `Costs ${m(100000 * g.world.priceIdx)} and you lose 80% of users. New, unknown fit.`, UI.btn('Pivot', 'techPivot', null, 'xs badb'));
    return o;
  }
  UI.A.techPivot = () => UI.confirm('Pivot the product? You restart development with a new, unknown fit.', 'techPivotGo');
  UI.A.techPivotGo = () => { const r = TG.M.techPivot(TG.G, biz()); UI.closeModal(); after(r, 'Pivoted. Back to building.'); };

  // ---- construction ----
  function projRows(g, b) {
    const pr = b.proj, PC = TG.CONFIG.businesses.construction.projects; const crew = b.staff.filter((e) => e.role === 'laborer').length; const need = U.sum(pr.active, (p) => p.crew);
    let o = UI.irow('cja' + b.id, '🏗️', 'Jobs going', `${pr.active.length}/${PC.maxActive}`, 'Win bids in the Projects tab. Late jobs pay penalties.', UI.btn('Bids', 'tab', 'biz:model', 'xs'), `${pr.done || 0} finished so far`);
    o += UI.irow('ccr' + b.id, '🦺', 'Crew', `${crew}/${need}`, 'Workers you have / workers your jobs need. Short crew = late jobs.', UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    for (const p of pr.active) o += UI.irow('cp' + p.id, p.elapsed > p.deadline ? '⏰' : '🧱', p.label, `${Math.round(p.progress * 100)}%`, `Month ${p.elapsed} of ${p.months}, deadline ${p.deadline}. Pays ${m(p.price)}.`, null, `${UI.bar(p.progress, 1)}`);
    return o;
  }
  // ---- franchise ----
  function frRows(g, b) {
    const s = b.fr; const L = (st) => s.locations.filter((l) => l.status === st).length;
    let o = UI.irow('fop' + b.id, '🏪', 'Shops open', N(L('open')), 'Each one pays you a share of its sales every month.', null, `${L('building')} opening soon · ${L('closed')} closed`);
    o += UI.irow('fap' + b.id, '📝', 'People asking to join', N(s.apps.length), 'Approve good ones in the Franchisees tab. Weak owners can hurt your brand later.', UI.btn('See', 'tab', 'biz:model', 'xs'));
    o += UI.irow('frg' + b.id, '🧭', 'Area managers', N(b.staff.filter((e) => e.role === 'regional').length), `Each looks after about ${TG.CONFIG.businesses.franchise.roles.regional.cap} shops.`, UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    return o;
  }
  // ---- freight ----
  function freightRows(g, b) {
    const tr = b.equip.filter((x) => x.type === 'truck' && x.broken !== 'destroyed'); const dr = b.staff.filter((e) => e.role === 'driver').length; const lc = b.lastCtx || {};
    let o = UI.irow('ftr' + b.id, '🚛', 'Trucks working', `${tr.filter((x) => !x.broken).length}/${tr.length}`, 'Each truck can do a set number of loads a month if it has a driver.', UI.btn('+ Truck', 'tab', 'biz:equip', 'xs'), `average wear ${Math.round(TG.E.avgWear(b, (x) => x.type === 'truck'))}%`);
    { const st = TG.ST.ensure(b); const cap = TG.ST.cap(b);
      o += UI.irow('fdz' + b.id, '⛽', 'Diesel', `${N(st.qty)}/${N(cap)}`, `${TG.ST.def(b).desc} ${m(TG.ST.unitCost(g, b))} a tank now. Room grows with trucks and yard tanks.`,
        qty('qSup', Math.max(1, lc.served || 14)) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.btn(st.auto ? '🤖 Auto ✓' : '🤖 Auto ✗', 'stAuto', null, 'xs' + (st.auto ? ' pri' : '')), 'tanks (1 tank ≈ 1 load)');
      o += `<div style="margin:0 0 6px 48px">${UI.bar(st.qty, Math.max(1, cap))}</div>`; }
    o += UI.irow('fdr' + b.id, '🧑‍✈️', 'Drivers', `${dr}/${tr.length}`, 'About one driver per truck.', UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    o += UI.irow('fld' + b.id, '📦', 'Loads', `${N(lc.served)}/${N(lc.cap)}`, 'Loads hauled / loads you could haul last month.');
    o += UI.irow('ffu' + b.id, '⛽', 'Fuel price', `x${g.world.fuel.toFixed(2)}`, 'Locking (hedging) fuel for 12 months wins if fuel spikes, loses if it falls.', UI.btn(b.hedge && b.hedge.until > g.month ? '🔒 Locked' : '🔒 Lock 12 mo', 'frHedge', null, 'xs'));
    return o;
  }
  UI.A.frHedge = () => { const r = TG.M.freightHedge(TG.G, biz()); after(r, r.ok ? `Hedged for ${m(r.cost)}.` : null); };

  // ================= EXTRA TABS =================
  P.farm = { label: '🌄 Land', render(g, b) {
    const f = b.farm, fd = FD(), e = fd.enterprises[f.ent]; const st = g.markets[e.market];
    let o = `<div class="card"><h3>🌄 Your land</h3>
      ${UI.irow('ac' + b.id, '🗺️', 'Land', `${N(f.acres)} acres`, `Neighbouring land costs about ${m(TG.M.farmLandPrice(g, b))} an acre.`, qty('farmAc', 50) + UI.btn('💵 Buy', 'farmDo', 'land', 'xs goodb') + UI.btn('🏦 Loan', 'farmDo', 'landM', 'xs'))}
      ${UI.irow('ir' + b.id, '💧', 'Watered (irrigated)', `${N(f.irrigated)}/${N(f.acres)}`, `Cuts drought losses by ${U.pct(fd.irrigationDroughtCut)}. ${m(fd.irrigationPerAcre * g.world.priceIdx)} an acre (uses the acres box above).`, UI.btn('💧 Add', 'farmDo', 'irr', 'xs'))}
      ${UI.irow('so' + b.id, '🟫', 'Soil', Math.round(f.soil * 100), 'Good soil grows more. Same crop every year wears it out a little.')}
      ${st && st.hist ? `<div class="mute">📉 ${esc(e.market)} price, last 5 years</div>${UI.spark(st.hist.slice(-60), '#f59e0b')}` : ''}</div>`;
    if (!TG.M.isLivestock(f)) o += `<div class="card"><h3>🔒 Lock a price</h3>${UI.irow('fut' + b.id, '📜', 'Sold ahead', `${N(U.sum(f.futures, (x) => x.qty - (x.done || 0)))} t`, `Lock ${U.pct(fd.futuresDiscount)} of today's price now. You must still deliver even after a bad harvest. Max ${U.pct(fd.futuresMax)} of the expected crop.`, qty('futQty', 100) + UI.btn('🔒 Lock', 'farmDo', 'futures', 'xs'))}</div>`;
    o += `<div class="card"><h3>🔁 Farm something else</h3><div class="btns">${Object.entries(fd.enterprises).filter(([k]) => k !== f.ent).map(([k, x]) => UI.btn(`${{ crops: '🌾', cattle: '🐄', orchard: '🍎', dairy: '🥛' }[k] || ''} ${esc(x.label)}`, 'farmSw', k, 'sm')).join('')}</div><div class="mute">Orchards take ~${fd.enterprises.orchard.rampMonths} months to grow. Cattle and dairy need a herd.</div></div>`;
    return o;
  } };
  UI.A.farmDo = (k) => {
    const g = TG.G, b = biz();
    if (k === 'futures') { const r = TG.M.farmFutures(g, b, UI.num('futQty', 0)); return after(r, r.ok ? `Locked ${r.qty} t at ${m(r.price)}.` : null); }
    if (k === 'land' || k === 'landM') return after(TG.M.farmBuyLand(g, b, UI.num('farmAc', 0), k === 'landM'), 'Land bought.');
    if (k === 'irr') return after(TG.M.farmIrrigate(g, b, UI.num('farmAc', 0) || b.farm.acres), 'Watering installed.');
  };
  UI.A.farmSw = (k) => after(TG.M.farmSwitch(TG.G, biz(), k), 'Switched.');

  P.projects = { label: '📝 Bids', render(g, b) {
    const pr = b.proj, PC = TG.CONFIG.businesses.construction.projects; const M = TG.M.models.projects;
    let o = `<div class="card"><h3>🏷️ Your markup</h3><div class="btns">${Object.keys(PC.markups).map((k) => UI.btn(`${k} +${U.pct(PC.markups[k])}`, 'cxMarkup', k, 'sm' + (pr.markup === k ? ' pri' : ''))).join('')}</div>
      ${UI.irow('cxa' + b.id, '🤖', 'Managers bid for me', null, 'Higher markup = more profit per job but you win fewer. Too many jobs for your crew = late penalties.', UI.btn(pr.autoBid ? '✅ On' : 'Off', 'cxAuto', null, 'xs' + (pr.autoBid ? ' goodb' : '')))}</div>`;
    o += `<div class="card"><h3>📝 Jobs you can bid on</h3>${pr.offers.map((x) => { const w = M.winChance(g, b, x, pr.markup); return UI.irow('cxo' + x.id, '🏠', x.label, m(x.cost), `${x.months} months · ${x.crew} crew${x.heavy ? ' · excavator' : ''}${x.crane ? ' · crane' : ''}${x.bond ? ' · bond needed' : ''}. Expires ${U.dateStr(x.expires)}.`, UI.btn(`Bid (${U.pct(w)} win)`, 'cxBid', x.id, 'xs pri'), 'cost to build'); }).join('') || '<div class="mute">No jobs this month.</div>'}</div>`;
    return o;
  } };
  UI.A.cxMarkup = (v) => { biz().proj.markup = v; UI.refresh(); };
  UI.A.cxAuto = () => { const b = biz(); b.proj.autoBid = !b.proj.autoBid; UI.refresh(); };
  UI.A.cxBid = (id) => { const b = biz(); const r = TG.M.bid(TG.G, b, id, b.proj.markup, 'You'); if (!UI.res(r)) return UI.refresh(); UI.toast(r.won ? `Won! Contract ${m(r.price)}.` : `Lost the bid (${U.pct(r.win)} odds).`, !r.won); UI.refresh(); };

  P.franchise = { label: '📝 Join requests', render(g, b) {
    const s = b.fr, fr = TG.CONFIG.businesses.franchise.franchise;
    return `<div class="card"><h3>📝 Want to open a shop (${s.apps.length})</h3><div class="mute">You get ${m(fr.fee * g.world.priceIdx)} per shop, then ${U.pct(fr.royalty)} of its sales. Weak owners look fine at first.</div>${s.apps.map((a) => UI.irow('fa' + a.id, a.signal > 0.7 ? '😀' : a.signal > 0.45 ? '🙂' : '😟', a.name, m(a.capital), `Looks ${a.signal > 0.7 ? 'strong' : a.signal > 0.45 ? 'okay' : 'weak'}. Expires ${U.dateStr(a.expires)}.`, UI.btn('✅', 'frApp', a.id, 'xs goodb') + UI.btn('❌', 'frRej', a.id, 'xs'), 'their savings')).join('') || '<div class="mute">Nobody yet. Good reputation and ads bring people.</div>'}</div>`;
  } };
  UI.A.frApp = (id) => after(TG.M.franchiseApprove(TG.G, biz(), id, 'You'), 'Approved: opening in ~3 months.');
  UI.A.frRej = (id) => after(TG.M.franchiseReject(TG.G, biz(), id), 'Rejected.');
})();
