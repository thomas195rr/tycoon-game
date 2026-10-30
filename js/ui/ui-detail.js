/* ui-detail.js - work-capacity card, sales card and the "See all" detail screens for stock, staff and equipment. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const biz = () => TG.B.get(TG.G, UI.bizId);
  const N = (x) => Math.round(x || 0).toLocaleString();
  const tone = { g: 'good', y: 'warn', r: 'bad' };

  // ---------- 💪 work: each team / machine group, load vs capacity ----------
  UI.workCard = (g, b) => {
    const W = b.work || [];
    if (!W.length) return `<div class="card"><h3>💪 Work</h3><div class="mute">Press ▶ Next Month to see how busy everyone is.</div></div>`;
    let worst = -1, wu = -1; W.forEach((w, i) => { if (w.cap != null && w.util > wu) { wu = w.util; worst = i; } });
    const rows = W.map((w, i) => {
      const t = TG.WK.tone(w.util); const k = 'wk' + b.id + i; const pct = w.cap ? Math.round(w.util * 100) : null;
      const each = w.n > 0 && w.cap ? ` About ${N(w.cap / w.n)} ${w.u} each.` : '';
      const eff = w.kind === 'eq' ? ` Wear speed x${TG.WK.wearMult(w.util).toFixed(1)} (busier = wears faster).` : w.kind === 'staff' ? (w.util > 1 ? ' Over 100%: they get tired, morale drops, mistakes rise.' : w.util < 0.4 ? ' Lots of idle time: you pay wages for little work.' : ' A healthy workload.') : '';
      return `<div class="link ${i === worst && w.util > 0.9 ? 'weak' : ''}" data-act="tip" data-arg="${k}" data-nosave="1"><span class="ico">${w.i}</span><span class="grow">${esc(w.t)}${w.kind !== 'space' ? ` <span class="mute">x${w.n}</span>` : ''}${w.cap ? `<div class="bar ${t === 'r' ? 'bad' : t === 'y' ? 'warn' : ''}"><i style="width:${Math.round(Math.min(1, w.util) * 100)}%"></i></div>` : ''}</span><span style="text-align:right"><b>${N(w.load)}/${w.cap == null ? '–' : N(w.cap)}</b><br>${pct != null ? UI.pill(pct + '%', tone[t]) : UI.pill('none!', 'bad')}</span></div>${UI.tipLine(k, `${w.tip}${each}${eff} (${w.u})`)}`;
    }).join('');
    return `<div class="card"><h3>💪 Work this month ${UI.tipBtn('wk' + b.id)}</h3>${UI.tipLine('wk' + b.id, 'Each team and machine group can do a set amount of work. Busy = number on the left, most they can do = right. The red one is what holds you back.')}${rows}
      <div class="btns">${UI.btn('👥 See staff', 'detail', 'staff', 'sm')}${UI.btn('🛠️ See machines', 'detail', 'equip', 'sm')}</div></div>`;
  };

  // ---------- 🛒 sales vs sales capacity ----------
  UI.salesCard = (g, b) => {
    const lc = b.lastCtx || {}; if (lc.cap == null || b.proj || b.fr) return '';
    const d = TG.B.def(b); const gd = TG.PR.good(b) || {}; const unit = gd.unit || 'sale';
    if (b.farm || b.tech || b.factory) return ''; // these show their own sales rows (harvest, users, production)
    const r = lc.priceR || 1; const pf = TG.PR.demandF(r);
    const sold = lc.served || 0, cap = lc.cap || 0, dem = lc.demand || 0;
    const lim = sold >= dem - 0.5 ? 'demand' : (lc.limit || 'staff');
    const L = { demand: ['🧲', 'Not enough customers', 'You could have served more than wanted to buy. Better reputation, ads, a busier location or a lower price bring more customers.'],
      staff: ['👥', 'Not enough staff', 'Your workers were full. Hire or train more.'], equipment: ['🛠️', 'Not enough equipment', 'A machine group was full. Buy more of the red one in Gear.'],
      space: ['📐', 'Not enough space', 'Your building is full. A bigger place is needed.'], support: ['🧹', 'Not enough helpers', 'Support staff were full.'], stock: ['📦', 'Ran out of stock', 'Supplies ran out. Order more, add storage or turn on auto-order.'] }[lim] || ['❓', lim, ''];
    const k = 'sl' + b.id;
    return `<div class="card"><h3>🛒 Sales ${UI.tipBtn(k)}</h3>${UI.tipLine(k, 'Sales = the smallest of: customers who want to buy, and how much you can serve (staff, machines, space, stock).')}
      <div class="tiles">${UI.tile(k + 's', '🛒', N(sold), 'Sold', sold >= cap * 0.95 ? 'y' : 'g', `You sold ${N(sold)} ${unit}s last month.`)}${UI.tile(k + 'c', '🧱', N(cap), 'Could sell', '', 'The most your staff, machines and space could handle.')}${UI.tile(k + 'd', '🧲', N(dem), 'Wanted', dem > cap ? 'y' : 'g', 'Customers who wanted to buy at your price. Reputation, ads, the economy and price change it.')}${UI.tile(k + 'p', '🏷️', Math.round(pf * 100) + '%', 'Price effect', r > 1.05 ? 'r' : r < 0.95 ? 'y' : 'g', `Your price is ${Math.round(r * 100)}% of market, so you get about ${Math.round(pf * 100)}% of the normal number of customers.`)}</div>
      ${UI.irow(k + 'l', L[0], 'Held back by: ' + L[1], null, L[2])}</div>`;
  };

  // ---------- detail screens ----------
  UI.A.detail = (what) => {
    const g = TG.G, b = biz(); if (!b) return;
    const f = { stock: stockDetail, staff: staffDetail, equip: equipDetail }[what];
    UI.modal({ stock: '📦 Everything in stock', staff: '👥 Your team', equip: '🛠️ Your machines' }[what], f(g, b) + `<div class="btns">${UI.btn('Close', 'closeModal', null, 'pri')}</div>`);
  };
  const grp = (b, kind, test) => (b.work || []).find((w) => w.kind === kind && test(w));
  function staffDetail(g, b) {
    const d = TG.B.def(b); const all = TG.S.allStaff(b);
    if (!all.length) return '<div class="card mute">No staff yet.</div>';
    const byRole = {}; for (const e of all) (byRole[e.role] = byRole[e.role] || []).push(e);
    let o = '';
    for (const [r, list] of Object.entries(byRole)) {
      const rd = d.roles[r] || TG.CONFIG.specialists[r] || {}; const w = grp(b, 'staff', (x) => x.t.toLowerCase().startsWith(String(rd.label || r).toLowerCase().slice(0, 5)));
      o += `<div class="card"><h3>${esc(rd.label || r)} x${list.length}</h3>${w ? `<div class="mute">Team load ${N(w.load)} / ${N(w.cap)} ${w.u} (${Math.round(w.util * 100)}%) · about ${N(w.load / Math.max(1, w.n))} each</div>` : ''}
        <table><tr><th>Name</th><th class="n">🎓 Skill</th><th class="n">😊 Mood</th><th class="n">⏰ Shows up</th>${rd.cap ? '<th class="n">💪 Can do</th>' : ''}</tr>${list.map((e) => `<tr><td>${esc(e.name)}</td><td class="n">${Math.round(e.skill)}</td><td class="n ${e.morale < 40 ? 'bad' : e.morale > 70 ? 'good' : ''}">${Math.round(e.morale)}</td><td class="n">${Math.round(e.reliability)}%</td>${rd.cap ? `<td class="n">${N(rd.cap * TG.M.staffEff(e))}</td>` : ''}</tr>`).join('')}</table></div>`;
    }
    return o + '<div class="mute">Training (Staff tab) raises skill, and skill raises how much each person can do.</div>';
  }
  function equipDetail(g, b) {
    if (!b.equip.length) return '<div class="card mute">No machines yet.</div>';
    const C = TG.CONFIG; const by = {};
    for (const it of b.equip) { const ed = TG.E.def(b, it.type); if (!ed) continue; const p = TG.E.poolOf(ed); (by[p] = by[p] || []).push(it); }
    let o = '';
    for (const [p, list] of Object.entries(by)) {
      const w = (b.work || []).find((x) => x.kind !== 'staff' && x.pools.indexOf(p) >= 0); const work = list.filter((x) => !x.broken).length;
      const ed = TG.E.def(b, list[0].type); const cat = C.equipCats[ed.cat] || ['⚙️', ed.label];
      o += `<div class="card"><h3>${cat[0]} ${esc(cat[1])} · ${esc(ed.label)}${list.length > 1 ? 's' : ''}</h3>${w ? `<div class="mute">Group load ${N(w.load)} / ${N(w.cap)} ${w.u} (${Math.round(w.util * 100)}%) · each working one does about ${N(w.load / Math.max(1, work))} · wear speed x${TG.WK.wearMult(w.util).toFixed(1)}</div>` : `<div class="mute">${esc(ed.desc || 'Helps the business; not a capacity group.')}</div>`}
        <table><tr><th>#</th><th>Kind</th><th class="n">⏳ Age</th><th class="n">🔩 Wear</th><th class="n">🎲 Break</th></tr>${list.map((it) => `<tr><td>${TG.E.num(b, it)}</td><td>${esc(C.equipTiers[it.tier].label)}${it.leased ? ' 📄' : ''}</td><td class="n">${(it.age / 12).toFixed(1)}y</td><td class="n ${TG.E.effWear(it) > 70 ? 'bad' : ''}">${it.hidden > 0 && !it.inspected ? Math.round(it.wear) + '%+?' : Math.round(TG.E.effWear(it)) + '%'}</td><td class="n">${it.broken ? '<span class="bad">broken</span>' : U.pct(it.lastP || 0, 1)}</td></tr>`).join('')}</table></div>`;
    }
    return o;
  }
  function lotsTable(b) {
    const st = TG.ST.ensure(b); const sh = TG.ST.shelf(b); if (!st) return '';
    const lots = st.lots.slice().sort((x, y) => x.a - y.a);
    return `<table><tr><th>Age</th><th class="n">How many</th><th>State</th></tr>${lots.map((l) => `<tr><td>${l.a === 0 ? 'new this month' : l.a + ' mo'}</td><td class="n">${N(l.q)}</td><td>${sh < 999 && l.a >= sh ? '<span class="bad">throw out soon</span>' : sh < 999 && l.a >= sh * 0.75 ? '<span class="warn">old</span>' : '<span class="good">fresh</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="mute">Empty.</td></tr>'}</table>${sh < 999 ? `<div class="mute">Keeps about ${sh} month${sh > 1 ? 's' : ''}; older is thrown out. Oldest is used first.</div>` : ''}`;
  }
  function stockDetail(g, b) {
    let o = '';
    if (b.farm && TG.M.isLivestock(b.farm)) {
      const f = b.farm, e = TG.M.models.farm.e(b); const y = f.young || [];
      const calves = U.sum(y.filter((x) => x.age < 6), (x) => x.n), grow = U.sum(y.filter((x) => x.age >= 6), (x) => x.n);
      const nearOld = f.cows * Math.min(1, 12 / Math.max(12, e.lifespan - 24));
      const rows = [['🍼', 'Calves (0-5 months)', calves, 'Drink milk, eat little. Most likely to get sick.'], ['🐮', 'Growing (6-14 months)', grow, `Eat more each month. Ready at ${e.matureAge} months.`], ['🐂', 'Ready to sell', f.ready, 'Sold at your price if buyers agree.']];
      if (f.ent === 'dairy') { const milk = Math.min(f.cows * 0.85, TG.M.farmParlorCap(b)); rows.push(['🥛', 'Cows milking', milk, 'In milk and fit in a parlor.'], ['😴', 'Dry / can\'t be milked', f.cows - milk, 'Resting before calving (about 15%) or no parlor space.']); }
      else rows.push(['🐄', 'Mother cows', f.cows, 'Each may have a calf in spring.']);
      rows.push(['👵', 'Near retirement (estimate)', nearOld, `Cows retire at about ${Math.round(e.lifespan / 12)} years and are sold for meat.`]);
      o += `<div class="card"><h3>🐄 Herd by stage</h3>${rows.map((r, i) => UI.irow('cw' + i, r[0], r[1], N(r[2]), r[3])).join('')}<div class="mute">Total ${N(f.herd)} of ${N(TG.M.farmHeadCap(b))} space.</div></div>`;
      o += `<div class="card"><h3>📊 Young by age (months)</h3><table><tr>${y.map((x) => `<th class="n">${x.age}</th>`).join('')}</tr><tr>${y.map((x) => `<td class="n">${N(x.n)}</td>`).join('')}</tr></table></div>`;
    } else if (b.farm) {
      const f = b.farm; o += `<div class="card"><h3>🏚️ In storage</h3>${UI.irow('fs1', '🌾', 'Crop', N(f.stored) + ' t', 'Spoils a little each month.')}${UI.irow('fs2', '🌱', 'Seed', N(f.seeds) + ' acres', 'Needed before planting.')}${UI.irow('fs3', '📜', 'Sold ahead', N(U.sum(f.futures, (x) => x.qty - (x.done || 0))) + ' t', 'Must be delivered at harvest.')}</div>`;
    }
    if (b.stock) o += `<div class="card"><h3>${TG.ST.def(b).icon} ${esc(TG.ST.def(b).label)} by age</h3>${lotsTable(b)}</div>`;
    if (b.brand) { const s = b.brand; o += `<div class="card"><h3>👕 Clothes</h3>${UI.irow('bd1', '👕', 'In the warehouse', N(s.stock), 'Slowly going out of style each month.')}${s.incoming.map((x, i) => UI.irow('bdi' + i, '🚚', `Batch arriving in ${x.due - g.month} mo`, N(x.units), x.test ? 'Small test batch.' : 'From the factory.')).join('')}</div>`; }
    if (b.factory) o += `<div class="card"><h3>📦 Finished goods</h3>${UI.irow('fd1', '📦', 'Waiting to be sold', N(b.factory.stock), 'Storage costs money each month.')}</div>`;
    if (b.tech) { const t = b.tech; const fl = (b.flow && b.flow.rows) || []; o += `<div class="card"><h3>📱 Users</h3>${UI.irow('td1', '📱', 'Users now', N(t.users), 'Paying each month.')}${fl.filter((x) => /user|left|join/i.test(x.t)).map((x, i) => UI.irow('tdf' + i, x.i, x.t, UI.fmtN(x.v, x.u), x.why)).join('')}${UI.irow('td2', '🏆', 'Best ever', N(t.peak), '')}</div>`; }
    if (b.fr) o += `<div class="card"><h3>🏪 Shops</h3><table><tr><th>Shop</th><th>Status</th><th class="n">Age</th></tr>${b.fr.locations.map((l, i) => `<tr><td>#${i + 1}</td><td>${{ open: '🟢 open', building: '🟡 opening', closed: '🔴 closed' }[l.status] || l.status}</td><td class="n">${l.age != null ? l.age + ' mo' : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="mute">None yet.</td></tr>'}</table></div>`;
    if (b.proj) o += `<div class="card"><h3>🏗️ Jobs</h3>${b.proj.active.map((p) => UI.irow('pj' + p.id, p.elapsed > p.deadline ? '⏰' : '🧱', p.label, Math.round(p.progress * 100) + '%', `Month ${p.elapsed}/${p.months}, deadline ${p.deadline}, crew ${p.crew}.`)).join('') || '<div class="mute">No jobs.</div>'}</div>`;
    if (b.type === 'gym') o += `<div class="card"><h3>🏋️ Members</h3>${UI.irow('gm1', '🏋️', 'Members', N(b.members), 'About 4-5% leave each month. More leave if your price is high.')}</div>`;
    return o || '<div class="card mute">Nothing stored here.</div>';
  }
})();
// ---------- 🔮 next-month forecast and last month's forecast vs actual ----------
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const ICON = (k) => (/Revenue|sales|Sales|income/.test(k) ? '💰' : /Wage|Payroll/.test(k) ? '👥' : /Rent|Property|Building/.test(k) ? '🏠' : /Supplies|cost|Cost|Feed|Fuel|Seed/.test(k) ? '📦' : /Advert|PR/.test(k) ? '📣' : /Repair|Mainten|lease|Equipment/.test(k) ? '🛠️' : /Insurance/.test(k) ? '🛡️' : /Utilit/.test(k) ? '💡' : '•');
  UI.forecastCard = (g, b) => {
    const f = b.fc; if (!f) return `<div class="card"><h3>🔮 Next month forecast</h3><div class="mute">Play a month first.</div></div>`;
    const L = Object.entries(f.lines).sort((a, c) => c[1] - a[1]);
    const k0 = 'fc' + b.id;
    let o = `<div class="card"><h3>🔮 Next month forecast ${UI.tipBtn(k0)}</h3>${UI.tipLine(k0, 'Wages, rent, taxes, ads and leases are known. Sales and other costs are estimated from recent months and the season (or the same month last year). Luck and events can change it.')}`;
    o += L.map(([k, v], i) => UI.irow(k0 + i, ICON(k), k, UI.signed(Math.round(v)), f.why[k] || '')).join('');
    o += `<div class="irow"><span class="ic">${f.profit >= 0 ? '📈' : '📉'}</span><span class="lb">Expected profit</span><span class="vl">${UI.signed(Math.round(f.profit))}</span></div>`;
    if (f.loans) o += UI.irow(k0 + 'ln', '🏦', 'Loan payments (from your cash)', m(f.loans), 'Loans tied to this business or its building are paid from your cash, outside its profit.');
    o += '</div>';
    const p = b.fcPrev, h = b.hist[b.hist.length - 1];
    if (p && h && p.m === h.m) {
      const keys = [...new Set(Object.keys(p.lines).concat(Object.keys(h.lines || {})))].filter((k) => Math.abs(p.lines[k] || 0) > 1 || Math.abs((h.lines || {})[k] || 0) > 1)
        .sort((a, c) => Math.abs((h.lines[c] || 0) - (p.lines[c] || 0)) - Math.abs((h.lines[a] || 0) - (p.lines[a] || 0)));
      const kc = 'fa' + b.id;
      o += `<div class="card"><h3>📊 Last month: forecast vs actual ${UI.tipBtn(kc)}</h3>${UI.tipLine(kc, 'What we expected before the month, and what really happened. Biggest differences first.')}
        <table><tr><th></th><th class="n">Forecast</th><th class="n">Actual</th><th class="n">Diff</th></tr>${keys.map((k) => { const a = (h.lines || {})[k] || 0, fv = p.lines[k] || 0; return `<tr><td>${ICON(k)} ${esc(k)}</td><td class="n">${m(fv)}</td><td class="n">${m(a)}</td><td class="n">${UI.signed(Math.round(a - fv))}</td></tr>`; }).join('')}
        <tr><td><b>Profit</b></td><td class="n"><b>${m(p.profit)}</b></td><td class="n"><b>${m(h.profit)}</b></td><td class="n">${UI.signed(Math.round(h.profit - p.profit))}</td></tr></table></div>`;
    }
    return o;
  };
})();
