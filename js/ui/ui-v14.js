/* ui-v14.js - gear quantity confirm, save slots, people/crime notes, compact folds, update note. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI, U = TG.U; const esc = UI.esc; const m = (x) => U.money(x);
  UI.fold = (id, title, html) => `<details class="fold" id="${esc(id)}"><summary>${title}</summary>${html || ''}</details>`;

  // ---------- gear: quality is already picked; Buy asks how many and shows each × total ----------
  UI.A.eqBuy = (type) => {
    const g = TG.G, b = TG.B.get(g, UI.bizId); if (!b) return;
    const tier = UI.S.eqTier || 'standard'; const lease = !!UI.S.eqLease && tier !== 'used';
    const ed = TG.E.def(b, type); if (!ed) return;
    const room = Math.max(0, TG.E.maxCount(b, type) - TG.E.count(b, type));
    if (room <= 0) return UI.toast('No room for more of these.', true);
    const each = lease ? Math.round(TG.E.price(g, b, type, tier) * TG.CONFIG.equipment.leaseMonthlyPct) : TG.E.price(g, b, type, tier);
    const cap = Math.min(room, 500);
    UI.S.eqEach = each; UI.S.eqCap = cap; UI.S.eqType = type; UI.S.eqLease = lease; UI.S.eqTier = tier;
    const t = TG.CONFIG.equipTiers[tier];
    UI.modal(`Buy ${ed.label}`, `<div class="card" id="gearConfirm"><h3 style="margin-top:0">${esc(ed.label)}</h3>
      <div class="small">Quality: <b>${esc(t.label)}</b> · ${lease ? 'leased' : 'buy'} · output ×${t.out} · breaks ×${t.brk}</div>
      <div class="big" id="eqEach">${m(each)} each${lease ? ' / month' : ''}</div>
      <div class="row" style="margin-top:8px">
        ${UI.btn('−10', 'eqN', '-10', 'sm')}${UI.btn('−1', 'eqN', '-1', 'sm')}
        <input type="number" id="eqN" min="1" max="${cap}" value="1" data-input="eqTot" data-change="eqTot">
        ${UI.btn('+1', 'eqN', '1', 'sm')}${UI.btn('+10', 'eqN', '10', 'sm')}${UI.btn('+100', 'eqN', '100', 'sm')}
      </div>
      <div class="small" id="eqMath">1 × ${m(each)}</div>
      <div class="big" id="eqTotal">Total ${m(each)}</div>
      <div class="mute">You can buy up to ${cap.toLocaleString()} (room left${cap >= 500 ? ', 500 at a time' : ''}). Cash ${m(g.cash)}.</div>
      <div class="btns">${UI.btn('Confirm', 'eqBuyGo', type, 'pri')}${UI.btn('Cancel', 'closeModal')}</div></div>`);
  };
  const qty = () => { const cap = UI.S.eqCap || 1; let n = Math.floor(UI.num('eqN', 1)); if (!(n > 0)) n = 1; n = Math.max(1, Math.min(cap, n)); const el = document.getElementById('eqN'); if (el && String(el.value) !== String(n)) el.value = n; return n; };
  UI.A.eqN = (d) => { const el = document.getElementById('eqN'); if (!el) return; el.value = (parseInt(el.value, 10) || 1) + Number(d); UI.A.eqTot(); };
  UI.A.eqTot = () => {
    const n = qty(); const each = UI.S.eqEach || 0; const tot = n * each;
    const math = document.getElementById('eqMath'); const total = document.getElementById('eqTotal');
    if (math) math.textContent = `${n.toLocaleString()} × ${m(each)}`;
    if (total) { total.textContent = 'Total ' + m(tot); total.className = 'big' + (tot > TG.G.cash ? ' bad' : ''); }
  };
  UI.A.eqBuyGo = (type) => {
    const g = TG.G, b = TG.B.get(g, UI.bizId); if (!b) return;
    const n = qty(); const tier = UI.S.eqTier || 'standard'; const lease = !!UI.S.eqLease && tier !== 'used';
    const each = lease ? Math.round(TG.E.price(g, b, type, tier) * TG.CONFIG.equipment.leaseMonthlyPct) : TG.E.price(g, b, type, tier);
    if (n * each > g.cash + 0.5) return UI.toast(`Total is ${m(n * each)}. You have ${m(g.cash)}.`, true);
    let got = 0;
    for (let i = 0; i < n; i++) { const it = TG.E.buy(g, b, type, tier, lease ? { leased: true } : null); if (!it) break; got++; }
    UI.closeModal();
    UI.toast(got ? `${lease ? 'Leased' : 'Bought'} ${got} × ${TG.E.def(b, type).label} · ${m(each)} each · total ${m(got * each)}.` : 'Could not buy any.', !got);
    UI.refresh();
  };

  // ---------- crime street boss card (on the crew tab) ----------
  UI.crimeBossCard = (g, c) => {
    const boss = c.mgr && c.mgr.boss; const W = TG.CONFIG.v14.crimeMgr.boss;
    let o = `<div class="card" id="bossCard"><h3>🕶️ Street boss ${UI.tipBtn('bossTip')}</h3>${UI.tipLine('bossTip', 'Like a manager for the street business. Buys the product clients want and hires replacements for crew who leave. Nothing is ordered for you without one. Pay comes out of street cash. Skill changes how close the order is.')}`;
    if (boss) {
      const fx = TG.V14.bossFx(boss);
      o += `<div class="small">👤 <b>${esc(boss.name)}</b> · skill ${Math.round(boss.skill)} · ${m(boss.wage)}/mo · orders about ${Math.round(fx.order * 100)}% of demand${fx.hire ? ' · replaces crew' : ''}</div>`;
      o += `<div class="btns">${UI.btn('Let them go', 'crBossFire', null, 'sm badb')}</div>`;
    } else {
      o += `<div class="small warn">No street boss: you buy product and hire crew yourself.</div>`;
      for (const k of TG.CR.bossPool(g)) {
        const fx = TG.V14.bossPreview(g, k);
        o += `<div class="ev"><div class="row sp"><b>${W.icon} ${esc(k.name)}</b><span>${m(k.wage)}/mo</span></div>
          <div class="small">Skill ${k.skill}: orders about <b>${Math.round(fx.order * 100)}%</b> of what clients want (${Math.round(fx.waste * 100)}% chance of a sloppy order). ${fx.hire ? 'Replaces crew who leave.' : 'Too green to replace crew.'}</div>
          <div class="btns">${UI.btn(`Hire ${m(k.wage)}`, 'crBossHire', k.id, 'sm pri')}</div></div>`;
      }
    }
    return o + '</div>';
  };
  UI.A.crBossHire = (id) => { const r = TG.CR.hireBoss(TG.G, id); UI.toast(r.ok ? 'Street boss hired. They start next month.' : (r.msg || 'Could not hire.'), !r.ok); UI.refresh(); };
  UI.A.crBossFire = () => { TG.CR.fireBoss(TG.G); UI.toast('Street boss let go.'); UI.refresh(); };

  // ---------- save slots ----------
  UI.slotCard = () => {
    const S = TG.Game.slots; const idx = S.ensure(); const g = TG.G;
    let o = `<div class="card" id="slotCard"><h3 style="margin-top:0">💾 Games</h3><div class="mute">Each slot is its own game. Your old save is in slot 1. Autosave writes the game you have open.</div>`;
    for (const s of idx.slots) {
      const on = s.id === idx.active;
      o += `<div class="ev ${on ? 'good' : ''}"><div class="row sp"><b>${on ? '▶️ ' : ''}${esc(s.name || 'Game')}</b><span class="small">${m(s.cash || 0)} · mo ${s.month || 0}</span></div>
        <div class="btns">${on ? '' : UI.btn('Load', 'slotLoad', s.id, 'sm pri')}${UI.btn('Rename', 'slotRename', s.id, 'sm')}${UI.btn('Delete', 'slotDel', s.id, 'sm badb')}</div></div>`;
    }
    if (!idx.slots.length) o += `<div class="mute">No saved games yet. Starting a game saves it here.</div>`;
    o += `<div class="btns">${UI.btn('➕ New game in a new slot', 'slotNew', null, 'sm pri')}</div></div>`;
    void g;
    return o;
  };
  UI.A.slotLoad = (id) => {
    if (!TG.Game.slots.activate(id)) return UI.toast('That game is gone.', true);
    const g = TG.Game.load(); if (!g) return UI.toast('Could not load that game.', true);
    TG.G = g; UI.toast('Loaded ' + ((TG.Game.slots.ensure().slots.find((s) => s.id === id) || {}).name || 'game') + '.'); UI.go('home');
  };
  UI.A.slotRename = (id) => {
    const s = TG.Game.slots.ensure().slots.find((x) => x.id === id); if (!s) return;
    UI.modal('Rename game', `<div class="card"><input type="text" id="slotName" value="${esc(s.name || '')}" maxlength="32"><div class="btns">${UI.btn('Save name', 'slotRenameGo', id, 'pri')}${UI.btn('Cancel', 'closeModal')}</div></div>`);
  };
  UI.A.slotRenameGo = (id) => { const name = (UI.val('slotName') || '').trim(); if (!name) return UI.toast('Type a name.', true); TG.Game.slots.rename(id, name); UI.closeModal(); UI.toast('Renamed.'); UI.refresh(); };
  UI.A.slotDel = (id) => { const s = TG.Game.slots.ensure().slots.find((x) => x.id === id); UI.confirm(`Delete “${s ? s.name : 'this game'}”? This cannot be undone.`, 'slotDelGo', id); };
  UI.A.slotDelGo = (id) => {
    const was = TG.Game.slots.active() === id; TG.Game.slots.remove(id); UI.closeModal();
    if (was) { const g = TG.Game.load(); if (g) { TG.G = g; UI.toast('Deleted. Opened your other game.'); UI.go('home'); } else { TG.G = null; UI.toast('Deleted.'); UI.newGameScreen(true); } }
    else { UI.toast('Deleted.'); UI.refresh(); }
  };
  UI.A.slotNew = () => { UI.S.slotNew = true; UI.newGameScreen(false); };
  const set0 = UI.screens.more;
  UI.screens.more = () => set0().replace('<div class="card"><h3 style="margin-top:0">Save</h3>', UI.slotCard() + '<div class="card"><h3 style="margin-top:0">Save</h3>');

  // new game from the dialog already lands in the slot slotNew created; the first-run button still uses one slot
  const ng0 = UI.A.newGame;
  UI.A.newGame = (scenario) => {
    if (UI.S.slotNew || !TG.Game.slots.active()) { TG.Game.slots.create((UI.val('ngName') || 'New game').slice(0, 32)); UI.S.slotNew = false; }
    return ng0(scenario);
  };

  // ---------- home: keep the top glance, fold the long news-style bits by enlarging tiles (css) ----------
  // market listings stay; a one-line hint is enough

  // ---------- update note ----------
  const showNotes = () => {
    const g = TG.G; if (!g || g.v13notes || g.v12notes || !g.v14notes || !g.v14notes.length || document.getElementById('modal')) return;
    const notes = g.v14notes; g.v14notes = null; UI.save();
    UI.modal('🆕 Game updated (v14)', `<div class="card">${notes.map((n) => `<div class="ev info">${esc(n)}</div>`).join('')}<div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const r0 = UI.render; UI.render = () => { r0(); try { showNotes(); } catch (e) { console.error(e); } };
})();
