/* ui-v8.js - v8 player-feedback fixes: Help chip, skip "stop on trouble" toggle, supplies warning before Next Month,
   full Quick setup cost preview, phone Back button, two-tab save guard, whole-number skip box. */
(function () {
  const TG = globalThis.TG; const U = TG.U; const UI = TG.UI; const esc = UI.esc, m = UI.m;
  const N = (x) => Math.round(x || 0).toLocaleString();

  // ================= ❓ HELP CHIP + ECONOMY INFO + STALE-TAB BANNER =================
  const header0 = UI.header;
  UI.header = () => {
    let h = header0();
    h = h.replace('</header>', '<span class="chip help" data-act="help" data-nosave="1">❓ Help</span></header>');
    if (TG.Game.stale) h = `<div class="stale">⚠️ This game was played in another tab or window. This copy is out of date, so nothing here is saved. ${UI.btn('🔄 Reload to continue', 'reloadTab', null, 'sm pri')}</div>` + h;
    return h;
  };
  UI.A.help = () => { UI.closeModal(); UI.tab.more = 'help'; UI.tab.helpb = 'how'; UI.go('more'); };
  UI.A.econInfo = () => { const g = TG.G; UI.toast(`Economy: ${TG.W.phaseLabel(g)}. ☀️ boom = more customers, 🌧️ recession = fewer; ⛅ in between. Interest rates follow it.`); };
  UI.A.reloadTab = () => { location.reload(); };
  TG.Game.onStale = () => { if (TG.G) UI.render(); UI.toast('This game was played in another tab: reload to continue.', true); };
  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
    if (e.key !== 'tycoon_save_meta' || !e.newValue) return;
    try { const mt = JSON.parse(e.newValue); if (mt && mt.tab !== TG.Game.TAB && TG.G) { TG.Game.stale = true; UI.render(); } } catch (err) { /* ignore */ }
  });
  // saving from a stale tab is refused by the engine; also keep the 💾 chip honest
  const save0 = UI.save;
  UI.save = () => { if (TG.Game.stale) return false; return save0(); };

  // ================= ⏩ SKIP: stop-on-trouble toggle next to the button + whole numbers only =================
  const footer0 = UI.footer;
  UI.footer = () => {
    const g = TG.G; const on = g && g.settings.stopOnMajor;
    return footer0().replace('</div></footer>', `</div><div class="stopRow">🛑 Skip stops early on trouble: ${UI.btn(on ? 'On' : 'Off', 'stopToggle', null, 'xs' + (on ? ' goodb' : ''))}<span class="wide">${on ? '(shop closed, cash below zero, collections, arrests)' : '(skips run to the end no matter what)'}</span></div></footer>`);
  };
  UI.A.stopToggle = () => { const s = TG.G.settings; s.stopOnMajor = !s.stopOnMajor; if (s.stopOnMajor) Object.assign(s.majorTypes, { closed: true, cash: true, crime: true }); UI.toast(s.stopOnMajor ? 'A skip now stops early when a shop closes, cash goes below zero, bills go to collections or you are arrested.' : 'Skips now run to the end, even through trouble.'); UI.refresh(); };
  const skip0 = UI.A.skip;
  UI.A.skip = () => {
    const el = document.getElementById('skipN'); const raw = el ? String(el.value).trim() : '';
    const n = UI.num('skipN', NaN);
    if (raw !== '' && (!Number.isFinite(n) || n !== Math.floor(n))) return UI.toast('Type a whole number of months, like 12.', true);
    const g = TG.G;
    if (n >= 2 && g.settings.warnSupplies !== false && UI.S.skipOK !== g.month) {
      const W = UI.supplyWarnings(g); const noMgr = g.businesses.filter((b) => TG.ST.def(b) && !TG.D.handler(g, b, 'stock') && !W.some((w) => w.b === b));
      const reEmpty = g.re && !g.re.manager ? U.sum(g.re.holdings.filter((h) => h.mode === 'rent'), (h) => TG.RE.vacant(h)) : 0;
      if (W.length || noMgr.length || reEmpty) {
        UI.modal('⏩ Before you skip', `<div class="card">${W.map((w) => `<div class="ev ${w.bad ? 'bad' : 'warn'}"><b>${esc(w.b.name)}</b> ${esc(w.text)}</div>`).join('')}${noMgr.map((b) => `<div class="ev warn"><b>${esc(b.name)}</b> has no manager to reorder supplies: it closes when they run out (about ${N((b.stock || {}).qty)} left).</div>`).join('')}${reEmpty ? `<div class="ev warn">🏘️ <b>${reEmpty} empty rental unit${reEmpty > 1 ? 's' : ''}</b>: with no property manager nobody looks for tenants during a skip, and repairs wait for you.</div>` : ''}
          <div class="mute">During a skip nobody buys supplies for a business without an Ops manager, GM or CEO.${g.settings.stopOnMajor ? ' The skip will stop early if a shop closes.' : ''}</div>
          <div class="btns">${W[0] || noMgr[0] ? UI.btn('🧑‍💼 Hire an Ops manager', 'hireLeadFor', (W[0] ? W[0].b : noMgr[0]).id, 'pri') : UI.btn('🧑‍💼 Property manager', 'goMoneyTab', 're', 'pri')}${UI.btn(`Skip ${n} months anyway`, 'skipAnyway', null, '')}</div></div>`);
        return;
      }
    }
    return skip0();
  };

  { const gm0 = UI.A.goMoneyTab; UI.A.goMoneyTab = (t) => { UI.closeModal(); gm0(t); }; }
  UI.A.skipAnyway = () => { UI.S.skipOK = TG.G.month; UI.closeModal(); UI.A.skip(); };
  UI.A.hireLeadFor = (id) => { UI.closeModal(); UI.bizId = id; UI.go('bizd'); UI.A.hireRole('ops'); }; /* v9: Shift lead is gone; the Ops manager orders supplies */
  // ================= 📦 WARN BEFORE NEXT MONTH IF A SHOP WILL RUN OUT =================
  UI.supplyWarnings = (g) => {
    const out = [];
    for (const b of g.businesses) {
      if (!TG.ST.def(b) || b.licensePending > 0) continue;
      const lc = UI.lc(b); const st = b.stock || {};
      const q = TG.ST.suggest(b, g);
      if (lc.closed) out.push({ b, q, bad: true, text: `will be CLOSED: no supplies (${N(st.qty)} left). Wages and rent still get paid.` });
      else if (lc.limit === 'stock' && (lc.demand || 0) > (lc.served || 0) * 1.08 && q >= 1) out.push({ b, q, bad: false, text: `will run out: enough for about ${N(lc.served)} of ${N(lc.demand)} customers.` }); // storage already full = nothing to buy: not a warning
    }
    return out;
  };
  const next0 = UI.A.next;
  UI.A.next = (force) => {
    const g = TG.G;
    if (g.settings.warnSupplies !== false && UI.S.supOK !== g.month && force !== 'sup') {
      const W = UI.supplyWarnings(g);
      if (W.length) {
        const tot = U.sum(W, (w) => (w.q > 0 ? w.q * TG.ST.unitCost(g, w.b) : 0));
        UI.modal(W.every((w) => w.dry) ? '👵 Before next month' : '📦 Supplies running low', `<div class="card">${W.map((w) => `<div class="ev ${w.bad ? 'bad' : 'warn'}"><b>${esc(w.b.name)}</b> ${esc(w.text)}${w.q > 0 ? `<div class="btns">${UI.btn(`📦 Buy ${N(w.q)} (${m(w.q * TG.ST.unitCost(g, w.b))})`, 'supFill', w.b.id, 'sm pri')}</div>` : ''}${w.dry ? `<div class="btns">${UI.btn(`💵 Sell ${N(w.dry.n)} dry cows (~${m(w.dry.meat)})`, 'cowSellDry', w.b.id, 'sm pri')}</div>` : ''}</div>`).join('')}
          <div class="mute">Nobody reorders for you unless a manager handles supplies (🤖 Auto).</div>
          <div class="btns">${W.length > 1 && tot > 0 ? UI.btn(`📦 Buy for all (${m(tot)})`, 'supFillAll', null, 'pri') : ''}${UI.btn('Play the month anyway', 'nextAnyway', null, '')}</div>
          <div class="btns">${UI.btn("Don't warn me again", 'supNoWarn', null, 'xs')}</div></div>`);
        return;
      }
    }
    return next0(force === 'sup' ? undefined : force);
  };
  UI.A.nextAnyway = () => { UI.S.supOK = TG.G.month; UI.closeModal(); UI.A.next('sup'); };
  UI.A.supNoWarn = () => { TG.G.settings.warnSupplies = false; UI.toast('OK: no more supply warnings (turn back on in More → Settings).'); UI.A.nextAnyway(); };
  const fill = (g, b) => { const q = TG.ST.suggest(b, g); return q > 0 ? TG.ST.buy(g, b, q, 0) : 0; };
  UI.A.supFill = (id) => { const g = TG.G, b = TG.B.get(g, id); if (!b) return; const c0 = g.cash; const n = fill(g, b); UI.toast(n > 0 ? `Bought ${N(n)} for ${b.name} (${m(c0 - g.cash)}).` : 'No room or not enough cash.', !(n > 0)); UI.closeModal(); UI.save(); UI.A.next(); };
  UI.A.supFillAll = () => { const g = TG.G; const c0 = g.cash; let n = 0; for (const w of UI.supplyWarnings(g)) n += fill(g, w.b); UI.toast(n > 0 ? `Bought supplies for ${m(c0 - g.cash)}.` : 'No room or not enough cash.', !(n > 0)); UI.closeModal(); UI.save(); UI.A.next(); };

  // ================= 🏁 QUICK SETUP: the full cost before you open =================
  // Dry run on a throw-away copy of the game: open + quick setup, then play 3 months twice (different luck). Nothing real changes.
  UI.startPreview = (pid, type, q, ent, name, from) => {
    const g = TG.G; const G0 = TG.G; const LB0 = TG.LB.record; const out = { ok: false };
    try {
      TG.LB.record = () => null;
      const runs = [];
      for (let k = 0; k < 2; k++) {
        const g2 = JSON.parse(JSON.stringify(g)); g2.rngState = ((g.rngState || 1) + 7919 * (k + 1)) >>> 0; TG.G = g2;
        const opts = { name: name || 'preview' }; if (ent) opts.ent = ent; if (from) { if (from.startsWith('biz:')) opts.fromBiz = from.slice(4); else opts.concept = from.slice(2); }
        const c0 = g2.cash; const r = TG.B.start(g2, type, pid, opts); if (!r || r.ok === false) { out.msg = r && r.msg; break; }
        if (q) TG.B.quickSetup(g2, r.biz, true, q);
        const today = c0 - g2.cash; const payroll = TG.S.payroll(r.biz); const after = g2.cash;
        const nets = []; for (let i = 0; i < 3; i++) { if (i > 0 && r.biz.stock) { const sq = TG.ST.suggest(r.biz, g2); if (sq > 0) TG.ST.buy(g2, r.biz, sq, 0); } TG.Game.nextMonth(g2); /* assumes you buy supplies each month */ const h = r.biz.hist[r.biz.hist.length - 1]; nets.push(h ? (h.cash != null ? h.cash : h.profit) : 0); }
        nets[0] += today; // setup spending is booked into the first month's books: count it once, as "today"
        runs.push({ today, payroll, after, nets });
      }
      if (runs.length === 2) {
        const a = runs[0], b = runs[1];
        out.ok = true; out.today = (a.today + b.today) / 2; out.payroll = (a.payroll + b.payroll) / 2; out.after = (a.after + b.after) / 2;
        out.m1 = (a.nets[0] + b.nets[0]) / 2; out.m3 = (U.sum(a.nets) + U.sum(b.nets)) / 6;
        const burn = Math.min(out.m1, out.m3); out.months = burn < 0 ? Math.max(0, out.after) / -burn : Infinity;
        out.risky = out.after < 0 || out.months < 3 || out.m1 < -Math.max(2000, g.cash * 0.25);
      }
    } catch (e) { out.err = e.message; } finally { TG.G = G0; TG.LB.record = LB0; }
    return out;
  };
  UI.startPreviewHtml = (p) => {
    if (!p.ok) return p.msg ? `<div class="ev bad"><b>You can't open this yet:</b> ${esc(p.msg)} You have ${m(TG.G.cash)}. Pick a cheaper business for this place, or sell/borrow first (💰 Money).</div>` : '<div class="mute">Could not estimate the first months.</div>';
    const row = (a, b) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`;
    return `<table>${row('💵 Cash spent today (setup, gear, staff hiring, supplies)', `<b>${m(p.today)}</b>`)}${row('💵 Cash left after opening', `<b class="${p.after < 0 ? 'bad' : ''}">${m(p.after)}</b>`)}${row('👥 Wages each month', m(p.payroll))}${row('📅 First month (estimate)', UI.signed(Math.round(p.m1)))}${row('📅 Average of first 3 months', UI.signed(Math.round(p.m3)))}${row('⏳ Cash lasts', p.months === Infinity ? 'not losing money' : p.months >= 24 ? '2+ years' : p.months < 1 ? 'less than a month' : `about ${Math.round(p.months)} month${Math.round(p.months) === 1 ? '' : 's'}`)}</table>
      ${p.risky ? `<div class="ev bad"><b>⚠️ Risky:</b> ${p.after < 0 ? 'this costs more cash than you have.' : p.months < 3 ? (p.months < 1 ? 'at this rate your cash runs out in the first month.' : `at this rate your cash runs out in about ${Math.round(p.months)} month${Math.round(p.months) === 1 ? '' : 's'}.`) : 'the first month is expected to lose a lot.'} Try ${p.q === 'standard' ? 'budget or used gear, ' : ''}${p.q ? '"No, I\'ll do it myself" (hire fewer people), ' : ''}a cheaper place, or a smaller business.</div>` : '<div class="mute">Estimates from a practice run where you buy supplies every month: real months can be better or worse.</div>'}`;
  };
  const startDialog0 = UI.startDialog;
  UI.startDialog = (pid, type) => {
    startDialog0(pid, type);
    const box = document.querySelector('#modal .box'); if (!box) return;
    const sel = document.getElementById('stQuick'); if (sel) sel.setAttribute('data-change', 'stPrev');
    const ent = document.getElementById('stEnt'); if (ent) ent.setAttribute('data-change', 'stPrev'); const fr = document.getElementById('stFrom'); if (fr) fr.setAttribute('data-change', 'stPrev');
    const go = box.querySelector('[data-act="startGo"]');
    if (go) { go.insertAdjacentHTML('beforebegin', `<div class="card prevbox" id="stPrevBox" data-pid="${esc(pid)}" data-type="${esc(type)}"></div>`); go.textContent = 'Open the business'; }
    UI.A.stPrev();
  };
  UI.A.stPrev = () => {
    const bx = document.getElementById('stPrevBox'); if (!bx) return;
    const p = UI.startPreview(bx.dataset.pid, bx.dataset.type, UI.val('stQuick'), UI.val('stEnt') || null, UI.val('stName'), UI.val('stFrom') || null);
    p.q = UI.val('stQuick'); UI.S.stPrev = p; bx.innerHTML = `<h3 style="margin-top:0">🧾 What it really costs</h3>${UI.startPreviewHtml(p)}`;
  };
  const startGo0 = UI.A.startGo;
  UI.A.startGo = (arg) => {
    const [pid, type, ok] = String(arg).split('|'); const p = UI.S.stPrev;
    if (ok !== 'y' && p && p.ok && p.risky) {
      UI.S.stPend = { name: UI.val('stName'), q: UI.val('stQuick'), ent: UI.val('stEnt'), from: UI.val('stFrom') };
      UI.modal('Are you sure?', `<div class="card"><p><b>This start looks risky.</b></p>${UI.startPreviewHtml(p)}<div class="btns">${UI.btn('Open anyway', 'startGo', `${pid}|${type}|y`, 'badb')}${UI.btn('Back', 'startBack', `${pid}|${type}`, 'pri')}</div></div>`);
      return;
    }
    const pend = ok === 'y' ? UI.S.stPend : null;
    if (pend) { // the confirm replaced the dialog: rebuild hidden inputs from what was picked
      const hold = document.createElement('div'); hold.style.display = 'none';
      hold.innerHTML = `<input id="stName"><select id="stQuick"><option value=""></option><option value="${esc(pend.q || '')}" selected></option></select>${pend.ent ? `<select id="stEnt"><option value="${esc(pend.ent)}" selected></option></select>` : ''}${pend.from ? `<select id="stFrom"><option value="${esc(pend.from)}" selected></option></select>` : ''}`;
      document.body.appendChild(hold); hold.querySelector('#stName').value = pend.name || '';
      try { startGo0(`${pid}|${type}`); } finally { hold.remove(); UI.S.stPend = null; }
      return;
    }
    startGo0(`${pid}|${type}`);
  };
  UI.A.startBack = (arg) => { const [pid, type] = String(arg).split('|'); UI.startDialog(pid, type); };

  // signing a lease / buying when you then can't afford to set the business up: ask first
  const acq0 = UI.A.acq;
  UI.A.acq = (arg) => {
    const [id, mode, ok] = String(arg).split('|'); const g = TG.G, C = TG.CONFIG; const p = g.listings.find((x) => x.id === id); const type = UI.S.mkType;
    if (p && ok !== 'y' && ok !== 'z' && C.businesses[type]) {
      const pay = mode === 'lease' ? Math.round(TG.P.leaseRent(g, p) * (1 + C.property.leaseDeposit)) : mode === 'cash' ? Math.round(p.price * (1 + C.property.buyCostPct)) : 0;
      const setup = TG.B.setupCost(g, type, p, null); const left = g.cash - pay;
      if (pay && left < setup) return UI.modal('Are you sure?', `<div class="card"><p>After this you would have <b>${m(left)}</b>, but setting up a ${esc(C.businesses[type].name.toLowerCase())} here costs about <b>${m(setup)}</b> (before gear and staff). You could not open it yet.</p><div class="btns">${UI.btn(mode === 'lease' ? 'Lease anyway' : 'Buy anyway', 'acq', `${id}|${mode}|z`, 'badb')}${UI.btn('Cancel', 'closeModal', null, 'pri')}</div></div>`);
    }
    return acq0(ok === "z" ? `${id}|${mode}|y` : arg);
  };
  // ================= ◀ PHONE / BROWSER BACK BUTTON =================
  // Every screen/tab change and popup adds a history step: Back closes the popup first, then goes to the previous screen.
  const H = typeof history !== 'undefined' && history.pushState ? history : null;
  let quiet = false; let inModal = false;
  const snap = () => ({ tg: 1, s: UI.screen, t: Object.assign({}, UI.tab), b: UI.bizId });
  const push = (st) => { if (!H) return; try { H.pushState(st, ''); } catch (e) { /* ignore */ } };
  const go0 = UI.go;
  UI.go = (screen, extra) => { const was = UI.screen; go0(screen, extra); if (was !== screen || extra) push(snap()); };
  const tab0 = UI.A.tab;
  UI.A.tab = (arg) => { tab0(arg); push(snap()); };
  const modal0 = UI.modal; const close0 = UI.closeModal;
  UI.modal = (title, html) => { const had = !!document.getElementById('modal'); inModal = true; try { modal0(title, html); } finally { inModal = false; } if (!had) push(Object.assign(snap(), { modal: 1 })); };
  UI.closeModal = () => {
    const had = document.getElementById('modal'); close0();
    if (had && !inModal && H && H.state && H.state.modal) { quiet = true; try { H.back(); } catch (e) { quiet = false; } }
  };
  if (typeof window !== 'undefined') window.addEventListener('popstate', (e) => {
    if (quiet) { quiet = false; return; }
    if (!TG.G) return;
    if (document.getElementById('modal')) { close0(); UI.render(); return; }
    const st = e.state;
    if (st && st.tg) { UI.screen = st.s || 'home'; UI.tab = Object.assign({}, st.t || {}); UI.bizId = st.b || UI.bizId; UI.render(); window.scrollTo(0, 0); }
    else if (UI.screen !== 'home') { UI.screen = 'home'; UI.render(); push(snap()); }
  });
  if (H) { try { H.scrollRestoration = 'manual'; H.replaceState(snap(), ''); } catch (e) { /* ignore */ } }

  // ================= New game: force the save (starting fresh is on purpose) =================
  const newGame0 = UI.A.newGame;
  UI.A.newGame = (scenario) => { newGame0(scenario); TG.Game.stale = false; TG.Game.save(TG.G, true); UI.render(); };
  const importGo0 = UI.A.importGo;
  if (importGo0) UI.A.importGo = () => { TG.Game.stale = false; TG.Game.markSeen && TG.Game.markSeen(); importGo0(); };
})();
