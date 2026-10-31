/* ui-market.js - property market (filtered by the business you want), buying/leasing, starting a business. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  UI.S.mkType = UI.S.mkType || 'cafe'; UI.S.mkSort = UI.S.mkSort || 'suit'; UI.S.mkMax = UI.S.mkMax || '';

  const tierLbl = { small: 'Small business', between: 'Grows with time & money', corp: 'Corporation' };
  UI.typeOptions = (sel) => {
    const C = TG.CONFIG.businesses; let o = '';
    for (const t of ['small', 'between', 'corp']) {
      o += `<optgroup label="${tierLbl[t]}">`;
      for (const [id, d] of Object.entries(C)) if (d.tier === t) o += `<option value="${id}"${id === sel ? ' selected' : ''}>${d.icon} ${esc(d.name)} (setup ~${m(d.setupCost)})</option>`;
      o += '</optgroup>';
    }
    return o;
  };

  UI.screens.market = () => {
    const g = TG.G, C = TG.CONFIG; const type = UI.S.mkType, d = C.businesses[type];
    let o = `<h2>🗺️ Pick a business</h2><div class="card"><div class="btns">${Object.entries(C.businesses).map(([k, x]) => `<button class="btn ${k === type ? 'pri' : ''}" style="font-size:26px;min-width:56px" data-act="mkType" data-arg="${k}" title="${esc(x.name)}">${x.icon}</button>`).join('')}</div></div>`;
    o += `<div class="card"><div class="row"><span class="small">I want to start a</span><select data-change="mkType">${UI.typeOptions(type)}</select></div>
      <div class="mute" style="margin-top:4px">${d.icon} <b>${esc(d.name)}</b> (${tierLbl[d.tier]}): ${esc(d.blurb || '')}</div>
      <div class="mute">Setup ${m(TG.B.setupCost(g, type, { acres: 0 }, null))} plus equipment and staff · needs ${d.space.unit === 'acres' ? `about ${d.space.ideal} acres` : `about ${d.space.ideal.toLocaleString()} sq ft`}${d.license ? ` · license takes ${d.license.months} months` : ''}</div>
      <div class="row" style="margin-top:6px"><span class="small">Sort</span><select data-change="mkSort">${[['suit', 'Best fit'], ['price', 'Cheapest'], ['priceD', 'Most expensive'], ['size', 'Biggest'], ['loc', 'Location']].map(([v, l]) => `<option value="${v}"${UI.S.mkSort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <span class="small">Max price</span><input type="number" id="mkMax" value="${esc(UI.S.mkMax)}" placeholder="any" data-change="mkMax"></div></div>`;
    // owned/leased empty properties first
    const free = g.properties.filter((p) => !p.bizId);
    if (free.length) {
      o += `<h3>Your empty properties</h3>`;
      for (const p of free) o += propCard(p, type, true);
    }
    let L = g.listings.map((p) => ({ p, s: TG.P.suit(p, type) }));
    const mx = Number(UI.S.mkMax); if (mx > 0) L = L.filter((x) => x.p.price <= mx);
    const sorters = { suit: (a, b) => b.s - a.s, price: (a, b) => a.p.price - b.p.price, priceD: (a, b) => b.p.price - a.p.price, size: (a, b) => (b.p.sqft + b.p.acres * 40000) - (a.p.sqft + a.p.acres * 40000), loc: (a, b) => (a.p.loc + a.p.region).localeCompare(b.p.loc + b.p.region) };
    L.sort(sorters[UI.S.mkSort] || sorters.suit);
    o += `<h3>For sale (${L.length})</h3><div class="mute" style="margin:-4px 0 6px">New listings appear every month. Lease = no big purchase, but monthly rent and nothing to sell later.</div>`;
    for (const x of L) o += propCard(x.p, type, false, x.s);
    return o;
  };
  UI.A.mkType = (v) => { UI.S.mkType = v; UI.render(); };
  UI.A.mkSort = (v) => { UI.S.mkSort = v; UI.render(); };
  UI.A.mkMax = (v) => { UI.S.mkMax = v; UI.render(); };

  function propCard(p, type, mine, s) {
    const g = TG.G, C = TG.CONFIG; if (s == null) s = TG.P.suit(p, type);
    const sl = TG.P.suitLabel(s); const pc = TG.P.prosCons(p, type);
    const kind = C.propertyKinds[p.kind]; const fees = Math.round(p.price * C.property.buyCostPct);
    const down = Math.round(p.price * C.property.mortgageDown); const rent = TG.P.leaseRent(g, p);
    const mort = TG.F.payment(p.price - down, TG.F.rateFor(g, 'mortgage'), C.finance.loans.mortgage.term);
    let btns = '';
    if (mine) btns = UI.btn(`Start ${esc(C.businesses[type].name)} here`, 'startHere', p.id, 'pri') + UI.btn('Start another type…', 'startPick', p.id) + UI.btn(p.leased ? 'End lease' : `Sell (~${m(TG.P.value(g, p) * (1 - C.property.sellCostPct))})`, 'sellProp', p.id, 'badb');
    else btns = UI.btn(`Buy ${m(p.price + fees)}`, 'acq', `${p.id}|cash`, 'pri', g.cash < p.price + fees) + UI.btn(`🏦 Mortgage (${m(down + fees)} down, ~${m(mort)}/mo)…`, 'propFin', p.id, '', g.cash < down + fees) + UI.btn(`Lease ${m(rent)}/mo`, 'acq', `${p.id}|lease`, '', g.cash < rent * (1 + C.property.leaseDeposit));
    return `<div class="card"><div class="row sp"><b>${kind.icon || '🏠'} ${esc(kind.label)} · ${esc(p.name)}</b>${UI.pill(`${sl.label} fit ${Math.round(s * 100)}%`, sl.tone)}</div>
      <div class="mute">${esc(TG.P.locLabel(p))} · ${esc(TG.P.sizeLabel(p))}${mine ? ` · ${p.leased ? `leased ${m(p.rent)}/mo` : `owned, worth ~${m(TG.P.value(g, p))}`}` : ` · <b>${m(p.price)}</b>`}</div>
      <div class="grid2 small" style="margin-top:4px"><div>${pc.pros.map((x) => `<div class="good">+ ${esc(x)}</div>`).join('') || '<div class="mute">No standout pros</div>'}</div><div>${pc.cons.map((x) => `<div class="bad">− ${esc(x)}</div>`).join('') || '<div class="mute">No obvious cons</div>'}</div></div>
      <div class="btns">${btns}</div></div>`;
  }

  UI.A.acq = (arg) => {
    const [id, mode] = arg.split('|'); const g = TG.G;
    const r = TG.P.acquire(g, id, mode); if (!UI.res(r)) return;
    UI.toast(mode === 'lease' ? 'Lease signed.' : 'Property bought.'); UI.refresh();
    UI.startDialog(r.prop.id, UI.S.mkType);
  };
  UI.A.startHere = (pid) => UI.startDialog(pid, UI.S.mkType);
  UI.A.startPick = (pid) => {
    UI.modal('Start which business?', `<div class="card"><select id="spType">${UI.typeOptions(UI.S.mkType)}</select><div class="btns">${UI.btn('Next', 'startPick2', pid, 'pri')}</div></div>`);
  };
  UI.A.startPick2 = (pid) => UI.startDialog(pid, UI.val('spType'));
  UI.A.sellProp = (pid) => { const v = TG.P.sell(TG.G, pid); UI.toast(v > 0 ? `Sold for ${m(v)}.` : 'Done.'); UI.refresh(); };

  UI.startDialog = (pid, type) => {
    const g = TG.G, C = TG.CONFIG, d = C.businesses[type]; const p = g.properties.find((x) => x.id === pid); if (!p) return;
    const s = TG.P.suit(p, type), sl = TG.P.suitLabel(s);
    let extra = '';
    if (d.model === 'farm') {
      const best = TG.M.bestEnterprise(p);
      extra = `<div class="kv"><span>What to farm</span><span><select id="stEnt">${[['crops', '🌾 All crops'], ['cows', '🐄 All cows (milk + meat)'], ['orchard', '🍎 All orchard'], ['mixed', '🐄🌾 Half cows, half crops']].map(([id, lb]) => `<option value="${id}"${id === (best === 'cattle' || best === 'dairy' ? 'cows' : best) ? ' selected' : ''}>${lb} (+${m(TG.B.setupCost(g, type, p, { ent: id }) - TG.B.setupCost(g, type, p, null))})</option>`).join('')}</select></span></div>
        <div class="mute">Suggested for this land: ${esc(best)}. This only sets how your acres start: later you can move acres between 🐄 cow, 🌾 crop and 🍎 orchard areas (costs money and a month or two). New orchards take ${d.farm.enterprises.orchard.rampMonths} months to bear fruit unless one is already planted; cows need a herd. Crop farms include the first season's seed.</div>`;
    }
    if (d.model === 'franchise') {
      const own = g.businesses.filter((b) => C.businesses[b.type].tier === 'small');
      extra = `<div class="kv"><span>Concept to franchise</span><span><select id="stFrom">${own.map((b) => `<option value="biz:${b.id}">Your ${esc(b.name)} (rep ${Math.round(b.rep)}, 30% cheaper setup)</option>`).join('')}${Object.entries(C.businesses).filter(([, x]) => x.tier === 'small').map(([id, x]) => `<option value="c:${id}">New ${esc(x.name)} concept</option>`).join('')}</select></span></div><div class="mute">A proven concept you already run starts with a better reputation.</div>`;
    }
    const cost = TG.B.setupCost(g, type, p, d.model === 'farm' ? { ent: TG.M.bestEnterprise(p) } : null);
    UI.modal(`Start a ${esc(d.name)}`, `<div class="card"><div class="row sp"><b>${d.icon} ${esc(d.name)} at ${esc(p.name)}</b>${UI.pill(`${sl.label} fit`, sl.tone)}</div>
      <div class="mute">${esc(d.blurb || '')}</div>
      <div class="kv" style="margin-top:6px"><span>Name</span><span><input type="text" id="stName" value="${esc(d.name)}" maxlength="30"></span>
      <span>Setup cost (fit-out, permits${d.license ? ', license' : ''})</span><span>${m(cost)}</span><span>Your cash</span><span>${m(g.cash)}</span></div>${extra}
      ${s < 0.4 ? '<div class="ev bad">This property is a poor fit: expect weak demand or high costs.</div>' : ''}
      <div class="kv" style="margin-top:6px"><span>Quick setup: buy basic equipment & hire a starting team</span><span><select id="stQuick"><option value="standard">Yes, standard gear</option><option value="budget">Yes, budget gear</option><option value="used">Yes, used gear (cheap, breaks more)</option><option value="">No, I'll do it myself</option></select></span></div>
      <div class="btns">${UI.btn('Open the business', 'startGo', `${pid}|${type}`, 'goodb')}</div></div>`);
  };
  UI.A.startGo = (arg) => {
    const [pid, type] = arg.split('|'); const g = TG.G, d = TG.CONFIG.businesses[type];
    const opts = { name: UI.val('stName') || d.name };
    if (d.model === 'farm') opts.ent = UI.val('stEnt');
    if (d.model === 'franchise') { const v = UI.val('stFrom'); if (v.startsWith('biz:')) opts.fromBiz = v.slice(4); else opts.concept = v.slice(2); }
    const q = UI.val('stQuick');
    const r = TG.B.start(g, type, pid, opts); if (!UI.res(r)) return;
    if (q) { const qs = TG.B.quickSetup(g, r.biz, true, q); UI.toast(`Opened ${r.biz.name}. Quick setup spent ~${m(qs.cost)} on gear and hired staff.`); }
    else UI.toast(`Opened ${r.biz.name}. Hire staff and buy equipment before next month.`);
    UI.closeModal(); UI.bizId = r.biz.id; UI.tab.biz = 'overview'; UI.go('bizd');
  };
})();
