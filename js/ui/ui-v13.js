// v13 UI: reputation target card + minimum hire skill card (Staff tab, next to the other GM settings).
(function () {
  const TG = globalThis.TG;
  const UI = TG.UI, C = TG.CONFIG, U = TG.U, V = TG.V13; const esc = UI.esc;
  UI.repCard = (g, b) => {
    const mgr = b.spec && b.spec.ads; const t = V.target(b);
    let o = `<div class="card" id="repCard"><h3 style="margin-top:0">📣 Keep reputation at least ${UI.tipBtn('rt' + b.id)}</h3>${UI.tipLine('rt' + b.id, 'Your ads manager spends on PR and ads whenever reputation is below this. Higher skill = cheaper and more reliable. Scandals can still knock it down for a while; it then climbs back.')}`;
    if (!mgr) return o + `<div class="small"><span class="warn">📣 Needs an ads manager (hire one above). Until then nobody holds your reputation.</span> Now ⭐ ${Math.round(b.rep)}/100.</div></div>`;
    const pv = V.preview(g, b, t);
    o += `<div class="small">👤 <b>${esc(mgr.name)}</b> (skill ~${Math.round(mgr.skillSeen != null ? mgr.skillSeen : mgr.skill)}) · now ⭐ <b>${Math.round(b.rep)}</b>/100 · without help it heads to ~${pv.nat != null ? pv.nat : Math.round(V.natural(b))}</div>`;
    o += `<div class="row" style="flex-wrap:wrap;gap:4px">${C.v13.repTargets.map((x) => UI.btn(`${x === t ? '✅' : '⬜'} ${x ? '⭐ ' + x : 'Off'}`, 'repTarget', x, x === t ? 'pri' : '')).join('')}</div>`;
    if (t) o += `<div class="small" id="repCost">💵 Expected about <b>${U.money(pv.month)}/mo</b> to hold ⭐ ${t} (${U.money(pv.cp)} per point, ${U.pct(pv.p)} of pushes land)${pv.catchUp ? ` · catch-up from ${Math.round(b.rep)}: about <b>${U.money(pv.catchUp)}</b> over ~${pv.monthsUp} mo` : ''}</div>`;
    else o += `<div class="small mute" id="repCost">Off: the manager only reacts to big hits (PR cards).</div>`;
    return o + '</div>';
  };
  UI.minCard = (g, b) => {
    const h = TG.D.handler(g, b, 'hire'); const m = V.minSkill(b);
    return `<div class="card" id="minCard"><h3 style="margin-top:0">🎚️ Minimum skill to hire ${UI.tipBtn('ms' + b.id)}</h3>${UI.tipLine('ms' + b.id, 'Your GM, HR manager or CEO will not hire anyone whose skill looks lower than this. If nobody applying is good enough, the spot stays open and you get a note. A higher bar = better staff, but spots can stay empty longer.')}
      <div class="small">${h ? `👔 Hiring done by <b>${esc(h.label)}</b>` : '<span class="warn">No GM, HR manager or CEO: you hire yourself.</span>'}</div>
      <select id="minSel" data-change="minSkill">${C.v13.minSkills.map((x) => `<option value="${x}"${x === m ? ' selected' : ''}>${x ? '🎚️ Skill ' + x + '+' : 'Any skill'}</option>`).join('')}</select></div>`;
  };
  UI.A.repTarget = (v) => { const b = TG.B.get(TG.G, UI.bizId); b.repTarget = +v; UI.toast(+v ? `📣 Hold reputation ${v}+` : '📣 Reputation target off'); UI.refresh(); };
  UI.A.minSkill = (v) => { const b = TG.B.get(TG.G, UI.bizId); b.minSkill = +v; UI.toast(+v ? `🎚️ Hire skill ${v}+ only` : '🎚️ Any skill'); UI.refresh(); };
  const ms0 = UI.mgrSettings; UI.mgrSettings = (g, b) => UI.repCard(g, b) + UI.minCard(g, b) + ms0(g, b);
  const showNotes = () => {
    const g = TG.G; if (!g || g.v12notes || !g.v13notes || !g.v13notes.length || document.getElementById('modal')) return;
    const notes = g.v13notes; g.v13notes = null; UI.save();
    UI.modal('🆕 Game updated (v13)', `<div class="card">${notes.map((n) => `<div class="ev info">${esc(n)}</div>`).join('')}<div class="btns">${UI.btn('OK', 'closeModal', null, 'pri')}</div></div>`);
  };
  const r0 = UI.render; UI.render = () => { r0(); try { showNotes(); } catch (e) { console.error(e); } };
})();
