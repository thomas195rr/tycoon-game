// v13: (1) ads manager holds a 'keep reputation at least' target; (2) minimum skill for manager hiring.
(function () {
  const TG = globalThis.TG;
  const C = TG.CONFIG, U = TG.U, R = TG.R, S = TG.S, D = TG.D;
  const X = () => C.v13; const V = TG.V13 = {};

  // ================= 1. REPUTATION TARGET =================
  // Root cause of 'reputation drops to 0 with an ads manager': the ads manager only acted on a single hit of 6+
  // (a PR card). Slow bleeds (closed months -1.5, fights, ad flops, small scandals) never made a card, and natural
  // recovery is capped at ~0.9/month, so reputation slid to 0 while the manager did nothing.
  V.target = (b) => (b.repTarget == null ? (b.spec && b.spec.ads ? X().repDefault : 0) : b.repTarget);
  V.sk = (b, seen) => { const a = b.spec && b.spec.ads; return U.clamp(((a && (seen && a.skillSeen != null ? a.skillSeen : a.skill)) || 50) / 100, 0, 1); };
  V.costPt = (g, b, seen) => { const P = X().rep; return Math.round(Math.max(P.ptMin * g.world.priceIdx, (b.revAvg || 0) * P.ptRev) * (P.costSkill[0] - P.costSkill[1] * V.sk(b, seen))); };
  V.okP = (b, seen) => X().rep.ok[0] + X().rep.ok[1] * V.sk(b, seen);
  V.step = (b, seen) => X().rep.step[0] + X().rep.step[1] * V.sk(b, seen);
  V.natural = (b) => U.clamp((b.lastCtx && b.lastCtx.quality != null ? b.lastCtx.quality : b.rep) + ((b.fixesOn && b.fixesOn.repTarget) || 0), 0, 100);
  // expected monthly cost to hold the target, and the one-off catch-up from where it is now
  V.preview = (g, b, t) => {
    t = t == null ? V.target(b) : t; if (!t) return { t, month: 0, catchUp: 0, pts: 0 };
    const nat = V.natural(b); const pts = Math.max(0, (t - nat) * 0.08) + X().rep.hitAllow;
    const cp = V.costPt(g, b, true), p = V.okP(b, true);
    return { t, nat: Math.round(nat), pts, cp, p, month: Math.round(pts * cp / p), catchUp: Math.round(Math.max(0, t - b.rep) * cp / p), monthsUp: Math.ceil(Math.max(0, t - b.rep) / (V.step(b, true) * p)) };
  };
  V.hold = (g, b) => {
    const mgr = b.spec && b.spec.ads; const t = V.target(b); if (!mgr || !t || b.rep >= t - 0.25) return;
    const gap = t - b.rep; const step = Math.min(gap, V.step(b)); const cost = Math.round(step * V.costPt(g, b));
    if (cost > Math.max(0, g.cash)) { if (!b.repNoCash || g.month - b.repNoCash >= 3) { b.repNoCash = g.month; TG.rep.decision(g, b, mgr.name, `Could not afford PR to hold reputation ${t} (needs ${U.money(cost)})`, 'bad'); } return; }
    TG.F.spend(g, cost, 'PR & marketing', b.id);
    if (R.chance(V.okP(b))) { const x = step * R.range(0.75, 1); b.rep = U.clamp(b.rep + x, 0, 100); if (gap >= 4) TG.rep.decision(g, b, mgr.name, `PR & ads to hold reputation ${t}: +${Math.round(x)} (${U.money(cost)})`, 'good'); }
    else TG.rep.decision(g, b, mgr.name, `PR push to hold reputation ${t} did not land (${U.money(cost)}; ${U.pct(V.okP(b))} odds at skill ~${Math.round(V.sk(b, true) * 100)})`, 'bad');
  };
  const rm0 = TG.B.repMonth; TG.B.repMonth = (g, b, ctx) => { rm0(g, b, ctx); V.hold(g, b); };

  // ================= 2. MINIMUM HIRE SKILL =================
  V.minSkill = (b) => b.minSkill || 0;
  V.seen = (c) => (c.skillSeen != null ? c.skillSeen : c.skill);
  // filter a pool for a manager hire; posts a note (throttled) when people applied but nobody met the bar
  V.filter = (g, b, role, pool, by) => {
    const m = V.minSkill(b); if (!m || !pool.length) return pool;
    const ok = pool.filter((c) => V.seen(c) >= m); if (ok.length) return ok;
    b.minNote = b.minNote || {}; const last = b.minNote[role];
    if (last == null || g.month - last >= X().minNoteEvery) {
      b.minNote[role] = g.month; const best = Math.max(...pool.map(V.seen));
      const lab = (S.roleDef(b, role) || C.specialists[role] || { label: role }).label.toLowerCase();
      TG.rep.event(g, b, 'info', `${by} left a ${lab} spot open: nobody met your minimum skill ${m}`, `${pool.length} applied, best skill ~${Math.round(best)}. Lower the bar on the Staff tab to fill it.`);
    }
    return ok;
  };

  // ================= MIGRATION v12 -> v13 =================
  V.migrate = (g) => {
    const notes = []; let n = 0;
    for (const b of g.businesses || []) { if (b.spec && b.spec.ads && b.repTarget == null) { b.repTarget = X().repDefault; n++; } }
    notes.push(`📣 Your ads manager now holds a "keep reputation at least" target${n ? ` (set to ${X().repDefault} for ${n} business${n > 1 ? 'es' : ''})` : ''}. Pick 60/70/80/90 or off on the Staff tab; the card shows the monthly cost.`);
    notes.push('🎚️ Set a minimum skill your GM, HR manager or CEO will hire (Staff tab). If nobody is good enough, the spot stays open and you get a note.');
    g.v13notes = notes; g.v = 13;
  };
  const mig0 = TG.Game.migrate;
  TG.Game.migrate = (g) => { mig0(g); if ((g.v || 0) < 13) V.migrate(g); return g; };
})();
