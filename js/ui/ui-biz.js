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
    const tabs = [['overview', 'Overview'], ['staff', 'Staff'], ['equip', 'Equipment'], ['upg', 'Upgrades'], ['mkt', 'Marketing']];
    if (TG.UI.modelPanel[d.model]) tabs.splice(1, 0, ['model', TG.UI.modelPanel[d.model].label]);
    tabs.push(['own', 'Ownership']);
    const t = UI.curTab('biz', 'overview');
    const body = { overview, staff, equip, upg, mkt, own, model: () => TG.UI.modelPanel[d.model].render(g, b) }[t] || overview;
    return `<div class="row sp"><h2>${d.icon} ${esc(b.name)}</h2>${UI.btn('◀ All', 'go', 'biz', 'sm')}</div>${UI.tabs('biz', tabs)}${body(g, b)}`;
  };

  // ---------- overview ----------
  function overview(g, b) {
    const d = TG.B.def(b), lc = b.lastCtx || {}; const h = b.hist; const last = h[h.length - 1];
    const prop = g.properties.find((p) => p.id === b.propId);
    let o = `<div class="card"><div class="row sp"><div><div class="mute">Last month</div><div class="big">${last ? UI.signed(last.profit) : '-'}</div><div class="mute">${last ? `rev ${m(last.rev)} · costs ${m(last.cost)}` : 'not open a full month yet'}</div></div>
      <div><div class="mute">Reputation</div><div class="big">${Math.round(b.rep)}</div>${UI.bar(b.rep, 100)}</div>
      <div><div class="mute">Quality</div><div class="big">${lc.quality != null ? lc.quality : '-'}</div><div class="mute">skill ${lc.skill != null ? lc.skill : '-'} · morale ${lc.morale != null ? lc.morale : '-'}</div></div></div>
      ${b.licensePending > 0 ? `<div class="ev warn">⏳ Waiting for license: ${b.licensePending} month(s). Costs run, no revenue yet.</div>` : ''}
      ${lc.cap != null ? `<div style="margin-top:6px" class="small">Capacity: served ${Math.round(lc.served || 0).toLocaleString()} of ${Math.round(lc.cap).toLocaleString()} (demand ${Math.round(lc.demand || 0).toLocaleString()})</div>${UI.bar(lc.served || 0, lc.cap || 1)}` : ''}
      ${lc.note ? `<div class="ev info">💡 ${esc(lc.note)}</div>` : ''}${lc.limit ? `<div class="mute">Growth is limited by: <b>${esc({ staff: 'not enough key staff', equipment: 'equipment (' + (lc.limitEquip || '') + ')', space: 'space (bigger property needed)', support: 'support staff', demand: 'customer demand' }[lc.limit] || lc.limit)}</b></div>` : ''}
      ${h.length > 2 ? `<div class="mute" style="margin-top:6px">Profit, last ${Math.min(36, h.length)} months</div>${UI.spark(h.slice(-36).map((x) => x.profit), '#1d4ed8')}` : ''}</div>`;
    // settings
    const owner = TG.B.owner(g, b);
    o += `<div class="card"><h3 style="margin-top:0">How it runs</h3><div class="kv">
      <span>Prices</span><span><select data-change="bizSet" data-k="price">${[['low', 'Low (more customers)'], ['normal', 'Normal'], ['premium', 'Premium (more per sale, fewer customers)']].map(([v, l]) => `<option value="${v}"${b.price === v ? ' selected' : ''}>${l}</option>`).join('')}</select></span>
      <span>Work pace</span><span><select data-change="bizSet" data-k="pace">${[['careful', 'Careful (fewer accidents, less output)'], ['normal', 'Normal'], ['rush', 'Rush (more output, more wear & accidents)']].map(([v, l]) => `<option value="${v}"${b.pace === v ? ' selected' : ''}>${l}</option>`).join('')}</select></span>
      <span>You work here yourself</span><span>${owner ? UI.btn('Yes: stop', 'ownerOp', '', 'sm') : UI.btn('No: work here', 'ownerOp', b.id, 'sm')}</span></div>
      <div class="mute">You can personally run one business: it adds a skilled worker and covers management, but you can't be everywhere. ${g.player.ownerBiz && !owner ? `(You currently run ${esc((TG.B.get(g, g.player.ownerBiz) || {}).name || '')}.)` : ''}</div>
      <div class="mute">${prop ? `Property: ${esc(prop.name)}, ${esc(TG.P.locLabel(prop))}, ${esc(TG.P.sizeLabel(prop))}${prop.leased ? `, leased ${m(prop.rent)}/mo` : ', owned'}` : ''}</div></div>`;
    const risks = TG.B.topRisks(g, b).slice(0, 8);
    o += `<div class="card"><h3 style="margin-top:0">Risks next month</h3><table>${risks.map((r) => `<tr><td>${esc(r.label)}<div class="mute">${esc(r.why)}</div></td><td class="n">${UI.risk(r.p)}</td></tr>`).join('') || '<tr><td class="mute">Nothing notable.</td></tr>'}</table></div>`;
    if (last) o += `<div class="card"><details><summary>Last month's income & expenses</summary><table>${Object.entries(last.lines || {}).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '-'}${m(Math.abs(v))}</td></tr>`).join('')}</table></details></div>`;
    const ev = g.log.filter((e) => e.bizId === b.id || e.biz === b.name).slice(-12).reverse();
    if (ev.length) o += `<div class="card"><h3 style="margin-top:0">Recent events</h3>${ev.map((e) => `<div class="small"><span class="mute">${U.dateStr(e.m)}</span> ${e.type === 'decision' ? `<b>${esc(e.by)}</b>: ` : ''}${esc(e.text)}</div>`).join('')}</div>`;
    return o;
  }
  UI.A.bizSet = (v, el) => { const b = biz(); b[el.dataset.k] = v; UI.toast('Updated.'); UI.refresh(); };
  UI.A.ownerOp = (id) => { TG.G.player.ownerBiz = id || null; UI.refresh(); };

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
      ${C.specialists[hr] ? `<div class="mute">${esc(C.specialists[hr].desc || '')}</div>` : ''}
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
      <div class="btns">${UI.btn(`Train basic ${m(C.staff.trainBasic.cost)}`, 'empDo', `${id}|train`, 'sm')}${UI.btn(`Train advanced ${m(C.staff.trainAdvanced.cost)}`, 'empDo', `${id}|trainA`, 'sm')}${UI.btn(`Raise +${U.pct(C.staff.raisePct)}`, 'empDo', `${id}|raise`, 'sm')}${UI.btn(`Bonus ${m(e.wage * 0.5)}`, 'empDo', `${id}|bonus`, 'sm')}
      ${UI.btn(`Fire (severance ${m(e.wage * C.staff.severanceMonths)})`, 'empDo', `${id}|fire`, 'sm badb')}</div>
      ${!isSpec ? `<div class="row" style="margin-top:8px"><span class="small">Promote to</span><select id="promRole">${Object.entries(C.specialists).map(([k, s]) => `<option value="${k}">${esc(s.label)}${b.spec[k] ? ' (replaces current)' : ''}</option>`).join('')}</select>${UI.btn('Promote', 'empDo', `${id}|promote`, 'sm')}</div><div class="mute">A promoted worker's management skill can surprise you either way.</div>` : ''}</div>`);
  };
  UI.A.empDo = (arg) => {
    const g = TG.G, b = biz(); const [id, act] = arg.split('|');
    if (act === 'train' || act === 'trainA') { const r = TG.S.train(g, b, id, act === 'trainA' ? 'advanced' : 'basic'); if (!r) return UI.toast('Not enough cash.', true); UI.toast(r.gain > 0 ? `Skill +${r.gain}` : 'Training did not stick (slow learner).', r.gain <= 0); }
    if (act === 'raise') { TG.S.raise(g, b, id); UI.toast('Raise given: morale and loyalty up.'); }
    if (act === 'bonus') { TG.S.bonus(g, b, id); UI.toast('Bonus paid.'); }
    if (act === 'fire') { TG.S.fire(g, b, id, 'fired'); const c = {}; for (const e of b.staff) c[e.role] = (c[e.role] || 0) + 1; for (const r in b.target) b.target[r] = Math.min(b.target[r], Math.max(c[r] || 0, 0)); UI.closeModal(); UI.toast('Let go.'); return UI.refresh(); }
    if (act === 'promote') { const e = TG.S.promote(g, b, id, UI.val('promRole')); if (e) UI.toast(`${e.name} promoted. True manager skill: ${e.skill}.`); UI.closeModal(); return UI.refresh(); }
    UI.A.emp(id); UI.refresh();
  };

  // ---------- equipment ----------
  function equip(g, b) {
    const d = TG.B.def(b), C = TG.CONFIG; const E = TG.E;
    let o = `<div class="card"><h3 style="margin-top:0">Buy or lease</h3><div class="row"><select id="eqType">${d.equip.map((x) => `<option value="${x.id}">${esc(x.label)} (std ${m(E.price(g, b, x.id, 'standard'))}${x.cap ? `, handles ${x.cap.toLocaleString()}` : ''})</option>`).join('')}</select>
      <select id="eqTier">${Object.entries(C.equipTiers).map(([k, t]) => `<option value="${k}"${k === 'standard' ? ' selected' : ''}>${t.label}: price x${t.price}, breaks x${t.brk}, output x${t.out}${t.warranty ? `, ${t.warranty}mo warranty` : ''}</option>`).join('')}</select></div>
      <div class="btns">${UI.btn('Buy', 'eqBuy', 'buy', 'pri')}${UI.btn(`Lease (${U.pct(C.equipment.leaseMonthlyPct, 1)} of price per month, maintenance included)`, 'eqBuy', 'lease')}</div>
      <div class="mute">Used gear is cheap but has hidden wear (inspect to see it). Premium gear is advanced: repairs cost more without a mechanic.</div></div>`;
    if (!b.equip.length) return o + `<div class="card mute">No equipment. Without it there's no capacity.</div>`;
    o += `<div class="card"><h3 style="margin-top:0">Your equipment (${b.equip.length})</h3>`;
    for (const it of b.equip) {
      const bc = it.broken ? null : E.breakChance(g, b, it); const w = E.effWear(it);
      const st = it.broken === 'destroyed' ? UI.pill('destroyed', 'bad') : it.broken ? UI.pill(`broken (${it.broken})`, 'bad') : UI.risk(bc.p);
      const wearShown = it.hidden > 0 && !it.inspected ? `${Math.round(it.wear)}%+?` : `${Math.round(w)}%`;
      o += `<div class="ev ${it.broken ? 'bad' : ''}"><div class="row sp"><b>${esc(it.label)} #${E.num(b, it)}</b>${st}</div>
        <div class="small">${C.equipTiers[it.tier].label} · ${(it.age / 12).toFixed(1)} yrs · wear ${wearShown} · resale ${m(E.resale(g, b, it))}${it.leased ? ` · leased ${m(it.leasePay)}/mo` : ''}${it.warranty > 0 ? ` · warranty ${it.warranty}mo` : ''}${it.maint ? ' · 🛡 maintenance plan' : ''}</div>
        ${UI.bar(w, 100, true)}${bc ? `<div class="mute">Break chance: ${esc(bc.factors.join(', '))}</div>` : ''}
        <div class="btns">${it.broken && it.broken !== 'destroyed' ? UI.btn(`Repair ${it.warranty > 0 || it.leased ? '(covered)' : m(E.repairCost(g, b, it))}`, 'eqDo', `${it.id}|repair`, 'sm goodb') : ''}
        ${!it.broken ? UI.btn(`Service ${m(E.def(b, it.type).price * C.equipment.serviceCostPct * g.world.priceIdx)}`, 'eqDo', `${it.id}|service`, 'sm') : ''}
        ${!it.leased ? UI.btn(it.maint ? 'Cancel plan' : `Maint. plan ${m(E.def(b, it.type).price * C.equipment.maintPlanCostPct * g.world.priceIdx)}/mo`, 'eqDo', `${it.id}|maint`, 'sm') : ''}
        ${it.hidden > 0 && !it.inspected ? UI.btn(`Inspect ${m(E.def(b, it.type).price * C.equipment.inspectCost * g.world.priceIdx)}`, 'eqDo', `${it.id}|inspect`, 'sm') : ''}
        ${UI.btn('Replace (std)', 'eqDo', `${it.id}|replace`, 'sm')}${UI.btn(it.leased ? 'Return lease' : 'Sell', 'eqDo', `${it.id}|sell`, 'sm badb')}</div></div>`;
    }
    return o + '</div>';
  }
  UI.A.eqBuy = (mode) => {
    const g = TG.G, b = biz(); const type = UI.val('eqType'), tier = UI.val('eqTier');
    if (mode === 'lease' && tier === 'used') return UI.toast('Used gear cannot be leased.', true);
    const it = TG.E.buy(g, b, type, tier, mode === 'lease' ? { leased: true } : null);
    if (!it) return UI.toast(`Not enough cash (${m(TG.E.price(g, b, type, tier))}).`, true);
    UI.toast(`${mode === 'lease' ? 'Leased' : 'Bought'} ${it.label}.`); UI.refresh();
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
    o += `<div class="card"><h3 style="margin-top:0">Reputation & PR</h3><div>Reputation ${Math.round(b.rep)}/100 ${UI.bar(b.rep, 100)}</div><div class="mute">PR can speed up recovery after a hit, but can flop.</div><div class="btns">${Object.entries(C.pr).map(([k, p]) => UI.btn(`${p.label} (${p.cost != null ? m(p.cost * g.world.priceIdx) : m(b.revAvg * p.costRev)}, ${U.pct(p.fail)} flop)`, 'pr', k, 'sm')).join('')}</div></div>`;
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
