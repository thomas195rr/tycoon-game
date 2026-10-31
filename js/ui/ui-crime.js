/* ui-crime.js - the optional 🕶️ crime screen. Icon rows, tap for info, details behind buttons. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const N = (x) => Math.round(x).toLocaleString();
  const K = () => TG.CONFIG.crime;
  const S = () => (UI.S.cr = UI.S.cr || { sup: 'plug', ht: 'branch', hm: 1, hg: 1, hp: 0 });
  const tone = (p) => (p > 0.08 ? 'bad' : p > 0.025 ? 'warn' : 'good');
  const oddsPill = (p) => UI.pill(p < 0.001 ? '0%' : U.pct(p, p < 0.1 ? 1 : 0), tone(p));
  const rows = (list, pre) => list.map((x, i) => { const key = pre + i; return `<div class="irow"><span class="dot ${x.tone}"></span><span class="ic">${x.i}</span><span class="lb" data-act="tip" data-arg="${key}" data-nosave="1">${esc(x.t)}</span><span class="vl">${UI.fmtN(x.v, x.u)}</span>${x.tip ? UI.tipBtn(key) : ''}${UI.tipLine(key, x.tip)}</div>`; }).join('');

  UI.screens.crime = () => {
    const g = TG.G; const CR = TG.CR; const c = CR.ensure(g);
    if (!CR.on(g)) return `<h2>🕶️ Crime</h2><div class="card">Crime is turned off in ☰ More → ⚙️ Settings.</div>`;
    const tabs = [['home', '🏠'], ['goods', '📦 Goods'], ['crew', '👥 Crew'], ['turf', '🗺️ Turf'], ['clean', '🧼 Clean'], ['jobs', '🎯 Jobs'], ['law', '⚖️ Law'], ['rep', '📊 Reports']];
    const t = UI.curTab('crime', 'home');
    let o = `<h2>🕶️ Crime ${UI.tipBtn('crIntro')}</h2>${UI.tipLine('crIntro', 'A risky side path. Crime money is street cash: it only becomes normal cash by laundering it through your businesses. Police heat, raids, robberies, snitches, jail and seizure can wipe you out. Nothing here is guaranteed.')}`;
    if (CR.jailed(g)) o += `<div class="banner">⛓️ You are in jail: ${c.jail} months left. Your managers run the businesses; your crew works at half speed and gets restless. You can only skip time.</div>`;
    o += UI.tabs('crime', tabs);
    return o + ({ home, goods, crew, turf, clean, jobs, law, rep: report }[t] || home)(g, c, CR);
  };

  // ---------- 🏠 overview ----------
  function home(g, c, CR) {
    let o = `<div class="tiles">${UI.tile('crD', '💵', m(c.dirty), 'Street cash', c.dirty > 0 ? 'g' : '', 'Dirty money. Pays crew and supplies. Raids and robbers take it. Clean it in 🧼 to use it normally. Counts 60% in net worth.')}
      ${UI.tile('crH', '🚨', Math.round(c.heat), 'Heat', c.heat > 60 ? 'r' : c.heat > 30 ? 'y' : 'g', 'How much the police watch you (0-100). Sales, crew, turf and big jobs raise it. It cools a bit each month; lookouts cool it faster.')}
      ${UI.tile('crC', '🧲', N(c.clients), 'Clients', '', `Loyal buyers. Room for ${N(c.last.room || 60 + c.blocks * K().perBlock)} on your ${c.blocks} blocks. Cheap prices bring them faster; high prices send them to rivals.`)}
      ${UI.tile('crR', '⭐', Math.round(c.rep), 'Street rep', c.rep < 30 ? 'r' : c.rep > 60 ? 'g' : '', 'What the street thinks of you. Fair prices and full shelves raise it. It unlocks better goods and suppliers.')}</div>`;
    if (!c.started) {
      o += `<div class="card"><h3>🚪 Start</h3>${UI.irow('crS1', '💵', 'Move cash to the street', null, 'Moves normal cash into street cash so you can buy goods and pay crew. Moving more than $10,000 at once adds heat (banks report it).')}
        <div class="row"><input type="number" id="crW" placeholder="$ amount" value="20000">${UI.btn('Move', 'crDo', 'withdraw', 'pri')}</div>
        <div class="mute">Then: 📦 buy goods, set a price, and sell to clients. You sell yourself at first (about ${N(K().youDeal)} a month).</div></div>`;
      return o;
    }
    // sales vs what you could sell
    const cap = CR.capacity(g); const L = { demand: ['🧲', 'Not enough clients', 'Everyone who wanted to buy got served. More blocks, better rep or lower prices bring more.'], stock: ['📦', 'Ran out of goods', 'Buy more or get a stash house for more room.'], dealers: ['🧍', 'Not enough dealers', 'Hire dealers in 👥 Crew.'], runners: ['🏃', 'Not enough runners', 'Hire runners or buy a van.'] }[c.last.limit || 'demand'];
    o += `<div class="card"><h3>🛒 Sales ${UI.tipBtn('crSl')}</h3>${UI.tipLine('crSl', 'Sales = the smallest of: what clients want, what your dealers and runners can move, and your stock.')}
      <div class="tiles">${UI.tile('crS', '🛒', N(c.last.sold_ || 0), 'Sold', '', 'Units sold last month.')}${UI.tile('crW2', '🧲', N(c.last.wanted || 0), 'Wanted', '', 'Units clients wanted at your prices.')}${UI.tile('crCap', '🧱', N(Math.min(cap.deal, cap.run)), 'Could move', '', 'The most dealers and runners can handle (bigger goods take more effort).')}</div>
      ${UI.irow('crLim', L[0], 'Held back by: ' + L[1], null, L[2])}</div>`;
    o += workCard(g, c, CR);
    o += `<div class="card"><h3>⚠️ Danger this month ${UI.tipBtn('crOdd')}</h3>${UI.tipLine('crOdd', 'Odds that each bad thing happens next month, and why. They can be lowered, never to zero.')}
      ${CR.odds(g).filter((x) => x.p > 0).map((x) => UI.irow('cro' + x.id, x.i, x.t, oddsPill(x.p), x.why)).join('') || '<div class="mute">Nothing yet.</div>'}</div>`;
    o += `<div class="card"><div class="btns">${UI.btn('👥 See crew', 'crDetail', 'crew', 'sm')}${UI.btn('📦 See stash', 'crDetail', 'stash', 'sm')}${UI.btn('📜 Crime log', 'crDetail', 'log', 'sm')}${UI.btn('📊 Reports', 'tab', 'crime:rep', 'sm')}</div></div>`;
    return o;
  }
  // ---------- 📊 reports: what happened this month and what to expect next (v6: kept off the working view) ----------
  function report(g, c) {
    if (!c.started) return '<div class="card mute">Nothing to report yet.</div>';
    let o = `<div class="card"><h3>📅 This month</h3>${c.flow.length ? rows(c.flow, 'crf') : '<div class="mute">Press ▶ Next Month.</div>'}</div>`;
    if (c.next.length) o += `<div class="card"><h3>🔮 Next month</h3>${rows(c.next, 'crn')}</div>`;
    return o;
  }
  function workCard(g, c, CR) {
    const cap = CR.capacity(g); const need = c.last.workNeed || 0;
    const r = (k, i, t, n, load, capV, u, tip) => { const ut = capV > 0 ? load / capV : 0; const tn = TG.WK.tone(ut); return `<div class="link" data-act="tip" data-arg="${k}" data-nosave="1"><span class="ico">${i}</span><span class="grow">${esc(t)} <span class="mute">x${n}</span> <span class="mute">${N(load)}/${N(capV)} ${u}</span></span>${UI.pill(Math.round(ut * 100) + '%', tn === 'r' ? 'bad' : tn === 'y' ? 'warn' : 'good')}</div>${UI.tipLine(k, tip)}`; };
    const D = K().crew;
    return `<div class="card"><h3>💪 Work ${UI.tipBtn('crWk')}</h3>${UI.tipLine('crWk', 'Each crew member handles a set amount (more with skill). Over 100% = lost sales; busy vans wear out faster.')}
      ${r('crw1', '🧍', 'Dealers' + (c.selfDeal && !TG.CR.jailed(g) ? ' + you' : ''), CR.count(g, 'dealer'), need, cap.deal, 'deals', `${D.dealer.desc} You add ${N(K().youDeal)} while free.`)}
      ${r('crw2', '🏃', 'Runners & vans', CR.count(g, 'runner') + cap.vans, need, cap.run, 'moved', `${D.runner.desc} Each van adds ${N(K().gear.van.cap)}.`)}
      ${r('crw3', '👀', 'Lookouts', CR.count(g, 'lookout'), c.blocks, cap.watch, 'blocks', D.lookout.desc)}
      ${r('crw4', '💪', 'Enforcers', CR.count(g, 'enforcer'), c.blocks, cap.guard, 'blocks', D.enforcer.desc)}
      ${CR.count(g, 'cook') ? r('crw5', '🧪', 'Cooks in workshops', CR.count(g, 'cook'), CR.count(g, 'cook'), cap.shops, 'cooks', 'Each workshop fits 2 cooks.') : ''}</div>`;
  }

  // ---------- 📦 goods: buy, price, sell back ----------
  function goods(g, c, CR) {
    const s = S(); const Sp = K().suppliers;
    let o = `<div class="card"><h3>📦 Stash ${N(CR.units(g))}/${N(CR.room(g))} ${UI.tipBtn('crSt')}</h3>${UI.tipLine('crSt', 'How many units you can hold. Stash houses add room (🗺️ Turf). Raids and robbers take stash.')}${UI.bar(CR.units(g), CR.room(g), true)}</div>`;
    o += `<div class="card"><h3>🤝 Supplier</h3><div class="btns">${Object.entries(Sp).map(([k, v]) => UI.btn(`${v.icon} ${v.label}`, 'crSup', k, 'sm' + (s.sup === k ? ' pri' : ''), !CR.unlocked(g, v.unlock))).join('')}</div>`;
    const sp = Sp[s.sup]; const od = CR.supOdds(g, s.sup);
    o += UI.irow('crSp', sp.icon, sp.label, `x${sp.mult.toFixed(2)} price`, `${sp.desc} Full order ${U.pct(od.ok)} · short ${U.pct(od.short)} · no-show ${U.pct(od.none)} (lose ${U.pct(K().noShowLoss)} of the money)${od.sting ? ` · police sting ${U.pct(od.sting)}` : ''}. Max order ${N(sp.maxOrder)}${sp.minOrder ? `, min ${m(sp.minOrder)}` : ''}. Unlock: ${sp.unlock.turf} blocks, ${sp.unlock.rep} rep.`)
      + `<div class="small">✅ ${U.pct(od.ok)} full · ⚠️ ${U.pct(od.short)} short · ❌ ${U.pct(od.none)} no-show${od.sting ? ` · 🚔 ${U.pct(od.sting)} sting` : ''}</div></div>`;
    for (const [p, P] of Object.entries(K().products)) {
      const un = CR.unlocked(g, P.unlock); const st = CR.street(g, p), pr = CR.price(g, p), r = pr / st; const wb = CR.wholesale(g, p) * sp.mult;
      const k = 'crp' + p;
      o += `<div class="card">${UI.irow(k, P.icon, P.label, un ? `${N(c.stock[p])} in stash` : '🔒', `${P.desc} Each client wants about ${P.want}/month. Heat per sale ${P.heat}. ${un ? '' : `Unlocks at ${P.unlock.turf} blocks and ${P.unlock.rep} street rep.`}`)}`;
      if (!un) { o += '</div>'; continue; }
      o += `<div class="small">🏷️ Street ${m(st)} · you buy at ${m(wb)} · margin ${m(pr - wb)} a unit</div>
        <div class="row" style="gap:6px;flex-wrap:wrap">🏷️ Your price <b>${m(pr)}</b> ${UI.pill(c.ask[p] == null ? 'street price' : (r < 0.97 ? 'cheap ' : r > 1.03 ? 'dear ' : 'fair ') + Math.round(r * 100) + '%', r > 1.1 ? 'warn' : r < 0.9 ? 'info' : 'good')}
        ${UI.btn('➖', 'crAsk', p + '|-', 'xs')}${UI.btn('➕', 'crAsk', p + '|+', 'xs')}${UI.btn('Street', 'crAsk', p + '|m', 'xs')}${UI.tipBtn(k + 'pr')}</div>${UI.tipLine(k + 'pr', 'Cheap: more buyers, clients grow faster, street rep rises, less heat per sale, but a thin margin. Dear: bigger margin, but clients leave for rivals, fewer fit on your turf and rep falls. Neither always wins.')}
        <div class="row"><input type="number" id="crQ${p}" placeholder="units" value="${Math.max(10, Math.round(c.clients * P.want))}" style="max-width:110px">${UI.btn('🛒 Buy', 'crBuy', p, 'sm goodb', !sp.goods.includes(p))}${UI.btn('Sell back', 'crDump', p, 'sm')}</div>
        <div class="small mute">${sp.goods.includes(p) ? `Cost ${m(wb)} each from ${sp.label}` : `${sp.label} does not sell this`} · sell back pays ${m(CR.wholesale(g, p) * K().sellBackShare)}</div></div>`;
    }
    return o;
  }

  // ---------- 👥 crew ----------
  function crew(g, c, CR) {
    const D = K().crew; let o = `<div class="card"><h3>👥 Your crew (${c.crew.length}) · wages ${m(U.sum(c.crew, (e) => e.wage))}/mo</h3>`;
    o += c.crew.length ? c.crew.map((e) => crewRow(g, e, CR)).join('') : '<div class="mute">Nobody yet. You do everything yourself.</div>';
    o += `<div class="row" style="margin-top:6px">${UI.btn(c.selfDeal ? '🙋 You sell on the street ✓' : '🙋 You stay off the street', 'crSelf', null, 'sm')}${UI.tipBtn('crSelf')}</div>${UI.tipLine('crSelf', `Selling yourself adds ${K().youDeal} deals and ${K().youRun} runs a month, but if police raid you are 30% more likely to be arrested.`)}</div>`;
    o += `<div class="card"><h3>🧑‍🤝‍🧑 Who wants in ${UI.tipBtn('crHire')}</h3>${UI.tipLine('crHire', `New faces each month. Hiring costs ${U.pct(K().hireCost)} of a month's wage up front. Skill = how much they get done. Loyalty = how likely they stay quiet and stay.`)}`;
    for (const k of CR.candidates(g)) {
      const d = D[k.role]; const cap = CR.capOf(k); const u = k.role === 'enforcer' || k.role === 'lookout' ? 'blocks' : k.role === 'cook' ? 'workshop slot' : k.role === 'dealer' ? 'deals/mo' : 'runs/mo';
      o += `<div class="irow"><span class="ic">${d.icon}</span><span class="lb" data-act="tip" data-arg="crk${k.id}" data-nosave="1">${esc(k.name)}<small>${d.label} · adds ${k.role === 'cook' ? N(K().cookMakes.sugar * (0.6 + 0.8 * k.skill / 100)) + ' Sugar/mo' : (cap < 10 ? cap.toFixed(1) : N(cap)) + ' ' + u}</small></span>
        <span class="small">🎯 ${k.skill} · 🤝 ${k.loyalty} · ${m(k.wage)}/mo</span>${UI.btn(`Hire ${m(k.wage * K().hireCost)}`, 'crHire', k.id, 'xs goodb')}${UI.tipLine('crk' + k.id, `${d.desc} Skill ${k.skill}: does ${Math.round((0.6 + 0.8 * k.skill / 100) * 100)}% of a normal ${d.label.toLowerCase()} (skill 50 = 100%). Loyalty ${k.loyalty}: under 60 they may snitch, more when heat is high.`)}</div>`;
    }
    return o + '</div>';
  }
  const crewRow = (g, e, CR) => {
    const d = K().crew[e.role]; const k = 'cre' + e.id;
    return `<div class="irow"><span class="ic">${d.icon}</span><span class="lb" data-act="tip" data-arg="${k}" data-nosave="1">${esc(e.name)}<small>${d.label}${e.inj ? ' · 🤕 hurt' : ''}</small></span><span class="small">🎯 ${Math.round(e.skill)} · 🤝 ${Math.round(e.loyalty)}</span>
      ${UI.btn('🎓', 'crCrew', e.id + '|train', 'xs')}${UI.btn('🎁', 'crCrew', e.id + '|bonus', 'xs')}${UI.btn('✖', 'crCrew', e.id + '|fire', 'xs badb')}
      ${UI.tipLine(k, `${d.desc} Handles ${N(CR.capOf(e))} now; +10 skill → ${N(K().crew[e.role].cap * (0.6 + 0.8 * Math.min(99, e.skill + 10) / 100))}. 🎓 Train ${m(K().trainCost)}: +${K().trainSkill[0]}-${K().trainSkill[1]} skill (${TG.USES.left(e, 'train', g.month, K().trainPerMonth)} left this month). 🎁 Bonus ${m(e.wage * 0.5)}: +10 loyalty (${TG.USES.left(e, 'bonus', g.month, K().bonusPerMonth)} left). More than that backfires: loyalty drops.`)}</div>`;
  };

  // ---------- 🗺️ turf & gear ----------
  function turf(g, c, CR) {
    const p = CR.turfOdds(g);
    let o = `<div class="card"><h3>🗺️ Turf: ${c.blocks} blocks</h3>${UI.irow('crTf', '🏘️', 'Take a new block', m(CR.turfCost(g)), `Each block holds about ${K().perBlock} more clients and brings new ones each month. Win odds ${U.pct(p)} (more enforcers and rep help). Losing hurts crew and adds heat. One try a month. Each block adds a little heat every month.`, UI.btn(`Try (${U.pct(p)})`, 'crDo', 'expand', 'sm'))}
      ${UI.irow('crRk', '🛡️', 'Protection racket', c.racket ? 'ON' : 'off', `Shops on your blocks pay you ${m(K().racket.perBlock)} each a month (half if you have fewer enforcers than half your blocks). Adds ${K().racket.heat} heat per block a month and shop owners may call police.`, UI.btn(c.racket ? 'Stop' : 'Start', 'crDo', 'racket', 'sm'))}</div>`;
    o += `<div class="card"><h3>🧰 Gear</h3>`;
    for (const [k, G] of Object.entries(K().gear)) {
      const n = c.gear.filter((x) => x.type === k).length;
      o += UI.irow('crg' + k, G.icon, G.label + (n ? ` ×${n}` : ''), m(G.price * g.world.priceIdx), `${G.desc} Upkeep ${m(G.upkeep)}/mo. Lasts about ${Math.round(G.life / 12) || 1} years.`, UI.btn('Buy', 'crGear', k, 'xs goodb'));
    }
    const own = c.gear;
    if (own.length) o += `<h4>Owned</h4>` + own.map((it) => `<div class="irow"><span class="ic">${K().gear[it.type].icon}</span><span class="lb">${K().gear[it.type].label}<small>wear ${Math.round(it.wear)}%${it.broken ? ' · broken' : ''}</small></span>${UI.btn('Sell ' + m(CR.gearValue(g, it)), 'crSell', it.id, 'xs')}</div>`).join('');
    return o + '</div>';
  }

  // ---------- 🧼 laundering ----------
  function clean(g, c, CR) {
    const L = CR.launderCap(g); const plan = Math.min(c.launder, c.dirty); const a = CR.auditOdds(g, Math.min(plan, L.total));
    let o = `<div class="card"><h3>🧼 Clean street cash ${UI.tipBtn('crCl')}</h3>${UI.tipLine('crCl', `Your businesses can hide some street cash in their sales each month. You lose a ${U.pct(K().launderFee)} fee and it is taxed as business income. The closer you get to the limit, the higher the audit odds. Businesses used for this can be seized if you are convicted.`)}
      <div class="tiles">${UI.tile('crL1', '🧼', m(L.total), 'Can clean/mo', '', 'Each business can hide a share of its sales: cash-heavy ones (car wash, food truck, cafe) more.')}${UI.tile('crL2', '🧾', U.pct(a, 1), 'Audit odds', a > 0.05 ? 'r' : a > 0.02 ? 'y' : 'g', `Fine ${U.pct(K().audit.fine)} of a year of laundering, heat +15, and ${U.pct(K().audit.seize)} odds a business is seized.`)}</div>
      ${L.rows.map((r) => UI.irow('crLb' + r.b.id, TG.CONFIG.businesses[r.b.type].icon, r.b.name, m(r.cap) + '/mo', `${U.pct(K().cashShare[r.b.type] || 0.1)} of its sales. If you are convicted: ${U.pct(CR.seizeOdds(g, r.b))} odds it is seized.`)).join('')}
      ${L.total ? '' : UI.irow('crLs', '🕴️', 'Shady money man', m(L.shady) + '/mo', `With no business he cleans up to ${m(L.shady)} a month for a ${U.pct(K().shadyFee)} fee.`)}
      <div class="row"><span>Clean each month</span><input type="number" id="crLa" value="${c.launder}" style="max-width:120px">${UI.btn('Save', 'crDo', 'launder', 'sm pri')}</div></div>`;
    o += `<div class="card"><h3>💵 Move cash to the street</h3><div class="row"><input type="number" id="crW" placeholder="$ amount">${UI.btn('Move', 'crDo', 'withdraw', 'sm')}${UI.tipBtn('crWd')}</div>${UI.tipLine('crWd', 'Normal cash → street cash. Over $10,000 adds heat. Moving it back costs the laundering fee, so there is no free loop.')}</div>`;
    return o;
  }

  // ---------- 🎯 one-off jobs ----------
  function jobs(g, c, CR) {
    const s = S(); const H = K().heists; const h = H[s.ht]; const p = CR.heistOdds(g, s.ht, s.hm, s.hg, s.hp); const cost = CR.heistCost(g, s.ht, s.hg, s.hp);
    const cd = Math.max(0, (c.cd.heist || 0) - g.month);
    let o = `<div class="card"><h3>🏦 Bank job ${UI.tipBtn('crBk')}</h3>${UI.tipLine('crBk', `Plan, pick gear and pros, then go. Success pays big street cash; failure often means arrest (${U.pct(K().heistArrest)}). Every job adds heat. Then you must lie low ${K().heistCooldown} months.`)}
      <div class="btns">${Object.entries(H).map(([k, v]) => UI.btn(`${v.icon} ${v.label}`, 'crH', 't|' + k, 'sm' + (s.ht === k ? ' pri' : ''))).join('')}</div>
      ${UI.irow('crHp', h.icon, h.label, `${m(h.pay[0])}-${m(h.pay[1])}`, `Needs ${h.crew} people (you count). Best possible odds ${U.pct(h.max)}. Heat +${h.heat}.`)}
      <div class="row" style="flex-wrap:wrap;gap:4px">🗓️ Plan ${[0, 1, 2, 3].map((x) => UI.btn(x + 'mo', 'crH', 'm|' + x, 'xs' + (s.hm === x ? ' pri' : ''))).join('')}${UI.tipBtn('crHm')}</div>${UI.tipLine('crHm', `Each month of planning adds ${U.pct(K().heistPlan.perMonth)} odds, but ${U.pct(K().heistPlan.leak)} a month that word leaks and it is off.`)}
      <div class="row" style="flex-wrap:wrap;gap:4px">🧰 Gear ${K().heistGear.map((x, i) => UI.btn(`${i ? m(x[0]) : 'none'}`, 'crH', 'g|' + i, 'xs' + (s.hg === i ? ' pri' : ''))).join('')}</div>
      <div class="row" style="flex-wrap:wrap;gap:4px">🧑‍💻 Pros ${['none', 'good', 'elite'].map((x, i) => UI.btn(x, 'crH', 'p|' + i, 'xs' + (s.hp === i ? ' pri' : ''))).join('')}${UI.tipBtn('crHpro')}</div>${UI.tipLine('crHpro', 'Hired specialists: good +7% odds for 5% of the expected take up front; elite +14% for 12%.')}
      <div class="tiles">${UI.tile('crHo', '🎯', U.pct(p), 'Odds', p > 0.5 ? 'g' : p > 0.3 ? 'y' : 'r', `Base ${U.pct(h.odds)} + planning + gear + pros + crew skill, cut if your crew is too small or heat is high.`)}${UI.tile('crHc', '💸', m(cost), 'Costs now', '', 'Gear and pros, paid from street cash even if it fails.')}</div>
      ${c.plan ? `<div class="banner">🗓️ Planning ${H[c.plan.t].label}: ${c.plan.left} months left</div>` : UI.btn(cd ? `Lie low ${cd} mo` : (s.hm ? '🗓️ Start planning' : '🚀 Go now'), 'crDo', 'heist', 'pri', !!cd)}</div>`;
    // sabotage
    o += `<div class="card"><h3>⚔️ Hit a rival business ${UI.tipBtn('crSb')}</h3>${UI.tipLine('crSb', 'Hurt a competitor of one of your businesses so more customers come to you for a while. They may sue, hit back or you may be arrested.')}`;
    if (!g.businesses.length) o += '<div class="mute">You need a business first.</div>';
    for (const b of g.businesses) for (const [k, v] of Object.entries(K().sabotage)) {
      const wait = Math.max(0, (c.cd['sab' + b.id] || 0) - g.month);
      o += UI.irow('crsb' + b.id + k, v.icon, `${v.label}: ${b.name}`, m(v.cost), `Works ${U.pct(v.ok)}: your demand x${v.boost} for ${v.months} months. Caught ${U.pct(v.caught)}: lawsuit ${m(v.suit[0])}-${m(v.suit[1])}, rep -10, heat +${v.heat}${v.arrest ? `, ${U.pct(v.arrest)} arrest` : ''}. They hit back ${U.pct(v.revenge)}.`, UI.btn(wait ? `${wait} mo` : 'Do it', 'crSab', b.id + '|' + k, 'xs', !!wait));
    }
    o += '</div>';
    const I = K().insider, T = K().theft;
    o += `<div class="card"><h3>🎲 Other jobs</h3>
      ${UI.irow('crIn', '📈', 'Insider trade', `${U.pct(I.odds)} right`, `Bet normal cash on a tip. Right: +${U.pct(I.up[0])}-${U.pct(I.up[1])}. Wrong: -${U.pct(I.down[0])}-${U.pct(I.down[1])}. Investigation odds ${U.pct(I.probe)} + more for bigger trades: fine ${I.fine}x the gain, heat +${I.heat}, ${U.pct(I.arrest)} arrest. Once every ${I.cooldown} months.`)}
      <div class="row"><input type="number" id="crIa" placeholder="$ stake" style="max-width:120px">${UI.btn('Trade', 'crDo', 'insider', 'sm')}</div>
      ${UI.irow('crTh', '🚗', 'Car theft run', `${U.pct(T.ok)} works`, `Pays ${m(T.pay[0])}-${m(T.pay[1])} per person (up to ${T.maxCrew}). ${U.pct(T.arrest)} odds someone is caught. Heat +${T.heat}. Once a month.`, UI.btn('Go', 'crDo', 'theft', 'xs'))}</div>`;
    return o;
  }

  // ---------- ⚖️ law ----------
  function law(g, c, CR) {
    let o = `<div class="card"><h3>⚖️ If you are caught ${UI.tipBtn('crLw')}</h3>${UI.tipLine('crLw', 'Arrests come from raids, failed jobs and snitches. Lawyers lower conviction odds and jail time; bribes lower raid odds. Nothing makes you safe.')}
      <div class="tiles">${UI.tile('crCv', '⚖️', U.pct(CR.convictOdds(g)), 'Conviction odds', '', `Never below ${U.pct(K().convictMin)}. A record raises it.`)}${UI.tile('crJm', '⛓️', CR.jailMonths(g) + ' mo', 'Jail if convicted', '', 'Grows with heat and your record; good lawyers shorten it. Businesses keep running with managers.')}${UI.tile('crRc', '📁', c.record, 'Record', '', 'Past convictions.')}</div></div>`;
    o += `<div class="card"><h3>👔 Lawyer (normal cash)</h3>${Object.entries(K().lawyers).map(([k, v]) => UI.irow('crly' + k, '👔', v.label, v.cost ? m(v.cost) + '/mo' : 'free', `Conviction odds -${U.pct(v.cut)}, jail time x${v.jail}.`, UI.btn(c.lawyer === k ? '✓' : 'Pick', 'crLaw', 'l|' + k, 'xs' + (c.lawyer === k ? ' pri' : '')))).join('')}</div>`;
    o += `<div class="card"><h3>💸 Bribes (street cash)</h3>${Object.entries(K().bribes).map(([k, v]) => UI.irow('crbr' + k, '💸', v.label, v.cost ? m(v.cost) + '/mo' : 'none', `Raid odds -${U.pct(K().raid.bribe * v.lvl)}${v.judge ? `, conviction odds -${U.pct(v.judge)}` : ''}. Scandal odds ${U.pct(v.lvl ? K().bribeScandal * (1 + v.lvl * 2) : 0, 1)} a month.`, UI.btn(c.bribe === k ? '✓' : 'Pick', 'crLaw', 'b|' + k, 'xs' + (c.bribe === k ? ' pri' : '')))).join('')}</div>`;
    if (g.businesses.length) o += `<div class="card"><h3>🏢 Could be seized</h3>${g.businesses.map((b) => UI.irow('crsz' + b.id, '🏢', b.name, U.pct(CR.seizeOdds(g, b)), 'Odds the state takes it if you are convicted. Grows with how much dirty money went through it (fades over a year).')).join('')}</div>`;
    return o;
  }

  // ---------- details ----------
  UI.A.crDetail = (k) => {
    const g = TG.G, c = TG.CR.ensure(g), CR = TG.CR;
    if (k === 'crew') return UI.modal('👥 Crew', `<div class="card">${c.crew.length ? `<table class="tbl"><tr><th></th><th>Name</th><th>Skill</th><th>Loyal</th><th>Does</th><th>Wage</th></tr>${c.crew.map((e) => `<tr><td>${K().crew[e.role].icon}</td><td>${esc(e.name)}</td><td>${Math.round(e.skill)}</td><td>${Math.round(e.loyalty)}</td><td>${N(CR.capOf(e))}</td><td>${m(e.wage)}</td></tr>`).join('')}</table>` : 'Nobody yet.'}</div>`);
    if (k === 'stash') return UI.modal('📦 Stash', `<div class="card">${Object.entries(K().products).map(([p, P]) => UI.irow('crsd' + p, P.icon, P.label, N(c.stock[p]), `Worth about ${m(c.stock[p] * CR.wholesale(g, p))} at wholesale.`)).join('')}${UI.irow('crsdr', '📦', 'Room', `${N(CR.units(g))}/${N(CR.room(g))}`, '')}</div>`);
    if (k === 'log') return UI.modal('📜 Crime log', `<div class="card">${g.log.filter((e) => String(e.text).startsWith('🕶️')).slice(-40).reverse().map((e) => `<div class="small"><b>${U.dateStr(e.m)}</b> ${UI.ev(e)}</div>`).join('') || 'Nothing yet.'}</div>`);
  };

  // ---------- actions ----------
  const res = (r, ok) => { if (r && r.ok === false) UI.toast(r.msg || 'Not possible.', true); else if (ok) UI.toast(typeof ok === 'function' ? ok(r) : ok, r && r.bad); UI.refresh(); };
  UI.A.crSup = (k) => { S().sup = k; UI.refresh(); };
  UI.A.crAsk = (arg) => { const g = TG.G; const [p, d] = arg.split('|'); if (d === 'm') TG.CR.setAsk(g, p, null); else TG.CR.setAsk(g, p, TG.CR.price(g, p) * (d === '+' ? 1.05 : 0.95)); UI.refresh(); };
  UI.A.crBuy = (p) => { const r = TG.CR.buy(TG.G, S().sup, p, UI.num('crQ' + p, 0)); res(r, (x) => (x.out === 'ok' ? `Got ${N(x.got)} for ${m(x.cost)}` : x.out === 'short' ? `Short order: got ${N(x.got)} for ${m(x.cost)}` : x.out === 'sting' ? 'It was a police sting!' : 'They never showed.')); };
  UI.A.crDump = (p) => res(TG.CR.dump(TG.G, p, UI.num('crQ' + p, 0)), (x) => `Sold back for ${m(x.v)}`);
  UI.A.crHire = (id) => res(TG.CR.hire(TG.G, id), 'Hired.');
  UI.A.crCrew = (arg) => { const [id, a] = arg.split('|'); const g = TG.G; if (a === 'fire') { TG.CR.fire(g, id); return res({}, 'Let go.'); } const r = a === 'train' ? TG.CR.train(g, id) : TG.CR.bonus(g, id); res(r, (x) => (x.spam ? 'Too much this month: it backfired (loyalty down).' : a === 'train' ? `Skill +${x.gain}` : 'Loyalty +10')); };
  UI.A.crSelf = () => { const c = TG.CR.ensure(TG.G); c.selfDeal = !c.selfDeal; UI.refresh(); };
  UI.A.crGear = (k) => res(TG.CR.buyGear(TG.G, k), 'Bought.');
  UI.A.crSell = (id) => res(TG.CR.sellGear(TG.G, id), (x) => `Sold for ${m(x.v)}`);
  UI.A.crH = (arg) => { const [k, v] = arg.split('|'); const s = S(); if (k === 't') s.ht = v; else s['h' + k] = Number(v); UI.refresh(); };
  UI.A.crSab = (arg) => { const [id, k] = arg.split('|'); res(TG.CR.sabotage(TG.G, id, k), (x) => (x.worked ? 'It worked.' : 'It did not work.')); };
  UI.A.crLaw = (arg) => { const [k, v] = arg.split('|'); const c = TG.CR.ensure(TG.G); if (k === 'l') c.lawyer = v; else c.bribe = v; UI.refresh(); };
  UI.A.crDo = (a) => {
    const g = TG.G, CR = TG.CR, c = CR.ensure(g), s = S();
    if (a === 'withdraw') return res(CR.withdraw(g, UI.num('crW', 0)), (x) => `Moved.${x.heat ? ` Heat +${x.heat.toFixed(1)}` : ''}`);
    if (a === 'expand') return res(CR.expand(g), (x) => (x.won ? 'You took a new block!' : `Lost the fight (${U.pct(x.p)} odds).`));
    if (a === 'racket') { c.racket = !c.racket; return res({}, c.racket ? 'Racket started.' : 'Racket stopped.'); }
    if (a === 'launder') { c.launder = Math.max(0, Math.round(UI.num('crLa', 0))); return res({}, 'Saved.'); }
    if (a === 'heist') return res(CR.heist(g, s.ht, s.hm, s.hg, s.hp), (x) => (x.planned ? 'Planning started.' : x.won ? `It worked: ${m(x.v)}!` : x.partial ? `Botched: only ${m(x.v)}.` : 'It failed.'));
    if (a === 'insider') return res(CR.insider(g, UI.num('crIa', 0)), (x) => (x.gain >= 0 ? `Made ${m(x.gain)}` : `Lost ${m(-x.gain)}`));
    if (a === 'theft') return res(CR.theft(g), (x) => (x.v ? `Got ${m(x.v)}` : 'Nothing this time.'));
  };
})();
