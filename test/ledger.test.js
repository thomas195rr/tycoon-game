// v7: money report reconciliation + loan amortization tests.
//  - every month: the report's lines (money in, money out, per business / property / investments / crime / you) add up
//    EXACTLY to the real change in cash since the end of last month (including what you did between months)
//  - skips: totals over the stretch reconcile, and the per-month rows add up to the total
//  - loans: each payment = interest on what is left + principal; schedules end at zero; extra payments shorten the loan;
//    a missed payment is never forgiven; credit line schedule pays down.
const load = require('./load.js'); const TG = load(); const bots = require('./bots.js')(TG);
const U = TG.U; const problems = []; let checked = 0;
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);
function checkReport(r, prevCash, label) {
  const M = r.money; if (!M) { problems.push(label + ': no money report'); return; }
  checked++;
  if (!near(M.cashStart, prevCash)) problems.push(`${label}: report starts at ${M.cashStart.toFixed(2)} but last month ended at ${prevCash.toFixed(2)}`);
  if (!near(r.cashEnd - prevCash, M.net)) problems.push(`${label}: cash moved ${(r.cashEnd - prevCash).toFixed(2)} but the report says ${M.net.toFixed(2)}`);
  const own = U.sum(M.owners, (o) => o.net); if (!near(own, M.net)) problems.push(`${label}: per-business/property lines add to ${own.toFixed(2)} not ${M.net.toFixed(2)}`);
  const gi = U.sum(Object.values(M.inG), (x) => x.t), go = U.sum(Object.values(M.outG), (x) => x.t);
  if (!near(gi - go, M.net)) problems.push(`${label}: money in/out groups add to ${(gi - go).toFixed(2)} not ${M.net.toFixed(2)}`);
  for (const o of M.owners) if (o.grp === 'biz' && r.biz.find((b) => b.id === o.k.slice(2)) && !near(r.biz.find((b) => b.id === o.k.slice(2)).cash, Math.round(o.net), 1)) problems.push(`${label}: business line mismatch`);
}
function runGame(label, seed, setup, policy, months) {
  const g = TG.Game.newGame({ seed }); TG.G = g; setup(g); g.cashMark = g.cash; g.acc = TG.F.newAcc();
  let prev = g.cash;
  for (let i = 0; i < months; i++) {
    try { policy(g); } catch (e) { problems.push(label + ' policy crash ' + e.message); }
    if (i % 23 === 7) {
      const s = TG.Game.skip(g, 6);
      if (!near(s.money.cashStart, prev)) problems.push(`${label} skip: starts at ${s.money.cashStart} not ${prev}`);
      if (!near(s.cash1 - prev, s.money.net, 2)) problems.push(`${label} skip: cash moved ${(s.cash1 - prev).toFixed(2)} but report ${s.money.net.toFixed(2)}`);
      const pm = U.sum(s.perMonth, (x) => x.net); if (!near(pm, s.money.net, 6 * 1)) problems.push(`${label} skip: month rows add to ${pm} not ${Math.round(s.money.net)}`);
      prev = g.cash; i += 5; checked++; continue;
    }
    const r = TG.Game.nextMonth(g); checkReport(r, prev, `${label} ${r.date}`); prev = r.cashEnd;
  }
  return g;
}
const SEEDS = Number((process.argv.find((a) => a.startsWith('--seeds=')) || '').split('=')[1]) || 6;
const types = Object.keys(TG.CONFIG.businesses);
for (let s = 1; s <= SEEDS; s++) {
  runGame(`random#${s}`, 500 + s, (g) => { g.cash += 800000; }, (g) => { for (let k = 0; k < 3; k++) bots.random(g); }, 140);
  for (const type of types) {
    let biz = null;
    runGame(`${type}#${s}`, s * 131 + types.indexOf(type), (g) => { g.cash = 3000000; biz = bots.startBiz(g, type); }, (g) => { if (biz && g.businesses.includes(biz)) bots[s % 2 ? 'careful' : 'reckless'](g, biz); bots.random(g); }, 60);
  }
}
// ---------- amortization ----------
{
  const g = TG.Game.newGame({ seed: 77 }); TG.G = g; g.cash = 5e6; const F = TG.F;
  const l = F.newLoan(g, 'business', 100000, { rate: 0.06, term: 120, noCash: true });
  const S0 = F.schedule(g, l); const pay = F.payment(100000, 0.06, 120);
  if (S0.length !== 120) problems.push(`amort: schedule has ${S0.length} payments, expected 120`);
  if (!near(U.sum(S0, (x) => x.prin), 100000, 1)) problems.push('amort: schedule principal does not add up to the loan');
  if (!near(S0[0].int, 500, 0.01)) problems.push(`amort: first interest ${S0[0].int} should be 500 (100k x 6% / 12)`);
  if (!near(U.sum(S0, (x) => x.int), pay * 120 - 100000, 120)) problems.push('amort: total interest off');
  for (let i = 1; i < S0.length; i++) if (!(S0[i].int < S0[i - 1].int)) { problems.push('amort: interest should shrink every month'); break; }
  let intSum = 0, n = 0, bal0 = l.balance;
  while (g.loans.includes(l) && n < 200) { const exp = Math.round(l.balance * l.rate / 12); g.acc = F.newAcc(); F.monthLoans(g); n++; const got = g.acc.exp['Loan interest'] || 0; if (!near(got, exp, 1)) { problems.push(`amort: month ${n} interest ${got} != balance x rate ${exp}`); break; } intSum += got; if (g.loans.includes(l) && !(l.balance < bal0)) { problems.push('amort: balance did not go down'); break; } bal0 = l.balance; }
  if (n !== 120) problems.push(`amort: loan took ${n} payments, expected 120`);
  if (!near(intSum, pay * 120 - 100000, 150)) problems.push(`amort: paid ${intSum} interest, expected ~${Math.round(pay * 120 - 100000)}`);
  if (!near(l.intPaid, intSum, 1)) problems.push('amort: interest-paid-so-far tracker is off');
  // extra payment: same payment, fewer months, less interest
  const l2 = F.newLoan(g, 'business', 200000, { rate: 0.07, term: 240, noCash: true }); const i0 = F.loanInfo(g, l2);
  F.prepay(g, l2.id, 40000); const i1 = F.loanInfo(g, l2);
  if (l2.payment !== i0.payment) problems.push('prepay: monthly payment should stay the same');
  if (!(i1.monthsLeft < i0.monthsLeft)) problems.push('prepay: loan should end sooner');
  if (!(i1.intLeft < i0.intLeft - 20000)) problems.push(`prepay: interest left should drop a lot (${Math.round(i0.intLeft)} -> ${Math.round(i1.intLeft)})`);
  if (!near(U.sum(i1.schedule, (x) => x.prin), l2.balance, 1)) problems.push('prepay: schedule does not clear the balance');
  // a missed payment is never forgiven
  const g2 = TG.Game.newGame({ seed: 78 }); TG.G = g2; const l3 = F.newLoan(g2, 'business', 20000, { rate: 0.08, term: 12, noCash: true });
  let paid = 0, k = 0; while (g2.loans.includes(l3) && k++ < 40) { g2.cash = k === 4 ? 0 : 1e6; g2.acc = F.newAcc(); F.monthLoans(g2); paid += (g2.acc.exp['Loan interest'] || 0) + (g2.acc.capOut['Loan principal'] || 0); }
  if (g2.loans.includes(l3)) problems.push('missed: loan never finished');
  if (!(paid > 20000 + 600)) problems.push(`missed: only ${paid} repaid on a 20k loan with a missed month (should be loan + interest + late fee)`);
  if (!(l3.prinPaid >= 20000 - 1)) problems.push('missed: principal paid should cover the whole loan');
  // credit line: interest on what you owe + minimum payment; the schedule pays it down
  g.loc.limit = 50000; g.loc.balance = 30000; const li = F.locInfo(g);
  if (!(li.monthsLeft > 12 && li.schedule[li.schedule.length - 1].bal < 1)) problems.push('credit line schedule does not pay down');
  if (!near(li.thisInt, 30000 * li.rate / 12, 0.01)) problems.push('credit line interest should be balance x rate / 12');
  console.log(`amortization: 100k @6% 10y payment ${Math.round(pay)}, interest paid ${Math.round(intSum)} over ${n} payments; prepay 40k on 200k: ${i0.monthsLeft} -> ${i1.monthsLeft} months, saves ${U.money(i0.intLeft - i1.intLeft)} interest; missed-month 20k loan repaid ${U.money(paid)}`);
}
console.log(`reconciliation: ${checked} monthly reports / skips checked`);
if (problems.length) { console.log('PROBLEMS:\n - ' + problems.slice(0, 40).join('\n - ') + (problems.length > 40 ? `\n ...and ${problems.length - 40} more` : '')); process.exit(1); }
console.log('LEDGER & LOAN TESTS PASSED');
