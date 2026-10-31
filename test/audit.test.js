// v9 balance audit check: every business (farm split by cows / crops / orchard) and every rental kind can succeed for a careful player,
// reckless play still loses. Runs tools/audit.js (see it for the bots and start options).
//   node test/audit.test.js [seeds=12] [months=120]
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const SEEDS = process.argv[2] || 12, MONTHS = process.argv[3] || 120; const out = path.join(os.tmpdir(), 'tycoon-audit-test.json');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'audit.js'), 'all', SEEDS, MONTHS, '--out', out], { stdio: ['ignore', 'ignore', 'ignore'] });
const R = JSON.parse(fs.readFileSync(out)); const bad = []; const p = (x) => (x * 100).toFixed(0) + '%';
for (const r of R) {
  if (r.err) { bad.push(`${r.unit}: crashed ${r.err}`); continue; }
  if (r.kind === 'reck') { if (!(r.all.med < 0)) bad.push(`${r.unit}: reckless play made ${p(r.all.med)}/yr`); continue; }
  const opts = Object.entries(r.opts).filter(([, o]) => o.n >= 3);
  const viable = opts.filter(([, o]) => o.med > 0.02 && o.grew >= 0.6 && o.ruin <= 0.15);
  if (!(r.all.med > 0)) bad.push(`${r.unit}: careful median ${p(r.all.med)}/yr`);
  if (!viable.length) bad.push(`${r.unit}: no start option where a careful player usually grows (${opts.map(([k, o]) => `${k} ${p(o.med)} grew ${p(o.grew)} ruin ${p(o.ruin)}`).join('; ')})`);
  if (r.kind === 'biz' && r.all.ruin > 0.15) bad.push(`${r.unit}: careful ruin ${p(r.all.ruin)}`);
  if (r.kind === 'biz' && r.all.med > 0.25) bad.push(`${r.unit}: careful median ${p(r.all.med)}/yr looks like a shortcut`);
}
console.log(`${R.length} units checked (${SEEDS} seeds x ${MONTHS} months)`);
if (bad.length) { console.log('BAD:\n' + bad.join('\n')); console.log('AUDIT TEST FAILED'); process.exit(1); }
console.log('AUDIT TEST PASSED');
