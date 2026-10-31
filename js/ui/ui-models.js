/* ui-models.js - icon-first stock rows ("cow rows") for every business + each model's extra panel. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const biz = () => TG.B.get(TG.G, UI.bizId);
  const P = (UI.modelPanel = {});
  const after = (r, msg) => { UI.res(r, msg); UI.refresh(); };
  const N = (x) => Math.round(x || 0).toLocaleString();
  const qty = (id, def) => `<input type="number" id="${id}" min="1" value="${Math.max(1, Math.round(def || 1))}" aria-label="how many">`;
  const FD = () => TG.CONFIG.businesses.farm.farm;

  // v8: Auto reorder only exists with a manager who handles supplies; otherwise say so plainly + offer a one-tap "fill for next month"
  UI.autoBtn = (g, b, st) => {
    const h = TG.D.handler(g, b, 'stock'); const q = TG.ST.suggest(b, g); const fill = q > 0 ? UI.btn(`📦 Fill for next month: ${N(q)} (${m(q * TG.ST.unitCost(g, b))})`, 'stBuyN', `${b.id}|${q}`, 'xs pri') : '';
    if (!h) return fill + UI.btn('🤖 Auto: needs a manager', 'stAutoNo', null, 'xs');
    return fill + UI.btn(st.auto ? `🤖 Auto ✓ (${esc((TG.CONFIG.specialists[h.role] || { label: 'CEO' }).label)})` : '🤖 Auto ✗', 'stAuto', null, 'xs' + (st.auto ? ' pri' : ''));
  };
  UI.A.stAutoNo = () => UI.toast('No one reorders for you yet: buy supplies yourself each month (🛒 Buy or 📦 Fill), or hire an Ops manager or GM in Staff to do it.', true);
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
    const d = TG.B.def(b), gd = TG.PR.good(b) || {}, lc = UI.lc(b); let o = '';
    const s = TG.ST.def(b);
    if (s) {
      const st = TG.ST.ensure(b); const cap = TG.ST.cap(b); const uc = TG.ST.unitCost(g, b);
      const per = Math.max(1, Math.round(lc.served || cap / 3));
      o += UI.irow('sup' + b.id, s.icon, s.label, `${N(st.qty)}/${N(cap)}`, `${s.desc || 'Used up by every sale.'} ${m(uc)} each. ${U.pct(s.spoil, 0)} of leftovers spoil each month. Run out = customers turned away.`,
        qty('qSup', per) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.autoBtn(g, b, st),
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
  UI.A.stAuto = () => { const b = biz(); const st = TG.ST.ensure(b); st.auto = !st.auto; UI.toast(st.auto ? 'Your manager will reorder each month.' : 'Only you order now. Watch the count!'); UI.refresh(); };

  // ---- farm: a short summary per area (details live on the 🌄 Land tab) ----
  function farmRows(g, b) {
    const f = TG.M.farmEnsure(b), A = f.areas; let o = '';
    if (A.cows.st) TG.M.herdSync(A.cows); /* v10: count the herd BEFORE deciding to show it, so 1 dry cow on a farm with no cow acres still gets its row */
    if (A.cows.acres || A.cows.herd || (A.cows.st && TG.M.cowStages.some((k) => (A.cows.st[k] || 0) > 0))) {
      const a = A.cows, HC = TG.CONFIG.cows; TG.M.herdSync(a);
      const cap = TG.M.farmHeadCap(b); const fc = TG.M.herdForecast(g, b); const mgr = TG.D.handler(g, b, 'farm');
      o += UI.irow('cow' + b.id, '🐄', 'Herd', `${N(a.herd)}/${N(cap)}`, `All your cattle / room (grass + barns). Health ${U.pct(a.health || 0)}. Tap "See all cows" for every stage.`, UI.btn('🐄 See all cows', 'detail', 'stock', 'xs'), `health ${U.pct(a.health || 0)}`);
      o += `<div style="margin:0 0 6px 48px">${UI.bar(a.herd, cap, true)}</div>`;
      o += `<div class="small herdchips" style="margin:0 0 6px 48px">${TG.M.cowStages.map((k) => `<span data-act="tip" data-arg="hc${b.id}${k}" data-nosave="1" style="cursor:pointer">${HC.stages[k].icon} ${N(Math.floor(a.st[k] || 0))} ${esc(HC.stages[k].label.toLowerCase())}</span>`).join('')} ${UI.tipBtn('hc' + b.id + 'all')}</div>${UI.tipLine('hc' + b.id + 'all', 'Tap any group (calves, heifers...) to see what it does, what it costs and what to do with it.')}${TG.M.cowStages.map((k) => UI.cowStageTip ? UI.tipLine('hc' + b.id + k, `${HC.stages[k].icon} ${HC.stages[k].label}: ${UI.cowStageTip(g, b, k)}`) : '').join('')}`;
      const fm = TG.M.feedMonths(g, b);
      o += UI.irow('fd' + b.id, '🌽', 'Feed in storage', `${N(f.feed || 0)} t`, `Cows eat grass first, then feed from storage (winter and dry months need lots). Next month they need about ${N(fc.buy)} t of feed. Feed costs ${m(TG.M.feedPrice(g))}/t. No feed = hungry cows: less milk, more sickness and deaths.${mgr ? ' Your manager keeps it topped up (Manager tab).' : ' No manager: you must buy it yourself.'}`,
        qty('qFeed', Math.max(Math.round(fc.buy * 2 - (f.feed || 0)), Math.round(TG.M.feedNeed(a) || 1), 1)) + UI.btn('🛒 Buy feed', 'feedBuy', null, 'xs goodb'), fm >= 99 ? 'grass is enough now' : `${fm < 1 ? '<span class="bad">' : ''}lasts ~${fm.toFixed(1)} months${fm < 1 ? '</span>' : ''}`);
      o += UI.irow('rdy' + b.id, '🥩', 'Market-ready', N(Math.floor(a.st.ready || 0)), `Steers at market weight. Sell them for meat (${m(TG.M.cowValue(g, 'ready'))} each). Keeping them only costs feed.${mgr ? '' : ' No manager: you must sell them yourself.'}`, qty('qRdy', Math.floor(a.st.ready || 0) || 1) + UI.btn('💵 Sell', 'cowSell', 'ready', 'xs goodb'), (() => { const n = Math.floor(a.st.ready || 0); return n ? `${m(Math.round(n * HC.stages.ready.feed * TG.M.feedPrice(g)))}/mo feed · worth ~${m(Math.round(n * TG.M.cowValue(g, 'ready') * HC.sellDrop))} as meat` : 'none ready yet'; })());
      { const n = Math.floor(a.st.dry || 0); const auto = !!(mgr && (((f.orders && f.orders.cows) || TG.M.cowOrderDefaults()).cullDry));
        o += UI.irow('dryN' + b.id, '👵', 'Dry / old cows', N(n), UI.cowStageTip ? UI.cowStageTip(g, b, 'dry') : HC.stages.dry.what, qty('qDry', n || 1) + UI.btn('💵 Sell', 'cowSell', 'dry', 'xs goodb'), n ? `no milk · ${m(Math.round(n * HC.stages.dry.feed * TG.M.feedPrice(g)))}/mo feed · worth ~${m(Math.round(n * TG.M.cowValue(g, 'dry') * HC.sellDrop))} as meat${auto ? ' · manager sells them monthly' : ''}` : (auto ? 'none · manager sells them monthly' : 'none right now')); }
      const pc = TG.M.farmParlorCap(b); o += UI.irow('mlk' + b.id, '🥛', 'Cows milked', `${N(Math.min(a.st.milker, pc))}/${N(a.st.milker)}`, `A milking parlor milks ${N(160)} cows. The dairy truck collects milk every day and sells it at your milk price. Unmilked cows make nothing.`, UI.btn('+ Parlor', 'tab', 'biz:equip', 'xs'), `about ${N(Math.min(a.st.milker, pc) * TG.M.areaE(b, 'cows').milkPerCow)} t milk / month`);
    }
    const cap = TG.M.farmStoreCap(b), used = TG.M.farmStoreUsed(b);
    for (const [k, good, ic] of [['crops', 'grain', '🌾'], ['orchard', 'fruit', '🍎']]) {
      const a = A[k]; if (!a.acres && !(f.stored[good] > 0)) continue; const e = TG.M.areaE(b, k); const price = TG.W.price(g, good, 0);
      o += UI.irow('st' + good + b.id, ic, good === 'grain' ? 'Grain stored' : 'Fruit stored', `${N(f.stored[good])} t`, `Harvest goes here if you don't sell it. Costs ${m(e.storageCost || 0)}/t a month and ${U.pct(e.spoil || 0, 1)} spoils a month. Full storage = the rest is sold cheap or rots.`,
        qty('q' + good, f.stored[good] || 1) + UI.btn('💵 Sell', 'cropSell', good, 'xs goodb'), `market ${m(price)}/t`);
      if (k === 'crops') o += UI.irow('pl' + b.id, '🌿', 'Growing', a.planted ? `${N(a.planted)} acres` : '—', 'Planted in spring, harvested in fall.');
      else o += UI.irow('tr' + b.id, '🌳', 'Trees', a.age >= e.rampMonths ? 'grown' : `${Math.round(a.age || 0)}/${e.rampMonths} mo`, 'Young trees give little fruit until fully grown.');
    }
    if (A.crops.acres || A.orchard.acres || used > 0) { o += UI.irow('sto' + b.id, '🏚️', 'Storage', `${N(used)}/${N(cap)} t`, 'Grain, fruit and seed share this. Add bins or silos in Gear.', UI.btn('+ Bins', 'tab', 'biz:equip', 'xs')); o += `<div style="margin:0 0 6px 48px">${UI.bar(used, Math.max(cap, 1), true)}</div>`; }
    o += `<div class="btns">${UI.btn('🌄 Land, soil & water', 'tab', 'biz:model', 'xs pri')}</div>`;
    return { title: '🚜 Farm', rows: o };
  }
  UI.A.cowBuy = (k) => after(TG.M.farmBuyCattle(TG.G, biz(), UI.num('qc_' + (k || 'milker'), 0), k || 'milker'), 'Bought.');
  UI.A.cowSell = (k) => { const r = TG.M.farmSellCattle(TG.G, biz(), UI.num(k === 'ready' && document.getElementById('qRdy') ? 'qRdy' : k === 'dry' && document.getElementById('qDry') ? 'qDry' : 'qc_' + k, 0), k); after(r, r.ok ? `Sold ${N(r.head)} for ${m(r.rev)}.` : null); };
  UI.A.feedBuy = () => { const want = Math.round(UI.num('qFeed', 0)); const r = TG.M.farmBuyFeed(TG.G, biz(), want, 'You'); after(r, r.ok ? `Bought ${N(r.tons)}${r.tons < want - 0.5 ? ` of ${N(want)}` : ''} t of feed for ${m(r.cost)}${r.tons < want - 0.5 ? ` (${TG.M.farmStoreFree(biz()) < 1 ? 'storage full' : 'not enough cash'})` : ''}.` : null); };
  UI.A.cropSell = (good) => { const g = TG.G, b = biz(); good = good || 'grain'; const t = Math.min(UI.num('q' + good, 0), b.farm.stored[good] || 0); if (!(t > 0)) return UI.toast('Nothing stored.', true); const v = TG.M.models.farm.sellStored(g, b, good, t); UI.toast(v > 0 ? `Sold for ${m(v)}.` : 'Buyers said no at your price.', !(v > 0)); UI.refresh(); };
  UI.A.seedBuy = () => { const g = TG.G, want = Math.round(UI.num('qSeed', 0)); const c0 = g.cash; const r = TG.M.farmBuySeeds(g, biz(), want); after(r, r.ok ? `Bought seed for ${N(r.acres)}${r.acres < want ? ` of ${N(want)}` : ''} acres for ${m(c0 - g.cash)}${r.acres < want ? ` (${TG.M.farmStoreFree(biz()) < 1 ? 'storage full' : 'not enough cash'})` : ''}.` : null); };
  UI.A.seedSell = () => after(TG.M.farmSellSeeds(TG.G, biz(), UI.num('qSeed', 0)), 'Seed sold (half price).');

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
    const f = b.factory, fd = TG.CONFIG.businesses.factory.factory, M = TG.M.models.factory; const st = TG.ST.ensure(b); const cap = TG.ST.cap(b); const lc = UI.lc(b);
    let o = UI.irow('fraw' + b.id, '🪨', 'Raw materials', `${N(st.qty)}/${N(cap)}`, `Every unit made uses one. ${m(TG.ST.unitCost(g, b))} each. Space depends on your building and silos.`,
      qty('qSup', Math.max(1, lc.served || 1000)) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.autoBtn(g, b, st));
    o += `<div style="margin:0 0 6px 48px">${UI.bar(st.qty, Math.max(1, cap))}</div>`;
    o += UI.irow('fln' + b.id, '🏭', 'Production lines', `${M.lines(b).length}/${M.maxLines(b)}`, 'More lines need more space and more workers.', UI.btn('+ Line', 'tab', 'biz:equip', 'xs'), `made ${N(lc.served)} of ${N(lc.cap)} last month`);
    o += UI.irow('ffin' + b.id, '📦', 'Finished goods', N(f.stock), `Waiting to be sold. Storage costs ${m(fd.storagePerUnit * g.world.priceIdx)} each a month.`, ['hold', 'sell'].map((p) => UI.btn(p === 'hold' ? '⏸️ Hold if cheap' : '💵 Sell all', 'facPol', p, 'xs' + ((f.policy === 'hold') === (p === 'hold') ? ' pri' : ''))).join(''));
    return o;
  }
  UI.A.facPol = (v) => { biz().factory.policy = v; UI.refresh(); };

  // ---- tech ----
  function techRows(g, b) {
    const t = b.tech, T = TG.CONFIG.businesses.tech.tech; const sc = TG.E.capacity(b, 'server'); const eng = b.staff.filter((e) => e.role === TG.M.keyRole(TG.B.def(b))).length;
    let o = t.phase === 'build' ? UI.irow('tdev' + b.id, '🧱', 'App being built', `${Math.min(100, Math.round(t.dev / T.devPoints * 100))}% now`, 'Engineers build the app each month. No users until it reaches 100% and launches.') + `<div style="margin:0 0 6px 48px">${UI.bar(t.dev, T.devPoints)}</div>` : '';
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
    const tr = b.equip.filter((x) => x.type === 'truck' && x.broken !== 'destroyed'); const dr = b.staff.filter((e) => e.role === 'driver').length; const lc = UI.lc(b);
    let o = UI.irow('ftr' + b.id, '🚛', 'Trucks working', `${tr.filter((x) => !x.broken).length}/${tr.length}`, 'Each truck can do a set number of loads a month if it has a driver.', UI.btn('+ Truck', 'tab', 'biz:equip', 'xs'), `average wear ${Math.round(TG.E.avgWear(b, (x) => x.type === 'truck'))}%`);
    { const st = TG.ST.ensure(b); const cap = TG.ST.cap(b);
      o += UI.irow('fdz' + b.id, '⛽', 'Diesel', `${N(st.qty)}/${N(cap)}`, `${TG.ST.def(b).desc} ${m(TG.ST.unitCost(g, b))} a tank now. Room grows with trucks and yard tanks.`,
        qty('qSup', Math.max(1, lc.served || 14)) + UI.btn('🛒 Buy', 'stBuy', null, 'xs goodb') + UI.btn('Sell', 'stSell', null, 'xs') + UI.autoBtn(g, b, st), 'tanks (1 tank ≈ 1 load)');
      o += `<div style="margin:0 0 6px 48px">${UI.bar(st.qty, Math.max(1, cap))}</div>`; }
    o += UI.irow('fdr' + b.id, '🧑‍✈️', 'Drivers', `${dr}/${tr.length}`, 'About one driver per truck.', UI.btn('Hire', 'tab', 'biz:staff', 'xs'));
    o += UI.irow('fld' + b.id, '📦', 'Loads', `${N(lc.served)}/${N(lc.cap)}`, 'Loads hauled / loads you could haul last month.');
    o += UI.irow('ffu' + b.id, '⛽', 'Fuel price', `x${g.world.fuel.toFixed(2)}`, 'Locking (hedging) fuel for 12 months wins if fuel spikes, loses if it falls.', UI.btn(b.hedge && b.hedge.until > g.month ? '🔒 Locked' : '🔒 Lock 12 mo', 'frHedge', null, 'xs'));
    return o;
  }
  UI.A.frHedge = () => { const r = TG.M.freightHedge(TG.G, biz()); after(r, r.ok ? `Hedged for ${m(r.cost)}.` : null); };

  // ================= EXTRA TABS =================
  // 🌄 Land: small land summary on top, then one section per area in order 🐄 → 🌾 → 🍎, each with its own soil, water and price
  const AD = () => FD().areas;
  P.farm = { label: '🌄 Land', render(g, b) {
    const f = TG.M.farmEnsure(b), M = TG.M; const free = M.farmFree(f);
    let o = `<div class="card"><div class="row sp"><h3 style="margin:0">🗺️ ${N(f.acres)} acres</h3>${UI.btn('➕ Buy land', 'landModal', null, 'xs')}</div>
      <div class="arealine">${M.farmAreas.map((k) => `<span>${AD()[k].icon} ${N(f.areas[k].acres)}</span>`).join('')}<span class="${free ? 'warn' : 'mute'}">⬜ ${N(free)} free</span></div>
      ${free ? `<div class="small">⬜ Free land does nothing until you give it to an area. ${UI.btn('↔️ Use it', 'moveModal', 'free', 'xs')}</div>` : ''}
      ${(f.moving || []).map((x) => `<div class="small">⏳ ${N(x.acres)} acres becoming ${AD()[x.to].icon} ${esc(AD()[x.to].label.toLowerCase())} · ready ${U.dateStr(x.ready)}</div>`).join('')}</div>`;
    for (const k of M.farmAreas) o += areaCard(g, b, k);
    // price locks + price history
    const goods = [['crops', 'grain', '🌾'], ['orchard', 'fruit', '🍎']].filter(([k]) => f.areas[k].acres > 0);
    if (goods.length) {
      o += `<div class="card"><h3>🔒 Lock a price ${UI.tipBtn('fut' + b.id)}</h3>${UI.tipLine('fut' + b.id, `Sell part of the next harvest now at ${U.pct(FD().futuresDiscount)} of today's price. You must still deliver even after a bad harvest. Max ${U.pct(FD().futuresMax)} of the expected crop.`)}`;
      for (const [k, good, ic] of goods) o += UI.irow('fu' + good + b.id, ic, `${good === 'grain' ? 'Grain' : 'Fruit'} sold ahead`, `${N(U.sum(f.futures.filter((x) => (x.mk || 'grain') === good), (x) => x.qty - (x.done || 0)))} t`, `Expected harvest about ${N(M.farmExpected(b, k))} t.`, qty('fq' + good, 100) + UI.btn('🔒 Lock', 'farmFut', k, 'xs'));
      o += `</div>`;
    }
    const mk = []; const A = f.areas; if (A.cows.acres) mk.push('milk', 'beef'); if (A.crops.acres) mk.push('grain'); if (A.orchard.acres) mk.push('fruit');
    o += `<div class="card"><details><summary>📉 Prices, last 5 years</summary>${mk.map((x) => g.markets[x] && g.markets[x].hist ? `<div class="mute">${esc(x)}</div>${UI.spark(g.markets[x].hist.slice(-60), '#f59e0b')}` : '').join('')}</details></div>`;
    return o;
  } };
  function areaCard(g, b, k) {
    const M = TG.M, f = b.farm, a = f.areas[k], ad = AD()[k], id = b.id + k; const W = TG.W.weatherOf(g, b.region);
    let o = `<div class="card area"><div class="row sp"><h3 style="margin:0">${ad.icon} ${esc(ad.label)} · ${N(a.acres)} ac</h3>${UI.btn('↔️ Move acres', 'moveModal', k, 'xs')}</div>`;
    if (!a.acres) return o + `<div class="mute">${esc(ad.what)} No acres here yet: move free land or acres from another area.</div></div>`;
    o += `<div class="mute">${esc(ad.what)}</div>`;
    if (k === 'cows') { // v6: cows need feed, not soil or water
      const cap = M.farmHeadCap(b); const odds = M.sickOdds(g, b, W); const grass = M.grass(g, b, W);
      o += UI.irow('gr' + id, '🌿', 'Grass this month', `${N(grass)} t`, `About ${TG.CONFIG.cows.grassPerHead} t per acre-cow in summer, little in winter (Dec-Feb) and dry spells. The rest comes from FEED in storage.`, null, `herd needs ${N(M.feedNeed(a))} t`);
      o += UI.irow('rm' + id, '🐄', 'Herd / room', `${N(a.herd)}/${N(cap)}`, 'One cow per acre of grass, plus pens and barns. Near full room, fewer calves are born; over full, cows get sick and die more.', UI.btn('🐄 See all cows', 'detail', 'stock', 'xs'));
      o += UI.irow('sk' + id, '🤒', 'Sick cows odds', UI.risk(odds.p), `This month: ${odds.why || 'no herd'}.`);
      const r = M.models.farm.ratio(b, k); const mk = M.models.farm.market(g, b, k, 0);
      o += UI.irow('pr' + id, '🏷️', 'Your milk price', a.askR == null ? 'market' : `x${r.toFixed(2)}`, `Market ${m(mk)} per t of milk. Above market the dairy buys less (the rest spoils). Meat is sold at market price when you sell cattle.`,
        UI.btn('➖', 'farmAsk', `${k}|-0.05`, 'xs') + UI.btn('➕', 'farmAsk', `${k}|0.05`, 'xs') + UI.btn('=', 'farmAsk', `${k}|0`, 'xs'), `${m(mk * r)} per t`);
      return o + '</div>';
    }
    // soil
    const drop = M.soilDrop(k, a.soil), add = M.soilAdd(a.soil); const sprayed = TG.USES.used(a, 'treat', g.month); const tc = M.farmTreatCost(g, b, k);
    o += UI.irow('so' + id, '🟫', 'Soil', `${Math.round(a.soil * 100)}%`, `Soil drops every month (faster when it is high: −${(drop * 100).toFixed(1)} pts next month at ${Math.round(a.soil * 100)}%). Nothing is sprayed unless YOU tap Spray (or a manager follows your spray order). No spray = no cost, and soil keeps dropping. Spray brings it back: +${Math.round(add * 100)} pts now (less when soil is already high). Yield x${M.soilYield(a.soil).toFixed(2)} at this soil (x${M.soilYield(1).toFixed(2)} at 100%, x${M.soilYield(0.4).toFixed(2)} at 40%).${k !== 'cows' ? ` Poor soil also raises pest odds.` : ' Good grass feeds more cows.'}`,
      sprayed ? '<span class="mute">sprayed ✓</span>' : UI.btn(`🧪 Spray ${m(tc)}`, 'farmSpray', k, 'xs goodb'), `yield x${M.soilYield(a.soil).toFixed(2)} · next month −${(drop * 100).toFixed(1)} pts · spray +${Math.round(add * 100)}`);
    o += `<div style="margin:0 0 6px 48px">${UI.bar(a.soil * 100, 100)}</div>`;
    // water
    const wtr = M.areaWater(b, k), cov = M.sprAcres(b, k); const ed = TG.E.def(b, ad.spr); const sp = TG.E.price(g, b, ad.spr, 'standard');
    const odds = k === 'cows' ? M.sickOdds(g, b, W) : M.dryOdds(g, b, k, W);
    o += UI.irow('wa' + id, '💧', 'Water', `${Math.round(wtr * 100)}%`, `Sprinklers cover ${N(Math.min(cov, a.acres))} of ${N(a.acres)} acres. Each ${ed.label.toLowerCase()} covers ${ed.acres} acres (${m(sp)}, wears out like other machines). ${k === 'cows' ? 'Watered pasture grows more grass (more room for cows) and keeps cows healthy in heat.' : `Water adds up to +${U.pct(FD().water.yieldK)} yield and lowers the odds of a dry-out.`} Rain on this land: ${U.pct(f.rain)}.`,
      UI.btn(`+ Sprinkler ${m(sp)}`, 'farmSpr', k, 'xs'), `${N(Math.min(cov, a.acres))}/${N(a.acres)} ac covered`);
    o += `<div style="margin:0 0 6px 48px">${UI.bar(wtr * 100, 100)}</div>`;
    if (k === 'cows') o += UI.irow('sk' + id, '🤒', 'Sick cows odds', UI.risk(odds.p), `This month: ${odds.why || 'no herd'}.`);
    else { o += UI.irow('dr' + id, '🥀', 'Dry-out odds', UI.risk(odds.p), `If it happens, ${U.pct(FD().water.lossRange[0])}-${U.pct(FD().water.lossRange[1])} of the ${ad.label.toLowerCase()} dies. Why: ${odds.why}.`, null, M.growing(k, U.moy(g.month)) ? 'this month' : 'off season (no risk now)');
      const po = M.pestOdds(g, b, k); o += UI.irow('pe' + id, '🐛', 'Pest & disease odds', UI.risk(po.p), `If it happens, ${U.pct(FD().water.pestRange[0])}-${U.pct(FD().water.pestRange[1])} of the crop is lost. Why: ${po.why}.`, null, 'this month'); }
    // price
    const r = M.models.farm.ratio(b, k); const mk = M.models.farm.market(g, b, k, 0); const unit = k === 'cows' ? (a.kind === 'dairy' ? 't milk' : 'head') : 't';
    o += UI.irow('pr' + id, '🏷️', 'Your price', a.askR == null ? 'market' : `x${r.toFixed(2)}`, `Market ${m(mk)} per ${unit}. Above market buyers take less (the rest is stored or spoils); below market you sell everything for less.`,
      UI.btn('➖', 'farmAsk', `${k}|-0.05`, 'xs') + UI.btn('➕', 'farmAsk', `${k}|0.05`, 'xs') + UI.btn('=', 'farmAsk', `${k}|0`, 'xs'), `${m(mk * r)} per ${unit}`);
    // area specifics
    if (k === 'crops') {
      const sc = M.models.farm.seedCost(g, b);
      o += UI.irow('sd' + id, '🌱', 'Seed', `${N(f.seeds)} ac`, `Buy seed before planting (Mar-Apr): ${m(sc)} per acre. ${TG.D.handler(g, b, 'farm') ? 'Your manager buys it (Manager tab).' : 'No manager: you must buy it yourself.'}`, qty('qSeed', Math.max(1, a.acres - (f.seeds || 0))) + UI.btn('🛒 Buy', 'seedBuy', null, 'xs goodb') + UI.btn('Sell', 'seedSell', null, 'xs'), `for ${N(a.acres)} acres`);
      o += UI.irow('gr' + id, '🌿', 'Growing', a.planted ? `${N(a.planted)} ac` : '—', `Planted Mar-Apr, harvested Aug-Sep. Outlook x${(a.seasonYield || 1).toFixed(2)}.`);
    }
    if (k === 'orchard') { const e = M.areaE(b, k); o += UI.irow('ag' + id, '🌳', 'Trees', a.age >= e.rampMonths ? 'grown' : `${Math.round(a.age)}/${e.rampMonths} mo`, `New trees give little fruit for ${e.rampMonths} months. Fruit Jul-Aug, spoils fast in storage (${U.pct(e.spoil)}/mo).`); }
    return o + '</div>';
  }
  UI.A.farmSpray = (k) => { const r = TG.M.farmTreat(TG.G, biz(), k, 'You'); after(r, r.ok ? `Soil ${Math.round(r.from * 100)}% → ${Math.round(r.to * 100)}% for ${m(r.cost)}.` : null); };
  UI.A.farmSpr = (k) => { const g = TG.G, b = biz(); const t = AD()[k].spr; const it = TG.E.buy(g, b, t, 'standard'); after(it ? { ok: true } : { ok: false, msg: TG.E.count(b, t) >= TG.E.maxCount(b, t) ? 'No room for more.' : `Costs ${m(TG.E.price(g, b, t, 'standard'))}.` }, 'Sprinkler bought: water goes up.'); };
  UI.A.farmAsk = (arg) => { const [k, s] = arg.split('|'); TG.M.farmSetAsk(biz(), k, Number(s) ? Number(s) : null); UI.refresh(); };
  UI.A.farmFut = (k) => { const g = TG.G; const r = TG.M.farmFutures(g, biz(), k, UI.num('fq' + (k === 'orchard' ? 'fruit' : 'grain'), 0)); after(r, r.ok ? `Locked ${r.qty} t at ${m(r.price)}.` : null); };
  // buy land (small modal)
  UI.A.landModal = () => {
    const g = TG.G, b = biz(); const per = TG.M.farmLandPrice(g, b);
    UI.modal('➕ Buy land', `<div class="card"><div class="small">Neighbouring land: about ${m(per)} an acre (big buys cost a bit more per acre). It arrives as ⬜ free land: then move it into an area.</div>
      <div class="row" style="margin-top:8px">${qty('farmAc', 50)}<span class="small">acres</span></div>
      <div class="btns">${UI.btn('💵 Pay cash', 'farmLand', 'cash', 'sm goodb')}${UI.btn('🏦 Mortgage', 'farmLand', 'loan', 'sm')}${UI.btn('Cancel', 'closeModal', null, 'sm')}</div></div>`);
  };
  UI.A.farmLand = (how) => { const r = TG.M.farmBuyLand(TG.G, biz(), UI.num('farmAc', 0), how === 'loan'); UI.closeModal(); after(r, r.ok ? `Land bought for ${m(r.cost)}.` : null); };
  // move acres between areas (modal shows cost and time)
  UI.A.moveModal = (from) => {
    const g = TG.G, b = biz(), f = TG.M.farmEnsure(b); UI.S.mv = UI.S.mv || {};
    if (from) { UI.S.mv.from = from; if (!UI.S.mv.to || UI.S.mv.to === from) UI.S.mv.to = from === 'free' ? (TG.M.farmAreas.find((k) => f.areas[k].acres) || 'crops') : 'free'; }
    const mv = UI.S.mv; const have = mv.from === 'free' ? TG.M.farmFree(f) : f.areas[mv.from].acres; const n = Math.min(have, Math.max(1, mv.n || Math.min(50, have)));
    const c = TG.M.farmMoveCost(g, b, mv.to, n); const lbl = (k) => (k === 'free' ? '⬜ Free land' : `${AD()[k].icon} ${AD()[k].label}`);
    const opts = (sel, act, skip) => ['free'].concat(TG.M.farmAreas).filter((k) => k !== skip).map((k) => UI.btn(lbl(k), act, k, 'xs' + (sel === k ? ' pri' : ''))).join('');
    UI.modal('↔️ Move acres', `<div class="card"><div class="small"><b>From</b> (${N(have)} ac there)</div><div class="btns">${opts(mv.from, 'mvFrom')}</div>
      <div class="small"><b>To</b></div><div class="btns">${opts(mv.to, 'mvTo', mv.from)}</div>
      <div class="row" style="margin-top:6px"><input type="number" id="mvN" min="1" max="${Math.round(have)}" value="${Math.round(n)}" aria-label="acres">${UI.btn('Update', 'mvN', null, 'xs')}</div>
      <div class="ev ${c.cost ? 'warn' : ''}">💵 ${c.cost ? m(c.cost) : 'free'} · ⏳ ${c.months ? c.months + ' month' + (c.months > 1 ? 's' : '') : 'right away'}<div class="mute">${esc(c.why)}${mv.from !== 'free' ? ' Acres keep their soil. Moving them out of an area drops what grows there.' : ''}</div></div>
      <div class="btns">${UI.btn('✅ Move', 'mvGo', null, 'sm pri', !(have >= 1))}${UI.btn('Cancel', 'closeModal', null, 'sm')}</div></div>`);
  };
  UI.A.mvFrom = (k) => { UI.S.mv.from = k; if (UI.S.mv.to === k) UI.S.mv.to = k === 'free' ? 'crops' : 'free'; UI.A.moveModal(); };
  UI.A.mvTo = (k) => { UI.S.mv.to = k; UI.A.moveModal(); };
  UI.A.mvN = () => { UI.S.mv.n = UI.num('mvN', 1); UI.A.moveModal(); };
  UI.A.mvGo = () => { const mv = UI.S.mv; const n = UI.num('mvN', 0); const r = TG.M.farmMove(TG.G, biz(), mv.from, mv.to, n); UI.closeModal(); after(r, r.ok ? (r.months ? `${n} acres on the way: ready in ${r.months} month${r.months > 1 ? 's' : ''}.` : `${n} acres moved.`) + (r.cost ? ` Cost ${m(r.cost)}.` : '') : null); };

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
