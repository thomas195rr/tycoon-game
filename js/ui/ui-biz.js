/* ui-biz.js - business list and business detail: overview, staff, equipment, upgrades & insurance, marketing, ownership. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const biz = () => TG.B.get(TG.G, UI.bizId);

  UI.screens.biz = () => {
    const g = TG.G;
    let o = `<h2>🏢 Your businesses</h2>`;
    if (!g.businesses.length) o += `<div class="card">No businesses yet. ${UI.btn('🗺️ Find a property', 'go', 'market', 'pri')}</div>`;
    for (const b of g.businesses) o += UI.bizCard(b);
    const free = g.properties.filter((p) => !p.bizId);
    o += `<div class="btns">${UI.btn('➕ Start another business', 'go', 'market', 'pri')}${free.length ? UI.btn(`${free.length} empty propert${free.length > 1 ? 'ies' : 'y'}`, 'go', 'market') : ''}${UI.btn('👔 Managers & CEO', 'goMoreTab', 'mgr')}</div>`;
    return o;
  };

  UI.screens.bizd = () => {
    const g = TG.G, b = biz(); if (!b) { UI.screen = 'biz'; return UI.screens.biz(); }
    const d = TG.B.def(b);
    const tabs = [['overview', '📋 Now'], ['staff', '👥 Staff'], ['equip', '🛠️ Gear'], ['upg', '⬆️ Extras'], ['mkt', '📣 Ads']];
    if (TG.UI.modelPanel[d.model]) tabs.splice(1, 0, ['model', TG.UI.modelPanel[d.model].label]);
    tabs.push(['own', '🔑 Owner']);
    const t = UI.curTab('biz', 'overview');
    const body = { overview, staff, equip, upg, mkt, own, model: () => TG.UI.modelPanel[d.model].render(g, b) }[t] || overview;
    return `<div class="row sp"><h2>${d.icon} ${esc(b.name)}</h2>${UI.btn('◀ All', 'go', 'biz', 'sm')}</div>${UI.tabs('biz', tabs)}${body(g, b)}`;
  };

  // ---------- overview (icon-first) ----------
  const PR = () => TG.PR;
  const toneRep = (v) => (v >= 60 ? 'g' : v >= 35 ? 'y' : 'r');
  function overview(g, b) {
    const d = TG.B.def(b), lc = b.lastCtx || {}; const h = b.hist; const last = h[h.length - 1];
    let o = `<div class="tiles">
      ${UI.tile('t_profit', '💰', last ? (last.profit >= 0 ? '+' : '−') + m(Math.abs(last.profit)) : '–', 'Profit last month', last ? (last.profit >= 0 ? 'g' : 'r') : '', last ? `Money in ${m(last.rev)} − money out ${m(last.cost)}.` : 'Not open a full month yet.')}
      ${UI.tile('t_rep', '⭐', Math.round(b.rep), 'Reputation', toneRep(b.rep), 'What customers think of you (0-100). Good quality and fair prices raise it.')}
      ${UI.tile('t_q', '🎯', lc.quality != null ? lc.quality : '–', 'Quality', lc.quality == null ? '' : toneRep(lc.quality), `Staff skill ${lc.skill != null ? lc.skill : '?'}, morale ${lc.morale != null ? lc.morale : '?'}, equipment condition.`)}
      ${UI.tile('t_cap', '📊', lc.cap ? Math.round((lc.served || 0) / lc.cap * 100) + '%' : '–', 'Busy', lc.cap ? ((lc.served || 0) / lc.cap > 0.95 ? 'y' : 'g') : '', lc.cap ? `Did ${Math.round(lc.served || 0).toLocaleString()} of ${Math.round(lc.cap).toLocaleString()} possible. Customers wanted ${Math.round(lc.demand || 0).toLocaleString()}.` : '')}</div>`;
    if (b.licensePending > 0) o += `<div class="banner">⏳ License: ${b.licensePending} month(s) to go. No sales yet.</div>`;
    if (lc.note) o += `<div class="ev info">💡 ${esc(lc.note)}</div>`;
    o += UI.flowCard(g, b);
    o += UI.stockCard(g, b);
    if (PR().hasPrice(b)) o += UI.priceCard(g, b);
    o += UI.salesCard(g, b);
    o += UI.workCard(g, b);
    // how it runs
    const owner = TG.B.owner(g, b);
    o += `<div class="card"><h3>⚙️ How it runs</h3>
      ${UI.irow('pace', '🏃', 'Work pace', null, 'Rush = more output, more wear and accidents. Careful = safer, less output.', ['careful', 'normal', 'rush'].map((p) => UI.btn({ careful: '🐢', normal: '🚶', rush: '🏃' }[p] + ' ' + p, 'bizPace', p, 'xs' + (b.pace === p ? ' pri' : ''))).join(''))}
      ${UI.irow('own', '👤', 'You work here', null, `You can run one business yourself: adds a skilled worker and covers ordering.${g.player.ownerBiz && !owner ? ' (Now at ' + ((TG.B.get(g, g.player.ownerBiz) || {}).name || '') + '.)' : ''}`, owner ? UI.btn('✅ Yes', 'ownerOp', '', 'xs goodb') : UI.btn('No', 'ownerOp', b.id, 'xs'))}</div>`;
    const risks = TG.B.topRisks(g, b).slice(0, 8);
    o += `<div class="card"><details><summary>⚠️ Risks next month</summary><table>${risks.map((r) => `<tr><td>${esc(r.label)}<div class="mute">${esc(r.why)}</div></td><td class="n">${UI.risk(r.p)}</td></tr>`).join('') || '<tr><td class="mute">Nothing notable.</td></tr>'}</table></details></div>`;
    if (last) o += `<div class="card"><details><summary>🧾 Money in & out</summary><table>${Object.entries(last.lines || {}).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '-'}${m(Math.abs(v))}</td></tr>`).join('')}</table>${h.length > 2 ? UI.spark(h.slice(-36).map((x) => x.profit), '#2563eb') : ''}</details></div>`;
    const ev = g.log.filter((e) => e.bizId === b.id || e.biz === b.name).slice(-12).reverse();
    if (ev.length) o += `<div class="card"><details><summary>📰 What happened</summary>${ev.map((e) => `<div class="small"><span class="mute">${U.dateStr(e.m)}</span> ${e.type === 'decision' ? `<b>${esc(e.by)}</b>: ` : ''}${esc(e.text)}</div>`).join('')}</details></div>`;
    return o;
  }
  UI.A.bizPace = (p) => { biz().pace = p; UI.refresh(); };
  UI.A.bizSet = (v, el) => { const b = biz(); b[el.dataset.k] = v; UI.toast('Updated.'); UI.refresh(); };
  UI.A.ownerOp = (id) => { TG.G.player.ownerBiz = id || null; UI.refresh(); };

  // "this month" flow + "next month"
  UI.flowCard = (g, b) => {
    const f = b.flow; if (!f || !f.rows || !f.rows.length) return `<div class="card"><h3>📅 This month</h3><div class="mute">Press ▶ Next Month to see what happens.</div></div>`;
    const row = (x, i, pre) => { const key = pre + b.id + i; return `<div class="irow"><span class="dot ${x.c}"></span><span class="ic">${x.i}</span><span class="lb" data-act="tip" data-arg="${key}" data-nosave="1">${esc(x.t)}</span><span class="vl">${UI.fmtN(x.v, x.u)}</span>${x.why ? UI.tipBtn(key) : ''}${UI.tipLine(key, x.why)}</div>`; };
    return `<div class="card"><h3>📅 This month</h3>${f.rows.map((x, i) => row(x, i, 'fr')).join('')}</div>` + (f.next && f.next.length ? `<div class="card"><h3>🔮 Next month</h3>${f.next.map((x, i) => row(x, i, 'fn')).join('')}</div>` : '');
  };

  // price: market price next to yours
  UI.priceCard = (g, b) => {
    const mk = PR().market(g, b); const r = PR().ratio(g, b); const gd = PR().good(b) || {};
    const ask = b.ask != null ? b.ask : null; const dec = mk < 50 ? 2 : 0; const fmt = (v) => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const kind = gd.kind === 'commodity' || b.farm ? 'Buyers can buy elsewhere: above market they buy less from you and unsold goods sit, spoil or rot.' : 'Above market: fewer customers and your reputation drops. Below market: more customers but less profit each.';
    return `<div class="card"><h3>🏷️ Price ${gd.icon || ''} <span class="mute">per ${esc(gd.unit || 'unit')}</span> ${UI.tipBtn('price' + b.id)}</h3>${UI.tipLine('price' + b.id, kind)}
      <div class="pricebox"><span class="mk">📉 Market ${fmt(mk)}</span><span class="mk">🏷️ You ${ask != null ? fmt(ask) : 'follow market'}</span>${UI.pill(PR().label(r) + (ask != null ? ` (${Math.round(r * 100)}%)` : ''), { g: 'good', y: 'warn', r: 'bad' }[PR().tone(r)])}</div>
      <div class="row" style="margin-top:8px"><input type="number" id="askIn" step="${dec ? '0.01' : '1'}" min="0" value="${(ask != null ? ask : mk).toFixed(dec)}">${UI.btn('✅ Set', 'askSet', null, 'sm pri')}${UI.btn('➖10%', 'askStep', '-1', 'sm')}${UI.btn('➕10%', 'askStep', '1', 'sm')}${UI.btn('= Market', 'askMkt', null, 'sm')}</div></div>`;
  };
  UI.A.askSet = () => { const b = biz(); const v = UI.num('askIn', 0); if (!(v > 0)) return UI.toast('Type a price.', true); const r = PR().set(TG.G, b, v); UI.toast(`Price set to ${m(r.price)}.`); UI.refresh(); };
  UI.A.askStep = (s) => { const g = TG.G, b = biz(); const cur = b.ask != null ? b.ask : PR().market(g, b); PR().set(g, b, cur * (1 + 0.1 * Number(s))); UI.refresh(); };
  UI.A.askMkt = () => { biz().ask = null; UI.toast('Following the market price.'); UI.refresh(); };

  // capacity = weakest link
  UI.linksCard = (g, b) => {
    const d = TG.B.def(b); const ctx = TG.B.ctx(g, b); const lc = b.lastCtx || {}; let L = [];
    const cats = TG.CONFIG.equipCats;
    if (d.model === 'service') {
      const k = TG.M.models.service.caps(g, b, ctx);
      L.push({ i: '👥', t: 'Staff', v: k.keyCap, tip: 'What your key workers can handle. Hire, train, or buy tools that speed them up.' });
      for (const l of k.links) { const ed = TG.E.def(b, l.id); const c = (d.equipCatsLabel && d.equipCatsLabel[ed.cat]) || cats[ed.cat] || ['⚙️', ed.label]; L.push({ i: c[0], t: c[1], v: l.cap, tip: `${ed.label}s and anything in the same group. Buy more in Equipment.` }); }
      if (Number.isFinite(k.spaceCap)) L.push({ i: '📐', t: 'Space', v: k.spaceCap, tip: 'The most your building can fit. Needs a bigger property.' });
      if (Number.isFinite(k.supCap)) L.push({ i: '🧹', t: 'Helpers', v: k.supCap, tip: 'Support staff (cleaners, desk...).' });
      if (b.stock) L.push({ i: TG.ST.def(b).icon, t: 'Storage', v: TG.ST.cap(b), tip: 'How much stock fits. Run out and you turn customers away.' });
    } else if (b.farm) {
      const cv = TG.M.models.farm.cover(g, b, ctx); const f = b.farm;
      L.push({ i: '🚜', t: 'Tractors', v: cv.tcov * 100, u: '%', tip: `${cv.tcap.toFixed(1)} of ${cv.tneed.toFixed(1)} tractors' worth working.` });
      L.push({ i: '👩‍🌾', t: 'Farmhands', v: cv.hcov * 100, u: '%', tip: 'Enough hands for the land or herd?' });
      if (f.ent === 'crops') { L.push({ i: '🌱', t: 'Planting', v: cv.pcov * 100, u: '%', tip: 'Tractors + planters.' }); L.push({ i: '🌾', t: 'Harvest', v: cv.hvcov * 100, u: '%', tip: 'Tractors + combines.' }); }
    } else if (b.tech) { L.push({ i: '🖥️', t: 'Servers', v: TG.E.capacity(b, 'server'), tip: 'Users your servers handle. More users than this = outages.' }); }
    else if (b.factory) { L.push({ i: '🏭', t: 'Lines', v: TG.E.capacity(b, 'line'), tip: 'Units per month your lines can make.' }); if (b.stock) L.push({ i: '🪨', t: 'Raw storage', v: TG.ST.cap(b), tip: 'Raw materials you can hold.' }); }
    if (!L.length) return '';
    const isPct = L[0].u === '%';
    const caps = L.map((x) => x.v); const mn = Math.min(...caps); const mx = Math.max(...caps.filter(Number.isFinite), 1);
    const dem = lc.demand;
    return `<div class="card"><h3>⛓️ What limits you ${UI.tipBtn('links' + b.id)}</h3>${UI.tipLine('links' + b.id, 'You can only serve as many as your weakest link. Fix the red one first: hire, buy equipment, add storage or move.')}
      ${L.map((x, i) => `<div class="link ${x.v === mn && (isPct ? x.v < 100 : true) ? 'weak' : ''}" data-act="tip" data-arg="ln${b.id}${i}" data-nosave="1"><span class="ico">${x.i}</span><span class="grow">${esc(x.t)}${UI.bar(x.v, isPct ? 100 : mx)}</span><b>${UI.fmtN(x.v, x.u)}</b></div>${UI.tipLine('ln' + b.id + i, x.tip)}`).join('')}
      ${dem != null && !isPct && d.model === 'service' ? `<div class="link"><span class="ico">🧲</span><span class="grow">Customers wanted</span><b>${Math.round(dem).toLocaleString()}</b></div>` : ''}</div>`;
  };
  // ---------- staff ----------
  const traitTxt = (e) => {
    const t = [];
    t.push(e.revealed && e.revealed.reliability ? `reliability ${e.reliability}` : 'reliability ?');
    t.push(e.revealed && e.revealed.honesty ? `honesty ${e.honesty}` : 'honesty ?');
    t.push(e.revealed && e.revealed.temper ? `temper ${e.temper}` : 'temper ?');
    if (e.trait) t.push(`style: ${e.trait === 'dishonest' && !(e.revealed && e.revealed.honesty) ? '?' : e.trait}`);
    return t.join(' · ');
  };
  function staff(g, b) {
    const d = TG.B.def(b); const C = TG.CONFIG;
    if (!b.target) TG.D.syncTargets(b);
    const roles = Object.keys(d.roles);
    let o = `<div class="card"><h3 style="margin-top:0">Team plan</h3><div class="mute">Your managers (GM / HR) keep each role at its target: they hire replacements when people quit.</div><table>`;
    for (const r of roles) {
      const rd = d.roles[r]; const have = b.staff.filter((e) => e.role === r).length; const tgt = b.target[r] || 0;
      o += `<tr><td><b>${esc(rd.label)}</b>${rd.key ? ' ⭐' : ''}${rd.licensed ? ' 🎓' : ''}<div class="mute">${m(rd.wage[0])}-${m(rd.wage[1])}/mo · each handles ~${rd.cap ? rd.cap.toLocaleString() : '-'} /mo</div></td><td class="n">${have} now</td><td class="n">target ${UI.btn('−', 'tgt', `${r}|-1`, 'sm')} ${tgt} ${UI.btn('+', 'tgt', `${r}|1`, 'sm')}</td></tr>`;
    }
    o += `</table><div class="mute">Payroll: ${m(TG.S.payroll(b))}/mo. ⭐ key role (drives capacity) · 🎓 licensed (scarce in small towns)</div></div>`;
    // hire
    const hr = UI.S.hireRole && (d.roles[UI.S.hireRole] || C.specialists[UI.S.hireRole]) ? UI.S.hireRole : roles[0];
    const pool = TG.S.poolFor(g, b, hr);
    o += `<div class="card"><h3 style="margin-top:0">Hire</h3><div class="row"><select data-change="hireRole">${roles.map((r) => `<option value="${r}"${r === hr ? ' selected' : ''}>${esc(d.roles[r].label)}</option>`).join('')}<optgroup label="Managers & specialists">${Object.entries(C.specialists).map(([k, s]) => `<option value="${k}"${k === hr ? ' selected' : ''}>${esc(s.label)}${b.spec[k] ? ' (filled)' : ''}</option>`).join('')}</optgroup></select></div>
      <div class="mute">${esc((C.specialists[hr] || d.roles[hr] || {}).desc || '')}</div>
      <div class="mute">${pool.length} applicant(s) this month. Skill shown is an interview estimate; a background check (${m(C.staff.backgroundCheck)}) reveals the truth.</div>`;
    for (const c of pool) o += `<div class="ev"><div class="row sp"><b>${esc(c.name)}</b><span>${m(c.wage)}/mo</span></div><div class="small">Skill ~${c.skillSeen}${c.revealed.honesty ? ` (true ${c.skill})` : ''} · ${c.years} yrs exp · attitude ${c.attitude}</div><div class="mute">${traitTxt(c)}</div>
      <div class="btns">${UI.btn('Hire', 'hire', c.id, 'sm pri')}${c.revealed.honesty ? '' : UI.btn(`Check ${m(C.staff.backgroundCheck)}`, 'bgCheck', c.id, 'sm')}</div></div>`;
    if (!pool.length) o += `<div class="ev warn">Nobody applied this month. Small labor pools make hiring slow; try next month or move to a bigger town.</div>`;
    o += `</div>`;
    // current team
    const specs = Object.entries(b.spec || {}).filter(([, e]) => e);
    if (specs.length) o += `<div class="card"><h3 style="margin-top:0">Managers & specialists</h3>${specs.map(([r, e]) => empRow(b, e, TG.S.roleDef(b, r).label)).join('')}</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Staff (${b.staff.length})</h3>${b.staff.length ? b.staff.slice().sort((x, y) => x.role.localeCompare(y.role) || y.skill - x.skill).map((e) => empRow(b, e, d.roles[e.role] ? d.roles[e.role].label : e.role)).join('') : '<div class="mute">No staff. Hire above.</div>'}</div>`;
    return o;
  }
  function empRow(b, e, label) {
    const mt = e.morale < 35 ? 'bad' : e.morale < 55 ? 'warn' : 'good';
    return `<div class="row sp" style="border-bottom:1px solid #eee;padding:4px 0"><div class="grow"><b>${esc(e.name)}</b> <span class="mute">${esc(label)}</span><div class="small">skill ${e.skillSeen != null ? e.skillSeen : e.skill} · ${UI.pill('morale ' + Math.round(e.morale), mt)} · ${m(e.wage)}/mo · ${Math.floor((e.months || 0) / 12)}y ${(e.months || 0) % 12}m</div></div>${UI.btn('Manage', 'emp', e.id, 'sm')}</div>`;
  }
  UI.A.tgt = (arg) => { const b = biz(); const [r, dv] = arg.split('|'); b.target[r] = Math.max(0, (b.target[r] || 0) + Number(dv)); UI.refresh(); };
  UI.A.hireRole = (v) => { UI.S.hireRole = v; UI.refresh(); };
  const findCand = (id) => { const b = biz(); for (const k in b.pools || {}) { const c = b.pools[k].list.find((x) => x.id === id); if (c) return c; } return null; };
  UI.A.hire = (id) => {
    const b = biz(), c = findCand(id); if (!c) return;
    TG.S.hire(TG.G, b, c); if (!TG.CONFIG.specialists[c.role]) b.target[c.role] = Math.max(b.target[c.role] || 0, b.staff.filter((e) => e.role === c.role).length);
    UI.toast(`Hired ${c.name}.`); UI.refresh();
  };
  UI.A.bgCheck = (id) => { const c = findCand(id); if (!c) return; TG.S.backgroundCheck(TG.G, biz(), c); UI.refresh(); };
  UI.A.emp = (id) => {
    const g = TG.G, b = biz(), C = TG.CONFIG; const e = TG.S.allStaff(b).find((x) => x.id === id); if (!e) return UI.closeModal();
    const isSpec = !!C.specialists[e.role];
    UI.modal(esc(e.name), `<div class="card"><div class="kv"><span>Role</span><span>${esc(TG.S.roleDef(b, e.role).label)}</span><span>Skill</span><span>${e.skillSeen != null ? e.skillSeen : e.skill}</span><span>Morale</span><span>${Math.round(e.morale)}</span><span>Loyalty</span><span>${Math.round(e.loyalty)}</span><span>Attitude</span><span>${e.attitude}</span><span>Wage</span><span>${m(e.wage)}/mo</span></div><div class="mute">${traitTxt(e)}</div>
      ${isSpec ? `<div class="mute">Good-call chance on decisions: ${U.pct(TG.D.pGood(g, e))} (skill + happiness).</div>` : ''}
      <div class="btns">${UI.btn(`Train basic ${m(C.staff.trainBasic.cost)}`, 'empDo', `${id}|train`, 'sm')}${UI.btn(`Train advanced ${m(C.staff.trainAdvanced.cost)}`, 'empDo', `${id}|trainA`, 'sm')}${UI.btn(`Raise +${U.pct(C.staff.raisePct)}`, 'empDo', `${id}|raise`, 'sm')}${UI.btn(`Bonus ${m(e.wage * 0.5)}`, 'empDo', `${id}|bonus`, 'sm')}</div><div class="small">This month left: 🎓 ${TG.S.usesLeft(g, e, 'train')} · 💵 raise ${TG.S.usesLeft(g, e, 'raise')} · 🎁 bonus ${TG.S.usesLeft(g, e, 'bonus')} ${UI.tipBtn('spamE')}</div>${UI.tipLine('spamE', 'Each person can get 2 trainings, 1 raise and 1 bonus a month. Doing more backfires: it costs money, gives nothing and lowers morale.')}<div class="btns">
      ${UI.btn(`Fire (severance ${m(e.wage * C.staff.severanceMonths)})`, 'empDo', `${id}|fire`, 'sm badb')}</div>
      ${!isSpec ? `<div class="row" style="margin-top:8px"><span class="small">Promote to</span><select id="promRole">${Object.entries(C.specialists).map(([k, s]) => `<option value="${k}">${esc(s.label)}${b.spec[k] ? ' (replaces current)' : ''}</option>`).join('')}</select>${UI.btn('Promote', 'empDo', `${id}|promote`, 'sm')}</div><div class="mute">A promoted worker's management skill can surprise you either way.</div>` : ''}</div>`);
  };
  UI.A.empDo = (arg) => {
    const g = TG.G, b = biz(); const [id, act] = arg.split('|');
    if (act === 'train' || act === 'trainA') { const r = TG.S.train(g, b, id, act === 'trainA' ? 'advanced' : 'basic'); if (!r) return UI.toast('Not enough cash.', true); UI.toast(r.spam ? 'Too much training this month: burned out (morale down, no skill).' : r.gain > 0 ? `Skill +${r.gain}` : 'Training did not stick (slow learner).', r.gain <= 0); }
    if (act === 'raise') { const r = TG.S.raise(g, b, id); UI.toast(r && r.spam ? 'Another raise this month? Payroll said no and it felt like a broken promise (morale down).' : 'Raise given: morale and loyalty up.', r && r.spam); }
    if (act === 'bonus') { const r = TG.S.bonus(g, b, id); UI.toast(r && r.spam ? 'Another bonus this month means less each time (morale down).' : 'Bonus paid.', r && r.spam); }
    if (act === 'fire') { TG.S.fire(g, b, id, 'fired'); const c = {}; for (const e of b.staff) c[e.role] = (c[e.role] || 0) + 1; for (const r in b.target) b.target[r] = Math.min(b.target[r], Math.max(c[r] || 0, 0)); UI.closeModal(); UI.toast('Let go.'); return UI.refresh(); }
    if (act === 'promote') { const e = TG.S.promote(g, b, id, UI.val('promRole')); if (e) UI.toast(`${e.name} promoted. True manager skill: ${e.skill}.`); UI.closeModal(); return UI.refresh(); }
    UI.A.emp(id); UI.refresh();
  };

  // ---------- equipment (grouped by what it does) ----------
  const effectTxt = (g, b, ed) => {
    if (ed.desc) return ed.desc;
    const gd = TG.PR.good(b) || {};
    if (ed.cap) return `+${ed.cap.toLocaleString()} ${gd.unit ? gd.unit + 's' : ''} a month`;
    if (ed.store || ed.storeTons || ed.storeUnits) return `+${(ed.store || ed.storeTons || ed.storeUnits).toLocaleString()} storage`;
    if (ed.demandBoost) return `+${Math.round(ed.demandBoost * 100)}% customers`;
    if (ed.staffBoost) return `staff +${Math.round(ed.staffBoost * 100)}% faster`;
    if (ed.ticketBoost) return `+${Math.round(ed.ticketBoost * 100)}% per sale`;
    return 'Needed to run';
  };
  function equip(g, b) {
    const d = TG.B.def(b), C = TG.CONFIG; const E = TG.E;
    const tier = UI.S.eqTier || 'standard'; const lease = !!UI.S.eqLease;
    let o = `<div class="card"><h3>🛍️ How to buy</h3><div class="btns">${Object.entries(C.equipTiers).map(([k, t]) => UI.btn(`${{ used: '♻️', standard: '🔧', premium: '💎' }[k] || ''} ${t.label}`, 'eqTierSet', k, 'sm' + (tier === k ? ' pri' : ''))).join('')}${UI.btn(lease ? '📄 Lease ✓' : '📄 Lease', 'eqLeaseSet', null, 'sm' + (lease ? ' pri' : ''))} ${UI.tipBtn('eqhow')}</div>
      ${UI.tipLine('eqhow', `${C.equipTiers[tier].label}: price x${C.equipTiers[tier].price}, breaks x${C.equipTiers[tier].brk}, output x${C.equipTiers[tier].out}. Used gear may hide wear. Lease = ${U.pct(C.equipment.leaseMonthlyPct, 1)} of price a month, repairs included.`)}</div>`;
    const cats = []; const byCat = {};
    for (const ed of d.equip) { const c = ed.cat || 'other'; if (!byCat[c]) { byCat[c] = []; cats.push(c); } byCat[c].push(ed); }
    const pools = E.pools(b).map((p) => p.pool);
    for (const c of cats) {
      const cd = (d.equipCatsLabel && d.equipCatsLabel[c]) || C.equipCats[c] || ['⚙️', 'Other', ''];
      o += `<div class="card"><div class="cathead"><span class="ic">${cd[0]}</span><span class="grow">${esc(cd[1])}</span>${cd[2] ? UI.tipBtn('cat' + c) : ''}</div>${UI.tipLine('cat' + c, cd[2])}`;
      for (const ed of byCat[c]) {
        const n = E.count(b, ed.id), mx = E.maxCount(b, ed.id); const pr = E.price(g, b, ed.id, tier);
        const pool = ed.pool || ed.id; const crit = pools.indexOf(pool) >= 0;
        const sub = `${esc(effectTxt(g, b, ed))}${ed.upkeep ? ` · upkeep ${m(ed.upkeep * g.world.priceIdx)}/mo` : ''}${crit ? ` · <b>${Math.round(E.capacity(b, pool)).toLocaleString()}</b> now` : ''}`;
        o += UI.irow('eq' + ed.id, ed.icon || cd[0], ed.label, `${n}${mx < 999 ? '/' + mx : ''}`, `${effectTxt(g, b, ed)}. Costs ${m(pr)}${lease ? ' (or ' + m(pr * C.equipment.leaseMonthlyPct) + '/mo leased)' : ''}. Wears out with use.`, UI.btn(lease ? `📄 ${m(pr * C.equipment.leaseMonthlyPct)}/mo` : `🛒 ${m(pr)}`, 'eqBuy', ed.id, 'xs goodb', n >= mx), sub);
      }
      const mine = b.equip.filter((it) => { const ed = E.def(b, it.type); return ed && (ed.cat || 'other') === c; });
      if (mine.length) o += `<details><summary>🔧 Yours (${mine.length})${mine.some((x) => x.broken) ? ' <span class="pill bad">broken!</span>' : ''}</summary>${mine.map((it) => itemRow(g, b, it)).join('')}</details>`;
      o += '</div>';
    }
    return o;
  }
  function itemRow(g, b, it) {
    const C = TG.CONFIG, E = TG.E; const bc = it.broken ? null : E.breakChance(g, b, it); const w = E.effWear(it);
    const st = it.broken === 'destroyed' ? UI.pill('gone', 'bad') : it.broken ? UI.pill('broken', 'bad') : UI.risk(bc.p);
    const wearShown = it.hidden > 0 && !it.inspected ? `${Math.round(it.wear)}%+?` : `${Math.round(w)}%`;
    const k = 'it' + it.id;
    return `<div class="ev ${it.broken ? 'bad' : w > 70 ? 'warn' : 'good'}"><div class="row sp"><b data-act="tip" data-arg="${k}" data-nosave="1">${esc(it.label)} #${E.num(b, it)}</b>${st}</div>
      <div class="row"><span class="small">⏳ ${(it.age / 12).toFixed(1)} yrs · 🔩 wear ${wearShown}${it.leased ? ' · 📄 leased' : ''}${it.maint ? ' · 🛡️ plan' : ''}</span>${UI.tipBtn(k)}</div>${UI.bar(w, 100, true)}
      ${UI.tipLine(k, `${C.equipTiers[it.tier].label}. Worth ${m(E.resale(g, b, it))}.${it.leased ? ' Lease ' + m(it.leasePay) + '/mo.' : ''}${it.warranty > 0 ? ' Warranty ' + it.warranty + ' mo.' : ''}${bc ? ' Break risk: ' + bc.factors.join(', ') + '.' : ''}`)}
      <div class="btns">${it.broken && it.broken !== 'destroyed' ? UI.btn(`🔧 Fix ${it.warranty > 0 || it.leased ? '(free)' : m(E.repairCost(g, b, it))}`, 'eqDo', `${it.id}|repair`, 'xs goodb') : ''}
      ${!it.broken ? UI.btn(`🧰 Service ${m(E.def(b, it.type).price * C.equipment.serviceCostPct * g.world.priceIdx)}`, 'eqDo', `${it.id}|service`, 'xs') : ''}
      ${!it.leased ? UI.btn(it.maint ? '🛡️ Stop plan' : `🛡️ Plan ${m(E.def(b, it.type).price * C.equipment.maintPlanCostPct * g.world.priceIdx)}/mo`, 'eqDo', `${it.id}|maint`, 'xs') : ''}
      ${it.hidden > 0 && !it.inspected ? UI.btn(`🔍 ${m(E.def(b, it.type).price * C.equipment.inspectCost * g.world.priceIdx)}`, 'eqDo', `${it.id}|inspect`, 'xs') : ''}
      ${UI.btn('🔁 New', 'eqDo', `${it.id}|replace`, 'xs')}${UI.btn(it.leased ? '↩️ Return' : '💵 Sell', 'eqDo', `${it.id}|sell`, 'xs badb')}</div></div>`;
  }
  UI.A.eqTierSet = (k) => { UI.S.eqTier = k; if (k === 'used') UI.S.eqLease = false; UI.refresh(); };
  UI.A.eqLeaseSet = () => { if ((UI.S.eqTier || 'standard') === 'used') return UI.toast('Used gear cannot be leased.', true); UI.S.eqLease = !UI.S.eqLease; UI.refresh(); };
  UI.A.eqBuy = (type) => {
    const g = TG.G, b = biz(); const tier = UI.S.eqTier || 'standard'; const lease = !!UI.S.eqLease && tier !== 'used';
    if (TG.E.count(b, type) >= TG.E.maxCount(b, type)) return UI.toast('No room for more of these.', true);
    const it = TG.E.buy(g, b, type, tier, lease ? { leased: true } : null);
    if (!it) return UI.toast(`Not enough cash (${m(TG.E.price(g, b, type, tier))}).`, true);
    UI.toast(`${lease ? 'Leased' : 'Bought'} ${it.label}.`); UI.refresh();
  };
  UI.A.eqDo = (arg) => {
    const g = TG.G, b = biz(); const [id, act] = arg.split('|'); const it = b.equip.find((x) => x.id === id); if (!it) return;
    if (act === 'repair') TG.E.repair(g, b, id, 'You');
    if (act === 'service') TG.E.service(g, b, id);
    if (act === 'maint') it.maint = !it.maint;
    if (act === 'inspect') { TG.E.inspect(g, b, id); UI.toast(`True wear: ${Math.round(it.wear)}%`); }
    if (act === 'replace') { if (!TG.E.replace(g, b, id, 'standard', 'You')) UI.toast('Not enough cash.', true); }
    if (act === 'sell') { const v = TG.E.sell(g, b, id); UI.toast(v ? `Sold for ${m(v)}.` : 'Returned.'); }
    TG.D.removeFor(g, (dd) => dd.itemId === id && !b.equip.some((x) => x.id === id && x.broken));
    UI.refresh();
  };

  // ---------- upgrades & insurance ----------
  function upg(g, b) {
    const d = TG.B.def(b), C = TG.CONFIG;
    let o = `<div class="card"><h3 style="margin-top:0">Upgrades & fixes</h3><div class="mute">Each one cuts specific risks or raises output. Some have monthly costs.</div>`;
    for (const f of d.fixes) {
      const on = !!b.fixes[f.id]; const red = f.reduces ? Object.entries(f.reduces).map(([k, v]) => { const r = d.risks.find((x) => x.id === k); return `${r ? r.label.toLowerCase() : k} −${Math.round((1 - v) * 100)}%`; }).join(', ') : '';
      o += `<div class="ev ${on ? 'good' : ''}"><div class="row sp"><b>${esc(f.label)}</b>${on ? UI.pill('active', 'good') : ''}</div><div class="small">${f.cost ? `${m(f.cost * g.world.priceIdx)} once` : 'No upfront cost'}${f.monthly ? ` + ${m(f.monthly)}/mo` : ''}${f.note ? ` · ${esc(f.note)}` : ''}</div>${red ? `<div class="mute">Cuts: ${esc(red)}</div>` : ''}
        <div class="btns">${on ? (b.fixes[f.id].until > g.month ? `<span class="mute">Locked in until ${U.dateStr(b.fixes[f.id].until)}</span>` : UI.btn('Drop', 'fix', `${f.id}|0`, 'sm')) : UI.btn('Add', 'fix', `${f.id}|1`, 'sm pri')}</div></div>`;
    }
    o += `</div><div class="card"><h3 style="margin-top:0">Insurance</h3><div class="mute">Insurance pays most of a covered loss. Premiums rise after claims.</div><table>`;
    for (const t of d.insurance) {
      const I = C.finance.insurance[t]; if (!I) continue;
      o += `<tr><td>${esc(I.label)}</td><td class="n">${m(TG.F.premium(g, b, t))}/mo</td><td class="n">${b.ins[t] ? UI.btn('Covered ✓ (cancel)', 'ins', t, 'sm goodb') : UI.btn('Buy', 'ins', t, 'sm')}</td></tr>`;
    }
    return o + `</table></div>`;
  }
  UI.A.fix = (arg) => { const g = TG.G, b = biz(); const [id, on] = arg.split('|'); if (on === '1') UI.res(TG.B.buyFix(g, b, id), 'Added.'); else { TG.B.dropFix(g, b, id); UI.toast('Dropped.'); } UI.refresh(); };
  UI.A.ins = (t) => { const b = biz(); b.ins[t] = !b.ins[t]; UI.refresh(); };

  // ---------- marketing ----------
  function mkt(g, b) {
    const C = TG.CONFIG.reputation; const ab = TG.B.adBoost(g, b);
    let o = `<div class="card"><h3 style="margin-top:0">Advertising</h3><div class="kv"><span>Monthly budget</span><span><input type="number" id="adBudget" value="${b.ads.budget || 0}" min="0" step="100"></span>
      <span>Channel</span><span><select id="adCh">${Object.entries(C.adChannels).map(([k, c]) => `<option value="${k}"${b.ads.channel === k ? ' selected' : ''}>${c.label} (flop risk ${U.pct(c.flop)})</option>`).join('')}</select></span></div>
      <div class="btns">${UI.btn('Save ad plan', 'adSave', null, 'pri')}</div>
      <div class="mute">Current effect: about +${U.pct(ab.boost || 0)} demand. Ads have diminishing returns and work worse with a poor reputation${b.spec.ads ? '; your ads manager makes spend go further' : ''}.</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Reputation & PR</h3><div>Reputation ${Math.round(b.rep)}/100 ${UI.bar(b.rep, 100)}</div><div class="mute">PR can speed up recovery after a hit, but can flop.</div>${UI.irow('prUse' + b.id, '📣', 'PR left this month', `${TG.USES.left(b, 'pr', g.month, TG.CONFIG.reputation.prPerMonth)}/${TG.CONFIG.reputation.prPerMonth}`, 'You get 2 PR moves a month. The 2nd does half as much. Any more looks spammy or desperate and LOSES reputation.')}<div class="btns">${Object.entries(C.pr).map(([k, p]) => UI.btn(`${p.label} (${p.cost != null ? m(p.cost * g.world.priceIdx) : m(b.revAvg * p.costRev)}, ${U.pct(p.fail)} flop)`, 'pr', k, 'sm')).join('')}</div></div>`;
    return o;
  }
  UI.A.adSave = () => { const b = biz(); b.ads.budget = Math.max(0, Math.round(UI.num('adBudget', 0))); b.ads.channel = UI.val('adCh') || 'social'; UI.toast('Ad plan saved.'); UI.refresh(); };
  UI.A.pr = (k) => { TG.B.doPR(TG.G, biz(), k, 'You'); const d = TG.G.cur.decisions[TG.G.cur.decisions.length - 1]; UI.toast(d ? d.text : 'Done.', d && d.outcome === 'bad'); UI.refresh(); };

  // ---------- ownership ----------
  function own(g, b) {
    const F = TG.F, C = TG.CONFIG.finance; const v = F.bizValue(g, b);
    const prop = g.properties.find((p) => p.id === b.propId);
    let o = `<div class="card"><div class="kv"><span>Estimated business value</span><span>${m(v)}</span><span>Outside owners</span><span>${U.pct(b.outside || 0)}${b.public ? ' (public)' : ''}</span><span>Sale price (incl. owned property)</span><span>${m(TG.B.saleValue(g, b))}</span></div><div class="mute">Value is based on recent profit, assets and reputation.</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Raise money</h3><div class="mute">Investors pay cash now and take that share of profits forever (until you buy them back at a premium).</div><div class="btns">${[0.1, 0.2, 0.3].map((p) => { const off = F.investorOffer(g, b, p); return UI.btn(`Sell ${U.pct(p)} for ${m(off.cash)}`, 'invTake', p, 'sm', off.cash < 10000 || (b.outside || 0) + p > 0.9); }).join('')}
      ${UI.btn(`IPO (needs ${m(C.ipoMinValue)} value)`, 'ipo', null, 'sm', b.public || v < C.ipoMinValue)}${UI.btn(`Buy back (${m(v * (b.outside || 0) * 1.2)})`, 'buyBack', null, 'sm', !b.outside)}</div></div>`;
    o += `<div class="card"><h3 style="margin-top:0">Exit</h3><div class="btns">${UI.btn(`Sell business ${m(TG.B.saleValue(g, b))}`, 'bizSell', null, 'sm')}${UI.btn('Close (sell equipment, keep property)', 'bizClose', null, 'sm')}${UI.btn('Business bankruptcy', 'bizBk', null, 'sm badb')}</div>
      <div class="mute">Business bankruptcy is only allowed when this business's debts exceed its assets: it wipes linked loans but hurts your credit${prop ? '' : ''}.</div>
      <div class="row" style="margin-top:6px"><span class="small">Rename</span><input type="text" id="bizName" value="${esc(b.name)}" maxlength="30">${UI.btn('Save', 'bizRename', null, 'sm')}</div></div>`;
    return o;
  }
  UI.A.invTake = (p) => { UI.res(TG.F.takeInvestor(TG.G, biz(), Number(p)), 'Investors are in.'); UI.refresh(); };
  UI.A.ipo = () => { UI.res(TG.F.ipo(TG.G, biz()), 'IPO complete!'); UI.refresh(); };
  UI.A.buyBack = () => { UI.res(TG.F.buyBack(TG.G, biz()), 'Bought back all shares.'); UI.refresh(); };
  UI.A.bizSell = () => UI.confirm('Sell this business (and its owned property)?', 'bizSellGo');
  UI.A.bizSellGo = () => { const v = TG.B.sell(TG.G, UI.bizId); UI.closeModal(); UI.toast(`Sold for ${m(v)}.`); UI.go('biz'); };
  UI.A.bizClose = () => UI.confirm('Close this business? Equipment is sold, staff let go, property kept.', 'bizCloseGo');
  UI.A.bizCloseGo = () => { const g = TG.G, b = biz(); for (const e of TG.S.allStaff(b).slice()) TG.S.fire(g, b, e.id, 'business closed'); TG.B.close(g, b, 'closed by owner', false); UI.closeModal(); UI.toast('Closed.'); UI.go('biz'); };
  UI.A.bizBk = () => UI.confirm('File business bankruptcy? Only allowed if this business owes more than it owns.', 'bizBkGo');
  UI.A.bizBkGo = () => { const r = TG.F.businessBankruptcy(TG.G, UI.bizId); UI.closeModal(); if (UI.res(r, 'Filed.')) UI.go('biz'); };
  UI.A.bizRename = () => { const b = biz(); const n = UI.val('bizName').trim(); if (n) b.name = n.slice(0, 30); UI.refresh(); };

  UI.confirm = (text, act, arg) => UI.modal('Are you sure?', `<div class="card"><p>${esc(text)}</p><div class="btns">${UI.btn('Yes', act, arg, 'badb')}${UI.btn('Cancel', 'closeModal')}</div></div>`);
})();
