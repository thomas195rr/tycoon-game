// Crime must not be a reliable money machine: compares crime plans with careful legit play (runs tools/crime-balance.js).
const { execFileSync } = require('child_process'); const path = require('path');
const SEEDS = process.argv[2] || '12';
execFileSync('node', [path.join(__dirname, '..', 'tools', 'crime-balance.js'), SEEDS, '120', '--json'], { stdio: 'inherit' });
const rows = require('../tools/crime-balance.json'); const R = Object.fromEntries(rows.map((r) => [r.name, r])); let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL: ' + m); } };
const legit = R['legit careful (cafe)'];
for (const n of ['street only, careful', 'street only, cheap prices (0.85x)', 'street only, dear prices (1.25x)', 'bank jobs only']) ok(R[n].med <= legit.med + 0.03, `${n} median ${R[n].med} beats legit ${legit.med} by more than 3 points`);
ok(R['street + cafe front, careful'].med <= R['legit careful (carwash)'].med, 'crime + front beats the best legit business');
ok(R['street + cafe front, careful'].p10 <= legit.p10, 'crime + front is safer than legit at the bottom 10%');
ok(R['street only, careful'].ruin > 0, 'careful crime never ruined anyone');
ok(R['street only, reckless'].ruin >= 0.7 && R['cafe + reckless crime'].ruin >= 0.7, 'reckless crime is not ruined most of the time');
console.log(fails ? `${fails} CRIME BALANCE CHECK(S) FAILED` : 'ALL CRIME BALANCE CHECKS PASSED'); process.exit(fails ? 1 : 0);
