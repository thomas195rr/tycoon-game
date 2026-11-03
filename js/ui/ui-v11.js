/* ui-v11.js - v11 screens: personal lawyer (Money > Finance), property-manager training/raises/bonus,
   real-estate rows that open on tap, the v11 update note. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI, U = TG.U; const V = TG.V11;
  const m = (x) => U.money(x); const esc = UI.esc || ((s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

  // ---------- remember which property rows are open ----------
  UI.S.reOpen = UI.S.reOpen || {};
  document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.matches && d.matches('details.rerow')) { UI.S.reOpen[d.dataset.reid] = d.open; const s = d.querySelector('summary span:last-child'); if (s) s.innerHTML = s.innerHTML.replace(/[▸▾]$/, d.open ? '▾' : '▸'); } }, true);

  // ---------- 👔 personal lawyer ----------
  const perkRows = (g, e) => { const p = V.lawyerPerks(g, e); return `<ul class="fx"><li>🏦 Loan approval odds: better (about +${Math.round(p.z * 10)} points on a 50/50 application)</li><li>📉 Loan interest: −${U.pct(p.rateCut, 1)} a year on new loans</li><li>🏘️ Real-estate injury claims: ${U.pct(p.stop)} get dropped, the rest are ${U.pct(p.cut)} smaller, +${U.pct(p.win)} to win in court</li><li>🚫 Does not handle debts or collections</li></ul>`; };
  UI.lawyerCard = (g) => {
    const e = g.player.lawyer;
    if (e) return `<div class="card"><h3 style="margin-top:0">👔 Your personal lawyer ${UI.tipBtn('plaw')}</h3>${UI.tipLine('plaw', 'Works for YOU, not a business. Paid from your cash every month. Better skill = bigger perks.')}
      <div class="row sp"><b>${esc(e.name)}</b><span>⭐ skill ${Math.round(e.skill)} · 💵 ${m(e.wage)}/mo</span></div>${perkRows(g, e)}<div class="btns">${UI.btn('Let go', 'plawFire', null, 'sm')}</div></div>`;
    return `<div class="card"><h3 style="margin-top:0">👔 Personal lawyer</h3><div class="mute">A lawyer on your own payroll: better loan odds, lower loan rates, and handles injury claims at your rentals. Not for debts.</div><div class="btns">${UI.btn('See lawyers…', 'plaw', null, 'sm')}</div></div>`;
  };
  UI.A.plaw = () => {
    const g = TG.G; const pool = V.lawyerPool(g);
    UI.modal('👔 Hire a personal lawyer', pool.map((c) => `<div class="card"><div class="row sp"><b>${esc(c.name)}</b><span>💵 <b>${m(c.wage)}/mo</b> (${m(c.wage * 12)} a year)</span></div><div class="small">⭐ skill ~${Math.round(c.skill)} · ${c.years || 0} yrs experience</div>${perkRows(g, c)}<div class="btns">${UI.btn(`Hire (${m(c.wage)}/mo)`, 'plawGo', c.id, 'sm pri')}</div></div>`).join('') + '<div class="mute">Wages come out of your cash every month, even in months you do not borrow or get sued.</div>');
  };
  UI.A.plawGo = (id) => { const r = V.hireLawyer(TG.G, id); UI.closeModal(); UI.toast(r.ok ? 'Lawyer hired.' : 'Not available.', !r.ok); UI.refresh(); };
  UI.A.plawFire = () => { V.fireLawyer(TG.G); UI.toast('Lawyer let go.'); UI.refresh(); };

  // ---------- 🧑‍💼 property manager: train / raise / bonus ----------
  const mgr0 = UI.reMgrCard;
  UI.reMgrCard = (g) => {
    const base = mgr0(g); const e = g.re.manager; if (!e) return base;
    const pb = V.remTrainPreview(g, 'basic'), pa = V.remTrainPreview(g, 'advanced'); const fx = V.remEffects(g, e);
    const raiseTo = Math.round(e.wage * (1 + TG.CONFIG.staff.raisePct) / 10) * 10; const qp = V.remQuitP(e);
    return base + `<div class="ev"><b>🧑‍💼 ${esc(e.name)}</b> · ⭐ skill ${Math.round(e.skill)} · 😊 morale ${Math.round(e.morale || 0)} · 🤝 loyalty ${Math.round(e.loyalty || 0)} · 💵 ${m(e.wage)}/mo
      <div class="small">Now: repairs & searches cost ×${fx.costMult.toFixed(2)} · tenant quality ${fx.quality >= 0 ? '+' : ''}${Math.round(fx.quality * 100)} pts · quits ${U.pct(qp, 1)}/mo</div>
      <div class="small">🎓 Training: skill +${pb.lo}-${pb.hi} for ${m(pb.cost)} → costs ×${pb.after.costMult.toFixed(2)}, tenants ${pb.after.quality >= 0 ? '+' : ''}${Math.round(pb.after.quality * 100)} · advanced +${pa.lo}-${pa.hi} for ${m(pa.cost)} → ×${pa.after.costMult.toFixed(2)}</div>
      <div class="small">💵 Raise to ${m(raiseTo)}/mo: morale +${TG.CONFIG.staff.raiseMorale}, loyalty +5 · 🎁 Bonus ${m(e.wage * 0.5)}: morale +${TG.CONFIG.staff.bonusMorale}, loyalty +10 (quits less)</div>
      <div class="btns">${UI.btn(`🎓 Train (${m(pb.cost)})`, 'remDo', 'basic', 'sm', g.cash < pb.cost)}${UI.btn(`🎓 Advanced (${m(pa.cost)})`, 'remDo', 'advanced', 'sm', g.cash < pa.cost)}${UI.btn(`💵 Raise (+${m(raiseTo - e.wage)}/mo)`, 'remDo', 'raise', 'sm')}${UI.btn(`🎁 Bonus (${m(e.wage * 0.5)})`, 'remDo', 'bonus', 'sm')}</div></div>`;
  };
  UI.A.remDo = (k) => {
    const g = TG.G; let r;
    if (k === 'raise') { r = V.remRaise(g); UI.toast(r.spam ? 'Another raise this month felt like a broken promise (morale down).' : `Raise: ${m(r.from)} → ${m(r.to)}/mo.`, !!r.spam); }
    else if (k === 'bonus') { r = V.remBonus(g); UI.toast(r.spam ? 'Too many bonuses this month (morale down).' : `Bonus paid. Morale now ${Math.round(r.morale)}.`, !!r.spam); }
    else { r = V.remTrain(g, k); UI.toast(!r.ok ? r.msg : r.spam ? 'Too much training this month: burned out.' : `Skill ${r.from} → ${r.to}.`, !r.ok || !!r.spam); }
    UI.refresh();
  };

  // ---------- v11 update note (once) ----------
  const showNotes = () => {
    const g = TG.G; if (!g || !g.v11notes || !g.v11notes.length || document.getElementById('modal')) return;
    const notes = g.v11notes; g.v11notes = null; UI.save();
    UI.modal('🆕 Game updated (v11)', `<div class="card">${notes.map((n) => `<div class="ev info">${esc(n)}</div>`).join('')}<div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const r0 = UI.render; UI.render = () => { r0(); try { showNotes(); } catch (e) { console.error(e); } };
})();
