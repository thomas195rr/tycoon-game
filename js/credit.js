/* credit.js - v6 credit score and loan applications.
   The score (300-850) is recomputed from your record: on-time months, late/missed payments (fade over time), credit line use,
   debt vs what you own, credit age, recent applications (hard inquiries), bankruptcies and defaults.
   Loans are APPLIED for: you see the odds and the factors first (good / okay / bad), a denial is possible and counts as an inquiry.
   No exploit: on-time credit counts once a month at most, every application is an inquiry, every loan has a fee. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const CR = {};
  const CC = () => TG.CONFIG.credit;
  CR.ensure = (g) => {
    const p = g.player;
    if (!p.cr) { // old saves / new games: build a past record that matches the score they start with
      const s = p.credit || 700; const q = U.clamp((s - 560) / 220, 0, 1);
      p.cr = { start: g.month, age0: Math.round(18 + q * 150 + R.range(0, 20)), prior: Math.round(8 + q * 40), onTime: 0, lastOn: -1, lates: [], inq: [], derog: [] };
      if (q < 0.45) p.cr.lates.push({ m: g.month - R.int(6, 30), sev: 1 + (0.45 - q) * 6 });
      if (p.bankruptcies) p.cr.derog.push({ m: g.month - 1, kind: 'bankruptcy' });
    }
    if (!g.loc.limit && g.loc.limit !== 0) g.loc.limit = g.loc.balance > 0 ? Math.max(g.loc.balance, 20000) : 0;
    return p.cr;
  };
  const fade = (m, now, half) => Math.pow(0.5, Math.max(0, now - m) / half);
  // utilization -> share of points (under 10% is best)
  const utilF = (u) => { const T = [[0, 1], [0.1, 1], [0.3, 0.88], [0.5, 0.65], [0.75, 0.4], [0.9, 0.2], [1, 0.08]]; for (let i = 1; i < T.length; i++) if (u <= T[i][0]) { const [a, fa] = T[i - 1], [b, fb] = T[i]; return fa + (fb - fa) * (u - a) / (b - a); } return 0.05; };
  CR.score = (g) => {
    const cr = CR.ensure(g), c = CC(), P = c.pts, now = g.month; const parts = [];
    // 1) payment history
    const paid = cr.prior + cr.onTime; const lw = U.sum(cr.lates, (x) => x.sev * fade(x.m, now, c.lateHalfLife));
    const thin = 0.55 + 0.45 * Math.min(1, paid / c.thinMonths); const pay = thin * Math.max(0, 1 - c.lateHit * lw);
    parts.push({ k: 'pay', icon: '🧾', label: 'Payment history', pts: P.pay * pay, max: P.pay, mark: lw > 0.8 ? 'bad' : lw > 0.2 || paid < 12 ? 'ok' : 'good',
      why: `${paid} months paid on time${lw > 0.05 ? `, late/missed payments still count (weight ${lw.toFixed(1)}; they fade by half every ${c.lateHalfLife} months)` : ', no recent late payments'}.` });
    // 2) credit line use
    const lim = g.loc.limit || 0; const u = lim > 0 ? g.loc.balance / lim : null;
    const uf = u == null ? 0.75 : utilF(u);
    parts.push({ k: 'util', icon: '💳', label: 'Credit line use', pts: P.util * uf, max: P.util, mark: u == null ? 'ok' : u <= 0.3 ? 'good' : u <= 0.6 ? 'ok' : 'bad',
      why: u == null ? 'No credit line yet: lenders cannot see how you handle one.' : `Using ${U.pct(u)} of your ${U.money(lim)} line. Under 10% scores best; over 75% hurts a lot.` });
    // 3) debt vs what you own
    const nw = TG.F.netWorth(g, true); const debt = TG.F.debt(g); const d = nw.assets > 0 ? debt / nw.assets : (debt > 0 ? 2 : 0);
    const df = Math.pow(U.clamp(1 - d / 0.9, 0, 1), 0.8);
    parts.push({ k: 'debt', icon: '⚖️', label: 'Debt vs what you own', pts: P.debt * df, max: P.debt, mark: d < 0.35 ? 'good' : d < 0.6 ? 'ok' : 'bad', why: `Debt ${U.money(debt)} is ${U.pct(d)} of everything you own (${U.money(nw.assets)}).` });
    // 4) age
    const age = cr.age0 + Math.max(0, now - cr.start); const af = Math.min(1, age / c.ageFull);
    parts.push({ k: 'age', icon: '📅', label: 'Credit age', pts: P.age * af, max: P.age, mark: age >= 96 ? 'good' : age >= 36 ? 'ok' : 'bad', why: `${Math.floor(age / 12)} years ${age % 12} months of credit history. Grows on its own with time.` });
    // 5) applications
    const inq = cr.inq.filter((m) => now - m < c.inqMonths).length; const inf = Math.max(0, 1 - c.inqHit * inq);
    parts.push({ k: 'inq', icon: '📝', label: 'Recent applications', pts: P.inq * inf, max: P.inq, mark: inq <= 1 ? 'good' : inq <= 3 ? 'ok' : 'bad', why: `${inq} loan application(s) in the last ${c.inqMonths} months. Each one (approved or not) lowers the score a little.` });
    // 6) bankruptcies, defaults, repossessions
    let dg = 0; const dl = [];
    for (const x of cr.derog) { const [pts, mo] = c.derog[x.kind] || [60, 48]; const left = Math.max(0, 1 - (now - x.m) / mo); if (left > 0) { dg += pts * left; dl.push(`${x.kind} (${Math.ceil((mo - (now - x.m)) / 12)} yrs left)`); } }
    if (dg > 0) parts.push({ k: 'derog', icon: '🚨', label: 'Bankruptcy / defaults', pts: -dg, max: 0, mark: 'bad', why: `On your record: ${dl.join(', ')}. Fades over time.` });
    const score = Math.round(U.clamp(300 + U.sum(parts, (x) => x.pts), 300, 850));
    return { score, parts };
  };
  CR.sync = (g) => { g.player.credit = CR.score(g).score; return g.player.credit; };
  CR.label = (s) => (s >= 760 ? 'Excellent' : s >= 700 ? 'Good' : s >= 640 ? 'Fair' : s >= 580 ? 'Poor' : 'Very poor');
  CR.tone = (s) => (s >= 700 ? 'good' : s >= 620 ? 'warn' : 'bad');
  // record events
  CR.onTime = (g) => { const cr = CR.ensure(g); if (cr.lastOn === g.month) return; cr.lastOn = g.month; cr.onTime++; };
  CR.late = (g, sev) => { CR.ensure(g).lates.push({ m: g.month, sev: sev || 1 }); CR.sync(g); };
  CR.inquiry = (g) => { CR.ensure(g).inq.push(g.month); };
  CR.derog = (g, kind) => { CR.ensure(g).derog.push({ m: g.month, kind }); CR.sync(g); };

  // ---------- loan quotes ----------
  const L = (type) => TG.CONFIG.finance.loans[type];
  CR.rate = (g, type, score) => {
    const s = score == null ? CR.score(g).score : score; const ind = type === 'business' ? CR.indScore(g) : 0;
    return U.clamp(g.world.baseRate + L(type).spread + Math.max(0, 760 - s) * CC().rateSpread - ind * CC().indRate, 0.01, 0.45);
  };
  // how your industries are doing (for business loans): average cycle level of the industries you are in
  CR.indScore = (g) => { if (!g.businesses.length || !TG.IN) return 0; return U.avg(g.businesses, (b) => TG.IN.score(g, TG.IN.ofBiz(b))); };
  // money available for debt payments each month. Savings count too (lenders treat spare cash, net of what you owe, as if paid out over 20 years);
  // borrowed cash never counts because debt is subtracted first.
  CR.income = (g) => Math.max(0, TG.F.avgProfit(g)) + TG.F.totalPayments(g) + Math.max(0, g.cash - TG.F.debt(g)) / 240;
  // quote: everything the player sees before applying
  CR.quote = (g, type, amount, opts) => {
    opts = opts || {}; const c = CC(); amount = Math.max(0, Math.round(amount || 0));
    const sc = CR.score(g).score; const term = opts.term || (type === 'loc' ? 0 : L(type).term);
    const rate = CR.rate(g, type, sc); const pay = type === 'loc' ? Math.round(amount * TG.CONFIG.finance.loc.minPayPct) : Math.round(TG.F.payment(amount, rate, term));
    const fee = type === 'loc' ? Math.round(c.fee.loc * g.world.priceIdx) : Math.round(amount * (c.fee[type] || 0.015));
    const nw = TG.F.netWorth(g, true); const debt = TG.F.debt(g) + amount; const dv = nw.assets + (opts.asset || 0) > 0 ? debt / (nw.assets + (opts.asset || 0)) : 2;
    const inc = CR.income(g); const dti = (TG.F.totalPayments(g) + (type === 'loc' ? amount * 0.03 : pay)) / Math.max(1500, inc + (opts.extraIncome || 0));
    const inq = CR.ensure(g).inq.filter((m) => g.month - m < c.inqMonths).length;
    const recentLate = U.sum(CR.ensure(g).lates.filter((x) => g.month - x.m < 12), (x) => x.sev);
    const F = []; let z = c.base[type] || 0;
    const add = (label, val, mark, dz, why) => { F.push({ label, val, mark, why }); z += dz; };
    add('Credit score', String(sc), sc >= 720 ? 'good' : sc >= 640 ? 'ok' : 'bad', (sc - 680) / 45, `${CR.label(sc)}. Higher = better odds and a lower rate.`);
    add('Payments vs income', U.pct(Math.min(dti, 9)), dti < 0.35 ? 'good' : dti < 0.55 ? 'ok' : 'bad', dti < 0.35 ? 0.4 : dti < 0.55 ? -0.3 : -1.6 - Math.min(2, dti - 0.55) * 1.5, `All loan payments would take ${U.pct(Math.min(dti, 9))} of the money you make (${U.money(inc + (opts.extraIncome || 0))}/mo, counting profit and some of your spare savings). Under 35% is comfortable.`);
    add('Debt vs what you own', U.pct(Math.min(dv, 9)), dv < 0.45 ? 'good' : dv < 0.7 ? 'ok' : 'bad', dv < 0.45 ? 0.4 : dv < 0.7 ? -0.3 : -1.4 - Math.min(2, dv - 0.7) * 2, `After this loan you would owe ${U.money(debt)} against ${U.money(nw.assets + (opts.asset || 0))} of things you own.`);
    if (opts.ltv != null) add('Down payment', U.pct(1 - opts.ltv), opts.ltv <= 0.75 ? 'good' : opts.ltv <= 0.85 ? 'ok' : 'bad', opts.ltv <= 0.75 ? 0.5 : opts.ltv <= 0.85 ? 0 : -0.8, 'The property backs the loan. A bigger down payment makes lenders safer.');
    if (type === 'equipment') { const cap = CR.equipCap(g); add('Machines as security', U.money(cap), amount <= cap ? 'good' : 'bad', amount <= cap ? 0.4 : -2.5, `Lenders lend up to 70% of what your machines are worth, minus other equipment loans (${U.money(cap)}).`); }
    if (type === 'business') { const x = CR.indScore(g); const st = x > 0.04 ? 'good' : x > -0.04 ? 'ok' : 'bad'; add('Your industries', g.businesses.length ? (x > 0.04 ? 'doing well' : x > -0.04 ? 'steady' : 'struggling') : 'no business yet', g.businesses.length ? st : 'bad', g.businesses.length ? x * 6 : -0.8, 'Lenders check how your industries are doing right now (Industry Outlook).'); }
    add('Recent applications', String(inq), inq <= 1 ? 'good' : inq <= 3 ? 'ok' : 'bad', -0.25 * Math.max(0, inq - 1), 'Lots of applications in a short time looks desperate.');
    add('Late payments (last year)', recentLate > 0 ? recentLate.toFixed(1) : 'none', recentLate <= 0 ? 'good' : recentLate < 2 ? 'ok' : 'bad', -0.7 * recentLate, 'Missed or late payments in the last 12 months.');
    let odds = U.clamp(1 / (1 + Math.exp(-z)), 0.02, 0.97);
    let block = null;
    if (type !== 'emergency' && g.player.noLoanUntil > g.month) block = `Lenders refuse new loans for ${g.player.noLoanUntil - g.month} more months (bankruptcy).`;
    const max = CR.max(g, type); if (amount > max) block = block || `Lenders cap this at about ${U.money(max)} for you.`;
    if (!(amount > 0)) block = block || 'Enter an amount.';
    if (block) odds = 0;
    return { type, amount, term, rate, pay, fee, odds, factors: F, score: sc, block, max };
  };
  CR.equipCap = (g) => Math.max(0, Math.round(U.sum(g.businesses, (b) => TG.E.value(g, b)) * 0.7 - U.sum(g.loans.filter((l) => l.type === 'equipment'), (l) => l.balance)));
  CR.max = (g, type) => {
    if (type === 'equipment') return CR.equipCap(g);
    if (type === 'loc') { const nw = Math.max(0, TG.F.netWorth(g)); return Math.round((20000 + 0.2 * nw + 6 * Math.max(0, TG.F.avgProfit(g))) / 1000) * 1000; }
    if (type === 'mortgage') return Infinity;
    return TG.F.maxLoan(g, type);
  };
  // apply: always an inquiry; approved -> the loan (fee paid out of the proceeds)
  CR.apply = (g, type, amount, opts) => {
    opts = opts || {}; const q = CR.quote(g, type, amount, opts);
    if (q.block) return { ok: false, msg: q.block, quote: q };
    CR.inquiry(g);
    const ok = R.chance(q.odds);
    if (!ok) { CR.sync(g); TG.rep.event(g, null, 'bad', `Loan application denied: ${L(type).label} ${U.money(q.amount)}`, `Odds were ${U.pct(q.odds)}. Weak spots: ${q.factors.filter((f) => f.mark === 'bad').map((f) => f.label.toLowerCase()).join(', ') || 'none, just unlucky'}. It still counts as an application.`); return { ok: false, denied: true, msg: `Denied (odds were ${U.pct(q.odds)}). It counts as an application.`, quote: q }; }
    if (opts.dryApprove) { CR.sync(g); return { ok: true, quote: q }; }
    if (type === 'loc') { g.loc.limit = (g.loc.limit || 0) + q.amount; TG.F.spend(g, q.fee, 'Loan fees'); CR.sync(g); return { ok: true, quote: q, limit: g.loc.limit }; }
    const loan = TG.F.newLoan(g, type, q.amount, Object.assign({}, opts, { term: q.term, rate: q.rate }));
    if (q.fee) TG.F.spend(g, q.fee, 'Loan fees');
    CR.sync(g); return { ok: true, loan, quote: q };
  };
  // monthly: lenders review credit lines (a poor record shrinks the line)
  CR.month = (g) => {
    CR.ensure(g); const s = CR.sync(g);
    if (g.loc.limit > 0 && (s < 560 || g.loans.some((l) => l.missed >= 2))) { const nl = Math.max(Math.round(g.loc.balance), Math.round(g.loc.limit * 0.5 / 1000) * 1000); if (nl < g.loc.limit) { g.loc.limit = nl; TG.rep.event(g, null, 'bad', `The bank cut your credit line to ${U.money(nl)}`, `Credit score ${s}${g.loans.some((l) => l.missed >= 2) ? ' and missed loan payments' : ''}`); } }
  };
  TG.CR_ = CR; TG.CREDIT = CR;
})();
