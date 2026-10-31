/* ui-v7.js - v7 screens: the money report (money in, expense groups, what you are left with, who made or lost money),
   skip totals with a month-by-month view, the loans screen with amortization, rental units, closed shops and HR hiring. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const N = (x) => Math.round(x || 0).toLocaleString();
  const LG = () => TG.LG;
  const sg = (x) => UI.signed(Math.round(x));
  const plus = (x) => `<span class="good">+${m(Math.round(x))}</span>`, minus = (x) => `<span class="bad">−${m(Math.round(x))}</span>`;
  const grp = (icon, label, val, inner, open) => `<details class="grp"${open ? ' open' : ''}><summary><span class="gl"><span class="car"></span>${icon} ${esc(label)}</span><span class="gv">${val}</span></summary><div class="in1">${inner}</div></details>`;
  const lineRows = (lines, sign) => `<table>${Object.entries(lines).sort((a, b) => b[1] - a[1]).filter(([, v]) => Math.abs(v) >= 0.5).map(([k, v]) => `<tr><td>${esc(k)}${LG().NOTE[k] ? ` <span class="mute">(${esc(LG().NOTE[k])})</span>` : ''}</td><td class="n">${sign > 0 ? plus(v) : minus(v)}</td></tr>`).join('')}</table>`;

  // ================= 💰 THE MONEY REPORT =================
  UI.moneyHtml = (M, opts) => {
    opts = opts || {}; if (!M) return '';
    const L = LG(); let o = '';
    o += `<div class="card"><h3>🟰 You are left with ${sg(M.net)}</h3><div class="row sp"><div><div class="mute">💰 In</div><div class="big good">+${m(M.tin)}</div></div><div><div class="mute">💸 Out</div><div class="big bad">−${m(M.tout)}</div></div><div><div class="mute">💵 Cash now</div><div class="big">${m(M.cashEnd)}</div></div></div>
      <div class="mute">${esc(opts.span || 'This month')}: every dollar in and out, including machines you bought, loan payments and money you moved between months.</div></div>`;
    // money in
    let inn = ''; for (const [k, ic, lb] of L.IN) { const G = M.inG[k]; if (G.t >= 0.5) inn += grp(ic, lb, plus(G.t), lineRows(G.lines, 1)); }
    o += `<div class="card"><h3>💰 Money in</h3>${inn || '<div class="mute">No money came in.</div>'}<div class="tot"><span>Total in</span><span class="good">+${m(M.tin)}</span></div></div>`;
    let out = ''; for (const [k, ic, lb] of L.OUT) { const G = M.outG[k]; if (G.t >= 0.5) out += grp(ic, lb, minus(G.t), lineRows(G.lines, -1)); }
    o += `<div class="card"><h3>💸 Money out</h3>${out || '<div class="mute">No money went out.</div>'}<div class="tot"><span>Total out</span><span class="bad">−${m(M.tout)}</span></div></div>`;
    o += `<div class="card"><h3>🟰 Bottom line</h3><table><tr><td>💵 Cash at the start</td><td class="n">${m(M.cashStart)}</td></tr><tr><td>💰 Money in</td><td class="n">${plus(M.tin)}</td></tr><tr><td>💸 Money out</td><td class="n">${minus(M.tout)}</td></tr>
      <tr><td><b>What you are left with</b></td><td class="n"><b>${sg(M.net)}</b></td></tr><tr><td><b>💵 Cash at the end</b></td><td class="n"><b>${m(M.cashEnd)}</b></td></tr></table>
      <div class="mute">${Math.abs(M.diff) < 1 ? '✔ Matches your real cash change.' : `⚠️ ${m(M.diff)} not explained.`}</div></div>`;
    o += UI.whoHtml(M, opts);
    return o;
  };
  // who made or lost money: every business, every property (grouped), investments, crime, you. Adds up to the bottom line.
  const ownerInner = (ow) => {
    const L = LG(); let t = '';
    for (const [k, ic, lb] of L.IN) { const v = ow.groups['+' + k]; if (v >= 0.5) t += `<tr><td>${ic} ${esc(lb)}</td><td class="n">${plus(v)}</td></tr>`; }
    for (const [k, ic, lb] of L.OUT) { const v = ow.groups['-' + k]; if (v >= 0.5) t += `<tr><td>${ic} ${esc(lb)}</td><td class="n">${minus(v)}</td></tr>`; }
    return `<table>${t}</table>${ow.borrowed >= 0.5 ? `<div class="mute">Includes ${m(ow.borrowed)} of borrowed money.</div>` : ''}`;
  };
  UI.whoHtml = (M, opts) => {
    const by = {}; for (const ow of M.owners) (by[ow.grp] = by[ow.grp] || []).push(ow);
    let o = '';
    for (const ow of (by.biz || []).concat(by.prop || [])) o += grp(ow.i, ow.n, sg(ow.net), ownerInner(ow));
    if (by.re) { const t = U.sum(by.re, (x) => x.net); o += grp('🏘️', `Real estate (${by.re.filter((x) => x.k !== 'rePort').length} properties)`, sg(t), by.re.map((ow) => grp(ow.i, ow.n, sg(ow.net), ownerInner(ow))).join(''), opts.openRE); }
    for (const ow of (by.inv || []).concat(by.crime || [], by.you || [])) o += grp(ow.i, ow.n, sg(ow.net), ownerInner(ow));
    return `<div class="card"><h3>📊 Who made or lost money ${UI.tipBtn('who')}</h3>${UI.tipLine('who', 'Each line counts ALL its real costs: machines bought, repairs and damage, its loan payments, upkeep. Red = it cost you money. The lines add up exactly to what you are left with.')}
      ${o || '<div class="mute">Nothing yet.</div>'}<div class="tot"><span>= Left with</span><span>${sg(M.net)}</span></div></div>`;
  };

  // monthly report: money first, then the why for each business, then events
  UI.reportHtml = (r) => {
    let o = '';
    if (r.money) o += UI.moneyHtml(r.money, { span: r.date });
    else o += `<div class="card"><div class="row sp"><div><div class="mute">Profit (after tax)</div><div class="big">${UI.signed(r.profit)}</div></div><div><div class="mute">Cash</div><div class="big">${m(r.cashEnd)}</div></div></div></div>`;
    o += `<div class="card"><div class="row sp"><div><div class="mute">Profit (after tax, before loans & purchases)</div><div class="big">${UI.signed(r.profit)}</div></div><div><div class="mute">Net worth</div><div class="big">${m(r.nw)}</div><div class="mute">${UI.signed(r.nw - r.nwStart)}</div></div></div>
      <div class="mute" style="margin-top:4px">Profit leaves out buying machines and buildings and paying down loans; "left with" above counts everything. Economy: ${esc(r.world.phase)} · interest ${U.pct(r.world.rate, 1)}${r.tax ? ` · income tax ${m(r.tax)}` : ''}</div></div>`;
    if (r.ach && r.ach.length) o += `<div class="card" style="border-color:#15803d">🏆 Achievement${r.ach.length > 1 ? 's' : ''}: ${r.ach.map((a) => esc(TG.CONFIG.achievements[a])).join(', ')}</div>`;
    if (r.biz.length) o += `<div class="card"><h3>🏪 Why each business did what it did</h3>${r.biz.map((b) => grp('🏪', b.name, sg(b.cash != null ? b.cash : b.profit), `<div class="mute">Cash made (all in) ${UI.signed(Math.round(b.cash != null ? b.cash : b.profit))} · profit on paper ${UI.signed(b.profit)} · sales ${m(b.rev)}</div><ul class="plain small">${b.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`)).join('')}</div>`;
    const evs = r.events.filter((e) => e.type !== 'news');
    if (evs.length) o += `<div class="card"><h3 style="margin-top:0">What happened (${evs.length})</h3>${evs.slice(0, 60).map(UI.ev).join('')}</div>`;
    if (r.decisions.length) o += `<div class="card"><h3 style="margin-top:0">Decisions made</h3>${r.decisions.map((d) => `<div class="ev ${d.outcome === 'bad' ? 'bad' : d.outcome === 'good' ? 'good' : 'info'}"><b>${esc(d.by)}</b>${d.biz ? ` (${esc(d.biz)})` : ''}: ${esc(d.text)}</div>`).join('')}</div>`;
    if (r.staff.length) o += `<div class="card"><h3 style="margin-top:0">Staff changes</h3>${r.staff.map((s) => `<div class="small">👥 ${s.biz ? esc(s.biz) + ': ' : ''}${esc(s.text)}</div>`).join('')}</div>`;
    if (r.news.length) o += `<div class="card"><h3 style="margin-top:0">News</h3>${r.news.map((n) => `<div class="ev ${n.tone}">📰 ${esc(n.text)}</div>`).join('')}</div>`;
    if (r.warns.length) o += `<div class="card"><h3 style="margin-top:0">Warning signs</h3>${r.warns.map((w) => `<div class="ev warn">${w.biz ? esc(w.biz) + ': ' : ''}${esc(w.text)}${w.p ? ` (${U.pct(w.p, 1)})` : ''}<div class="why">${esc(w.why || '')}</div></div>`).join('')}</div>`;
    return o;
  };

  // skip: totals for the whole stretch, then month by month (tap a month for who made or lost money)
  UI.showSkip = (s) => {
    UI.S.lastSkip = s;
    let o = `<div class="card"><div class="mute">${esc(s.from)} to ${esc(s.to)}: ${s.months} month${s.months === 1 ? '' : 's'}${s.months >= 12 ? ` (${U.yrsMo(s.months)})` : ''} simulated one by one${s.months < s.asked ? `, stopped early of ${s.asked}` : ''}</div>
      ${s.stopped ? `<div class="ev bad"><b>Stopped early (${esc(s.stopped.date)}):</b> ${esc(s.stopped.text)}</div>` : ''}
      <div class="row sp" style="margin-top:6px"><div><div class="mute">Net worth</div><div class="big">${m(s.nw1)}</div><div class="mute">from ${m(s.nw0)}</div></div><div><div class="mute">Profit (before loans & purchases)</div><div class="big">${UI.signed(s.profit)}</div></div></div></div>`;
    { const g = TG.G, r = g.re; if (r && r.holdings.length && !r.manager) { const open = U.sum(r.holdings, (h) => (h.issues || []).length); const empty = U.sum(r.holdings, (h) => TG.RE.vacant(h)); if (open || empty) o += `<div class="ev warn">🏘️ <b>Your buildings need you:</b> ${open ? `${open} repair${open > 1 ? 's' : ''} waiting (unfixed repairs annoy tenants and can bring city fines)` : ''}${open && empty ? ' · ' : ''}${empty ? `${empty} empty unit${empty > 1 ? 's' : ''} earning nothing` : ''}. Fix them in Money → 🏘️ Real estate, or hire a property manager to handle it during skips.</div>`; } }
    o += UI.moneyHtml(s.money, { span: s.months === 1 ? 'The whole month' : `All ${s.months} months together`, openRE: true });
    const PM = s.perMonth || []; const show = PM.slice(-600);
    o += `<div class="card"><details class="grp"><summary><span class="gl"><span class="car"></span>📅 Month by month (${PM.length})</span><span class="gv"></span></summary>
      ${PM.length > show.length ? `<div class="mute">Showing the last ${show.length} months.</div>` : ''}<div class="mute">Tap a month to see who made or lost money.</div>
      ${show.map((x) => grp('', x.date, `<span class="mute small">net</span> ${sg(x.net)} <span class="mute small">· cash ${m(x.cash)}</span>`, `<table class="mtab"><tr><td>💰 In</td><td class="n">${plus(x.in)}</td></tr><tr><td>💸 Out</td><td class="n">${minus(x.out)}</td></tr>${Object.entries(x.own).sort((a, b) => a[1] - b[1]).map(([k, v]) => { const nm = (s.names && s.names[k]) || LG().nameOf(TG.G, k) || { n: 'Closed / sold', i: '•' }; return `<tr><td>${nm.i} ${esc(nm.n)}</td><td class="n">${sg(v)}</td></tr>`; }).join('')}</table>`)).join('')}</details></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Major events (${s.majorCount})</h3>${s.majors.length ? s.majors.slice(-40).reverse().map((e) => `<div class="ev bad"><b>${esc(e.date)}</b> ${e.biz ? esc(e.biz) + ': ' : ''}${esc(e.text)}<div class="why">${esc(e.why || '')}</div></div>`).join('') : '<div class="mute">None. Quiet stretch.</div>'}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Manager decisions (${s.decisionCount})</h3>${s.decisions.length ? s.decisions.slice(-30).reverse().map((d) => `<div class="ev ${d.outcome === 'bad' ? 'bad' : d.outcome === 'good' ? 'good' : 'info'}"><b>${esc(d.date)}</b> ${esc(d.by)}: ${esc(d.text)}</div>`).join('') : '<div class="mute">No manager decisions. Without managers, problems sat unhandled.</div>'}</div>`;
    UI.modal('⏩ Skip summary', o + `<div class="btns">${s.pending ? UI.btn(`⚠️ ${s.pending} decision(s) waiting`, 'decisions', null, 'pri') : ''}${UI.btn('Close', 'closeModal')}</div>`);
  };

  // ================= 🏦 LOANS (like real mortgages) =================
  const loanOwnerName = (g, key) => { const nm = LG().nameOf(g, key); return nm ? `${nm.i} ${nm.n}` : '👤 You'; };
  UI.loansCard = (g) => {
    const F = TG.F; let o = `<div class="card" id="loansCard"><h3>🏦 Your loans (${g.loans.length + (g.loc.balance > 0 ? 1 : 0)}) ${UI.tipBtn('lns')}</h3>${UI.tipLine('lns', 'Every payment = interest on what you still owe + the rest off the balance. Early on most of it is interest; near the end most of it pays the loan down. Tap a loan for the full schedule, extra payments or paying it off.')}`;
    const rows = g.loans.map((l) => { const i = F.loanInfo(g, l); return `<div class="link" data-act="loanView" data-arg="${l.id}" style="cursor:pointer"><span class="ico">${l.type === 'mortgage' ? '🏠' : l.type === 'equipment' ? '🛠️' : l.type === 'emergency' ? '🚑' : '🏦'}</span><span class="grow"><b>${esc(l.label)}</b><small>${U.pct(l.rate, 2)} · ${m(l.payment)}/mo · ${i.monthsLeft} mo left${l.missed ? ` · <span class="bad">${l.missed} missed</span>` : ''}</small></span><b>${m(l.balance)}</b></div>`; });
    if (g.loc.balance > 0) { const i = F.locInfo(g); rows.push(`<div class="link" data-act="loanView" data-arg="loc" style="cursor:pointer"><span class="ico">💳</span><span class="grow"><b>Credit line</b><small>${U.pct(i.rate, 2)} · ${m(i.payment)}/mo minimum</small></span><b>${m(g.loc.balance)}</b></div>`); }
    o += rows.join('') || '<div class="mute">No loans.</div>';
    if (rows.length) o += `<div class="tot"><span>Total owed · ${m(F.totalPayments(g))}/mo</span><span>${m(U.sum(g.loans, (l) => l.balance) + g.loc.balance)}</span></div>`;
    return o + '</div>';
  };
  UI.A.loanView = (id) => {
    const g = TG.G, F = TG.F; const loc = id === 'loc'; const l = loc ? null : g.loans.find((x) => x.id === id); if (!loc && !l) { UI.closeModal(); return; }
    const i = loc ? F.locInfo(g) : F.loanInfo(g, l);
    const col = l && l.collateral ? (l.collateral.kind === 'property' ? `🏠 ${esc(((g.re.holdings.find((h) => h.id === l.collateral.id) || g.properties.find((p) => p.id === l.collateral.id) || {}).name) || 'property')} (the lender takes it after ${TG.CONFIG.finance.repoAfterMissed} missed payments)` : '🛠️ a machine') : 'none (unsecured)';
    const row = (a, b) => `<span>${a}</span><span>${b}</span>`;
    let o = `<div class="card"><div class="kv kvl">
      ${loc ? row('Approved limit', m(g.loc.limit || 0)) : row('Borrowed', m(i.original))}
      ${row('<b>Still owed</b>', `<b>${m(i.balance)}</b>`)}${row('Interest rate', `${U.pct(i.rate, 2)} a year`)}
      ${loc ? row('Length', 'no end date: minimum payments') : row('Length', `${i.term} months (${U.yrsMo(i.term)})`)}
      ${row('Monthly payment', `<b>${m(i.payment)}</b>${loc ? ' minimum' : ''}`)}
      ${row('This month: interest', minus(i.thisInt))}${row('This month: principal (off the balance)', `<span class="good">${m(i.thisPrin)}</span>`)}
      ${row('Interest paid so far', m(i.intPaid) + (l && l.histUnknown ? ' <span class="mute">(since v7)</span>' : ''))}${row('Interest still to pay', m(i.intLeft))}
      ${row('Months left', `${i.monthsLeft} (${U.yrsMo(i.monthsLeft)})`)}${row('Paid off in', U.dateStr(i.payoffM))}
      ${loc ? '' : row('Paid by', esc(loanOwnerName(g, i.owner)))}</div>${loc ? '' : `<div class="small" style="margin-top:6px">🔒 Security: ${col}</div>`}
      ${l && l.missed ? `<div class="ev bad">${l.missed} missed payment(s): late interest and fees were added to what you owe.</div>` : ''}</div>`;
    const cut = Math.min(i.balance, Math.max(0, Math.floor(g.cash)));
    o += `<div class="card"><h3>💵 Pay extra</h3><div class="mute">Extra money goes straight off the balance. ${loc ? 'Less owed = less interest.' : 'Your monthly payment stays the same, so the loan ends sooner and you skip the interest on those months.'}</div>
      <div class="row"><input type="number" id="xPay" placeholder="amount" min="0" step="1000" aria-label="extra payment">${UI.btn('Pay extra', 'loanExtra', id, 'sm pri')}</div>
      <div class="btns">${UI.btn(`Pay it all off (${m(i.balance)})`, 'loanExtra', id + '|all', 'sm', g.cash < i.balance)}</div>${cut < i.balance ? `<div class="mute">You have ${m(g.cash)} cash.</div>` : ''}</div>`;
    const S = i.schedule; const show = S.slice(0, 600);
    o += `<div class="card"><details class="grp"><summary><span class="gl"><span class="car"></span>📅 Full payment schedule (${S.length})</span><span class="gv"></span></summary>
      <table class="sched mtab"><tr><th>When</th><th>Pay</th><th>Interest</th><th>Off loan</th><th>Left</th></tr>${show.map((x) => `<tr><td>${U.dateStr(x.m)}</td><td class="n">${m(x.pay)}</td><td class="n bad">${m(x.int)}</td><td class="n good">${m(x.prin)}</td><td class="n">${m(x.bal)}</td></tr>`).join('')}</table>${S.length > show.length ? '<div class="mute">First 600 shown.</div>' : ''}</details></div>`;
    UI.modal(loc ? '💳 Credit line' : `🏦 ${esc(l.label)}`, o + `<div class="btns">${UI.btn('Close', 'closeModal')}</div>`);
  };
  UI.A.loanExtra = (arg) => {
    const g = TG.G, F = TG.F; const [id, how] = String(arg).split('|');
    if (id === 'loc') { const amt = how === 'all' ? g.loc.balance : UI.num('xPay', 0); const v = F.locRepay(g, amt); UI.toast(v ? `Paid ${m(v)} off the credit line.` : 'Nothing paid (check your cash).', !v); }
    else { const l = g.loans.find((x) => x.id === id); if (!l) return UI.closeModal();
      if (how === 'all') { if (g.cash < l.balance) return UI.toast(`Paying it off takes ${m(l.balance)}.`, true); const b = l.balance; F.payoff(g, id); UI.toast(`Paid off: ${m(b)}.`); }
      else { const before = F.loanInfo(g, l); const v = F.prepay(g, id, UI.num('xPay', 0)); if (!v) return UI.toast('Enter an amount you have in cash.', true); const after = g.loans.includes(l) ? F.loanInfo(g, l) : null; UI.toast(after ? `Paid ${m(v)} extra: ${before.monthsLeft - after.monthsLeft} months sooner, ${m(before.intLeft - after.intLeft)} less interest.` : `Paid off with ${m(v)}.`); } }
    if ((id === 'loc' && g.loc.balance > 0) || g.loans.some((x) => x.id === id)) UI.A.loanView(id); else UI.closeModal();
    UI.refresh();
  };

  // ================= 🔑 RENTAL UNITS: one tenant per home / unit =================
  UI.unitsHtml = (g, h) => {
    const RE = TG.RE; RE.ensureUnits(h); if (!h.units || h.kind === 'land' || !TG.CONFIG.realEstate.kinds[h.kind].rentPct) return '';
    const mgr = g.re.manager; const occ = h.tenants.filter((t) => t).length;
    const UL = h.tenants.map((t, u) => {
      const iss = RE.unitIssues(h, u);
      const fix = iss.map((it) => `<div class="small bad">🔧 ${esc(it.what)} ${UI.btn(`Fix ${m(RE.fixCost(g, it))}`, 'reFix', `${h.id}|${it.id}`, 'xs pri')}</div>`).join('');
      if (t) { const q = RE.quality(t); return `<div class="unit"><span class="un">🟢 ${u + 1}</span><span class="ub"><b>${esc(t.name)}</b> ${UI.pill('⭐'.repeat(q.stars) + ' ' + q.label, q.tone)}<br>${m(t.rent)}/mo · ${t.evict ? `<span class="bad">eviction: ${t.evict} mo</span>` : `lease ${RE.leaseLeft(g, t)} mo left`}${t.late ? ` · <span class="bad">${t.late} mo behind</span>` : ''}${fix}</span></div>`; }
      const cur = RE.current(g, h, u); const s = h.searches[u];
      const act = h.mode !== 'rent' ? '<span class="mute">not renting</span>' : iss.length ? '<span class="mute">fix first</span>' : mgr ? '<span class="mute">manager is on it</span>' : cur ? UI.btn(`👤 Applicants (${s.list.length - s.i})`, 'reSearch', `${h.id}|${u}`, 'xs pri') : UI.btn(`🔎 Search ${m(RE.searchCost(g, h, false, u))}`, 'reSearch', `${h.id}|${u}`, 'xs');
      const ur = RE.unitRentR(h, u); const mr = RE.marketRent(g, h); const rsel = `<select class="usel" data-change="reUnitR" aria-label="rent for unit ${u + 1}">${TG.CONFIG.tenants.rentSteps.map((r) => `<option value="${h.id}|${u}|${r}"${Math.abs(ur - r) < 0.001 ? ' selected' : ''}>${m(mr * r)} (${r === 1 ? 'market' : Math.round(r * 100) + '%'})</option>`).join('')}</select>`;
      return `<div class="unit" data-unit="${u}"><span class="un">🔴 ${u + 1}</span><span class="ub"><b>Empty</b> · rent ${rsel}${fix}</span>${act}</div>`;
    });
    const big = h.tenants.length > 8; const lim = UI.S['units' + h.id] ? UI.S['units' + h.id] : 40;
    const shown = UL.slice(0, lim).join('') + (UL.length > lim ? `<div class="btns">${UI.btn(`Show ${Math.min(40, UL.length - lim)} more units`, 'unitsMore', h.id, 'xs')}</div>` : '');
    const whole = (h.issues || []).filter((x) => x.unit == null).map((it) => `<div class="ev bad">🔧 Building: ${esc(it.what)} ${UI.btn(`Fix ${m(RE.fixCost(g, it))}`, 'reFix', `${h.id}|${it.id}`, 'xs pri')}</div>`).join('');
    return `${whole}<details class="grp"${big ? '' : ' open'}><summary><span class="gl"><span class="car"></span>🚪 Units: ${occ}/${h.tenants.length} rented</span><span class="gv">${h.tenants.length - occ ? `<span class="bad">${h.tenants.length - occ} empty</span>` : '<span class="good">full</span>'}</span></summary>${shown}</details>`;
  };
  UI.A.reUnitR = (v) => { const [hid, u, r] = String(v).split('|'); const h = TG.G.re.holdings.find((x) => x.id === hid); if (!h) return; h.unitR = h.unitR || {}; h.unitR[u] = Number(r); UI.refresh(); };
  UI.A.unitsMore = (hid) => { UI.S['units' + hid] = (UI.S['units' + hid] || 40) + 40; UI.refresh(); };
  UI.A.reFix = (arg) => { const [hid, iid] = arg.split('|'); const r = TG.RE.fixIssue(TG.G, hid, iid); if (UI.res(r, r.ok ? `Fixed for ${m(r.cost)}.` : null)) UI.refresh(); };

  // property manager card: what they do, what they cost, and what you must do without one
  UI.reMgrCard = (g) => {
    const RC = TG.CONFIG.realEstate, r = g.re, RE = TG.RE; const open = U.sum(r.holdings, (h) => (h.issues || []).length); const empty = U.sum(r.holdings, (h) => RE.vacant(h));
    if (r.manager) { const mg = r.manager; const rent = U.sum(r.holdings, (h) => U.sum((h.tenants || []).filter((t) => t), (t) => t.rent));
      return `<div class="ev info">🧑‍💼 <b>Property manager ${esc(mg.name)}</b> (skill ~${mg.skillSeen}) ${UI.btn('Fire', 'reMgrFire', null, 'xs')}<div class="small">Finds and screens a tenant for every empty unit, pays for repairs as they happen and handles evictions. Skill: tenants ${mg.skill >= 60 ? 'better' : mg.skill >= 40 ? 'about average' : 'worse'} than you'd find; searches and repairs cost x${RE.mgrCostMult(g).toFixed(2)}.</div><div class="small">Cost: ${m(mg.wage)}/mo + ${U.pct(RC.managerFeePct)} of rent (≈ ${m(rent * RC.managerFeePct)}) = about <b>${m(mg.wage + rent * RC.managerFeePct)}/mo</b>.</div></div>
        <div class="kv" style="margin-top:6px"><span>Handyman on call</span><span>${UI.btn(r.handyman ? 'Yes' : 'No', 'reHandy', null, 'sm')}</span></div>`; }
    return `<div class="ev warn">🧑‍💼 <b>No property manager: you do it all.</b><div class="small">Each empty unit needs its own tenant search${empty ? ` (${empty} empty now)` : ''}; repairs wait until you tap Fix${open ? ` (<b class="bad">${open} open</b>)` : ''}. Unfixed repairs annoy tenants, wear the building and can bring city fines. Self-managing more than ${RC.selfManageLimit} units gets sloppy (more late rent).</div>
      <div class="btns">${UI.btn('Hire a property manager', 'reMgr', null, 'sm')}</div><div class="mute">A manager costs a wage + ${U.pct(RC.managerFeePct)} of rent: worth it with many units.</div></div>
      <div class="kv" style="margin-top:6px"><span>Handyman on call (repairs −20%)</span><span>${UI.btn(r.handyman ? 'Yes' : 'No', 'reHandy', null, 'sm')}</span></div>`;
  };
  // ================= 🚫 CLOSED SHOP =================
  UI.closedBanner = (g, b) => {
    const lc = UI.lc(b); const closedNow = lc.closed || (b.lastCtx && b.lastCtx.closed);
    if (!closedNow) return '';
    const shut = Math.max(b.shut || 0, 1); const st = b.stock; const q = TG.ST.suggest(b, g);
    const pq = U.avg(b.staff, (e) => TG.B.shutQuitP(Object.assign({}, b, { shut: shut + 1 }), e), 0);
    return `<div class="closed">🚫 ${esc(lc.note || 'Closed: no supplies, no manager')}<div class="small" style="font-weight:600;margin-top:4px">No sales while closed. Wages (${m(TG.S.payroll(b))}/mo), rent and bills keep coming. Idle staff may quit: about ${U.pct(pq)} each next month (more each closed month and when unhappy). ${st ? `You have ${N(st.qty)} supplies.` : ''}</div>
      <div class="btns">${q > 0 ? UI.btn(`📦 Buy ${N(q)} supplies (${m(q * TG.ST.unitCost(g, b))})`, 'stBuyN', `${b.id}|${q}`, 'sm pri') : ''}${UI.btn('🧑‍💼 Hire an Ops manager to reorder', 'hireRole', 'ops', 'sm')}</div></div>`;
  };

  UI.A.stBuyN = (arg) => { const [id, q] = String(arg).split('|'); const g = TG.G, b = TG.B.get(g, id); if (!b) return; const c0 = g.cash; const n = TG.ST.buy(g, b, Number(q), 0); UI.res(n > 0 ? { ok: true } : { ok: false, msg: 'No room or not enough cash.' }, `Bought ${N(n)} supplies for ${m(c0 - g.cash)}${n < Number(q) - 0.5 ? ` (wanted ${N(q)}: not enough cash or room)` : ''}.`); UI.refresh(); };
  // ================= 🤝 HR IN HIRING =================
  UI.hrHiring = (g, b, role) => {
    const C = TG.CONFIG, S = TG.S; if (C.specialists[role] || role === 'ceo') return '';
    const hr = S.hrOf(b); const rd = S.roleDef(b, role) || {};
    if (hr) {
      const d = S.hrDisc(hr), sc = S.hrScreen(hr);
      return `<div class="ev info">🤝 <b>HR manager ${esc(hr.name)}</b> (skill ${Math.round(hr.skill)}, ${m(hr.wage)}/mo): wages about <b>${U.pct(d)} lower</b> for the same skill, and about <b>${U.pct(sc)}</b> of unreliable or dishonest applicants are screened out.
        <div class="mute">Odds, not a promise: the deepest bargains are more often duds, and people paid under the going rate are a bit less happy. HR pays for itself only if you hire a lot (${U.pct(d)} of ${m(S.payroll(b))} payroll ≈ ${m(d * U.sum(b.staff, (e) => e.wage))}/mo vs ${m(hr.wage)} salary).</div></div>`;
    }
    const sp = C.specialists.hr; const mid = Math.round((sp.wage[0] + sp.wage[1]) / 2 * (C.staff.specWageByTier[TG.B.def(b).tier] || 1));
    return `<div class="ev">🤝 <b>No HR manager</b>: you pay full wages and see every applicant. An HR manager (about ${m(mid)}/mo) would get ~${U.pct(S.hrDisc({ skill: 40 }))}–${U.pct(S.hrDisc({ skill: 85 }))} lower wages and screen out ${U.pct(S.hrScreen({ skill: 40 }))}–${U.pct(S.hrScreen({ skill: 85 }))} of bad fits. Worth it when you hire many people (your payroll: ${m(S.payroll(b))}/mo). ${UI.btn('See HR managers', 'hireRole', 'hr', 'xs')}</div>`;
  };
  UI.hrCand = (c) => (c.hrDisc != null ? `<div class="small">🤝 HR deal: ${m(c.wage)} instead of ${m(c.listWage)} (−${U.pct(c.hrDisc)})${c.screened ? ' · ✔ screened' : ''}</div>` : '');
})();
