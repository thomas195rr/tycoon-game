/* ui-v6.js - v6 screens: Industry Outlook, credit score + loan applications, financing preview,
   rent setting + tenant search (one applicant at a time), the "do it yourself" list, and the business Reports tab. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const N = (x) => Math.round(x || 0).toLocaleString();
  const after = (r, msg) => { UI.res(r, msg); UI.refresh(); };
  const MK = { good: ['✅', 'good'], ok: ['⚠️', 'warn'], bad: ['❌', 'bad'] };
  const mark = (x) => `<span class="${MK[x][1]}">${MK[x][0]}</span>`;
  const biz = () => TG.B.get(TG.G, UI.bizId);

  // ================= 📈 INDUSTRY OUTLOOK =================
  UI.screens.ind = () => {
    const g = TG.G; const L = TG.IN.list(g); const mine = new Set(g.businesses.map((b) => TG.IN.ofBiz(b)));
    let o = `<div class="row sp"><h2>📈 Industry Outlook</h2>${UI.btn('◀ Back', 'go', 'home', 'sm')}</div>
      <div class="card"><div class="mute">Every industry has good and bad years. Booms raise demand and prices; slumps cut them. They turn slowly and partly follow the economy, but nobody can time them exactly: the arrow shows where things are heading now, not where they will be in two years. Tap a row for the reasons.</div></div>`;
    L.sort((a, c) => (mine.has(c.k) - mine.has(a.k)) || c.s.x - a.s.x);
    o += `<div class="card">`;
    for (const it of L) {
      const k = 'ind' + it.k; const n = it.s.news[0];
      o += UI.irow(k, it.d.icon, it.d.label + (mine.has(it.k) ? ' ⭐' : ''), `${UI.pill(it.st.label, it.st.tone)} ${TG.IN.arrow(it.s)}`,
        `${it.d.label} is ${it.st.label.toLowerCase()} and ${TG.IN.dir(it.s)}. Customers x${it.demand.toFixed(2)}, selling prices x${it.price.toFixed(2)}, costs x${it.cost.toFixed(2)}.${n ? ' Latest: ' + n.why + '.' : ''} Businesses: ${it.d.biz.map((t) => TG.CONFIG.businesses[t].name).join(', ')}.`,
        null, `customers x${it.demand.toFixed(2)} · prices x${it.price.toFixed(2)} · costs x${it.cost.toFixed(2)}`);
      if (UI.S.tips[k]) o += `<div style="margin:0 0 8px 48px">${UI.spark(it.s.hist.slice(-60), it.s.x >= 0 ? '#16a34a' : '#dc2626')}${it.s.news.map((x) => `<div class="small"><span class="mute">${U.dateStr(x.m)}</span> <span class="${x.tone}">${esc(x.text)}</span></div>`).join('')}</div>`;
    }
    return o + `</div><div class="mute">⭐ = you are in this industry.</div>`;
  };

  // ================= 🏦 CREDIT SCORE + LOAN APPLICATIONS =================
  const CRD = () => TG.CREDIT;
  UI.creditCards = (g) => {
    const sc = CRD().score(g); const s = sc.score; const C = TG.CONFIG, F = TG.F;
    let o = `<div class="card"><h3>🏦 Credit score ${UI.tipBtn('crs')}</h3>${UI.tipLine('crs', 'Worked out every month from your record. Paying on time (once a month counts), using little of your credit line, not owing too much, a long history and few applications all help. Missed payments, defaults and bankruptcy hurt for years.')}
      <div class="row sp"><div style="font-size:2em;font-weight:700" class="${CRD().tone(s)}">${s}</div>${UI.pill(CRD().label(s), CRD().tone(s))}</div>${UI.bar(s - 300, 550)}`;
    for (const p of sc.parts) o += UI.irow('crp' + p.k, p.icon, p.label, `${mark(p.mark)} ${p.max ? `${Math.round(p.pts)}/${p.max}` : Math.round(p.pts)}`, p.why);
    o += `<div class="mute">300 = worst, 850 = best. Tap a line to see why.</div></div>`;
    // apply
    const S = UI.S.ln = UI.S.ln || { type: 'business', amount: 50000, term: null };
    const terms = C.credit.terms[S.type] || [C.finance.loans[S.type].term]; if (S.term == null || terms.indexOf(S.term) < 0) S.term = S.type === 'loc' ? 0 : C.finance.loans[S.type].term;
    const q = CRD().quote(g, S.type, S.amount, { term: S.term });
    o += `<div class="card" id="loanCard"><h3>📝 Apply for a loan ${UI.tipBtn('lnap')}</h3>${UI.tipLine('lnap', 'Pick a type, amount and length. You see the odds and what helps or hurts BEFORE you apply. It is never a sure thing. Every application (yes or no) counts as a recent application on your score. Every loan has a small fee, so borrowing and paying back right away always loses money.')}
      <div class="kv"><span>Type</span><span><select data-change="lnT">${['business', 'equipment', 'loc', 'emergency'].map((t) => `<option value="${t}"${S.type === t ? ' selected' : ''}>${esc(C.finance.loans[t].label)}</option>`).join('')}</select></span>
      <span>Amount</span><span><input type="number" id="lnAmt" value="${S.amount}" min="1000" step="1000" aria-label="amount"></span>
      ${S.type !== 'loc' ? `<span>Length</span><span><select data-change="lnTerm">${terms.map((t) => `<option value="${t}"${S.term === t ? ' selected' : ''}>${t >= 24 ? t / 12 + ' years' : t + ' months'}</option>`).join('')}</select></span>` : ''}</div>
      <div class="btns">${UI.btn('🔍 Check my odds', 'lnCheck', null, 'sm')}</div>
      <div class="mute">Mortgages are applied for when you buy a building (you see the payment first).</div>`;
    o += `<div class="ev ${q.block ? 'bad' : q.odds >= 0.7 ? 'good' : q.odds >= 0.4 ? 'warn' : 'bad'}"><b>Approval odds: ${q.block ? 'no chance' : U.pct(q.odds)}</b>${q.block ? `<div class="small">${esc(q.block)}</div>` : ''}
      <div class="small">Rate ${U.pct(q.rate, 1)} · ${S.type === 'loc' ? `minimum payment ${m(q.pay)}/mo when fully used` : `${m(q.pay)}/mo for ${S.term} months`} · fee ${m(q.fee)}</div></div>
      <table>${q.factors.map((f) => `<tr><td>${mark(f.mark)} ${esc(f.label)}<div class="mute">${esc(f.why)}</div></td><td class="n">${esc(f.val)}</td></tr>`).join('')}</table>
      ${q.tips && q.tips.length ? `<div class="small"><b>What would raise your odds:</b><ul style="margin:4px 0 0 18px;padding:0">${q.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="mute">A "no" still counts as an application (a small, temporary hit to your score).</div>
      <div class="btns">${UI.btn(`📝 Apply (${q.block ? 'blocked' : U.pct(q.odds) + ' odds'})`, 'lnApply', null, 'sm pri', !!q.block)}</div></div>`;
    // credit line
    const lim = F.locLimit(g);
    o += `<div class="card"><h3>💳 Credit line</h3><div class="kv"><span>Limit</span><span>${lim ? m(lim) : '<span class="mute">none: apply above</span>'}</span><span>Owed</span><span>${m(g.loc.balance)}</span><span>Used</span><span>${lim ? U.pct(g.loc.balance / lim) : '–'}</span><span>Rate</span><span>~${U.pct(F.rateFor(g, 'loc'), 1)}</span></div>
      ${lim ? `<div class="row" style="margin-top:6px"><input type="number" id="locAmt" placeholder="amount">${UI.btn('Draw', 'loc', 'draw', 'sm')}${UI.btn('Repay', 'loc', 'repay', 'sm')}</div>` : ''}
      <div class="mute">Using under 30% of the line keeps your score healthy. Only an accountant or CEO draws on it for you when cash runs short.</div></div>`;
    return o;
  };
  UI.A.lnT = (v) => { UI.S.ln.type = v; UI.S.ln.term = null; UI.S.ln.amount = UI.num('lnAmt', UI.S.ln.amount); UI.refresh(); };
  UI.A.lnTerm = (v) => { UI.S.ln.term = Number(v); UI.S.ln.amount = UI.num('lnAmt', UI.S.ln.amount); UI.refresh(); };
  UI.A.lnCheck = () => { UI.S.ln.amount = Math.max(0, Math.round(UI.num('lnAmt', 0))); UI.refresh(); };
  UI.A.lnApply = () => {
    const g = TG.G, S = UI.S.ln; S.amount = Math.max(0, Math.round(UI.num('lnAmt', S.amount)));
    const r = CRD().apply(g, S.type, S.amount, { term: S.term || undefined });
    if (r.ok) UI.toast(S.type === 'loc' ? `Approved! Credit line now ${m(r.limit)} (fee ${m(r.quote.fee)}).` : `Approved! ${m(S.amount)} at ${U.pct(r.quote.rate, 1)} (fee ${m(r.quote.fee)}).`);
    else UI.toast(r.msg, true);
    UI.refresh();
  };

  // ================= 🏠 FINANCING PREVIEW (before you buy with a mortgage) =================
  // shows: down payment, rate from YOUR score, length, principal & interest, estimated taxes + insurance, approval odds
  UI.finPreview = (g, price, ltv, extra, term) => {
    const loan = Math.round(price * ltv), down = price - loan; const q = CRD().quote(g, 'mortgage', loan, { term, ltv, asset: price, extraIncome: extra.rent || 0 });
    const tax = price * (extra.taxPct || 0.012) / 12, ins = price * (extra.insPct || 0.00035);
    const fees = Math.round(price * TG.CONFIG.property.buyCostPct);
    return { loan, down, fees, q, tax, ins, total: q.pay + tax + ins, cash: down + fees + q.fee };
  };
  const finHtml = (g, p, act, id) => {
    const terms = TG.CONFIG.credit.terms.mortgage;
    const row = (a, b) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`;
    return `<div class="card"><h3>🏦 Your monthly payment</h3><table>
      ${row('Price', m(p.loan + p.down))}${row('Down payment', act === 'reFin' ? `<select data-change="finDown" data-id="${id}" data-act2="${act}">${TG.CONFIG.v10.reDown.map((d) => `<option value="${d}"${Math.abs(p.down / (p.loan + p.down) - d) < 0.02 ? ' selected' : ''}>${U.pct(d)} = ${m((p.loan + p.down) * d)}</option>`).join('')}</select>` : `${m(p.down)} (${U.pct(p.down / (p.loan + p.down))})`)}${row('Loan', m(p.loan))}
      ${row('Length', `<select data-change="finTerm" data-id="${id}" data-act2="${act}">${terms.map((t) => `<option value="${t}"${p.q.term === t ? ' selected' : ''}>${t / 12} years</option>`).join('')}</select>`)}
      ${row(`Rate <span class="mute">(score ${p.q.score})</span>`, U.pct(p.q.rate, 2))}${row('Loan payment', `<b>${m(p.q.pay)}/mo</b>`)}${row('Property tax', `${m(p.tax)}/mo`)}${row('Insurance', `${m(p.ins)}/mo`)}
      ${row('<b>Total each month</b>', `<b>${m(p.total)}/mo</b>`)}${row('<b>Cash today</b>', `<b>${m(p.cash)}</b>`)}</table>
      <div class="mute">Cash today = down payment + closing ${m(p.fees)} + loan fee ${m(p.q.fee)}. Tax and insurance are estimates.</div>
      <div class="ev ${p.q.block ? 'bad' : p.q.odds >= 0.7 ? 'good' : p.q.odds >= 0.4 ? 'warn' : 'bad'}"><b>Approval odds: ${p.q.block ? 'no chance' : U.pct(p.q.odds)}</b>${p.q.block ? ` · ${esc(p.q.block)}` : ''}</div>
      <table>${p.q.factors.map((f) => `<tr><td>${mark(f.mark)} ${esc(f.label)}${f.why ? `<div class="mute">${esc(f.why)}</div>` : ''}</td><td class="n">${esc(f.val)}</td></tr>`).join('')}</table>
      ${p.q.tips && p.q.tips.length ? `<div class="small"><b>What would raise your odds:</b><ul style="margin:4px 0 0 18px;padding:0">${p.q.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${g.cash < p.cash ? `<div class="ev bad">You need ${m(p.cash - g.cash)} more cash today to apply (you have ${m(g.cash)}).</div>` : ''}
      <div class="mute">Applying counts as a loan application even if the bank says no.</div></div>`;
  };
  UI.A.finDown = (v, el) => { UI.S.finDown = Number(v); UI.A[el.dataset.act2](el.dataset.id); };
  UI.A.finTerm = (v, el) => { UI.S.finTerm = Number(v); UI.A[el.dataset.act2](el.dataset.id); };
  // real estate listing
  UI.A.reFin = (id) => {
    const g = TG.G; const l = g.re.listings.find((x) => x.id === id); if (!l) return;
    const ltv = Math.min(TG.RE.maxLtv(l), 1 - (UI.S.finDown || 0)); const rc = TG.CONFIG.realEstate; /* v10: pick your down payment */
    const p = UI.finPreview(g, l.price, ltv, { rent: TG.RE.estRent(g, l), taxPct: rc.propertyTax, insPct: rc.insurancePct }, UI.S.finTerm || 300);
    const pu = TG.RE.marketRent(g, l);
    // v9 audit: what a typical month leaves you after ALL running costs and the loan (rentals with a loan often cost you cash each month)
    const runPct = rc.typicalRunPct || 0.048; const rentL = TG.RE.estRent(g, l); const run = Math.round(l.price * runPct / 12); const left = Math.round(rentL - run - p.q.pay);
    const flow = l.units ? `<div class="card"><h3>🧮 A typical month with this loan ${UI.tipBtn('reFlow')}</h3><table><tr><td>Rent you can count on</td><td class="n">${m(rentL)}</td></tr><tr><td>Running costs (tax, repairs, upkeep, insurance, turnover)</td><td class="n">−${m(run)}</td></tr><tr><td>Loan payment</td><td class="n">−${m(p.q.pay)}</td></tr><tr><td><b>${left >= 0 ? 'You keep' : 'You pay from your own cash'}</b></td><td class="n"><b class="${left >= 0 ? 'good' : 'bad'}">${m(Math.abs(left))}/mo</b></td></tr></table>${left < 0 ? `<div class="ev warn">⚠️ The rent does not cover the costs and the loan: you add about ${m(-left)} a month (${m(-left * 12)} a year). It only pays off if prices rise. Keep at least ${m(-left * 12)} spare cash, or pay more down, or buy with cash.</div>` : '<div class="mute">The rent covers the costs and the loan in a normal month. Repairs and empty months still happen: keep some spare cash.</div>'}${UI.tipLine('reFlow', `Running costs are about ${U.pct(runPct, 1)} of the price a year in this game (property tax ${U.pct(rc.propertyTax, 1)}, upkeep, repairs, insurance, tenant turnover and the odd eviction). Big buildings also need a property manager (about 8% of rent plus a salary). "Rent you can count on" is the full rent less about 8% for empty months.`)}</div>` : '';
    UI.modal(`🏠 ${esc(l.name)}`, finHtml(g, p, 'reFin', id) + flow + `<div class="card"><div class="kv kvl"><span>Rent (est.)</span><span>${l.units ? `${m(pu)}/unit${l.units > 1 ? ` × ${l.units} = ${m(pu * l.units)}/mo when full` : '/mo'}` : 'no rent (land)'}</span></div>${l.units ? `<div class="mute">Lenders count about ${m(TG.RE.estRent(g, l))}/mo of it (some months units sit empty).</div>` : ''}</div>
      <div class="btns">${UI.btn('📝 Apply & buy', 'reFinGo', id, 'sm pri', !!p.q.block || g.cash < p.cash)}${UI.btn('Cancel', 'closeModal', null, 'sm')}</div>`);
  };
  UI.A.reFinGo = (id) => { const r = TG.RE.buy(TG.G, id, true, UI.S.finTerm || 300, UI.S.finDown || 0); UI.closeModal(); after(r && r.ok === false ? r : { ok: true }, r && r.h && r.h.units ? `Approved and bought. ${r.h.units > 1 ? `All ${r.h.units} units are` : 'It is'} empty: set each unit's rent and find a tenant for each one.` : 'Approved and bought.'); };
  // business property listing
  UI.A.propFin = (id) => {
    const g = TG.G; const p0 = g.listings.find((x) => x.id === id); if (!p0) return; const C = TG.CONFIG;
    const p = UI.finPreview(g, p0.price, 1 - C.property.mortgageDown, { taxPct: 0.012, insPct: C.finance.insurance.property.val }, UI.S.finTerm || C.finance.loans.mortgage.term);
    UI.modal(`🏢 ${esc(p0.name || 'Property')}`, finHtml(g, p, 'propFin', id) + `<div class="btns">${UI.btn('📝 Apply & buy', 'propFinGo', id, 'sm pri', !!p.q.block || g.cash < p.cash)}${UI.btn('Cancel', 'closeModal', null, 'sm')}</div>`);
  };
  UI.A.propFinGo = (id) => { const r = TG.P.acquire(TG.G, id, 'mortgage', UI.S.finTerm); UI.closeModal(); after(r, 'Approved and bought.'); };

  // ================= 🔑 RENT + TENANT SEARCH =================
  UI.rentRows = (g, h) => {
    const RE = TG.RE, T = TG.CONFIG.tenants; if (!h.units || h.kind === 'land') return '';
    const mr = RE.marketRent(g, h), ask = RE.askRent(g, h), vac = RE.vacant(h); const pv = RE.poolPreview(g, h); const cur = RE.current(g, h);
    let o = `<div class="row small" style="margin-top:4px"><span>${h.units > 1 ? 'Rent for every unit' : 'Your rent'}</span><select data-change="reRent" data-h="${h.id}">${T.rentSteps.map((r) => `<option value="${r}"${Math.abs((h.rentR || 1) - r) < 0.001 ? ' selected' : ''}>${m(mr * r)} (${r === 1 ? 'market' : Math.round(r * 100) + '%'})</option>`).join('')}</select><span class="mute">market ${m(mr)}/unit</span></div>`;
    const tot = (h.tenants || []).reduce((a, t, u) => a + (t ? t.rent || 0 : RE.askRent(g, h, u)), 0); const diff = Object.keys(h.unitR || {}).length > 0;
    if (h.units > 1) o += `<div class="small">${diff ? 'Rents set per unit' : `Your rent ${m(ask)}/unit × ${h.units} units`} = <b>${m(tot)}/mo when full</b> · now ${h.units - vac} of ${h.units} rented${h.mode === 'rent' && vac < h.units ? ` paying ${m((h.tenants || []).reduce((a, t) => a + (t ? t.rent || 0 : 0), 0))}/mo (leases keep the rent they signed at)` : ''}</div>`;
    o += `<div class="small">${(h.rentR || 1) > 1.08 ? '<span class="warn">Above market: fewer, riskier applicants and longer empty months.</span>' : (h.rentR || 1) < 0.95 ? '<span class="warn">Below market: lots of great applicants, but you leave money on the table.</span>' : 'Near market: a fair number of decent applicants.'}</div>`;
    if (vac && h.mode === 'rent' && !g.re.manager) o += `<div class="small warn">🔑 ${vac} empty unit${vac > 1 ? 's' : ''}: no property manager, so each one needs its own tenant search (below). Expect roughly ${Math.max(1, Math.round(pv.n) - 2)}-${Math.round(pv.n) + 2} applicants per search (it varies), mostly ${pv.label}.</div>`;
    void cur;
    return o;
  };
  UI.A.reRent = (v, el) => { const h = TG.G.re.holdings.find((x) => x.id === el.dataset.h); if (h) { h.rentR = Number(v); h.unitR = {}; } UI.refresh(); }; /* v10: one rent for all; each empty unit can then be changed on its own */
  // v7: every unit has its own search; you see one applicant at a time and cannot go back
  UI.A.reSearch = (arg) => {
    const g = TG.G, RE = TG.RE; const [hid, us] = String(arg).split('|'); const h = g.re.holdings.find((x) => x.id === hid); if (!h) return;
    const u = RE.pickUnit(g, h, us != null && us !== '' ? Number(us) : null, true); if (u < 0 || h.tenants[u]) { UI.closeModal(); UI.refresh(); return UI.toast('That unit is rented.'); }
    const a = RE.current(g, h, u); const tag = h.units > 1 ? ` · unit ${u + 1}` : ''; const key = `${hid}|${u}`;
    if (!a) {
      const pv = RE.poolPreview(g, h, false, u); const s0 = h.searches[u]; const had = s0 && s0.m >= g.month - TG.CONFIG.tenants.search.expires;
      return UI.modal(`🔎 Tenant search${esc(tag)}`, `<div class="card">${had ? '<div class="ev warn"><b>No applicants left.</b> Pay for another search to see more.</div>' : ''}
        <div class="kv kvl"><span>Home</span><span>${esc(h.name)}${esc(tag)}</span><span>Rent you ask</span><span>${m(RE.askRent(g, h, u))} (${Math.round(RE.unitRentR(h, u) * 100)}% of market)</span><span>Search cost</span><span>${m(RE.searchCost(g, h, false, u))}</span><span>Expect</span><span>about ${Math.max(0, Math.round(pv.n))} applicant(s), mostly ${pv.label}</span></div>
        <div class="mute">One tenant per home. This search is for this unit only. Ads, showings and background checks. You see one applicant at a time: accept or decline. Declined applicants are gone for good.</div>
        ${RE.unitIssues(h, u).length ? '<div class="ev bad">Fix the repair in this unit first.</div>' : ''}
        <div class="btns">${UI.btn(`💵 Pay ${m(RE.searchCost(g, h, false, u))} and search`, 'reSearchGo', key, 'sm pri', g.cash < RE.searchCost(g, h, false, u) || RE.unitIssues(h, u).length > 0)}${UI.btn('Close', 'closeModal', null, 'sm')}</div></div>`);
    }
    const s = h.searches[u]; const left = s.list.length - s.i; const marks = RE.applicantMarks(a);
    UI.modal(`👤 Applicant${esc(tag)}`, `<div class="card"><div class="row sp"><b>${esc(a.name)}</b><span class="mute">${left} left for this unit</span></div>
      <table>${marks.map((x) => `<tr><td>${mark(x.mark)} ${esc(x.label)}</td><td class="n">${esc(x.val)}</td></tr>`).join('')}</table>
      <div class="small">Rent ${m(s.rent)}/mo. Rule of thumb: income at least 3x rent, no evictions, credit 650+.</div>
      <div class="mute">These are clues, not guarantees: good tenants can still lose a job, and risky ones sometimes pay fine.</div>
      <div class="btns">${UI.btn('✅ Accept', 'reDecide', key + '|1', 'sm goodb')}${UI.btn('❌ Decline', 'reDecide', key + '|0', 'sm badb')}${UI.btn('Close', 'closeModal', null, 'sm')}</div></div>`);
  };
  UI.A.reSearchGo = (key) => { const [hid, u] = String(key).split('|'); const r = TG.RE.search(TG.G, hid, null, u != null ? Number(u) : null); if (!r.ok) return UI.toast(r.msg, true); UI.toast(r.n ? `${r.n} applicant(s) came.` : 'Nobody applied at this rent.', !r.n); UI.A.reSearch(`${hid}|${r.unit}`); UI.refresh(); };
  UI.A.reDecide = (arg) => {
    const [hid, u, acc] = arg.split('|'); const g = TG.G; const r = TG.RE.decide(g, hid, acc === '1', Number(u)); if (!r.ok) return UI.toast(r.msg || 'Not possible.', true);
    UI.toast(acc === '1' ? `Signed a lease with ${r.tenant.name}.` : 'Declined.');
    if (acc === '1') UI.closeModal(); else UI.A.reSearch(`${hid}|${u}`);
    UI.refresh();
  };
  // ================= ✋ "NO MANAGER: YOU MUST DO THIS YOURSELF" =================
  UI.todoCard = (g, b) => {
    const D = TG.D, out = [];
    const broken = b.equip.filter((x) => x.broken && x.broken !== 'destroyed');
    if (broken.length && !TG.E.hasMech(b)) out.push(['🔧', `${broken.length} broken machine${broken.length > 1 ? 's' : ''}: no mechanic, so they stay broken until you tap Fix (Gear tab).`, 'tab', 'biz:equip']);
    if (b.stock && TG.ST.def(b) && !D.handler(g, b, 'stock')) { const q = TG.ST.suggest(b, g); if (q > 0) out.push(['📦', `Buy supplies: about ${N(q)} more for next month. No manager reorders for you.`, null, null]); }
    if (b.farm && b.farm.areas && !D.handler(g, b, 'farm')) {
      const A = b.farm.areas, M = TG.M;
      if (A.cows.herd) { const fc = M.herdForecast(g, b); if ((b.farm.feed || 0) < fc.buy * 1.5) out.push(['🌽', `Feed: ${N(b.farm.feed || 0)} t in storage, cows need about ${N(fc.buy)} t next month.`, null, null]); if (A.cows.st.ready >= 1) out.push(['🥩', `${N(A.cows.st.ready)} cattle are market-ready: sell them.`, null, null]); if (A.cows.st.bull < 0.5 && A.cows.herd > 5) out.push(['🐃', 'No bull: very few calves. Buy one (See all cows).', 'detail', 'stock']); }
      if (A.crops.acres) { const e = M.areaE(b, 'crops'); const nm = U.moy(g.month + 1); if (e.plant.indexOf(nm) >= 0 && (b.farm.seeds || 0) < A.crops.acres / e.plant.length) out.push(['🌱', `Planting next month: buy seed (have ${N(b.farm.seeds)} acres' worth).`, 'tab', 'biz:model']); }
      for (const k of ['crops', 'orchard']) if (A[k].acres && A[k].soil < 0.5) out.push(['🧪', `${M.areaLabel(k)} soil is ${U.pct(A[k].soil)}: nobody sprays unless you do.`, 'tab', 'biz:model']);
    }
    if (!out.length) return '';
    return `<div class="card"><h3>✋ You must do this yourself</h3><div class="mute">No manager for these jobs. Hire a GM / ops manager / mechanic to hand them off.</div>${out.map(([i, t, a, arg], n) => `<div class="irow"><span class="ic">${i}</span><span class="lb">${esc(t)}</span>${a ? UI.btn('Go', a, arg, 'xs') : ''}</div>`).join('')}</div>`;
  };

  // ================= 📊 REPORTS TAB (results and forecasts live here; the Now tab is for doing) =================
  UI.salesSummary = (g, b) => {
    const done = !!(b.hist && b.hist.length && b.lastCtx && b.lastCtx.cap != null); const lc = done ? b.lastCtx : UI.lc(b); if (lc.cap == null || b.proj || b.fr || b.farm || b.tech || b.factory) return '';
    return UI.irow('ss' + b.id, '🛒', done ? 'Sold last month' : 'Expected sales next month', `${N(lc.served)}/${N(lc.cap)}`, `Customers wanted ${N(lc.demand)}. Full sales detail is in 📊 Reports.`, UI.btn('📊', 'tab', 'biz:rep', 'xs'), `wanted ${N(lc.demand)}`);
  };
  UI.reportsTab = (g, b) => {
    const h = b.hist, last = h[h.length - 1];
    let o = UI.flowCard(g, b) + UI.forecastCard(g, b) + UI.salesCard(g, b);
    const risks = TG.B.topRisks(g, b).slice(0, 8);
    o += `<div class="card"><h3>⚠️ Risks next month</h3><table>${risks.map((r) => `<tr><td>${esc(r.label)}<div class="mute">${esc(r.why)}</div></td><td class="n">${UI.risk(r.p)}</td></tr>`).join('') || '<tr><td class="mute">Nothing notable.</td></tr>'}</table></div>`;
    if (last) o += `<div class="card"><details><summary>🧾 Money in & out</summary><table>${Object.entries(last.lines || {}).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '-'}${m(Math.abs(v))}</td></tr>`).join('')}</table>${h.length > 2 ? UI.spark(h.slice(-36).map((x) => x.profit), '#2563eb') : ''}</details></div>`;
    const ev = g.log.filter((e) => e.bizId === b.id || e.biz === b.name).slice(-12).reverse();
    if (ev.length) o += `<div class="card"><details><summary>📰 What happened</summary>${ev.map((e) => `<div class="small"><span class="mute">${U.dateStr(e.m)}</span> ${e.type === 'decision' ? `<b>${esc(e.by)}</b>: ` : ''}${esc(e.text)}</div>`).join('')}</details></div>`;
    return o;
  };
  void biz;
})();
