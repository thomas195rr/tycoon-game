// Print the balance-audit table: node tools/audit-table.js after.json [before.json] [--detail]
const fs = require('fs'); const A = JSON.parse(fs.readFileSync(process.argv[2])); const B = process.argv[3] && !process.argv[3].startsWith('--') ? JSON.parse(fs.readFileSync(process.argv[3])) : null;
const p = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : '–'); const key = (r) => r.kind + ':' + r.unit;
const bk = {}; if (B) for (const r of B) bk[key(r)] = r;
const careful = A.filter((r) => r.kind !== 'reck').sort((a, b) => (a.kind === 're') - (b.kind === 're') || a.unit.localeCompare(b.unit));
console.log('unit'.padEnd(15), 'median/yr', ' grew', ' prof yr2-3', ' ruin', ' worst10%', ' boom-start', ' slump-start', ' reckless med/ruin', B ? '   | BEFORE: median grew ruin worst10%' : '');
for (const r of careful) {
  const a = r.all; const rk = A.find((x) => x.kind === 'reck' && x.unit === r.unit); const b = bk[key(r)];
  console.log(r.unit.padEnd(15), p(a.med).padStart(9), p(a.grew).padStart(5), p(a.prof).padStart(11), p(a.ruin).padStart(5), p(a.p10).padStart(9), p(a.boom).padStart(11), p(a.slump).padStart(12), (rk ? `${p(rk.all.med)} / ${p(rk.all.ruin)}` : '').padStart(18), b ? `   | ${p(b.all.med).padStart(6)} ${p(b.all.grew).padStart(5)} ${p(b.all.ruin).padStart(4)} ${p(b.all.p10).padStart(6)}` : '');
}
if (process.argv.includes('--detail')) {
  console.log('\nStart options and locations (median/yr, grew, ruin; "none" = could not start with that budget):');
  for (const r of careful) {
    const o = Object.entries(r.opts).map(([k, v]) => `${k}: ${p(v.med)} ${p(v.grew)} ${p(v.ruin)}${v.none ? ` none ${v.none}` : ''}`).join(' | ');
    const l = Object.entries(r.locs).map(([k, v]) => `${k}(${v.n}) ${p(v.med)} ${p(v.grew)}`).join(' | ');
    console.log(`${r.unit}\n   options: ${o}\n   locations: ${l}`);
  }
}
