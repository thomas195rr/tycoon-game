/* ui-misc.js - "More" screen: managers & CEO, news, event log, achievements & leaderboard, settings, help. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m; const N = (x) => Math.round(x).toLocaleString();

  UI.screens.more = () => {
    const tabs = [['mgr', '👔 Managers'], ['news', '📰 News'], ['log', '📜 Log'], ['ach', '🏆 Goals'], ['set', '⚙️ Settings'], ['help', '❓ Help']];
    const t = UI.curTab('more', 'mgr');
    return `<h2>☰ More</h2>${UI.tabs('more', tabs)}${({ mgr, news, log, ach, set, help }[t] || mgr)(TG.G)}`;
  };

  // ---------- managers & CEO ----------
  function mgr(g) {
    const C = TG.CONFIG;
    let o = `<div class="card"><h3 style="margin-top:0">How managers work</h3><div class="mute">Problems (breakdowns, thefts, poaching, lawsuits, bad PR) create decision cards. If you don't answer by next month, the right manager decides: their skill and happiness set the chance of a good call. Reckless managers take risks, cautious ones play safe, and dishonest ones may skim. With nobody to cover, the default happens and problems pile up. There are no spending limits: watch who you trust.</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">CEO</h3>`;
    if (g.ceo) { const c = g.ceo; o += `<div class="kv"><span>Name</span><span>${esc(c.name)}</span><span>Skill</span><span>~${c.skillSeen}</span><span>Morale</span><span>${Math.round(c.morale)}</span><span>Pay</span><span>${m(c.wage)}/mo + ${U.pct(c.profitShare, 1)} of profit</span><span>Good-call chance</span><span>${U.pct(TG.D.pGood(g, c, true))}</span><span>Style</span><span>${esc(c.trait || 'steady')}</span></div>
        <div class="kv" style="margin-top:6px"><span>CEO makes big moves (expansions, equipment, hiring)</span><span>${UI.btn(g.settings.ceoBigMoves ? 'On' : 'Off', 'setToggle', 'ceoBigMoves', 'sm')}</span></div>
        <div class="btns">${UI.btn(`Fire (severance ${m(c.wage * 3)})`, 'ceoFire', null, 'sm badb')}</div><div class="mute">A CEO covers every business when no specialist does, but gets worse past ${C.ceo.spanFree} businesses (spread thin).</div>`; }
    else {
      o += `<div class="mute">A CEO handles decisions across all businesses. Expensive: worth it once you run several.</div>`;
      for (const c of TG.D.ceoPool(g)) o += `<div class="ev"><div class="row sp"><b>${esc(c.name)}</b><span>${m(c.wage)}/mo + ${U.pct(c.profitShare, 1)} profit</span></div><div class="small">Skill ~${c.skillSeen} · ${c.years} yrs · style ${esc(c.trait || '?')}</div><div class="btns">${UI.btn('Hire', 'ceoHire', c.id, 'sm pri')}</div></div>`;
    }
    o += `</div><div class="card"><h3 style="margin-top:0">Managers by business</h3>`;
    for (const b of g.businesses) {
      const sp = Object.entries(b.spec || {}).filter(([, e]) => e);
      o += `<div class="ev"><div class="row sp"><b>${esc(b.name)}</b>${UI.btn('Open', 'go', `bizd:${b.id}`, 'sm')}</div><div class="small">${sp.length ? sp.map(([r, e]) => `${esc(C.specialists[r].label)}: ${esc(e.name)} (skill ~${e.skillSeen}, morale ${Math.round(e.morale)}, ${U.pct(TG.D.pGood(g, e))} good calls)`).join('<br>') : '<span class="warn">No managers: problems wait for you.</span>'}</div></div>`;
    }
    if (g.re.holdings.length) o += `<div class="ev"><b>Real estate</b><div class="small">${g.re.manager ? `Property manager ${esc(g.re.manager.name)}` : 'No property manager'}</div></div>`;
    return o + '</div>';
  }
  UI.A.ceoHire = (id) => { const c = (TG.G.ceoPool && TG.G.ceoPool.list || []).find((x) => x.id === id); if (c) { TG.D.hireCeo(TG.G, c); UI.toast(`${c.name} is your CEO.`); } UI.refresh(); };
  UI.A.ceoFire = () => { TG.D.fireCeo(TG.G); UI.refresh(); };

  // ---------- news / log ----------
  function news(g) {
    const n = (g.newsFeed || []).slice().reverse().slice(0, 80);
    return `<div class="card"><div class="mute">World events move prices, demand and wages. Economy: <b>${esc(TG.W.phaseLabel(g))}</b> · interest ${U.pct(g.world.baseRate, 1)} · prices x${g.world.priceIdx.toFixed(2)} · wages x${g.world.wageIdx.toFixed(2)} · housing x${g.world.housing.toFixed(2)}</div></div>` +
      (n.length ? n.map((e) => `<div class="ev ${e.tone}"><span class="mute">${U.dateStr(e.m)}</span> ${e.big ? '<b>' : ''}${esc(e.text)}${e.big ? '</b>' : ''}</div>`).join('') : '<div class="card mute">No news yet.</div>');
  }
  function log(g) {
    const f = UI.S.logF || 'all';
    let L = g.log.slice().reverse(); if (f !== 'all') L = L.filter((e) => (f === 'bad' ? e.type === 'bad' || e.type === 'major' : e.type === f));
    return `<div class="row"><span class="small">Show</span><select data-change="logF">${[['all', 'Everything'], ['bad', 'Problems'], ['good', 'Good news'], ['decision', 'Decisions'], ['staff', 'Staff']].map(([v, l]) => `<option value="${v}"${f === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="card" style="margin-top:8px">` +
      (L.slice(0, 200).map((e) => `<div class="small" style="border-bottom:1px solid #eee;padding:3px 0"><span class="mute">${U.dateStr(e.m)}</span> ${e.type === 'major' ? '🔴' : e.type === 'bad' ? '🟠' : e.type === 'good' ? '🟢' : e.type === 'decision' ? '🧭' : e.type === 'staff' ? '👥' : e.type === 'news' ? '📰' : '•'} ${e.biz ? `<b>${esc(e.biz)}</b>: ` : ''}${e.by ? `${esc(e.by)}: ` : ''}${esc(e.text)}${e.why ? `<div class="mute">Why: ${esc(e.why)}</div>` : ''}</div>`).join('') || '<div class="mute">Nothing yet.</div>') + '</div>';
  }
  UI.A.logF = (v) => { UI.S.logF = v; UI.refresh(); };

  // ---------- achievements & leaderboard ----------
  function ach(g) {
    const A = TG.CONFIG.achievements;
    let o = `<div class="card"><h3 style="margin-top:0">Achievements (${Object.keys(g.achievements).length}/${Object.keys(A).length})</h3>${Object.entries(A).map(([k, l]) => `<div class="small">${g.achievements[k] != null ? `🏆 <b>${esc(l)}</b> <span class="mute">${U.dateStr(g.achievements[k])}</span>` : `<span class="mute">🔒 ${esc(l)}</span>`}</div>`).join('')}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Milestones</h3>${TG.CONFIG.leaderboardTargets.map((t) => `<div class="small">${g.stats.reached && g.stats.reached[t] != null ? '✅' : '⬜'} Net worth ${m(t)}${g.stats.reached && g.stats.reached[t] != null ? ` in ${U.yrsMo(g.stats.reached[t])}` : ''}</div>`).join('')}<div class="mute">Peak net worth: ${m(g.stats.peakNW)}</div></div>`;
    const lb = TG.LB.all();
    o += `<div class="card"><h3 style="margin-top:0">Leaderboard (this device)</h3><table><tr><th>Player</th><th class="n">Peak</th><th class="n">Time</th></tr>${lb.map((e) => `<tr${e.id === g.gameId ? ' style="font-weight:700"' : ''}><td>${esc(e.name)} <span class="mute">${esc(e.scenario || '')}${e.bankruptcies ? `, ${e.bankruptcies} bankrupt` : ''}</span></td><td class="n">${m(e.peak)}</td><td class="n">${U.yrsMo(e.months)}</td></tr>`).join('') || '<tr><td class="mute">Play a few months to appear here.</td></tr>'}</table></div>`;
    return o;
  }

  // ---------- settings ----------
  function set(g) {
    const s = g.settings, MT = { breakdown: 'Equipment breakdowns', keyQuit: 'Key staff quitting', cash: 'Cash crunch / bankruptcy', lawsuit: 'Lawsuits', strike: 'Strikes & walkouts', harvest: 'Harvests', weather: 'Weather disasters' };
    const tg = (k, label, note) => `<span>${label}${note ? `<div class="mute">${note}</div>` : ''}</span><span>${UI.btn(s[k] ? 'On' : 'Off', 'setToggle', k, 'sm' + (s[k] ? ' goodb' : ''))}</span>`;
    let o = `<div class="card"><h3 style="margin-top:0">Gameplay</h3><div class="kv">
      ${tg('stopOnMajor', 'Stop a skip early on major events', 'Off by default. Choose the event types below.')}
      ${tg('confirmPending', 'Warn before Next Month if decisions are waiting')}
      ${tg('gambling', 'Gambling & high-risk investing', 'Casino, betting, penny stocks, coins, margin, angel deals')}
      ${tg('crime', '🕶️ Crime side', 'Street deals, bank jobs, sabotage. Off hides it and freezes everything there.')}
      ${tg('habit', 'Gambling habit can build up', 'Big bets can lead to chasing losses on their own')}
      ${tg('autoCredit', 'Auto-draw credit line when cash runs short')}
      ${tg('ceoBigMoves', 'CEO may make big moves for me')}
      <span>Event frequency</span><span><select data-change="setFreq"><option value="normal"${s.eventFreq === 'normal' ? ' selected' : ''}>Normal</option><option value="calm"${s.eventFreq === 'calm' ? ' selected' : ''}>Calm</option></select></span></div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Stop the skip on…</h3><div class="kv">${Object.entries(MT).map(([k, l]) => `<span>${l}</span><span>${UI.btn(s.majorTypes[k] ? 'Yes' : 'No', 'setMajor', k, 'sm' + (s.majorTypes[k] ? ' goodb' : ''))}</span>`).join('')}</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Save</h3><div class="mute">The game autosaves after every month and action${TG.store.ok ? ' in this browser' : '. <b class="bad">Browser storage is blocked here, so autosave only lasts this session: use Export to keep your progress.</b>'}.</div>
      <div class="btns">${UI.btn('Export save code', 'exportSave', null, 'sm')}${UI.btn('Import save code', 'importSave', null, 'sm')}${UI.btn('New game', 'newGameOpen', null, 'sm pri')}${UI.btn('Delete save', 'clearSave', null, 'sm badb')}</div>
      <div class="mute">Seed ${g.seed} · month ${g.month} · version ${TG.VERSION}</div></div>`;
    return o;
  }
  UI.A.setMajor = (k) => { const s = TG.G.settings; s.majorTypes[k] = !s.majorTypes[k]; UI.refresh(); };
  UI.A.setFreq = (v) => { TG.G.settings.eventFreq = v; UI.refresh(); };
  UI.A.exportSave = () => { const c = TG.Game.exportCode(TG.G); UI.modal('Export save', `<div class="card"><div class="mute">Copy this code somewhere safe. Paste it into Import to continue later (any browser).</div><textarea id="expCode" style="width:100%;height:160px" readonly>${esc(c)}</textarea><div class="btns">${UI.btn('Copy', 'copyCode', null, 'sm pri')}</div></div>`); };
  UI.A.copyCode = () => { const t = document.getElementById('expCode'); t.select(); try { document.execCommand('copy'); UI.toast('Copied.'); } catch (e) { UI.toast('Select and copy it manually.'); } };
  UI.A.importSave = () => UI.modal('Import save', `<div class="card"><textarea id="impCode" style="width:100%;height:160px" placeholder="TYC1:..."></textarea><div class="btns">${UI.btn('Load this save', 'importGo', null, 'pri')}</div></div>`);
  UI.A.importGo = () => { try { TG.Game.importCode(UI.val('impCode')); UI.closeModal(); UI.save(); UI.toast('Save loaded.'); UI.go('home'); } catch (e) { UI.toast(e.message || 'Invalid code.', true); } };
  UI.A.newGameOpen = () => UI.newGameScreen(false);
  UI.A.clearSave = () => UI.confirm('Delete the saved game and start over?', 'clearGo');
  UI.A.clearGo = () => { TG.Game.clearSave(); if (TG.IDB) TG.IDB.put('tycoon_save_v1', null); TG.G = null; UI.closeModal(); UI.newGameScreen(true); };

  // ---------- help ----------
  const MONEY = {
    cafe: 'Drinks and food. Price × cups sold, minus beans, milk and wages.', foodtruck: 'Meals sold where the truck parks. Events and good spots pay most.',
    bakery: 'Bread and cakes baked each morning. Unsold stock goes stale fast.', salon: 'Haircuts and color per visit. Good stylists keep regulars.',
    carwash: 'Price per wash × cars. Sunny weeks busy, rainy weeks quiet.', lawn: 'Mowing jobs in spring and summer, little in winter.',
    auto: 'Repair jobs: labor plus parts. Honest work brings repeat customers.', gym: 'Monthly memberships. January rush, then people quit.',
    farm: 'Crops sold at harvest, or cattle and milk sold through the year at market prices.', freight: 'Rate per load × loads hauled, minus diesel, tolls and drivers.',
    brand: 'Buy batches of clothes, sell them online. Hits sell out; flops sit in the warehouse.', hotel: 'Room-nights × room rate. Busy seasons and reviews drive it.',
    law: 'Billable case hours × hourly rate.', clinic: 'Patient visits paid by insurance, often late.',
    construction: 'Win bids, build, get paid by stages. Overruns eat profit.', factory: 'Products made on lines and sold in bulk at market price.',
    tech: 'Users who pay a subscription. Growth costs engineers and servers first.', franchise: 'Fees and royalties from every shop that franchisees run.',
  };
  const TIPS = {
    cafe: ['Watch the Baristas bar: over 100% means lost customers.', 'Fresh stock spoils in about 2 months: buy small, often.'],
    foodtruck: ['A spare generator fund helps: if the truck stops, sales stop.', 'Food spoils in a month.'],
    bakery: ['Match what you buy to what sells: leftovers spoil.', 'Ovens and mixers both limit output.'],
    salon: ['Chairs without stylists earn nothing, and the reverse too.', 'Happy stylists stay; leaving ones can take clients.'],
    carwash: ['Weather moves sales a lot: keep cash for slow months.', 'A running tunnel near 100% wears out much faster.'],
    lawn: ['Winter is slow: do not overhire in spring.', 'Mowers wear quickly when every crew is maxed.'],
    auto: ['Each tech needs a lift and the scanner keeps up with all of them.', 'Cutting corners raises lawsuit odds.'],
    gym: ['Members leave after the January rush.', 'Cardio and weights each cap how many members fit.'],
    farm: ['Plant and harvest windows are short: missing tractors or hands then costs the year.', 'Prices swing: storage lets you wait, but grain slowly spoils.'],
    freight: ['Diesel is about a third of costs: fill the yard tank when fuel is cheap.', 'Trucks without drivers earn nothing.'],
    brand: ['Test with small batches before a big order.', 'Unsold stock costs storage and loses value.'],
    hotel: ['Housekeepers and laundry both cap rooms cleaned.', 'Reviews drive occupancy: worn rooms hurt.'],
    law: ['Attorneys are the bottleneck; paralegals free their time.', 'Reputation builds slowly.'],
    clinic: ['Doctors are costly: keep exam rooms full.', 'Insurance pays late: keep a cash cushion.'],
    construction: ['Bid only what crews and machines can handle.', 'Clients pay late; overruns are common.'],
    factory: ['Each line needs about 14 workers to run full.', 'Selling far above market: buyers stop ordering.'],
    tech: ['Most apps fail; some get huge. Keep cash runway.', 'Server and engineer bars over 100% mean outages.'],
    franchise: ['Each regional manager covers about 10 shops.', 'Bad franchisees hurt the whole brand.'],
  };
  function help(g) {
    const C = TG.CONFIG; const t0 = UI.tab.helpb || 'how';
    const pick = `<div class="row" style="flex-wrap:wrap;gap:4px">${UI.btn('📖', 'tab', 'helpb:how', 'sm' + (t0 === 'how' ? ' pri' : ''))}${Object.entries(C.businesses).map(([k, d]) => UI.btn(d.icon, 'tab', 'helpb:' + k, 'sm' + (t0 === k ? ' pri' : ''))).join('')}</div>`;
    if (t0 === 'how' || !C.businesses[t0]) return `<div class="card">${pick}</div>${howTo(C)}`;
    const d = C.businesses[t0]; const k = t0; let o = `<div class="card">${pick}</div><div class="card"><h3 style="margin-top:0">${d.icon} ${esc(d.name)}</h3><div class="mute">${esc(d.blurb || '')}</div>`;
    o += UI.irow('hm' + k, '💰', 'Makes money', null, MONEY[k] || '');
    o += `<h4>👥 Staff</h4>` + Object.entries(d.roles).map(([r, rd]) => UI.irow('hr' + k + r, rd.support ? '🧹' : '🧑', rd.label, rd.cap > 1 ? `${N(rd.cap)}/mo` : '', `${rd.desc || ''} Training raises how much each can do. Overworked staff get unhappy and quit more.`)).join('');
    o += `<h4>🛠️ Equipment</h4>` + d.equip.map((e) => { const cat = C.equipCats[e.cat] || ['🛠️']; return UI.irow('he' + k + e.id, cat[0], e.label, U.money(e.price), `${e.desc || ''} Lasts about ${Math.round(e.life / 12)} yrs. Breaks about ${(e.brk * 100).toFixed(1)}% a month when new; more when old or run near 100%.`); }).join('');
    if (d.supply) o += `<h4>📦 Supplies</h4>` + UI.irow('hs' + k, d.supply.icon || '📦', d.supply.label || 'Supplies', '', `${d.supply.desc || 'Bought ahead and used as you sell.'} ${d.supply.shelf && d.supply.shelf < 900 ? `Goes bad after about ${d.supply.shelf} months.` : 'Does not go bad.'} Storage limits how much you can hold.`);
    else if (k === 'farm') o += `<h4>📦 Supplies</h4>` + UI.irow('hs' + k, '🌱', 'Seed, feed, animals', '', 'Seed is bought before planting and limited by storage. Animals need feed and get older each month: calves grow, cows give milk, old cows retire.');
    else o += `<h4>📦 Stock</h4>` + UI.irow('hs' + k, '📋', { construction: 'Jobs', tech: 'Users', franchise: 'Shops', brand: 'Batches', factory: 'Materials and products' }[k] || 'Stock', '', { construction: 'Each job goes bid → build → paid. Materials are bought per job.', tech: 'Users sign up, use the app, and some leave each month.', franchise: 'Shops open, grow, and some close.' }[k] || 'Bought or made, kept in storage, then sold.');
    const risks = (d.risks || []).filter((r) => r.base).slice().sort((a, b) => b.base - a.base).slice(0, 5);
    o += `<h4>⚠️ Main risks</h4>` + risks.map((r) => UI.irow('hk' + k + r.id, '⚠️', r.label, `~${(r.base * 100).toFixed(1)}%/mo`, `Usual odds before your choices change them. Caused by: ${r.why || 'bad luck'}.`)).join('');
    o += `<h4>💡 Tips</h4><ul class="plain small">${(TIPS[k] || []).map((x) => `<li>${esc(x)}</li>`).join('')}<li>Nothing is guaranteed: every month is rolled from odds.</li></ul></div>`;
    return o;
  }
  function howTo(C) {
    const rows = [['🏪', 'Start', 'Pick a business and a place in Market. The place decides how many customers come.'], ['🛠️', 'Equip', 'Machines and space set how much you can make or serve each month.'], ['👥', 'Staff', 'Each worker handles a set amount. Training raises it. Too much work makes people unhappy.'],
      ['📦', 'Stock', 'Buy supplies ahead. Storage limits how much. Old stock goes bad.'], ['🏷️', 'Price', 'Follow the market, or set your own price. Higher = fewer buyers.'], ['📊', 'Work bars', 'Green = fine, yellow = busy or idle, red = over 100%: lost sales and fast wear.'],
      ['▶️', 'Next month', 'Press it to play a month. The report shows money in and out and why things happened.'], ['⚠️', 'Risk', 'Bad events have odds you can see. Upkeep, managers and insurance lower them.'], ['📈', 'Grow', 'Hire managers, open more businesses, buy property, invest. No ending.']];
    return `<div class="card"><h3 style="margin-top:0">📖 How to play</h3>${rows.map(([i, l, t], n) => UI.irow('hh' + n, i, l, null, t)).join('')}</div>
      <div class="card"><h3 style="margin-top:0">🎨 Colors</h3><div>${UI.pill('green', 'good')} ${UI.pill('yellow', 'watch')} ${UI.pill('red', 'problem')}</div><div class="mute">Tap any ⓘ or label to see what it means.</div></div>
      <div class="card"><h3 style="margin-top:0">🏢 Business sizes</h3>${['small', 'between', 'corp'].map((t) => `<p><b>${esc(C.tiers[t].label)}</b> ${Object.values(C.businesses).filter((d) => d.tier === t).map((d) => d.icon).join(' ')}</p>`).join('')}<div class="mute">Tap a business icon above for its guide.</div></div>`;
  }
})();
