/* ui-money.js - finance (loans, credit line, taxes, net worth), real estate, investments, casino & betting. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const after = (r, msg) => { UI.res(r, msg); UI.refresh(); };

  UI.screens.money = () => {
    const g = TG.G; const tabs = [['fin', '🏦 Finance'], ['re', '🏘️ Real estate'], ['inv', '📈 Investing']];
    if (g.settings.gambling) tabs.push(['casino', '🎰 Casino & bets']);
    const t = UI.curTab('money', 'fin');
    return `<h2>💰 Money</h2>${UI.tabs('money', tabs)}${({ fin, re, inv, casino }[t] || fin)(g)}`;
  };

  // ---------- finance ----------
  function fin(g) {
    const F = TG.F, C = TG.CONFIG.finance; const nwd = F.netWorth(g, true);
    let o = `<div class="card"><div class="kv"><span>Cash</span><span class="${g.cash < 0 ? 'bad' : ''}">${m(g.cash)}</span><span>Total assets</span><span>${m(nwd.assets)}</span><span>Total debt</span><span>${m(nwd.liab)}</span><span>Net worth</span><span>${m(nwd.nw)}</span>
      <span>Credit score</span><span>${TG.CREDIT.score(g).score} ${UI.pill(TG.CREDIT.label(TG.CREDIT.score(g).score).toLowerCase(), TG.CREDIT.tone(TG.CREDIT.score(g).score))}</span>
      <span>Debt payments</span><span>${m(F.totalPayments(g))}/mo</span><span>Income tax rate</span><span>${U.pct(C.incomeTax)}${g.businesses.some((b) => b.spec && b.spec.accountant) || g.ceo ? ` (−${U.pct(C.accountantTaxCut)} with accountant)` : ''}</span>
      <span>Past losses that lower future tax <div class="mute">(losses carried forward: next profits are tax-free until used up)</div></span><span>${m(g.taxLoss)}</span><span>Tax paid last 12 months</span><span>${m(U.sum(g.taxPaid))}</span></div>
      ${g.player.noLoanUntil > g.month ? `<div class="ev bad">Lenders refuse new loans for ${g.player.noLoanUntil - g.month} more months (bankruptcy).</div>` : ''}
      ${g.cash < 0 ? `<div class="ev bad">Cash is negative: ${C.bankruptcyMonths - g.negMonths} month(s) until creditors force a fire sale. Interest and fees pile up.</div>` : ''}
      <div class="mute">Without an accountant, tax audits are ${C.auditMessyMult}x more likely.</div></div>`;
    o += UI.creditCards(g); // v6: score with its reasons, loan applications with odds, credit line
    o += UI.loansCard(g); // v7: amortizing loans, tap one for its schedule
    if (g.lawsuits.length) o += `<div class="card"><h3 style="margin-top:0">Lawsuits</h3>${g.lawsuits.map((ls) => `<div class="ev bad"><b>${esc(ls.label)}</b> ${m(ls.amount)} · ${ls.status === 'fighting' ? `in court (${U.pct(ls.win || 0)} win odds)` : 'awaiting your decision'} · ${ls.left} mo left<div class="why">${esc(ls.why || '')}</div></div>`).join('')}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Last resort</h3><div class="btns">${UI.btn('Declare personal bankruptcy', 'bk', null, 'sm badb')}</div><div class="mute">Wipes everything: you keep ${m(C.bankruptcy.keepCash)}, credit drops, no loans for ${C.bankruptcy.noLoanMonths} months. The game continues.</div></div>`;
    return o;
  }
  const equipCap = (g) => Math.max(0, Math.round(U.sum(g.businesses, (b) => TG.E.value(g, b)) * 0.7 - U.sum(g.loans.filter((l) => l.type === 'equipment'), (l) => l.balance)));
  UI.A.loan = () => {
    const g = TG.G, t = UI.val('lnType'), a = UI.num('lnAmt', 0);
    if (t === 'equipment' && a > equipCap(g)) return UI.toast(`Equipment loans are capped at ${m(equipCap(g))}.`, true);
    after(TG.F.takeLoan(g, t, a), `Borrowed ${m(a)}.`);
  };
  UI.A.loanDo = (arg) => { const g = TG.G; const [id, how] = arg.split('|'); if (how === 'off') TG.F.payoff(g, id); else TG.F.prepay(g, id, Number(how)); UI.toast('Paid.'); UI.refresh(); };
  UI.A.loc = (how) => { const g = TG.G, a = UI.num('locAmt', 0); const v = how === 'draw' ? TG.F.locDraw(g, a, 'You') : TG.F.locRepay(g, a); UI.toast(v ? `${how === 'draw' ? 'Drew' : 'Repaid'} ${m(v)}.` : 'Nothing to do (check limit / cash).', !v); UI.refresh(); };
  UI.A.bk = () => UI.confirm('Declare full personal bankruptcy? You lose almost everything.', 'bkGo');
  UI.A.bkGo = () => { TG.F.bankrupt(TG.G, 'You declared bankruptcy'); UI.closeModal(); UI.go('home'); };

  // ---------- real estate ----------
  function re(g) {
    const RC = TG.CONFIG.realEstate, RE = TG.RE, r = g.re;
    let o = `<div class="card"><div class="kv"><span>Portfolio value</span><span>${m(RE.totalValue(g))}</span><span>Units</span><span>${RE.unitsOwned(g)}</span><span>Last month</span><span>rent ${m(r.m.rev)} · costs ${m(r.m.cost)}</span><span>Housing market</span><span>x${g.world.housing.toFixed(2)}</span>
      <span>Flips done</span><span>${r.flipsDone} (${r.flipsProfit} profitable)</span></div>
      ${r.hist.length > 2 ? UI.spark(r.hist.slice(-48).map((x) => x.rev - x.cost), '#1d4ed8') : ''}
      ${UI.reMgrCard(g)}
      ${RE.totalValue(g) >= RC.fund.minPortfolio && !r.fund ? `<div class="btns">${UI.btn(`Raise a fund (${U.pct(RC.fund.raisePct)} of value, investors get ${U.pct(RC.fund.investorShare)} of rent)`, 'reFund', null, 'sm')}</div>` : ''}</div>`;
    o += `<h3>Your properties (${r.holdings.length})</h3>`;
    for (const h of r.holdings) {
      const k = RC.kinds[h.kind]; const occ = h.tenants.filter((t) => t).length; const v = RE.value(g, h);
      const loan = h.mortgageId ? g.loans.find((l) => l.id === h.mortgageId) : null;
      o += `<div class="card"><div class="row sp"><b>${k.icon} ${esc(k.label)} · ${esc(h.name)}</b>${UI.pill(h.mode === 'sale' ? `for sale ${m(h.ask)}` : h.mode === 'reno' ? 'renovating' : h.mode === 'hold' ? 'empty' : 'renting', h.mode === 'rent' ? 'good' : 'warn')}</div>
        <div class="small">Worth ~${m(v)}${loan ? ` · mortgage ${m(loan.balance)} (${m(loan.payment)}/mo)` : ''} · condition ${Math.round(h.cond)}/100 · ${h.units ? `${occ}/${h.units} units rented` : `${h.acres} acres`}</div>
        ${h.lastNetM != null ? `<div class="small">Last month, after every cost${loan ? ' and the mortgage' : ''}: <b>${UI.signed(Math.round(h.lastNet))}</b></div>` : ''}
        ${h.flip ? `<div class="ev info">Renovation: ${esc(RC.flip.levels[h.flip.level].label)} by ${esc(RC.flip.contractors[h.flip.contractor].label.toLowerCase())}, ${h.flip.left} month(s) left, budget ${m(h.flip.budget)}${h.flip.overrun ? `, overrun ${m(h.flip.overrun)}` : ''}</div>` : ''}
        ${h.dev ? `<div class="ev info">Development: ${h.dev.units} units, stage ${esc(h.dev.stage)}, ${h.dev.left} month(s) left, ${m(h.dev.paid)} of ~${m(h.dev.cost)} spent</div>` : ''}
        <div class="row small" style="margin-top:4px"><span>Upkeep</span><select data-change="reSet" data-k="upkeep" data-h="${h.id}">${['low', 'normal', 'high'].map((x) => `<option${h.upkeep === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
        <span>Insured</span><select data-change="reSet" data-k="insured" data-h="${h.id}"><option value="1"${h.insured ? ' selected' : ''}>yes</option><option value="0"${!h.insured ? ' selected' : ''}>no</option></select></div>
        ${UI.rentRows(g, h)}${UI.unitsHtml(g, h)}
        <div class="btns">${!h.flip && !h.dev && h.kind !== 'land' ? UI.btn('Renovate…', 'reFlip', h.id, 'sm') : ''}${h.kind === 'land' && !h.dev ? UI.btn('Develop…', 'reDev', h.id, 'sm') : ''}
        ${h.mode === 'sale' ? UI.btn('Unlist', 'reDo', `${h.id}|unlist`, 'sm') : !h.flip && !h.dev ? UI.btn('List at value', 'reDo', `${h.id}|list`, 'sm') + UI.btn('List +10%', 'reDo', `${h.id}|list110`, 'sm') : ''}
        ${h.mode === 'hold' && h.units && !h.flip ? UI.btn('Start renting', 'reDo', `${h.id}|rent`, 'sm') : ''}
        ${UI.btn('Refinance', 'reDo', `${h.id}|refi`, 'sm')}${UI.btn(`Quick sale (${m(v * 0.9 * (1 - TG.CONFIG.property.sellCostPct))})`, 'reDo', `${h.id}|quick`, 'sm badb')}</div></div>`;
    }
    o += `<h3>For sale (${r.listings.length})</h3><div class="mute" style="margin:-4px 0 6px">Distressed homes are cheap flip candidates but may hide problems: an inspection (${m(RC.flip.inspectionCost)}) finds most of them.</div>`;
    for (const l of r.listings.slice().sort((a, b) => a.price - b.price)) {
      const k = RC.kinds[l.kind]; const ltv = k.commercial ? 0.75 : 0.8; const down = Math.round(l.price * (1 - ltv) + l.price * TG.CONFIG.property.buyCostPct);
      const rent = l.units ? TG.RE.marketRent(g, l) : 0; const fees = Math.round(l.price * TG.CONFIG.property.buyCostPct); const cashAll = l.price + fees; const rc0 = TG.CONFIG.realEstate; const fp = UI.finPreview(g, l.price, ltv, { rent: TG.RE.estRent(g, l), taxPct: rc0.propertyTax, insPct: rc0.insurancePct }, UI.S.finTerm || 300); const nowM = fp.cash; const oddsM = fp.q.block ? 'no chance' : Math.round(fp.q.odds * 100) + '% odds';
      o += `<div class="card"><div class="row sp"><b>${k.icon} ${esc(k.label)}</b><b>${m(l.price)}</b></div><div class="small">${esc(l.name)} · ${esc(TG.CONFIG.locations[l.loc].label)}, ${esc(TG.CONFIG.regions[l.region].label)} · grade ${l.grade} · condition ${Math.round(l.cond)}/100 · ${l.units ? `${l.units} unit(s)` : `${l.acres} acres`}${l.distressed ? ' · ' + UI.pill('distressed', 'warn') : ''}</div>
        ${l.units ? `<div class="mute">Rent about <b>${m(rent)}/unit</b>${l.units > 1 ? ` × ${l.units} units = <b>${m(rent * l.units)}/mo when full</b>` : '/mo when rented'}, before costs (tax, upkeep, insurance, empty months).</div>` : '<div class="mute">No income: land is for developing.</div>'}
        ${l.inspected ? `<div class="ev ${l.found ? 'bad' : 'good'}">${l.found ? `Inspection found hidden problems (~${m(l.hidden * l.price)})` : 'Inspection found nothing major'}</div>` : ''}
        <div class="mute">Cash price ${m(l.price)} + closing ${m(fees)} = ${m(cashAll)}. With a mortgage you pay ${m(nowM)} now (down payment + closing + loan fee), then ${m(fp.total)}/mo.</div>
        ${g.cash < nowM ? `<div class="small bad">Need ${m(nowM - g.cash)} more cash for the mortgage.</div>` : g.cash < cashAll ? `<div class="small mute">Need ${m(cashAll - g.cash)} more to pay all cash.</div>` : ''}
        <div class="btns">${UI.btn(`Buy cash (${m(cashAll)})`, 'reBuy', `${l.id}|0`, 'sm pri', g.cash < cashAll)}${UI.btn(`🏦 Mortgage (${m(nowM)} now · ${oddsM})…`, 'reFin', l.id, 'sm')}${l.inspected ? '' : UI.btn(`Inspect ${m(RC.flip.inspectionCost)}`, 'reInspect', l.id, 'sm')}</div></div>`;
    }
    return o;
  }
  UI.A.reBuy = (arg) => {
    const [id, mo, ok] = arg.split('|'); const g = TG.G; const l = g.re.listings.find((x) => x.id === id);
    if (l && mo === '0' && ok !== 'y') { const c = Math.round(l.price * (1 + TG.CONFIG.property.buyCostPct)); if (c > g.cash * 0.4) return UI.confirm(`Pay ${m(c)} cash for ${l.name}? That is ${Math.round(c / Math.max(1, g.cash) * 100)}% of your cash, leaving ${m(g.cash - c)}.`, 'reBuy', `${id}|0|y`); }
    UI.closeModal(); const rb = TG.RE.buy(g, id, mo === '1'); after(rb, rb && rb.ok && rb.h && rb.h.units ? `Bought. ${rb.h.units > 1 ? `All ${rb.h.units} units are` : 'It is'} empty: set each unit's rent and find a tenant for each one (🚪 Units).` : 'Bought.');
  };
  UI.A.reInspect = (id) => { const t = TG.RE.inspect(TG.G, id); if (t) UI.toast(t); UI.refresh(); };
  UI.A.reSet = (v, el) => { const h = TG.G.re.holdings.find((x) => x.id === el.dataset.h); if (!h) return; const k = el.dataset.k; h[k] = k === 'upkeep' ? v : v === '1'; UI.refresh(); };
  UI.A.reDo = (arg) => {
    const g = TG.G; const [id, act] = arg.split('|'); const h = g.re.holdings.find((x) => x.id === id); if (!h) return;
    if (act === 'list') TG.RE.list(g, id, 1); if (act === 'list110') TG.RE.list(g, id, 1.1); if (act === 'unlist') TG.RE.unlist(g, id); if (act === 'rent') h.mode = 'rent';
    if (act === 'refi') { const r = TG.RE.refinance(g, id); return after(r, r.ok ? `Cash out ${m(r.cashOut)}.` : null); }
    if (act === 'quick') { const v = TG.RE.sell(g, id, 0.9); UI.toast(`Sold for ${m(v)}.`); }
    UI.refresh();
  };
  UI.A.reFlip = (id) => {
    const RC = TG.CONFIG.realEstate.flip;
    UI.modal('Renovate', `<div class="card"><div class="kv"><span>Level</span><span><select id="flLvl">${Object.entries(RC.levels).map(([k, l]) => `<option value="${k}">${l.label}: ~${U.pct(l.cost)} of value, ${l.months} mo, +${U.pct(l.value)} value</option>`).join('')}</select></span>
      <span>Contractor</span><span><select id="flCon">${Object.entries(RC.contractors).map(([k, c]) => `<option value="${k}">${c.label}: cost x${c.costMult}, ${U.pct(c.overrun)} overrun risk, ${U.pct(c.delay)} delay risk${c.vanish > 0.01 ? ', may vanish' : ''}</option>`).join('')}</select></span>
      <span>Contingency fund (+${U.pct(RC.contingencyPct)})</span><span><select id="flCt"><option value="1">yes</option><option value="0">no</option></select></span></div>
      <div class="mute">You pay 30% upfront, the rest monthly. Tenants move out during work. Luxury remodels above the neighbourhood's level may not pay back.</div>
      <div class="btns">${UI.btn('Start renovation', 'reFlipGo', id, 'pri')}</div></div>`);
  };
  UI.A.reFlipGo = (id) => { const r = TG.RE.startFlip(TG.G, id, UI.val('flLvl'), UI.val('flCon'), UI.val('flCt') === '1'); UI.closeModal(); after(r, r.ok ? `Renovation started (budget ${m(r.budget)}).` : null); };
  UI.A.reDev = (id) => {
    const D = TG.CONFIG.realEstate.develop; const h = TG.G.re.holdings.find((x) => x.id === id);
    UI.modal('Develop land', `<div class="card"><div class="row"><span>Units</span><input type="number" id="devU" value="${Math.min(D.maxUnits, Math.round(h.acres * D.unitsPerAcre / 2))}"><span class="mute">max ${Math.min(D.maxUnits, h.acres * D.unitsPerAcre)}</span></div>
      <div class="mute">Permits take ${D.permitMonths[0]}-${D.permitMonths[1]} months and can stall. Building costs ${m(D.costPerUnit[0])}-${m(D.costPerUnit[1])} per unit over ${D.buildMonths[0]}-${D.buildMonths[1]} months, often with overruns. Finished units become rentals.</div>
      <div class="btns">${UI.btn('Start (pay permits now)', 'reDevGo', id, 'pri')}</div></div>`);
  };
  UI.A.reDevGo = (id) => { const r = TG.RE.develop(TG.G, id, UI.num('devU', 10)); UI.closeModal(); after(r, r.ok ? `Development of ${r.dev.units} units started.` : null); };
  UI.A.reMgr = () => {
    const pool = TG.RE.managerPool(TG.G);
    UI.modal('Hire a property manager', pool.map((c) => `<div class="card"><div class="row sp"><b>${esc(c.name)}</b><span>${m(c.wage)}/mo</span></div><div class="small">Skill ~${c.skillSeen} · ${c.years} yrs · tenants ${c.skillSeen >= 60 ? '👍 better' : c.skillSeen >= 40 ? '≈ average' : '👎 worse'} · searches & repairs x${U.clamp(1.2 - c.skillSeen / 250, 0.8, 1.2).toFixed(2)}</div><div class="mute">Plus ${U.pct(TG.CONFIG.realEstate.managerFeePct)} of the rent they collect.</div><div class="btns">${UI.btn('Hire', 'reMgrGo', c.id, 'sm pri')}</div></div>`).join(''));
  };
  UI.A.reMgrGo = (id) => { const c = TG.G.re.pool.list.find((x) => x.id === id); if (c) TG.RE.hireManager(TG.G, c); UI.closeModal(); UI.refresh(); };
  UI.A.reMgrFire = () => { TG.G.re.manager = null; UI.refresh(); };
  UI.A.reHandy = () => { TG.G.re.handyman = !TG.G.re.handyman; UI.refresh(); };
  UI.A.reFund = () => after(TG.RE.raiseFund(TG.G), 'Fund raised.');

  // ---------- investing ----------
  function inv(g) {
    const I = TG.I, IC = TG.CONFIG.invest, A = IC.assets, iv = g.invest, w = g.world;
    const fee = U.pct(IC.tradeFee, 1), mgRate = U.pct(w.baseRate + IC.margin.spread, 1), callAt = U.pct(IC.margin.callAt);
    /* v9: every number and section on the investing screen has an "i" that explains it */
    let o = `<div class="card"><h3 style="margin-top:0">📈 Your investments ${UI.tipBtn('ivIntro')}</h3>${UI.tipLine('ivIntro', `Put spare cash into stocks to grow it. Prices go up and down every month, mostly with the economy (now: ${w.phase}). Nobody can predict next month: there are no patterns. Each buy and each sale costs a ${fee} fee. Money in stocks is not cash: sell first if you need it.`)}`;
    o += UI.irow('ivPort', '💼', 'Portfolio', m(I.posValue(g)), 'What everything you own would sell for at today\'s prices (before the sale fee). It changes every month.');
    o += UI.irow('ivMg', '🏦', 'Margin debt', m(iv.marginDebt), `Money the broker lent you to buy more ("Buy w/ margin"). You pay ${mgRate}/yr interest on it every month. If your stocks fall so that your own share is under ${callAt} of their value, the broker sells EVERYTHING (a margin call). Selling pays this back first.`);
    o += UI.irow('ivAng', '👼', 'Angel stakes (est.)', m(I.angelValue(g)), 'Your money in startups. It is locked until each one ends. Until an update arrives we guess 70% of what you put in.');
    o += iv.marginDebt > 0 ? `<div class="row" style="margin-top:6px"><input type="number" id="mgAmt" placeholder="amount">${UI.btn('Repay margin', 'mgRepay', null, 'sm')}</div><div class="mute">If equity falls below ${callAt} of the position, a margin call force-sells.</div>` : '';
    o += '</div>';
    o += `<div class="card"><h3 style="margin-top:0">Markets ${UI.tipBtn('ivMk')}</h3>${UI.tipLine('ivMk', `Price = what one share costs now. "1y" = change over the last 12 months (green up, red down). "Swings" = how far it typically moves in one month. The line shows the last 5 years. Booms push prices up, recessions down; now and then the whole market crashes 18-35%. Penny stocks and coins drift down on average and can go to zero.`)}<div class="mute">Prices move randomly with the economy. Penny stocks and coins drift down on average and can go to zero. No patterns to exploit.</div>`;
    for (const [s, a] of Object.entries(A)) {
      if (a.kind !== 'stock' && !g.settings.gambling) continue;
      const p = iv.prices[s]; const h = iv.hist[s] || []; const pos = iv.pos[s]; const val = pos ? pos.qty * p : 0; const prev = h.length > 12 ? h[h.length - 13] : h[0];
      const yr = Math.exp(12 * (a.mu - a.sd * a.sd / 2)) - 1, yrSd = a.sd * Math.sqrt(12);
      const tk = 'iv_' + s;
      const tip = `${a.desc || ''} On its own it averages about ${yr >= 0 ? '+' : ''}${U.pct(yr, 1)} a year, plus ${a.beta}x whatever the whole market does. In a normal year it can easily end anywhere from ${U.pct(Math.max(-0.95, Math.exp(-yrSd) - 1))} to +${U.pct(Math.exp(yrSd) - 1)}.${a.zero ? ` Each month there is a ${U.pct(a.zero, 1)} chance it goes to zero (about ${U.pct(1 - Math.pow(1 - a.zero, 12))} a year): you lose everything in it.` : ''}${pos ? ` You paid ${m(pos.cost)} in total; it is worth ${m(val)} now.` : ''}`;
      o += `<div class="ev ${a.kind !== 'stock' ? 'warn' : ''}"><div class="row sp"><b data-act="tip" data-arg="${tk}" data-nosave="1">${s} · ${esc(a.label)}</b><span>${p > 0 ? p.toFixed(p < 5 ? 3 : 2) : 'delisted'} ${prev ? `<span class="${UI.tone(p - prev)} small">${p >= prev ? '+' : ''}${U.pct((p - prev) / prev)} 1y</span>` : ''}${UI.tipBtn(tk)}</span></div>${UI.tipLine(tk, tip)}
        <div class="small">${a.kind === 'stock' ? `swings ±${U.pct(a.sd)}/mo` : UI.pill(`high risk: ${U.pct(a.zero || 0, 1)}/mo chance of going to zero`, 'bad')}${pos ? ` · you own ${m(val)} (cost ${m(pos.cost)}, ${UI.signed(val - pos.cost)})` : ''}</div>
        ${UI.spark(h.slice(-60), '#1d4ed8')}
        <div class="row"><input type="number" id="amt_${s}" placeholder="$ amount">${UI.btn('Buy', 'invBuy', `${s}|0`, 'sm')}${g.settings.gambling ? UI.btn('Buy w/ margin', 'invBuy', `${s}|1`, 'sm') : ''}${pos ? UI.btn('Sell half', 'invSell', `${s}|0.5`, 'sm') + UI.btn('Sell all', 'invSell', `${s}|1`, 'sm') : ''}</div></div>`;
    }
    o += `<div class="row" style="margin-top:6px"><span class="small">How buying works</span>${UI.tipBtn('ivBuy')}</div>${UI.tipLine('ivBuy', `Type a dollar amount and tap Buy: that much cash turns into shares, plus a ${fee} fee. Sell half / Sell all turns shares back into cash at today's price, minus ${fee}.${g.settings.gambling ? ` Buy w/ margin: the broker lends up to half (you can borrow up to ${IC.margin.maxLev}x your own money). Gains AND losses are bigger, you pay ${mgRate}/yr interest, and if prices fall far you lose everything in a margin call.` : ''}`)}`;
    o += '</div>';
    if (g.settings.gambling) {
      const oc = IC.angel.outcomes;
      o += `<div class="card"><h3 style="margin-top:0">Angel investing ${UI.tipBtn('ivAngel')}</h3>${UI.tipLine('ivAngel', `You give a young startup money for a small piece of it. The money is locked for ${Math.round(IC.angel.horizon[0] / 12)}-${Math.round(IC.angel.horizon[1] / 12)} years. Odds for each one: ${U.pct(oc[0][0])} fail (you get $0), ${U.pct(oc[1][0])} return ${oc[1][1]}-${oc[1][2]}x, ${U.pct(oc[2][0], 1)} return ${oc[2][1]}-${oc[2][2]}x, ${U.pct(oc[3][0], 1)} return ${oc[3][1]}-${oc[3][2]}x. Halfway through you get an update. Spread small amounts over many startups.`)}<div class="mute">Most startups fail (about two in three return nothing). A rare few return 15x+. Money is locked for years.</div>
        ${iv.angelOffers.map((a) => `<div class="ev"><div class="row sp"><b>${esc(a.name)}</b><span>min ${m(a.min)}${UI.tipBtn('ivAo' + a.id)}</span></div>${UI.tipLine('ivAo' + a.id, `${a.name} makes ${a.sector}. "${a.buzz}." The buzz is only a hint: about ${a.buzz[0] === 'S' ? '58' : a.buzz[0] === 'P' ? '38' : '20'}% of pitches that sound like this return any money (34% on average). Even good-sounding ones often fail. The least you can put in is ${m(a.min)}.`)}<div class="small">${esc(a.sector)} · ${esc(a.buzz)}</div><div class="row"><input type="number" id="ang_${a.id}" value="${a.min}">${UI.btn('Invest', 'angel', a.id, 'sm')}</div></div>`).join('') || '<div class="mute">No pitches right now.</div>'}
        ${iv.angels.length ? `<h3>Your stakes</h3>${iv.angels.map((a) => `<div class="small">${esc(a.name)} (${esc(a.sector)}): ${m(a.amt)} in, ${a.left} mo to exit${a.mark != null ? `, marked at ${a.mark.toFixed(2)}x` : ''}</div>`).join('')}` : ''}</div>`;
    }
    return o;
  }
  UI.A.invBuy = (arg) => { const [s, mg] = arg.split('|'); after(TG.I.buy(TG.G, s, UI.num('amt_' + s, 0), mg === '1'), 'Bought.'); };
  UI.A.invSell = (arg) => { const [s, f] = arg.split('|'); const v = TG.I.sell(TG.G, s, Number(f)); UI.toast(`Sold for ${m(v)}.`); UI.refresh(); };
  UI.A.mgRepay = () => { TG.I.repayMargin(TG.G, UI.num('mgAmt', 0)); UI.refresh(); };
  UI.A.angel = (id) => after(TG.I.angelInvest(TG.G, id, UI.num('ang_' + id, 0)), 'Invested.');

  // ---------- casino ----------
  function casino(g) {
    const CC = TG.CONFIG.casino, c = g.invest.casino, I = TG.I;
    const amt = UI.S.betAmt || 100;
    let o = `<div class="card"><div class="kv"><span>Net this month</span><span>${UI.signed(c.net)}</span><span>Lifetime</span><span>${UI.signed(c.lifetimeNet)}</span><span>Bets this month</span><span>${c.bets || 0}</span><span>Table limit</span><span>none (bet any amount you have)</span></div>
      <div class="row" style="margin-top:6px"><span>Bet</span><input type="number" id="betAmt" value="${amt}" min="${CC.minBet}"></div>
      <div class="mute">Every game has a house edge: over time you lose. There is no table limit: big bets lose big just as fast, and the odds are the same at any size.${g.invest.habit > 40 ? ' <b class="warn">Your gambling habit is growing: you may start chasing losses on your own.</b>' : ''}${c.banned ? ' <b class="bad">You are banned from the casino.</b>' : ''}</div>
      ${UI.S.lastBet ? `<div class="ev ${UI.S.lastBet.win ? 'good' : 'bad'}">${esc(UI.S.lastBet.text)}</div>` : ''}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">🎰 Casino ${UI.tipBtn('csCas')}</h3>${UI.tipLine('csCas', `Pick a game; your bet is the amount above. Roulette red/black wins 18 in 37 (pays 1:1), dozen 12 in 37 (pays 2:1), one number 1 in 37 (pays 35:1). Dice wins 15 in 36 (pays 1.3:1). Slots pay back ${U.pct(CC.games.slots.rtp)} of bets on average. Every game loses a little each bet on average, so the more you play, the surer you lose. No table limit and no bet count: the odds are the same for every bet.`)}<div class="btns">${Object.entries(CC.games).map(([k, gm]) => UI.btn(`${esc(gm.label)}${gm.pays ? ` (pays ${gm.pays}:1)` : ` (${U.pct(gm.rtp)} return)`}`, 'bet', `c|${k}`, 'sm')).join('')}</div></div>`;
    const r = g.invest.race;
    o += `<div class="card"><h3 style="margin-top:0">🏇 Horse race ${UI.tipBtn('csHr')}</h3>${UI.tipLine('csHr', `The number is what you get back per $1 if that horse wins (2.50x = $250 back on a $100 bet). Lower number = more likely to win. The track keeps about ${U.pct(1 - 1 / CC.horses.overround)} of all bets, so on average you lose.`)}${r.horses.map((h, i) => `<div class="row sp small"><span>${esc(h.name)}</span><span>${h.odds.toFixed(2)}x ${UI.btn('Bet', 'bet', `h|${i}`, 'sm')}</span></div>`).join('')}</div>`;
    const gm = g.invest.game;
    o += `<div class="card"><h3 style="margin-top:0">🏈 Sports ${UI.tipBtn('csSp')}</h3>${UI.tipLine('csSp', `Bet on which team wins. The number is what you get back per $1 if you are right. The favorite has the lower number. The bookmaker keeps about ${U.pct(CC.sports.vig, 1)}, so on average you lose.`)}<div class="row sp small"><span>${esc(gm.a)}</span><span>${gm.oddsA.toFixed(2)}x ${UI.btn('Bet', 'bet', 's|a', 'sm')}</span></div><div class="row sp small"><span>${esc(gm.b)}</span><span>${gm.oddsB.toFixed(2)}x ${UI.btn('Bet', 'bet', 's|b', 'sm')}</span></div></div>`;
    return o;
  }
  UI.A.bet = (arg) => {
    const g = TG.G; const [k, x] = arg.split('|'); const a = UI.num('betAmt', 0); UI.S.betAmt = a;
    const r = k === 'c' ? TG.I.casinoBet(g, x, a) : k === 'h' ? TG.I.betHorse(g, Number(x), a) : TG.I.betSports(g, x, a);
    if (!r.ok) return UI.toast(r.msg, true);
    UI.S.lastBet = r; UI.refresh();
  };
  UI.A.setToggle = (k) => { TG.G.settings[k] = !TG.G.settings[k]; UI.refresh(); };
})();
