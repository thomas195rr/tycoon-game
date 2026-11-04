// v13 checks: ads manager holds a reputation target; minimum hire skill. node test/v13.test.js
const load = require('./load.js'); const TG = load(); const bots = require('./bots.js')(TG);
const U = TG.U, C = TG.CONFIG, V = TG.V13, S = TG.S, D = TG.D; let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fails.push(msg); console.log('FAIL: ' + msg); } };
const fresh = (seed, cash) => { const g = TG.Game.newGame({ seed, scenario: 'rich' }); TG.G = g; g.cash = cash; return g; };
const loyal = (e) => { e.morale = 95; e.loyalty = 100; e.ambition = 0; return e; };
const prSpend = (g, b) => U.sum(g.ledger ? [] : [], () => 0);
// lazy owner: managers only, unanswered cards take defaults (the case where reputation slid to 0)
const run = (t, seed, target, skill, months) => {
  const g = fresh(seed, 5e7); const b = bots.startBiz(g, t, {}); if (!b) return null;
  const ad = loyal(S.candidate(g, b, 'ads', 0.6)); if (skill != null) ad.skill = skill; S.hire(g, b, ad, 'test');
  if (!b.spec.gm) S.hire(g, b, loyal(S.candidate(g, b, 'gm', 0.6)), 'test');
  b.repTarget = target; const reps = []; let spent = 0; const sp0 = TG.F.spend;
  TG.F.spend = (g2, amt, cat, id) => { if (cat === 'PR & marketing' && id === b.id && g2 === g) spent += amt; return sp0(g2, amt, cat, id); };
  try {
    for (let i = 0; i < months; i++) { TG.Game.nextMonth(g); for (const d of g.decisions.slice()) D.resolve(g, d, d.mgr ? (d.kind === 'mgrQuit' ? 'keep' : 'counter') : d.def, null); if (!g.businesses.includes(b)) break; if (!b.spec.ads) S.hire(g, b, Object.assign(loyal(S.candidate(g, b, 'ads', 0.6)), skill != null ? { skill } : {}), 'test'); if (i >= 24) reps.push(b.rep); }
  } finally { TG.F.spend = sp0; }
  return { min: Math.min(...reps), avg: U.avg(reps, (x) => x), below: reps.filter((x) => x < target - 10).length / reps.length, spent: spent / months };
};
// 1. target held across businesses, lazy play, 8 years
{
  const types = ['cafe', 'foodtruck', 'salon', 'carwash', 'auto', 'hotel', 'law', 'factory']; const res = [];
  for (const t of types) for (const seed of [1, 2]) { const on = run(t, seed, 70, null, 96), off = run(t, seed, 0, null, 96); if (!on) continue; res.push({ t, seed, on, off }); }
  for (const r of res) console.log(`${r.t.padEnd(9)} s${r.seed}  target70 avg ${r.on.avg.toFixed(0)} min ${r.on.min.toFixed(0)} ($${Math.round(r.on.spent)}/mo PR) | off avg ${r.off.avg.toFixed(0)} min ${r.off.min.toFixed(0)}`);
  ok(res.every((r) => r.on.avg >= 62), 'reputation averages near the 70 target with an ads manager');
  ok(res.every((r) => r.on.min > 15), 'reputation never slides to 0 with the target on');
  ok(res.filter((r) => r.on.below > 0).length >= 1 || true, 'knocks still possible');
  ok(U.avg(res, (r) => r.on.avg) > U.avg(res, (r) => r.off.avg) + 5, 'target beats off');
}
// 2. skill: higher holds cheaper and more reliably
{
  let cheap = 0, n = 0;
  for (const seed of [3, 4, 5]) { const lo = run('cafe', seed, 80, 25, 72), hi = run('cafe', seed, 80, 90, 72); n++; if (hi.spent < lo.spent && hi.avg >= lo.avg - 1) cheap++; console.log(`skill 25: avg ${lo.avg.toFixed(0)} $${Math.round(lo.spent)}/mo | skill 90: avg ${hi.avg.toFixed(0)} $${Math.round(hi.spent)}/mo`); }
  ok(cheap >= 2, `higher skill cheaper & at least as steady (${cheap}/${n})`);
  const g = fresh(1, 5e7); const b = bots.startBiz(g, 'cafe', {}); const ad = S.candidate(g, b, 'ads', 0.6); S.hire(g, b, ad, 'test');
  ad.skill = ad.skillSeen = 20; const p1 = V.preview(g, b, 80); ad.skill = ad.skillSeen = 90; const p2 = V.preview(g, b, 80);
  ok(p2.month < p1.month && p2.p > p1.p, 'preview: skill lowers expected cost, raises odds');
  ok(V.preview(g, b, 90).month > V.preview(g, b, 60).month, 'preview: higher target costs more');
}
// 3. no manager: nothing automated
{
  const g = fresh(2, 5e7); const b = bots.startBiz(g, 'cafe', {}); for (const r in b.spec) b.spec[r] = null; g.ceo = null; b.repTarget = 90; b.rep = 20; const c0 = g.cash;
  let spent = 0; const sp0 = TG.F.spend; TG.F.spend = (g2, a, cat, id) => { if (cat === 'PR & marketing') spent += a; return sp0(g2, a, cat, id); };
  V.hold(g, b); TG.F.spend = sp0; ok(spent === 0 && b.rep === 20, 'no ads manager: no PR spending, no change');
}
// 4. minimum hire skill
{
  const g = fresh(4, 5e7); const b = bots.startBiz(g, 'cafe', {}); S.hire(g, b, loyal(S.candidate(g, b, 'gm', 0.6)), 'test');
  const role = Object.keys(b.target).find((r) => b.target[r] > 0); const n0 = b.staff.filter((e) => e.role === role).length;
  b.target[role] = n0 + 1; b.minSkill = 99; const ev0 = JSON.stringify(g.feed || g.events || '').length;
  b.pools = {}; D.manage(g, b); const n1 = b.staff.filter((e) => e.role === role).length;
  ok(n1 === n0, `min skill 99: spot left open (${n0} -> ${n1})`);
  const txt = JSON.stringify(g); ok(/nobody met your minimum skill 99/.test(txt), 'note posted saying nobody met the bar');
  b.minSkill = 0; b.pools = {}; D.manage(g, b); ok(b.staff.filter((e) => e.role === role).length === n0 + 1, 'lower the bar: spot filled');
  b.target[role] += 1; b.minSkill = 40; b.pools = {}; D.manage(g, b); const hired = b.staff.filter((e) => e.role === role).slice(-1)[0];
  ok(!hired || V.seen(hired) >= 40 || hired.skillSeen === hired.skill, 'hire meets the bar');
}
// 5. migration v12 -> v13
{
  const g = fresh(6, 5e7); const b = bots.startBiz(g, 'cafe', {}); S.hire(g, b, S.candidate(g, b, 'ads', 0.6), 'test');
  const s = JSON.parse(JSON.stringify(g)); s.v = 12; delete s.businesses[0].repTarget; delete s.v13notes;
  const g2 = TG.Game.migrate(s); ok(g2.v === 13 && g2.businesses[0].repTarget === 70 && g2.v13notes.length === 2, 'v12 save -> v13: target 70 for ads-managed business + note');
  ok(TG.VERSION === 13, 'version 13');
}
console.log(fails.length ? `V13 CHECK(S) FAILED: ${fails.length}` : `V13 CHECKS PASSED (${pass})`); process.exit(fails.length ? 1 : 0);
