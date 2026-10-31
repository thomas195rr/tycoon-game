// v9 balance audit: can a careful player succeed in EVERY business / property type, from every sensible start?
// For each business: 4 start options (starter cash + lease, normal cash/mortgage, normal lease, big budget) x N seeds,
// random start years (the world runs 0-10 years first, so industries start in booms or slumps), random listings/locations.
// Farm is split by enterprise (cows / crops / orchard). Real estate: each rental kind, cash vs 30-year mortgage.
// The careful bot only uses what the screens show (forecasts, restock suggestions, market price, manager cards).
//   node tools/audit.js biz <type|farm:cows> [seeds=24] [months=120]   -> JSON line
//   node tools/audit.js re <kind> [seeds=24] [months=120]
//   node tools/audit.js all [seeds=24] [months=120] [--out file]       (runs every unit in parallel and prints the table)
const path = require('path'); const fs = require('fs');
const [mode, unit] = process.argv.slice(2);
const pct = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : '–');
const med = (a) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const q = (a, p) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const summ = (res) => ({ n: res.length, med: med(res.map((r) => r.cagr)), grew: res.filter((r) => r.cagr > 0).length / Math.max(1, res.length), prof: res.filter((r) => r.prof3 > 0).length / Math.max(1, res.length), ruin: res.filter((r) => r.ruined).length / Math.max(1, res.length), p10: q(res.map((r) => r.cagr), 0.1), boom: med(res.filter((r) => r.x0 >= 0).map((r) => r.cagr)), slump: med(res.filter((r) => r.x0 < 0).map((r) => r.cagr)) });
if (mode === 'biz' || mode === 'reck') {
  const SEEDS = Number(process.argv[4] || 24), MONTHS = Number(process.argv[5] || 120);
  const TG = require('../test/load')(); const bots = require('../test/bots')(TG);
  const [type, ent] = unit.split(':'); const tier = TG.CONFIG.businesses[type].tier;
  const CAP = { small: 250000, between: 600000, corp: 5000000 }[tier];
  const OPTS = mode === 'reck' ? [{ id: 'normal', cap: 1 }] : [{ id: 'starter (half cash, lease)', cap: 0.5, lease: true }, { id: 'normal (cash/mortgage)', cap: 1 }, { id: 'normal (lease)', cap: 1, lease: true }, { id: 'big budget', cap: 2.5 }];
  const all = []; const byOpt = {}; const byLoc = {};
  for (const o of OPTS) for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: s * 7919 + unit.length * 131 + Math.round(o.cap * 10) + (o.lease ? 5 : 0) + (mode === 'reck' ? 77 : 0) }); TG.G = g;
    const burn = (s * 37) % 121; for (let i = 0; i < burn; i++) { TG.W.month(g); g.month++; }
    const ind = TG.CONFIG.indOf[type]; const x0 = ind ? g.world.ind[ind].x : 0;
    g.cash = Math.round(CAP * o.cap); g.lastNW = TG.F.netWorth(g); const nw0 = g.cash;
    if (ent === 'orchard') for (let i = 0; i < 4; i++) { const p = TG.P.gen(g, { kind: 'hillside' }); p.orchard = true; g.listings.push(p); }
    if (ent === 'cows') for (let i = 0; i < 3; i++) g.listings.push(TG.P.gen(g, { kind: 'ranch' }));
    const biz = bots.startBiz(g, type, Object.assign({}, ent ? { ent } : {}, o.lease ? { lease: true } : {}));
    if (!biz) { (byOpt[o.id] = byOpt[o.id] || { none: 0, res: [] }).none++; continue; }
    const prop = g.properties && g.properties.find((p) => p.id === biz.propId); const loc = (prop && prop.loc) || '?';
    let ruined = false; const pr = [];
    for (let i = 0; i < MONTHS; i++) {
      if (g.businesses.includes(biz)) bots[mode === 'reck' ? 'reckless' : 'careful'](g, biz); else bots.resolveSmart(g);
      TG.Game.nextMonth(g);
      if (g.businesses.includes(biz) && i >= 12 && i < 36) pr.push(biz.hist[biz.hist.length - 1].profit);
      if (g.player.bankruptcies > 0) ruined = true;
    }
    const nw1 = g.lastNW; const cagr = nw1 > 0 ? Math.pow(nw1 / nw0, 12 / MONTHS) - 1 : -1;
    const r = { cagr, ruined, x0, prof3: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : -1, loc };
    all.push(r); (byOpt[o.id] = byOpt[o.id] || { none: 0, res: [] }).res.push(r); (byLoc[loc] = byLoc[loc] || []).push(r);
  }
  const out = { unit, kind: mode, all: summ(all), opts: {}, locs: {} };
  for (const k in byOpt) out.opts[k] = Object.assign(summ(byOpt[k].res), { none: byOpt[k].none });
  for (const k in byLoc) out.locs[k] = summ(byLoc[k]);
  console.log(JSON.stringify(out));
} else if (mode === 're') {
  const SEEDS = Number(process.argv[4] || 24), MONTHS = Number(process.argv[5] || 120);
  const TG = require('../test/load')(); const bots = require('../test/bots')(TG);
  const all = []; const byOpt = {}; const byLoc = {};
  for (const fin of ['cash', 'mortgage']) for (let s = 1; s <= SEEDS; s++) {
    const g = TG.Game.newGame({ seed: 3100 + s * 53 + unit.length * 7 + (fin === 'cash' ? 0 : 1) }); TG.G = g;
    const burn = (s * 37) % 121; for (let i = 0; i < burn; i++) { TG.W.month(g); g.month++; }
    const x0 = g.world.housing - 1;
    const L = TG.RE.gen(g, unit, { distressed: false }); g.re.listings = [L];
    const fees = Math.round(L.price * TG.CONFIG.property.buyCostPct); const ltv = TG.CONFIG.realEstate.kinds[unit].commercial ? 0.75 : 0.8;
    g.cash = Math.round(fin === 'cash' ? L.price + fees + L.price * 0.08 : L.price * (1 - ltv) + fees + L.price * 0.08); g.lastNW = TG.F.netWorth(g); const nw0 = g.cash;
    const r0 = TG.RE.buy(g, L.id, fin === 'mortgage', 360); if (!r0 || r0.ok === false) { (byOpt[fin] = byOpt[fin] || { none: 0, res: [] }).none++; continue; }
    const h = r0.h; let ruined = false; const pr = [];
    for (let m = 0; m < MONTHS; m++) {
      if (g.re.holdings.includes(h)) {
        for (let u = 0; u < h.tenants.length; u++) if (!h.tenants[u] && g.cash > 5000) { if (!TG.RE.current(g, h, u)) TG.RE.search(g, h.id, null, u); let tries = 0; while (TG.RE.current(g, h, u) && !h.tenants[u] && tries++ < 6) { const a = TG.RE.current(g, h, u); const marks = TG.RE.applicantMarks ? TG.RE.applicantMarks(a) : []; const bad = marks.filter((x) => x.tone === 'bad').length; TG.RE.decide(g, h.id, bad < 2 || tries > 3, u); } }
        for (const it of h.issues.slice()) if (g.cash > TG.RE.fixCost(g, it) + 2000) TG.RE.fixIssue(g, h.id, it.id);
      }
      const c0 = g.cash; TG.Game.nextMonth(g); bots.resolveSmart(g); if (m >= 12 && m < 36) pr.push(g.cash - c0);
      if (g.player.bankruptcies > 0) ruined = true;
    }
    const nw1 = g.lastNW; const cagr = nw1 > 0 ? Math.pow(nw1 / nw0, 12 / MONTHS) - 1 : -1;
    const r = { cagr, ruined, x0, prof3: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : -1, loc: L.loc };
    all.push(r); (byOpt[fin] = byOpt[fin] || { none: 0, res: [] }).res.push(r); (byLoc[L.loc] = byLoc[L.loc] || []).push(r);
  }
  const out = { unit: 're:' + unit, kind: 're', all: summ(all), opts: {}, locs: {} };
  for (const k in byOpt) out.opts[k] = Object.assign(summ(byOpt[k].res), { none: byOpt[k].none });
  for (const k in byLoc) out.locs[k] = summ(byLoc[k]);
  console.log(JSON.stringify(out));
} else if (mode === 'all') {
  const SEEDS = Number(process.argv[3] || 24), MONTHS = Number(process.argv[4] || 120);
  const oi = process.argv.indexOf('--out'); const OUT = oi > 0 ? process.argv[oi + 1] : path.join(__dirname, 'audit-results.json');
  const TG = require('../test/load')();
  const units = []; for (const t of Object.keys(TG.CONFIG.businesses)) { if (t === 'farm') for (const e of ['cows', 'crops', 'orchard']) units.push(['biz', 'farm:' + e]); else units.push(['biz', t]); }
  for (const u of units) units.push(['reck', u[1]]);
  for (const k of ['condo', 'house', 'duplex', 'smallapt', 'apartment', 'strip', 'officebldg', 'warehouse']) units.push(['re', k]);
  const { spawn } = require('child_process'); const results = []; let i = 0, running = 0; const PAR = Number(process.env.PAR || 7);
  const next = () => new Promise((done) => { const go = () => { while (running < PAR && i < units.length) { const u = units[i++]; running++; const ch = spawn(process.execPath, [__filename, u[0], u[1], SEEDS, MONTHS]); let s = ''; ch.stdout.on('data', (d) => { s += d; }); ch.stderr.on('data', (d) => process.stderr.write(`[${u[1]}] ${d}`)); ch.on('close', () => { running--; try { results.push(JSON.parse(s.trim().split('\n').pop())); } catch (e) { results.push({ unit: u[1], kind: u[0], err: s.slice(-300) }); } process.stderr.write(`done ${u[0]} ${u[1]} (${results.length}/${units.length})\n`); if (results.length === units.length) done(); else go(); }); } }; go(); });
  next().then(() => { fs.writeFileSync(OUT, JSON.stringify(results, null, 1)); console.log('wrote', OUT); });
}
