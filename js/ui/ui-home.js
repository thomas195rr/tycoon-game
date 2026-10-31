/* ui-home.js - dashboard, monthly report, skip summary, decision cards, new game. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;

  UI.screens.home = () => {
    const g = TG.G; const h = g.history; const last = h[h.length - 1];
    let out = '';
    if (!g.businesses.length && !g.re.holdings.length) {
      out += `<div class="card hi"><h3>👋 Let's start!</h3>
        <div class="irow"><span class="ic">1️⃣</span><span class="lb">Pick a business and a place in 🗺️ Shop</span></div>
        <div class="irow"><span class="ic">2️⃣</span><span class="lb">Press ▶ Next Month</span></div>
        <div class="irow"><span class="ic">3️⃣</span><span class="lb">See what happened, fix the red things, grow</span></div>
        <div class="btns">${UI.btn('🗺️ Go shopping', 'go', 'market', 'pri')}${UI.btn('🏘️ Houses to rent out', 'goMoneyTab', 're')}</div>
        ${g.player.noLoanUntil > g.month ? `<div class="mute">🏦 Banks won't lend for ${g.player.noLoanUntil - g.month} more months.</div>` : ''}</div>`;
    }
    out += `<div class="tiles">${UI.tile('h_cash', '💵', m(g.cash), 'Cash', g.cash < 0 ? 'r' : 'g', 'Money you can spend right now.')}
      ${UI.tile('h_nw', '📈', m(g.lastNW), 'Worth', '', 'Everything you own minus everything you owe.')}
      ${(() => { const lr = g.lastReport && g.lastReport.money; const v = lr ? lr.net : last ? last.profit : null; return UI.tile('h_pf', '💰', v != null ? (v >= 0 ? '+' : '−') + m(Math.abs(v)) : '–', 'Left with last month', v == null ? '' : v >= 0 ? 'g' : 'r', 'Cash change last month: everything in minus everything out (sales, rent, wages, machines, loan payments, tax...). Tap 📄 Last month for the full report.'); })()}
      ${UI.tile('h_cr', '🏦', TG.CREDIT.score(g).score, 'Credit score', TG.CREDIT.score(g).score >= 700 ? 'g' : TG.CREDIT.score(g).score >= 620 ? 'y' : 'r', 'Higher = better loan odds and cheaper rates. Details in Money → Finance.')}</div>`;
    { const L = TG.IN.list(g); const mine = new Set(g.businesses.map((b) => TG.IN.ofBiz(b))); const sh = L.filter((x) => mine.has(x.k)); const show = (sh.length ? sh : L.sort((a, c) => c.s.x - a.s.x).slice(0, 3)).slice(0, 4);
      out += `<div class="card"><div class="row sp"><h3 style="margin:0">📈 Industry outlook</h3>${UI.btn('See all', 'go', 'ind', 'xs')}</div>${show.map((x) => `<div class="small">${x.d.icon} ${esc(x.d.label)} ${UI.pill(x.st.label, x.st.tone)} ${TG.IN.arrow(x.s)}</div>`).join('')}</div>`; }
    const al = [];
    if (g.decisions.length) al.push(`<div class="ev warn" data-act="decisions" style="cursor:pointer">⚠️ <b>${g.decisions.length} thing${g.decisions.length > 1 ? 's' : ''} to decide.</b> Tap here.</div>`);
    if (g.cash < 0) al.push(`<div class="ev bad">💸 <b>Out of cash (${m(g.cash)}).</b> ${TG.CONFIG.finance.bankruptcyMonths - g.negMonths} month(s) to fix it: sell, borrow or cut costs.</div>`);
    for (const ls of g.lawsuits) al.push(`<div class="ev bad">⚖️ Sued: ${esc(ls.label)} (${m(ls.amount)}), ${ls.left} month(s) left</div>`);
    for (const b of g.businesses) {
      const br = b.equip.filter((x) => x.broken); if (br.length) al.push(`<div class="ev bad" data-act="go" data-arg="bizd:${b.id}" style="cursor:pointer">🔧 ${esc(b.name)}: ${br.length} broken</div>`);
      if (b.lastCtx && b.lastCtx.note) al.push(`<div class="ev info" data-act="go" data-arg="bizd:${b.id}" style="cursor:pointer">💡 ${esc(b.name)}: ${esc(b.lastCtx.note)}</div>`);
    }
    if (g.lastReport && g.lastReport.warns) for (const w of g.lastReport.warns.slice(0, 3)) al.push(`<div class="ev warn">⚠️ ${w.biz ? esc(w.biz) + ': ' : ''}${esc(w.text)}</div>`);
    if (al.length) out += `<div class="card"><h3>🔔 Look at these</h3>${al.join('')}</div>`;
    if (g.businesses.length) { out += `<h3>🏪 My businesses</h3>`; for (const b of g.businesses) out += UI.bizCard(b); }
    if (g.re.holdings.length) out += `<div class="card tap" data-act="goMoneyTab" data-arg="re"><div class="row"><span class="ico">🏘️</span><b class="grow">Houses & flats</b><b>${TG.RE.unitsOwned(g)} 🚪</b></div><div class="mute">Last month: ${UI.signed(Math.round(U.sum(g.re.holdings, (h) => h.lastNet || 0)))} after every cost and mortgage payment · ${g.re.holdings.reduce((a, h) => a + (h.tenants || []).filter((t) => !t).length, 0)} empty units</div></div>`;
    out += `<div class="card">${h.length > 2 ? `<div class="mute">📈 Worth</div>${UI.spark(h.slice(-60).map((x) => x.nw))}<div class="mute">💰 Profit each month</div>${UI.spark(h.slice(-60).map((x) => x.profit), '#2563eb')}` : ''}
      <div class="btns">${g.lastReport ? UI.btn('📄 Last month', 'lastReport') : ''}${UI.btn('📰 News', 'goMoreTab', 'news')}${UI.btn('📜 History', 'goMoreTab', 'log')}</div></div>`;
    const risks = [];
    for (const b of g.businesses) for (const r of TG.B.topRisks(g, b).slice(0, 3)) risks.push(Object.assign({ biz: b.name }, r));
    risks.sort((a, b) => b.p - a.p);
    if (risks.length) out += `<div class="card"><details><summary>🎲 Biggest risks next month</summary><table>${risks.slice(0, 6).map((r) => `<tr><td>${esc(r.biz)}: ${esc(r.label)}<div class="mute">${esc(r.why)}</div></td><td class="n">${UI.risk(r.p)}</td></tr>`).join('')}</table></details></div>`;
    return out;
  };
  UI.bizCard = (b) => {
    const g = TG.G, d = TG.CONFIG.businesses[b.type]; const h = b.hist[b.hist.length - 1];
    const lc = UI.lc(b); const fl = b.flow && b.flow.rows ? b.flow.rows : [];
    const bad = fl.filter((x) => x.c === 'r').length, warn = fl.filter((x) => x.c === 'y').length;
    const res = h ? (h.cash != null ? h.cash : h.profit) : 0; const shut = lc.closed || (b.lastCtx && b.lastCtx.closed);
    const tone = !h ? '' : res < 0 || bad || shut ? 'r' : warn > 2 ? 'y' : 'g';
    const top = fl.slice(0, 3).map((x) => `<span class="pill ${x.c === 'r' ? 'bad' : x.c === 'y' ? 'warn' : x.c === 'g' ? 'good' : ''}">${x.i} ${UI.fmtN(x.v, x.u)}</span>`).join(' ');
    return `<div class="card tap" data-act="go" data-arg="bizd:${b.id}"><div class="row"><span class="ico">${d.icon}</span><div class="grow"><div class="row sp"><b>${esc(b.name)}</b><span class="row">${UI.dot(tone)}${h ? UI.signed(Math.round(res)) : '<span class="mute">new</span>'}</span></div>${shut ? `<div class="closed small">🚫 ${esc(lc.note || 'Closed: no supplies, no manager')}</div>` : ''}
      <div class="mute">${b.licensePending > 0 ? `⏳ license ${b.licensePending} mo · ` : ''}⭐ ${Math.round(b.rep)} · 👥 ${TG.S.allStaff(b).length} · 🛠️ ${b.equip.length}${g.player.ownerBiz === b.id ? ' · 👤 you' : b.spec.gm ? ' · 👔 boss' : ' · ⚠️ no boss'}${lc.cap ? ` · 📊 ${Math.round((lc.served || 0) / lc.cap * 100)}%` : ''}</div>${top ? `<div style="margin-top:4px">${top}</div>` : ''}</div></div></div>`;
  };
  UI.A.goMoneyTab = (t) => { UI.tab.money = t; UI.go('money'); };
  UI.A.goMoreTab = (t) => { UI.tab.more = t; UI.go('more'); };

  // ---------- monthly report ----------
  const plTable = (inc, exp) => {
    const rows = []; let ti = 0, te = 0;
    for (const [k, v] of Object.entries(inc || {}).sort((a, b) => b[1] - a[1])) { ti += v; rows.push(`<tr><td>${esc(k)}</td><td class="n good">+${m(v)}</td></tr>`); }
    for (const [k, v] of Object.entries(exp || {}).sort((a, b) => b[1] - a[1])) { te += v; rows.push(`<tr><td>${esc(k)}</td><td class="n bad">-${m(v)}</td></tr>`); }
    rows.push(`<tr><td><b>Operating profit</b></td><td class="n"><b>${UI.signed(ti - te)}</b></td></tr>`);
    return `<table>${rows.join('')}</table>`;
  };
  UI.reportHtml = (r) => {
    let o = `<div class="card"><div class="row sp"><div><div class="mute">Profit (after tax)</div><div class="big">${UI.signed(r.profit)}</div></div><div><div class="mute">Cash</div><div class="big">${m(r.cashEnd)}</div><div class="mute">${UI.signed(r.cashEnd - r.cashStart)} this month</div></div><div><div class="mute">Net worth</div><div class="big">${m(r.nw)}</div><div class="mute">${UI.signed(r.nw - r.nwStart)}</div></div></div>
      <div class="mute" style="margin-top:4px">Economy: ${esc(r.world.phase)} · interest ${U.pct(r.world.rate, 1)} · prices x${r.world.inflation.toFixed(2)}${r.tax ? ` · income tax ${m(r.tax)}` : ''}</div></div>`;
    if (r.ach && r.ach.length) o += `<div class="card" style="border-color:#15803d">🏆 Achievement${r.ach.length > 1 ? 's' : ''}: ${r.ach.map((a) => esc(TG.CONFIG.achievements[a])).join(', ')}</div>`;
    for (const b of r.biz) {
      o += `<div class="card"><div class="row sp"><b>${esc(b.name)}</b>${UI.signed(b.profit)}</div><div class="mute">Revenue ${m(b.rev)} · costs ${m(b.cost)}</div>
        <ul class="plain small">${b.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        <details><summary class="small">Income & expense lines</summary><table>${b.lines.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '-'}${m(Math.abs(v))}</td></tr>`).join('')}</table></details></div>`;
    }
    if (r.re) o += `<div class="card"><b>🏘️ Real estate</b><div class="mute">${r.re.units} units · rent in ${m(r.re.rev)} · costs ${m(r.re.cost)} · net ${UI.signed(r.re.rev - r.re.cost)}</div></div>`;
    const evs = r.events.filter((e) => e.type !== 'news');
    if (evs.length) o += `<div class="card"><h3 style="margin-top:0">What happened (${evs.length})</h3>${evs.slice(0, 60).map(UI.ev).join('')}</div>`;
    if (r.decisions.length) o += `<div class="card"><h3 style="margin-top:0">Decisions made</h3>${r.decisions.map((d) => `<div class="ev ${d.outcome === 'bad' ? 'bad' : d.outcome === 'good' ? 'good' : 'info'}"><b>${esc(d.by)}</b>${d.biz ? ` (${esc(d.biz)})` : ''}: ${esc(d.text)}${d.outcome ? ` ${UI.pill(d.outcome === 'good' ? 'good call' : d.outcome === 'bad' ? 'bad call' : 'ok call', d.outcome === 'good' ? 'good' : d.outcome === 'bad' ? 'bad' : '')}` : ''}</div>`).join('')}</div>`;
    if (r.staff.length) o += `<div class="card"><h3 style="margin-top:0">Staff changes</h3>${r.staff.map((s) => `<div class="small">👥 ${s.biz ? esc(s.biz) + ': ' : ''}${esc(s.text)}</div>`).join('')}</div>`;
    if (r.news.length) o += `<div class="card"><h3 style="margin-top:0">News</h3>${r.news.map((n) => `<div class="ev ${n.tone}">📰 ${esc(n.text)}</div>`).join('')}</div>`;
    if (r.warns.length) o += `<div class="card"><h3 style="margin-top:0">Warning signs</h3>${r.warns.map((w) => `<div class="ev warn">${w.biz ? esc(w.biz) + ': ' : ''}${esc(w.text)}${w.p ? ` (${U.pct(w.p, 1)})` : ''}<div class="why">${esc(w.why || '')}</div></div>`).join('')}</div>`;
    o += `<div class="card"><details><summary>Full money flow</summary>${plTable(r.inc, r.exp)}
      ${Object.keys(r.capOut || {}).length || Object.keys(r.capIn || {}).length ? `<div class="mute" style="margin-top:6px">Not counted as profit (buying/selling assets, loans):</div><table>${Object.entries(r.capIn || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">+${m(v)}</td></tr>`).join('')}${Object.entries(r.capOut || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">-${m(v)}</td></tr>`).join('')}</table>` : ''}</details></div>`;
    return o;
  };
  UI.showReport = (r) => {
    const g = TG.G;
    UI.modal(`📄 ${r.date} report`, UI.reportHtml(r) + `<div class="btns">${g.decisions.length ? UI.btn(`⚠️ ${g.decisions.length} decision(s) waiting`, 'decisions', null, 'pri') : ''}${UI.btn('Close', 'closeModal')}</div>`);
  };
  UI.A.lastReport = () => { if (TG.G.lastReport) UI.showReport(TG.G.lastReport); };

  // ---------- skip summary ----------
  UI.showSkip = (s) => {
    let o = `<div class="card"><div class="mute">${s.from} to ${s.to}: ${s.months} months (${U.yrsMo(s.months)}) simulated one by one${s.months < s.asked ? `, stopped early of ${s.asked}` : ''}</div>
      ${s.stopped ? `<div class="ev bad"><b>Stopped early (${esc(s.stopped.date)}):</b> ${esc(s.stopped.text)}</div>` : ''}
      <div class="row sp" style="margin-top:6px"><div><div class="mute">Total profit</div><div class="big">${UI.signed(s.profit)}</div></div><div><div class="mute">Cash</div><div class="big">${m(s.cash1)}</div><div class="mute">from ${m(s.cash0)}</div></div><div><div class="mute">Net worth</div><div class="big">${m(s.nw1)}</div><div class="mute">from ${m(s.nw0)}</div></div></div></div>`;
    const bt = Object.entries(s.bizTot);
    if (bt.length) o += `<div class="card"><h3 style="margin-top:0">By business</h3><table>${bt.map(([n, t]) => `<tr><td>${esc(n)}</td><td class="n">rev ${m(t.rev)}</td><td class="n">${UI.signed(t.profit)}</td></tr>`).join('')}</table></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Major events (${s.majorCount})</h3>${s.majors.length ? s.majors.slice(-40).reverse().map((e) => `<div class="ev bad"><b>${esc(e.date)}</b> ${e.biz ? esc(e.biz) + ': ' : ''}${esc(e.text)}<div class="why">${esc(e.why || '')}</div></div>`).join('') : '<div class="mute">None. Quiet stretch.</div>'}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Manager decisions (${s.decisionCount})</h3>${s.decisions.length ? s.decisions.slice(-30).reverse().map((d) => `<div class="ev ${d.outcome === 'bad' ? 'bad' : d.outcome === 'good' ? 'good' : 'info'}"><b>${esc(d.date)}</b> ${esc(d.by)}: ${esc(d.text)}</div>`).join('') : '<div class="mute">No manager decisions. Without managers, problems sat unhandled.</div>'}</div>`;
    o += `<div class="card"><details><summary>Money flow over the skip</summary>${plTable(s.inc, s.exp)}</details></div>`;
    UI.modal(`⏩ Skip summary`, o + `<div class="btns">${s.pending ? UI.btn(`⚠️ ${s.pending} decision(s) waiting`, 'decisions', null, 'pri') : ''}${UI.btn('Close', 'closeModal')}</div>`);
  };

  // ---------- decisions ----------
  UI.A.decisions = () => {
    const g = TG.G;
    if (!g.decisions.length) { UI.closeModal(); UI.toast('No decisions waiting.'); UI.render(); return; }
    const o = g.decisions.map((d) => {
      const b = d.bizId ? TG.B.get(g, d.bizId) : null; const h = TG.D.handler(g, b, d.kind);
      return `<div class="card"><div class="row sp"><b>${esc(d.title)}</b>${b ? `<span class="mute">${esc(b.name)}</span>` : ''}</div><div>${esc(d.text || '')}</div>${d.why ? `<div class="mute">Why: ${esc(d.why)}</div>` : ''}
      <div class="btns">${d.options.map((o) => UI.btn(esc(o.label), 'decide', `${d.id}|${o.id}`, 'sm')).join('')}</div>
      <div class="mute" style="margin-top:4px">If you don't choose: ${h ? `${esc(h.label)} decides (${U.pct(h.p)} chance of a good call)` : d.def != null ? `default "${esc((d.options.find((x) => x.id === d.def) || {}).label || d.def)}"` : 'it stays open until the deadline'}</div></div>`;
    }).join('');
    UI.modal('⚠️ Decisions', o);
  };
  UI.A.decide = (arg) => {
    const g = TG.G; const [id, opt] = arg.split('|'); const d = g.decisions.find((x) => x.id === id); if (!d) return;
    TG.D.resolve(g, d, opt, null);
    UI.toast('Done.'); UI.save();
    if (g.decisions.length) UI.A.decisions(); else { UI.closeModal(); UI.render(); }
  };

  // ---------- new game ----------
  UI.newGameScreen = (first) => {
    const sc = TG.Game.scenarios;
    const o = `<div class="card"><p>A turn-based business sim. Buy property, start businesses, hire people, manage risk. Every outcome is a probability, and each month's report explains what happened and why.</p>
      <div class="kv"><span>Your name</span><span><input type="text" id="ngName" value="${esc((TG.G && TG.G.player.name) || 'You')}" maxlength="24"></span>
      <span>Starting money</span><span><select id="ngMoney"><option value="random">Random ($90k-$260k)</option><option value="low">Low</option><option value="high">High</option></select></span>
      <span>Event frequency</span><span><select id="ngFreq"><option value="normal">Normal</option><option value="calm">Calm (fewer bad events)</option></select></span>
      <span>Gambling & high-risk investing</span><span><select id="ngGamble"><option value="1">On</option><option value="0">Off (hidden)</option></select></span>
      <span>Seed (optional)</span><span><input type="number" id="ngSeed" placeholder="random"></span></div></div>
      <h3>Choose a start</h3>${Object.entries(sc).map(([id, s]) => `<div class="card"><div class="row sp"><div class="grow"><b>${esc(s.label)}</b><div class="mute">${esc(s.desc)}</div></div>${UI.btn('Start', 'newGame', id, 'pri')}</div></div>`).join('')}
      ${first ? '' : '<div class="mute">Starting a new game replaces the current autosave (export it first in Settings if you want to keep it).</div>'}`;
    if (first) { document.querySelector('#app').innerHTML = `<header class="top"><span class="date">🏢 Tycoon</span></header><main><h2>New game</h2>${o}</main>`; }
    else UI.modal('New game', o);
  };
  UI.A.newGame = (scenario) => {
    const seedV = UI.num('ngSeed', NaN);
    const g = TG.Game.newGame({ scenario, name: UI.val('ngName') || 'You', money: UI.val('ngMoney'), seed: Number.isFinite(seedV) ? seedV : undefined, settings: { eventFreq: UI.val('ngFreq') || 'normal', gambling: UI.val('ngGamble') !== '0' } });
    TG.G = g; UI.closeModal(); UI.save(); UI.go(scenario === 'farm' ? 'biz' : 'home');
    UI.toast('New game started. Good luck!');
  };
})();
