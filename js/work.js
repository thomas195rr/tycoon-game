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
  WK.add = (ctx, kind, icon, label, n, cap, load, unit, pools, tip) => {
    if (!ctx.wk) ctx.wk = [];
    cap = Number.isFinite(cap) ? Math.max(0, cap) : null; load = Math.max(0, load || 0);
    ctx.wk.push({ kind, i: icon, t: label, n: Math.round((n || 0) * 10) / 10, cap: cap == null ? null : Math.round(cap), load: Math.round(load), u: unit || '', pools: pools || [], util: cap ? Math.round(load / cap * 100) / 100 : (load > 0 ? 9 : 0), tip: tip || '' });
  };
  // equipment pools of a business -> group per pool (service-type)
  WK.poolGroups = (g, b, ctx, load, unit) => {
    const C = TG.CONFIG; for (const pl of TG.E.pools(b)) {
      const ed = pl.primary; const items = b.equip.filter((x) => { const d = TG.E.def(b, x.type); return d && TG.E.poolOf(d) === pl.pool && !x.broken; });
      const cat = C.equipCats[ed.cat] || ['⚙️', ed.label];
      WK.add(ctx, 'eq', cat[0], cat[1], items.length, TG.E.capacity(b, pl.pool), load, unit, [pl.pool], `${items.length} working, about ${Math.round(TG.E.capacity(b, pl.pool) / Math.max(1, items.length)).toLocaleString()} ${unit} each. Work is shared evenly.`);
    }
  };
  // end of month: keep the report and per-pool utilization (drives next month's wear)
  WK.commit = (b, ctx) => {
    b.work = ctx.wk || []; const P = {};
    for (const w of b.work) if (w.kind === 'eq') for (const p of w.pools) P[p] = Math.min(1.5, w.util);
    b.workPool = P;
  };
  // wear speed from utilization: idle 0.4x, full 1.2x, overloaded up to 1.6x
  WK.wearMult = (u) => 0.4 + 0.8 * U.clamp(u, 0, 1.5);
  WK.tone = (u) => (u > 1.02 ? 'r' : u > 0.9 ? 'y' : u < 0.35 ? 'y' : 'g');
  TG.WK = WK;
})();
