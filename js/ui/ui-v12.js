/* ui-v12.js - v12 screens: CEO coaching/raise/bonus, manager training effects, GM job-offer setting,
   CEO keeps managers hired, who orders supplies, a real help page per business, the v12 update note. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI, U = TG.U; const V = TG.V12; const C = TG.CONFIG;
  const m = (x) => U.money(x); const esc = UI.esc;

  // ---------- CEO: coaching, raise, bonus (effects and cost before paying) ----------
  UI.ceoUpCard = (g) => {
    const e = g.ceo; if (!e) return '';
    const pb = V.ceoTrainPreview(g, 'basic'), pa = V.ceoTrainPreview(g, 'advanced'), rp = V.ceoRaisePreview(g);
    const row = (lvl, p) => `<div class="ev"><div class="row sp"><b>${lvl === 'advanced' ? '🎓 Advanced coaching' : '📘 Coaching'}</b><span>${m(p.cost)}</span></div>
      <div class="small">⭐ skill +${p.lo} to +${p.hi} · 🎯 good calls ${U.pct(p.now)} → <b>${U.pct(p.after)}</b> · ✅ keeps working</div>
      <div class="btns">${UI.btn(`${lvl === 'advanced' ? '🎓' : '📘'} Coach ${m(p.cost)}`, 'ceoDo', lvl, 'sm', g.cash < p.cost)}</div></div>`;
    return `<div class="card" id="ceoUp"><h4 style="margin:0">⬆️ Make your CEO better</h4>${row('basic', pb)}${row('advanced', pa)}
      <div class="ev"><div class="small">💵 Raise: ${m(e.wage)} → <b>${m(rp.to)}</b>/mo (+${m(rp.add)}) · 🚪 quit risk ${U.pct(rp.quitNow, 1)} → ${U.pct(rp.quitAfter, 1)}/mo</div>
      <div class="small">🎁 Bonus ${m(e.wage * 0.5)} once: morale ${Math.round(e.morale)} → ${Math.min(100, Math.round(e.morale + C.staff.bonusMorale))}</div>
      <div class="btns">${UI.btn(`💵 Raise (+${m(rp.add)}/mo)`, 'ceoDo', 'raise', 'sm')}${UI.btn(`🎁 Bonus ${m(e.wage * 0.5)}`, 'ceoDo', 'bonus', 'sm')}</div></div></div>`;
  };
  UI.A.ceoDo = (k) => {
    const g = TG.G; let r;
    if (k === 'raise') { r = V.ceoRaise(g); UI.toast(r.spam ? 'Another raise this month backfired (morale down).' : `Raise: ${m(r.from)} → ${m(r.to)}/mo.`, !!r.spam); }
    else if (k === 'bonus') { r = V.ceoBonus(g); UI.toast(r.spam ? 'Too many bonuses this month (morale down).' : `Bonus paid. Morale now ${Math.round(r.morale)}.`, !!r.spam); }
    else { r = V.ceoTrain(g, k); UI.toast(!r.ok ? r.msg : r.spam ? 'Too much coaching this month: burned out.' : `CEO skill ${r.from} → ${r.to}.`, !r.ok || !!r.spam); }
    UI.refresh();
  };

  // ---------- business managers: what training does to their calls ----------
  const tc0 = UI.trainCard;
  UI.trainCard = (g, b, e) => {
    const o = tc0(g, b, e); if (!C.specialists[e.role]) return o;
    const a = V.mgrTrainEffect(g, b, e, 'basic'), z = V.mgrTrainEffect(g, b, e, 'advanced');
    return `<div class="ev info" id="mgrTrainFx">🎯 Right calls on decisions: <b>${U.pct(a.now)}</b> now → about <b>${U.pct(a.after)}</b> after 📘 basic, <b>${U.pct(z.after)}</b> after 🎓 advanced. ✅ Keeps working while training.</div>` + o;
  };

  // ---------- Staff tab: GM job-offer setting + CEO keeps managers hired ----------
  UI.mgrSettings = (g, b) => {
    const P = C.v12.poachPol; const pol = V.poachPol(b); const h = TG.D.handler(g, b, 'poach');
    let o = `<div class="card" id="poachCard"><h3 style="margin-top:0">🎯 When a worker gets a job offer ${UI.tipBtn('pp' + b.id)}</h3>${UI.tipLine('pp' + b.id, 'Other companies try to hire your workers away. Pick what your manager does. Manager job offers always come to you.')}
      <div class="small">${h ? `👔 Handled by <b>${esc(h.label)}</b>${pol === 'ask' ? '' : ' right away: the month skip keeps going'}` : '<span class="warn">No GM, HR manager or CEO: offers come to you as cards.</span>'}</div>
      <select id="poachSel" data-change="poachPol">${Object.entries(P).map(([k, x]) => `<option value="${k}"${k === pol ? ' selected' : ''}>${x.ic} ${esc(x.label)}</option>`).join('')}</select>
      <div class="small mute" id="poachTxt">${esc(P[pol].txt)}</div></div>`;
    const roles = Object.keys(C.specialists); const keep = b.keep || {};
    o += `<div class="card" id="keepCard"><h3 style="margin-top:0">👑 CEO keeps these managers hired ${UI.tipBtn('kp' + b.id)}</h3>${UI.tipLine('kp' + b.id, 'When a chosen spot is empty, your CEO hires the best candidate you can afford (needs 3 months of their pay in cash). Their skill sets how good the pick is.')}
      <div class="small">${g.ceo ? `👑 CEO <b>${esc(g.ceo.name)}</b> checks every month.` : '<span class="warn">Needs a CEO (More → Managers). Until then nobody hires managers for you.</span>'}</div>
      <div class="row" style="flex-wrap:wrap;gap:4px">${roles.map((r) => UI.btn(`${keep[r] ? '✅' : '⬜'} ${C.specialists[r].icon || ''} ${esc(C.specialists[r].label)}${b.spec && b.spec[r] ? ' 👤' : ''}`, 'keepRole', r, 'xs' + (keep[r] ? ' goodb' : ''))).join('')}</div>
      <div class="small mute">👤 = hired now. Pay is shown on each candidate before the CEO hires.</div></div>`;
    return o;
  };
  UI.A.poachPol = (v) => { const b = TG.B.get(TG.G, UI.bizId); b.poachPol = v; UI.toast(`${C.v12.poachPol[v].ic} ${C.v12.poachPol[v].label}`); UI.refresh(); };
  UI.A.keepRole = (r) => { const b = TG.B.get(TG.G, UI.bizId); b.keep = b.keep || {}; b.keep[r] = !b.keep[r]; UI.refresh(); };

  // ---------- who orders supplies (Now tab) ----------
  const auto0 = UI.autoBtn;
  UI.autoBtn = (g, b, st) => {
    const o = V.orderer(g, b); const last = st.lastBy ? ` · last order: aimed for about ${Math.round(st.need || 0).toLocaleString()} on hand, bought ${Math.round(st.inM || 0).toLocaleString()}` : '';
    const line = o.who === 'mgr' ? `🤖 Ordering supplies: <b>${esc(o.h.label)}</b>${last}` : o.who === 'off' ? `⏸️ <b>You</b> order supplies (🤖 Auto is off; ${esc(o.h.label)} could do it)` : '🙋 <b>You</b> order supplies (no GM, Ops manager or CEO)';
    return `<div class="small" id="supWho">${line}</div>` + auto0(g, b, st);
  };

  // ---------- help pages ----------
  UI.bizHelp = (g, k) => {
    const d = C.businesses[k]; const H = C.v12.help[k] || {}; const li = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join('');
    return `<div class="card" id="bizHelp"><h3 style="margin-top:0">${d.icon} ${esc(d.name)}</h3>
      <div class="ev good">💰 <b>How it makes money:</b> ${esc(H.money || d.blurb || '')}</div>
      <h4>💸 Main costs</h4><ul class="plain small">${li(H.costs)}</ul>
      <h4>⚠️ Main risks</h4><ul class="plain small">${li(H.risks)}</ul>
      <h4>👔 Managers that matter here</h4><ul class="plain small">${li(H.mgrs)}</ul>
      <h4>⬆️ Best first upgrades</h4><ul class="plain small">${li(H.ups)}</ul>
      <h4>🚀 Getting started</h4><ol class="small">${li(H.start)}</ol>
      <div class="small mute">💵 Setup about ${m(d.setupCost * g.world.priceIdx)} · Nothing is guaranteed: every month is rolled from odds.</div></div>`;
  };

  // ---------- v12 update note (once) ----------
  const showNotes = () => {
    const g = TG.G; if (!g || !g.v12notes || !g.v12notes.length || document.getElementById('modal')) return;
    const notes = g.v12notes; g.v12notes = null; UI.save();
    UI.modal('🆕 Game updated (v12)', `<div class="card">${notes.map((n) => `<div class="ev info">${esc(n)}</div>`).join('')}<div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const r0 = UI.render; UI.render = () => { r0(); try { showNotes(); } catch (e) { console.error(e); } };
})();
