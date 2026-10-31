/* work.js - the work-capacity model shown to the player.
   Every business reports "work groups": a team of staff or a group of machines, each with
   how much work it CAN do this month (capacity), how much it DID (load) and the utilization %.
   Machines in a group split the work evenly, so utilization is per group; busy groups wear faster
   (equipment.js reads b.workPool) and busy staff lose morale (staff.js reads ctx.busy). */
(function () {
  const TG = globalThis.TG; const U = TG.U;
  const WK = {};
  // add one group to this month's report
  // kind: 'staff' | 'eq' | 'space' | 'stock'; pools: equipment pools it covers; unit: what one unit of work is
  WK.add = (ctx, kind, icon, label, n, cap, load, unit, pools, tip, role) => {
    if (!ctx.wk) ctx.wk = [];
    cap = Number.isFinite(cap) ? Math.max(0, cap) : null; load = Math.max(0, load || 0);
    ctx.wk.push({ kind, i: icon, t: label, n: Math.round((n || 0) * 10) / 10, cap: cap == null ? null : Math.round(cap), load: Math.round(load), u: unit || '', pools: pools || [], util: cap ? Math.round(load / cap * 100) / 100 : (load > 0 ? 9 : 0), tip: tip || '', role: role || null });
  };
  // equipment pools of a business -> group per pool (service-type)
  WK.poolGroups = (g, b, ctx, load, unit) => {
    const C = TG.CONFIG; const PL = TG.E.pools(b); const catN = {}; for (const pl of PL) catN[pl.primary.cat] = (catN[pl.primary.cat] || 0) + 1;
    for (const pl of PL) {
      const ed = pl.primary; const items = b.equip.filter((x) => { const d = TG.E.def(b, x.type); return d && TG.E.poolOf(d) === pl.pool && !x.broken; });
      let cat = C.equipCats[ed.cat] || ['⚙️', ed.label];
      if (catN[ed.cat] > 1) cat = [cat[0], ed.label + 's']; /* v9: two groups in one category (bakery ovens + mixers) get their own names, not "Machines" twice */
      WK.add(ctx, 'eq', cat[0], cat[1], items.length, TG.E.capacity(b, pl.pool), load, unit, [pl.pool], `${items.length} working, about ${Math.round(TG.E.capacity(b, pl.pool) / Math.max(1, items.length)).toLocaleString()} ${unit} each. Work is shared evenly.`);
    }
  };
  // end of month: keep the report and per-pool utilization (drives next month's wear)
  WK.commit = (b, ctx) => {
    b.work = ctx.wk || []; const P = {};
    const kr = TG.M.keyRole(TG.CONFIG.businesses[b.type]); for (const w of b.work) if (w.kind === 'staff' && !w.role) { w.role = kr; const mw = TG.S.mgrW(b); if (mw > 0) { w.mw = Math.round(mw * 100) / 100; w.tip += TG.S.mgrNote(b); } break; } // v9: managers' share of the main work
    /* v9: machine groups show what you OWN (w.own) and how many are broken (w.brk), not just the working ones */
    for (const w of b.work) if (w.kind === 'eq' && w.pools.length) {
      const mine = b.equip.filter((x) => { if (x.broken === 'destroyed') return false; const d = TG.E.def(b, x.type); return w.pools.includes(x.type) || (d && (w.pools.includes(TG.E.poolOf(d)) || w.pools.includes(d.countsAs))); });
      const brk = mine.filter((x) => x.broken).length; w.brk = brk; w.own = Math.max(w.n + brk, mine.length);
    }
    for (const w of b.work) if (w.kind === 'eq') for (const p of w.pools) P[p] = Math.min(1.5, w.util);
    b.workPool = P;
  };
  // wear speed from utilization: idle 0.4x, full 1.2x, overloaded up to 1.6x
  WK.wearMult = (u) => 0.4 + 0.8 * U.clamp(u, 0, 1.5);
  WK.tone = (u) => (u > 1.02 ? 'r' : u > 0.9 ? 'y' : u < 0.35 ? 'y' : 'g');
  TG.WK = WK;
})();
