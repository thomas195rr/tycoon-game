/* ui-v15.js - street boss upgrades, crime buy confirm, clean-the-profit, update note. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI, U = TG.U; const esc = UI.esc; const m = (x) => U.money(x);
  const V = () => TG.V15;

  const boss0 = UI.crimeBossCard;
  UI.crimeBossCard = (g, c) => {
    const html = boss0 ? boss0(g, c) : '';
    const e = c.mgr && c.mgr.boss; if (!e) return html;
    const pb = V().bossTrainPreview(g, 'basic'), pa = V().bossTrainPreview(g, 'advanced'), rp = V().bossRaisePreview(g);
    const bonus = Math.round(e.wage * 0.5);
    const extra = `<div class="ev" id="bossUp"><b>⬆️ Train and pay</b> <span class="mute">(street cash)</span>
      <div class="small">📘 Training ${m(pb.cost)}: skill +${pb.lo} to +${pb.hi}. Orders about ${Math.round(pb.now * 100)}% → <b>${Math.round(pb.after * 100)}%</b> of what clients want. Sloppy orders ${Math.round(pb.wasteNow * 100)}% → ${Math.round(pb.wasteAfter * 100)}%.</div>
      <div class="small">🎓 Advanced ${m(pa.cost)}: orders about ${Math.round(pa.now * 100)}% → <b>${Math.round(pa.after * 100)}%</b>.</div>
      <div class="small">💵 Raise: ${m(e.wage)} → <b>${m(rp.to)}</b>/mo. 🎁 Bonus ${m(bonus)}: morale up.</div>
      <div class="btns">${UI.btn(`📘 Train ${m(pb.cost)}`, 'bossDo', 'basic', 'sm')}${UI.btn(`🎓 Advanced ${m(pa.cost)}`, 'bossDo', 'advanced', 'sm')}${UI.btn(`💵 Raise`, 'bossDo', 'raise', 'sm')}${UI.btn(`🎁 Bonus ${m(bonus)}`, 'bossDo', 'bonus', 'sm')}</div></div>`;
    return html.replace(/<\/div>\s*$/, extra + '</div>');
  };
  UI.A.bossDo = (k) => {
    const g = TG.G; let r;
    if (k === 'raise') r = V().bossRaise(g);
    else if (k === 'bonus') r = V().bossBonus(g);
    else r = V().bossTrain(g, k);
    UI.toast(!r || r.ok === false ? (r && r.msg) || 'Could not.' : r.spam ? 'Too much this month: it backfired.' : (k === 'raise' ? `Pay ${m(r.from)} → ${m(r.to)}.` : k === 'bonus' ? 'Bonus paid from street cash.' : `Skill ${r.from} → ${r.to}.`), !r || r.ok === false || !!r.spam);
    UI.refresh();
  };

  // buy goods: show price each and the total, then confirm
  UI.A.crBuy = (p) => {
    const g = TG.G, c = TG.CR.ensure(g), s = UI.S.cr || { sup: 'plug' };
    const q = Math.max(0, Math.floor(UI.num('crQ' + p, 0)));
    const each = TG.CR.wholesale(g, p) * TG.CONFIG.crime.suppliers[s.sup].mult;
    const room = Math.max(0, TG.CR.room(g) - TG.CR.units(g));
    const n = Math.min(q, room, TG.CONFIG.crime.suppliers[s.sup].maxOrder);
    const total = Math.round(n * each);
    if (!(n > 0)) return UI.toast('Type how many to buy.', true);
    UI.modal('Buy ' + TG.CONFIG.crime.products[p].label, `<div class="card" id="crBuyBox"><div class="big">${m(each)} each</div>
      <div class="small">${n.toLocaleString()} × ${m(each)}</div>
      <div class="big">Total ${m(total)}</div>
      <div class="mute">Street cash ${m(c.dirty)}. Room for ${room.toLocaleString()}.</div>
      <div class="btns">${UI.btn('Confirm', 'crBuyGo', p + '|' + n, 'pri')}${UI.btn('Cancel', 'closeModal')}</div></div>`);
  };
  UI.A.crBuyGo = (arg) => {
    const [p, n] = String(arg).split('|'); const s = UI.S.cr || { sup: 'plug' };
    const r = TG.CR.buy(TG.G, s.sup, p, Number(n));
    UI.closeModal();
    if (r && r.ok === false) UI.toast(r.msg || 'Not possible.', true);
    else UI.toast(r.out === 'ok' ? `Got ${Math.round(r.got).toLocaleString()} for ${m(r.cost)}` : r.out === 'short' ? `Short order: got ${Math.round(r.got).toLocaleString()} for ${m(r.cost)}` : r.out === 'sting' ? 'It was a police sting!' : 'They never showed.', r.out === 'sting' || r.out === 'none');
    UI.refresh();
  };
  UI.A.crQty = (v, el) => {
    const p = el && el.dataset ? el.dataset.arg : ''; if (!p) return;
    const s = UI.S.cr || { sup: 'plug' }; const each = TG.CR.wholesale(TG.G, p) * TG.CONFIG.crime.suppliers[s.sup].mult;
    const n = Math.max(0, Math.floor(Number(v) || 0));
    const line = document.getElementById('crTot' + p); if (line) line.textContent = `${m(each)} each · ${n.toLocaleString()} × ${m(each)} = ${m(Math.round(n * each))}`;
  };
  UI.A.crCleanProfit = () => {
    const g = TG.G, c = TG.CR.ensure(g);
    const profit = Math.max(0, Math.round((c.last && c.last.rev) || 0) - (c.last && c.last.spent || 0));
    const keep = Math.round(profit * (1 - TG.CONFIG.crime.launderFee));
    c.launder = profit;
    UI.toast(profit ? `Will clean ${m(profit)} (you keep about ${m(keep)} after the fee).` : 'No sales profit to clean yet.');
    UI.refresh();
  };

  const showNotes = () => {
    const g = TG.G; if (!g || g.v14notes || g.v13notes || !g.v15notes || !g.v15notes.length || document.getElementById('modal')) return;
    const notes = g.v15notes; g.v15notes = null; UI.save();
    UI.modal('🆕 Game updated (v15)', `<div class="card">${notes.map((n) => `<div class="ev info">${esc(n)}</div>`).join('')}<div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const r0 = UI.render; UI.render = () => { r0(); try { showNotes(); } catch (e) { console.error(e); } };
})();
