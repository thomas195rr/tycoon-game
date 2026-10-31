/* ui-core.js - rendering helpers, navigation, modal, turn controls, actions dispatch, autosave. */
(function () {
  const TG = globalThis.TG; const U = TG.U;
  const UI = (TG.UI = { screen: 'home', tab: {}, bizId: null, A: {}, S: {} });
  const $ = (s) => document.querySelector(s);
  UI.$ = $;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  UI.esc = esc;
  UI.m = (x) => U.money(x);
  UI.pct = (x, d) => U.pct(x, d);
  UI.tone = (x) => (x > 0 ? 'good' : x < 0 ? 'bad' : '');
  UI.signed = (x) => `<span class="${UI.tone(x)}">${x > 0 ? '+' : x < 0 ? '-' : ''}${U.money(Math.abs(x))}</span>`;
  UI.pill = (txt, tone) => `<span class="pill ${tone || ''}">${esc(txt)}</span>`;
  UI.risk = (p) => { const r = U.riskLabel(p); return UI.pill(`${r.label} ${U.pct(p, p < 0.1 ? 1 : 0)}`, r.tone); };
  UI.btn = (label, act, arg, cls, dis) => `<button class="btn ${cls || ''}" data-act="${act}"${arg != null ? ` data-arg="${esc(arg)}"` : ''}${dis ? ' disabled' : ''}>${label}</button>`;
  UI.bar = (v, max, invert) => { const p = U.clamp(max ? v / max : 0, 0, 1); const t = invert ? (p > 0.7 ? 'bad' : p > 0.45 ? 'warn' : '') : (p < 0.3 ? 'bad' : p < 0.55 ? 'warn' : ''); return `<div class="bar ${t}"><i style="width:${Math.round(p * 100)}%"></i></div>`; };
  UI.tabs = (key, list) => { const cur = UI.tab[key] || list[0][0]; return `<div class="tabs">${list.map(([id, lbl]) => `<button class="btn sm ${cur === id ? 'on' : ''}" data-act="tab" data-arg="${key}:${id}">${lbl}</button>`).join('')}</div>`; };
  UI.curTab = (key, def) => UI.tab[key] || def;
  UI.ev = (e) => `<div class="ev ${e.type === 'major' ? 'bad' : e.type}"><div>${e.biz ? `<b>${esc(e.biz)}:</b> ` : ''}${esc(e.text)}</div>${e.why ? `<div class="why">Why: ${esc(e.why)}</div>` : ''}</div>`;
  UI.spark = (vals, color) => {
    if (!vals || vals.length < 2) return '';
    const mn = Math.min(...vals, 0), mx = Math.max(...vals, 1); const w = 300, h = 46;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / (mx - mn || 1) * (h - 4)).toFixed(1)}`).join(' ');
    const zy = (h - 2 - (0 - mn) / (mx - mn || 1) * (h - 4)).toFixed(1);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" x2="${w}" y1="${zy}" y2="${zy}" stroke="#d1d5db" stroke-width="1"/><polyline fill="none" stroke="${color || '#15803d'}" stroke-width="2" points="${pts}"/></svg>`;
  };
  // ---- icon-first helpers ----
  UI.S.tips = UI.S.tips || {};
  // (i) button: tap to show a short line, tap again to hide it
  UI.tipBtn = (key) => `<button class="tipb" data-act="tip" data-arg="${esc(key)}" data-nosave="1" aria-label="info">i</button>`;
  /* v9: the text is always in the page (hidden until tapped) and the tap shows it in place. Before, a tap re-drew only the
     main screen, so every "i" inside a popup (worker, loan, listing...) showed nothing. */
  UI.tipLine = (key, text) => (text ? `<div class="tip" data-tip="${esc(key)}"${UI.S.tips[key] ? '' : ' style="display:none"'}>${esc(text)}</div>` : '');
  UI.A.tip = (k, el) => {
    UI.S.tips[k] = !UI.S.tips[k];
    const root = (el && el.closest && el.closest('#modal')) || document;
    const lines = [...root.querySelectorAll('.tip[data-tip]')].filter((t) => t.dataset.tip === k);
    if (lines.length) { for (const t of lines) t.style.display = UI.S.tips[k] ? '' : 'none'; return; }
    if (root !== document) { UI.toast('No more details for this one.'); return; }
    UI.refresh();
  };
  // icon row: icon, label (tap = info), value, actions
  UI.irow = (key, icon, label, value, tip, acts, sub) => `<div class="irow"><span class="ic">${icon}</span><span class="lb" data-act="tip" data-arg="${esc(key)}" data-nosave="1">${esc(label)}${sub ? `<small>${sub}</small>` : ''}</span>${tip ? UI.tipBtn(key) : ''}${value != null ? `<span class="vl">${value}</span>` : ''}${acts ? `<span class="acts">${acts}</span>` : ''}${UI.tipLine(key, tip)}</div>`;
  // big stat tile (tap = info)
  UI.tile = (key, icon, value, label, tone, tip) => `<div class="tile ${tone || ''}" data-act="tip" data-arg="${esc(key)}" data-nosave="1"><div class="ti">${icon}</div><div class="tv">${value}</div><div class="tl">${esc(label)}</div></div>${UI.S.tips[key] && tip ? `<div class="tip" style="grid-column:1/-1;margin:0">${esc(tip)}</div>` : ''}`;
  UI.dot = (c) => `<span class="dot ${c || ''}"></span>`;
  UI.fmtN = (v, u) => (u === '$' ? U.money(v) : u === '%' ? Math.round(v) + '%' : Math.round(v).toLocaleString() + (u ? (u[0] === '/' ? '' : ' ') + u : ''));
  UI.num = (id, def) => { const el = document.getElementById(id); if (!el) return def; const t = String(el.value).trim().replace(/[$,\s]/g, ''); if (t === '') return def; const v = Number(t); return Number.isFinite(v) ? v : def; }; // v8: blank = default, "1e3" = 1000 (was 13)
  UI.val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

  UI.toast = (msg, bad) => {
    const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 3600 : 2400);
  };
  UI.res = (r, okMsg) => { if (r && r.ok === false) { UI.toast(r.msg || 'Not possible.', true); return false; } if (okMsg) UI.toast(okMsg); return true; };

  // ---------- modal ----------
  UI.modal = (title, html) => {
    UI.closeModal();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
    m.innerHTML = `<div class="box"><div class="row sp"><h2 style="margin:0">${title}</h2>${UI.btn('Close', 'closeModal', null, 'sm')}</div>${html}</div>`;
    m.addEventListener('click', (e) => { if (e.target === m) UI.closeModal(); });
    document.body.appendChild(m); m.scrollTop = 0;
  };
  UI.closeModal = () => { const m = document.getElementById('modal'); if (m) m.remove(); };
  UI.A.closeModal = () => { UI.closeModal(); UI.render(); };

  // ---------- frame ----------
  const NAV = [['home', '🏠', 'Home'], ['biz', '🏪', 'My Biz'], ['market', '🗺️', 'Shop'], ['money', '💰', 'Money'], ['more', '⚙️', 'More']];
  const JAIL_OK = ['help', 'reloadTab', 'stopToggle', 'nextAnyway', 'supNoWarn', 'skipAnyway', 'econInfo', 'next', 'skip', 'go', 'tab', 'tip', 'closeModal', 'decisions', 'decide', 'saveInfo', 'exportSave', 'lastReport', 'detail', 'crDetail', 'setToggle', 'setMajor', 'setFreq', 'newGameOpen', 'newGame', 'clearSave', 'clearGo', 'importSave', 'importGo', 'copyCode', 'goMoreTab', 'goMoneyTab', 'logF', 'emp', 'crSup', 'crH', 'mkType', 'mkSort', 'mkMax'];
  // v6 instant updates: derived numbers (capacity, work bars, limits, forecast) for a business as it is RIGHT NOW.
  // TG.B.live recomputes them whenever the business changed (it is cached otherwise), so every action shows its effect at once.
  const LV = (b) => (TG.G && b ? TG.B.live(TG.G, b) : null);
  UI.lc = (b) => { const L = LV(b); return (L && L.ok ? L.ctx : b.lastCtx) || {}; };
  UI.wk = (b) => { const L = LV(b); return (L && L.ok ? L.work : b.work) || []; };
  UI.fc = (b) => { const L = LV(b); return L ? L.fc : b.fc; };
  UI.go = (screen, extra) => { UI.screen = screen; if (extra) Object.assign(UI, extra); UI.render(); window.scrollTo(0, 0); };
  UI.A.go = (arg) => { const [s, id] = String(arg).split(':'); if (s === 'bizd') UI.bizId = id; UI.go(s); };
  UI.A.tab = (arg) => { const i = arg.indexOf(':'); UI.tab[arg.slice(0, i)] = arg.slice(i + 1); UI.render(); };

  UI.saveChip = () => {
    const st = TG.Game.saveState || {};
    if (st.ok === false) return `<span class="chip save no" id="saveInd" data-act="exportSave">⚠️ Not saved</span>`;
    if (st.ok) { const d = new Date(st.at); return `<span class="chip save ok" id="saveInd" data-act="saveInfo" data-nosave="1">💾 ✓</span>`; }
    return `<span class="chip save" id="saveInd" data-act="saveInfo" data-nosave="1">💾</span>`;
  };
  UI.header = () => {
    const g = TG.G; const nw = g.lastNW != null ? g.lastNW : TG.F.netWorth(g);
    const pend = g.decisions.length; const ph = g.world.phase;
    return `<header class="top"><span class="chip">📅 ${U.dateStr(g.month)}</span>
      <span class="chip cash ${g.cash < 0 ? 'neg' : ''}">💵 ${UI.m(g.cash)}</span>
      <span class="chip">📈 ${UI.m(nw)}</span>
      <span class="chip" data-act="econInfo" data-nosave="1" style="cursor:pointer">${ph === 'boom' ? '☀️' : ph === 'recession' ? '🌧️' : '⛅'} Economy: ${TG.W.phaseLabel(g)}</span>
      ${pend ? `<span class="chip dec" data-act="decisions">⚠️ ${pend}</span>` : ''}${UI.saveChip()}</header>
      ${TG.Game.saveState && TG.Game.saveState.ok === false ? `<div class="banner" style="margin:8px 10px 0">⚠️ This browser is not keeping your save (${esc(TG.Game.saveState.err || 'storage blocked')}). ${UI.btn('📤 Export save', 'exportSave', null, 'sm pri')}</div>` : ''}`;
  };
  UI.A.saveInfo = () => { const st = TG.Game.saveState || {}; const d = new Date(st.at || Date.now()); UI.toast(st.ok ? `💾 Saved at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} on this ${st.where || 'device'}. The game saves after every month and every tap.` : 'Not saved yet.'); };
  TG.Game.onSaved = () => { const el = document.getElementById('saveInd'); if (el) el.outerHTML = UI.saveChip(); };
  UI.footer = () => {
    const v = UI.S.skipVal || '';
    return `<footer class="turn"><div class="in">
      <button class="btn next" data-act="next">Next Month ▶</button>
      <input type="number" id="skipN" min="1" max="2400" placeholder="#" aria-label="months to skip" value="${esc(v)}" inputmode="numeric">
      <span class="yrs" id="skipYrs">${v ? U.yrsMo(Number(v)) : 'months'}</span>
      <button class="btn" data-act="skip">Skip ⏩</button></div></footer>`;
  };
  const navList = () => (TG.G && TG.CR && TG.CR.on(TG.G) ? NAV.slice(0, 4).concat([['crime', '🕶️', 'Crime']], NAV.slice(4)) : NAV);
  UI.nav = () => `<nav class="bottom"><div class="in">${navList().map(([id, ic, lbl]) => `<button class="${UI.screen === id || (id === 'biz' && UI.screen === 'bizd') ? 'on' : ''}" data-act="go" data-arg="${id}"><span class="ic">${ic}</span>${lbl}</button>`).join('')}</div></nav>`;

  UI.render = () => {
    const g = TG.G; if (!g) return;
    const fn = UI.screens[UI.screen] || UI.screens.home;
    let body = '';
    try { body = fn(); } catch (e) { console.error(e); body = `<div class="card bad">Screen error: ${esc(e.message)}</div>`; }
    const sy = window.scrollY;
    /* v9: keep folded sections (<details>) open across re-renders, so tapping an "i" inside one shows its text instead of folding it shut */
    const dk = (d) => { const s = d.querySelector('summary'); return (s ? s.textContent : '').replace(/[\d$,.%()+-]+/g, '').trim(); };
    const openK = new Set([...document.querySelectorAll('#app details[open]')].map(dk));
    $('#app').innerHTML = UI.header() + `<main>${body}</main>` + UI.footer() + UI.nav();
    if (openK.size) for (const d of document.querySelectorAll('#app details')) if (openK.has(dk(d))) d.open = true;
    if (UI.keepScroll) window.scrollTo(0, sy); UI.keepScroll = false;
  };
  UI.refresh = () => { UI.keepScroll = true; UI.render(); };
  UI.screens = {};

  // ---------- save ----------
  UI.save = () => { const ok = TG.Game.save(TG.G); UI.S.saveOk = ok; return ok; };

  // ---------- turn ----------
  UI.A.next = (force) => {
    const g = TG.G;
    if (g.settings.confirmPending && g.decisions.length && force !== 'go') {
      UI.modal('Decisions waiting', `<div class="card"><p>${g.decisions.length} decision(s) are waiting. If you continue, managers decide where they can; otherwise the default happens.</p><div class="btns">${UI.btn('Decide now', 'decisions', null, 'pri')}${UI.btn('Continue anyway', 'next', 'go')}</div></div>`);
      return;
    }
    UI.closeModal();
    const r = TG.Game.nextMonth(g); UI.save();
    UI.render(); UI.showReport(r);
  };
  UI.busy = (msg) => { const d = document.createElement('div'); d.className = 'modal'; d.id = 'busy'; d.innerHTML = `<div class="box"><b>${esc(msg)}</b></div>`; document.body.appendChild(d); };
  UI.A.skip = () => {
    const n = Math.floor(UI.num('skipN', 0));
    if (!(n >= 1)) return UI.toast('Type how many months to skip.', true);
    if (n > 2400) return UI.toast('Max 2,400 months (200 years) per skip.', true);
    const g = TG.G; UI.S.skipVal = '';
    UI.closeModal(); UI.busy(`Simulating ${n} months (${U.yrsMo(n)}) one by one…`);
    setTimeout(() => {
      let s; try { s = TG.Game.skip(g, n); } catch (e) { console.error(e); UI.toast('Error: ' + e.message, true); }
      const b = document.getElementById('busy'); if (b) b.remove();
      UI.save(); UI.render(); if (s) UI.showSkip(s);
    }, 30);
  };

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    const fn = UI.A[el.dataset.act]; if (!fn) return;
    e.preventDefault();
    // in jail you can look around and pass time, nothing else
    if (TG.G && TG.CR && TG.CR.jailed(TG.G) && !JAIL_OK.includes(el.dataset.act)) { UI.toast(`⛓️ You are in jail for ${TG.G.crime.jail} more months. Skip time; managers run things.`, true); return; }
    try { fn(el.dataset.arg, el); } catch (err) { console.error(err); UI.toast('Error: ' + err.message, true); }
    if (TG.G && !el.dataset.nosave) UI.save();
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'skipN') { UI.S.skipVal = e.target.value; const n = Number(e.target.value); const y = document.getElementById('skipYrs'); if (y) y.textContent = n >= 1 ? U.yrsMo(Math.floor(n)) : 'months'; }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'skipN') UI.A.skip(); });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (!el) return; const fn = UI.A[el.dataset.change]; if (fn) { fn(el.value, el); UI.save(); } });

  // save when the app is hidden or closed (phones kill background tabs)
  const saveNow = () => { try { if (TG.G) UI.save(); } catch (e) { return; } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);
  UI.boot = () => {
    const done = (g) => {
      if (g) { TG.G = g; UI.render(); if (!TG.store.ok) UI.toast('Browser storage is blocked here: tap ⚠️ to export your save.', true); }
      else UI.newGameScreen(true);
    };
    let fired = false; const once = (g) => { if (!fired) { fired = true; done(g); } };
    try { TG.Game.loadAsync().then(once, () => once(TG.Game.load())); } catch (e) { once(TG.Game.load()); }
    setTimeout(() => once(TG.Game.load()), 2500);
    // installable app (service worker only works over http/https, not file://)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => null);
  };
})();
