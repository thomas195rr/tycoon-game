/* ui-v10.js - v10 screens: cost before you buy (each + total, live), play time, version label, takeover starts,
   "take over a failing business" new game, and the v10 update note. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI, U = TG.U; const m = U.money, esc = UI.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const V = TG.V10; const N = (x) => Math.round(x || 0).toLocaleString();
  const biz = () => TG.B.get(TG.G, UI.bizId);

  // ================= COST BEFORE YOU BUY =================
  // every "how many" box next to a Buy/Sell button shows the price of one and the total, and updates as you type
  const PRICE = {
    qSup: (g, b) => { const s = TG.ST.def(b); return s ? { each: TG.ST.unitCost(g, b), unit: (s.unitWord || 'unit'), buy: true } : null; },
    qFeed: (g) => ({ each: TG.M.feedPrice(g), unit: 't of feed', buy: true }),
    qSeed: (g, b) => ({ each: TG.M.models.farm.seedCost(g, b), unit: "acre's seed", buy: true }),
    qRdy: (g) => ({ each: TG.M.cowValue(g, 'ready'), unit: 'steer', buy: false }),
    qDry: (g) => ({ each: TG.M.cowValue(g, 'dry') * TG.CONFIG.cows.sellDrop, unit: 'cow', buy: false }),
    qgrain: (g) => ({ each: TG.W.price(g, 'grain', 0), unit: 't', buy: false }),
    qfruit: (g) => ({ each: TG.W.price(g, 'fruit', 0), unit: 't', buy: false }),
  };
  const priceFor = (id, g, b) => {
    if (PRICE[id]) return PRICE[id](g, b);
    if (/^qc_/.test(id) && b && b.farm) { const k = id.slice(3); return { each: TG.M.cowPrice(g, b, k), sell: TG.M.cowValue(g, k) * TG.CONFIG.cows.sellDrop, unit: 'head', buy: true }; }
    return null;
  };
  UI.costLine = (id) => {
    const g = TG.G, b = biz(); const el = document.getElementById(id); if (!el || !g) return '';
    const p = priceFor(id, g, b); if (!p) return ''; const n = Math.max(0, Math.round(UI.num(id, 0)));
    const me = (x) => (x < 10 ? "$" + x.toFixed(2) : m(x)); const a = `${N(n)} × ${me(p.each)} = <b>${m(n * p.each)}</b>`;
    return p.buy ? `🧾 Buy: ${a}${p.sell ? ` · 💵 sell: ${N(n)} × ${me(p.sell)} = ${m(n * p.sell)}` : ''}${n * p.each > g.cash ? ' <span class="bad">(more than your cash)</span>' : ''}` : `💵 Sell: ${a}`;
  };
  const decorate = () => {
    if (typeof document === 'undefined' || !TG.G) return;
    for (const el of document.querySelectorAll('input[type="number"][id]')) {
      const id = el.id; if (!priceFor(id, TG.G, biz())) continue;
      const row = el.closest('.irow') || el.parentElement; if (!row) continue;
      let line = document.getElementById('cl_' + id);
      if (!line) { line = document.createElement('div'); line.className = 'small costline'; line.id = 'cl_' + id; line.style.margin = '0 0 6px 48px'; row.insertAdjacentElement('afterend', line); }
      line.innerHTML = UI.costLine(id);
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('input', (e) => {
      const el = e.target; if (!el || !el.id) return;
      const line = document.getElementById('cl_' + el.id); if (line) line.innerHTML = UI.costLine(el.id);
      const f = el.dataset && el.dataset.input && UI.A[el.dataset.input]; if (f) f(el.value, el);
    });
  }

  // ================= PLAY TIME + VERSION =================
  UI.playLine = (g) => `<div class="small mute playtime" id="playTime">⏱️ Play time: <b>${V.playText(V.playMonths(g))}</b> (all your games, in game time) · this game ${V.playText(g.month || 0)} · v${TG.VERSION}</div>`;
  const home0 = UI.screens.home;
  UI.screens.home = () => home0() + UI.playLine(TG.G);
  const more0 = UI.screens.more;
  UI.screens.more = () => { const o = more0(); return UI.curTab('more', 'mgr') === 'set' ? o + `<div class="card"><h3 style="margin-top:0">⏱️ Play time</h3>${UI.playLine(TG.G)}<div class="mute">Counts every month you have played, across new games and selling everything. Saved with your game and on this device.</div></div>` : o; };

  // ================= RENDER HOOK =================
  const render0 = UI.render;
  UI.render = () => {
    render0(); try { decorate(); } catch (e) { console.error(e); }
    const g = TG.G; if (!g || !g.v10notes || !g.v10notes.length || document.getElementById('modal')) return;
    const notes = g.v10notes; g.v10notes = null; UI.save();
    UI.modal('🆕 Game updated (v10)', `<div class="card">${notes.map((t) => `<div class="ev info">${esc(t)}</div>`).join('')}
      <div class="small" style="margin-top:6px">⬆️ More upgrades, each with its payback · 📣 ads show what they really did · 🔧 machine insurance and machine care on the Gear tab · 🏠 new rentals start empty: pick each tenant and each unit's rent · 🎁 bonuses build loyalty · ⏱️ play time on Home.</div>
      <div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const modal0 = UI.modal;
  UI.modal = (t, h) => { const r = modal0(t, h); try { decorate(); } catch (e) { /* ignore */ } return r; };

  // ================= START: NEW OR TAKE OVER A STRUGGLING ONE =================
  const sd0 = UI.startDialog;
  UI.startDialog = (pid, type) => {
    sd0(pid, type);
    const box = document.querySelector('#modal .box'); const q = document.getElementById('stQuick'); if (!box || !q) return;
    const qrow = q.closest('.kv');
    qrow.insertAdjacentHTML('beforebegin', `<div class="kv" style="margin-top:6px"><span>🧭 How to start</span><span><select id="stHow" data-change="stHow"><option value="new">🆕 Open a new one</option><option value="take">🏚️ Take over a struggling one (cheaper, needs fixing)</option></select></span></div><div id="stTakeBox"></div>`);
  };
  UI.A.stHow = (v) => {
    const bx = document.getElementById('stTakeBox'); const pv = document.getElementById('stPrevBox'); const q = document.getElementById('stQuick'); const qrow = q && q.closest('.kv');
    const go = document.querySelector('#modal [data-act="startGo"]'); if (!bx) return;
    if (v !== 'take') { bx.innerHTML = ''; if (pv) pv.style.display = ''; if (qrow) qrow.style.display = ''; if (go) go.textContent = 'Open the business'; return; }
    const [pid, type] = (go ? go.dataset.arg : '|').split('|'); const g = TG.G;
    const t = V.takeoverQuote(g, type, pid, { ent: UI.val('stEnt') || undefined });
    if (pv) pv.style.display = 'none'; if (qrow) qrow.style.display = 'none'; if (go) go.textContent = '🏚️ Take it over';
    const T = TG.CONFIG.v10.takeover;
    bx.innerHTML = t.ok ? `<div class="card"><h3 style="margin-top:0">🏚️ A struggling ${esc(TG.CONFIG.businesses[type].name.toLowerCase())}</h3><table>
      <tr><td>💵 Price (cash today)</td><td class="n"><b>${m(t.price)}</b></td></tr><tr><td>🆕 A new one with gear would cost</td><td class="n">${m(t.full)}</td></tr>
      <tr><td>🧾 Old owner's debt you take on (a loan)</td><td class="n">${m(t.debt)}</td></tr><tr><td>💵 Your cash after</td><td class="n ${g.cash - t.price < 0 ? 'bad' : ''}">${m(g.cash - t.price)}</td></tr></table>
      <div class="small">Comes with: ♻️ worn used gear (${T.wear[0]}-${T.wear[1]}% wear, about ${U.pct(T.broken)} of machines broken) · 👥 a team with low morale · ⭐ reputation ${T.rep[0]}-${T.rep[1]} · 📦 little stock. Already open, so no waiting.</div>
      <div class="mute">Good move if you can fix it: repair or replace the worst gear, buy supplies, raise morale. Reputation climbs back as quality improves. Bad move if you have no cash left to fix things.</div></div>` : `<div class="ev bad">${esc(t.msg || 'Not possible here.')}</div>`;
  };
  const go0 = UI.A.startGo;
  UI.A.startGo = (arg) => {
    if (UI.val('stHow') !== 'take') return go0(arg);
    const [pid, type] = String(arg).split('|'); const g = TG.G; const d = TG.CONFIG.businesses[type];
    const opts = { name: UI.val('stName') || d.name }; if (d.model === 'farm') opts.ent = UI.val('stEnt') || undefined;
    if (d.model === 'franchise') { const v = UI.val('stFrom'); if (v.startsWith('biz:')) opts.fromBiz = v.slice(4); else opts.concept = v.slice(2); }
    const r = V.takeover(g, type, pid, opts); if (!UI.res(r)) return;
    UI.toast(`You took over ${r.biz.name} for ${m(r.quote.price)}. Fix the gear and buy supplies!`);
    UI.closeModal(); UI.bizId = r.biz.id; UI.tab.biz = 'overview'; UI.go('bizd');
  };

  // ================= NEW GAME: take over a failing business of any type =================
  const ng0 = UI.newGameScreen;
  UI.newGameScreen = (first) => {
    ng0(first);
    const btn = document.querySelector('[data-act="newGame"][data-arg="failing"]'); if (!btn) return;
    const C = TG.CONFIG; const opts = Object.entries(C.businesses).map(([k, d]) => `<option value="${k}">${d.icon} ${esc(d.name)}</option>`).join('');
    btn.closest('.card').querySelector('.grow').insertAdjacentHTML('beforeend', `<div class="row small" style="margin-top:4px"><span>Which business?</span><select id="ngFail">${opts}</select></div>`);
  };
  const ngA0 = UI.A.newGame;
  UI.A.newGame = (scenario) => {
    if (scenario !== 'failing') return ngA0(scenario);
    const raw = String(UI.val('ngSeed') || '').trim(); const seedV = /^\d+$/.test(raw) ? Number(raw) : NaN;
    const g = TG.Game.newGame({ scenario, failType: UI.val('ngFail') || 'cafe', name: UI.val('ngName') || 'You', money: UI.val('ngMoney'), seed: Number.isFinite(seedV) ? seedV : undefined, settings: { eventFreq: UI.val('ngFreq') || 'normal', gambling: UI.val('ngGamble') !== '0', crime: UI.val('ngCrime') === '1' } });
    TG.G = g; UI.closeModal(); UI.save(); UI.bizId = g.businesses[0] && g.businesses[0].id; UI.tab.biz = 'overview'; UI.go(UI.bizId ? 'bizd' : 'home');
    UI.toast('You took over a failing business. Turn it around!');
  };
})();
