/* finance.js - cash flow, loans, credit line, credit score, taxes, insurance, investors, valuation, bankruptcy. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const F = {};
  const acc = (g) => (g.acc = g.acc || F.newAcc());
  F.newAcc = () => ({ inc: {}, exp: {}, capIn: {}, capOut: {}, led: {}, names: {} });

  F.earn = (g, amt, label, bizId, capital) => {
    amt = U.num(amt); if (!amt) return;
    g.cash += amt; const a = acc(g); if (TG.LG) TG.LG.rec(g, amt, label, bizId);
    const bucket = capital ? a.capIn : a.inc; bucket[label] = (bucket[label] || 0) + amt;
    if (bizId && !capital) { const b = g.businesses.find((x) => x.id === bizId); if (b && b.m) { b.m.rev += amt; b.m.lines[label] = (b.m.lines[label] || 0) + amt; } }
  };
  F.spend = (g, amt, label, bizId, capital) => {
    amt = U.num(amt); if (!amt) return;
    g.cash -= amt; const a = acc(g); if (TG.LG) TG.LG.rec(g, -amt, label, bizId);
    const bucket = capital ? a.capOut : a.exp; bucket[label] = (bucket[label] || 0) + amt;
    if (bizId && !capital) { const b = g.businesses.find((x) => x.id === bizId); if (b && b.m) { b.m.cost += amt; b.m.lines[label] = (b.m.lines[label] || 0) - amt; } }
  };

  // accounting-only expense (e.g. cost of goods sold for stock that was paid for when ordered): hits profit, not cash
  F.book = (g, amt, label, bizId) => {
    amt = U.num(amt); if (!amt) return;
    const a = acc(g); a.exp[label] = (a.exp[label] || 0) + amt; a.capIn[label + ' (non-cash)'] = (a.capIn[label + ' (non-cash)'] || 0) + amt;
    if (bizId) { const b = g.businesses.find((x) => x.id === bizId); if (b && b.m) { b.m.cost += amt; b.m.lines[label] = (b.m.lines[label] || 0) - amt; } }
  };
  // ---------- rates & credit ----------
  F.rateFor = (g, type) => {
    return TG.CREDIT.rate(g, type, g.player.credit); // v6: rate from the credit score (+ industry outlook for business loans)
  };
  F.payment = (P, rate, n) => { const r = rate / 12; return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n)); };
  F.assets = (g) => Math.max(0, F.netWorth(g, true).assets);

  F.maxLoan = (g, type) => {
    const C = TG.CONFIG.finance, L = C.loans[type];
    const nw = F.netWorth(g);
    const cf = U.clamp((g.player.credit - 500) / 300, 0.1, 1.2);
    if (type === 'business') return Math.max(0, Math.round((L.maxBase + L.maxNW * Math.max(0, nw) + 4 * Math.max(0, F.avgProfit(g))) * cf));
    if (type === 'emergency') return Math.round(L.maxBase + L.maxAssets * F.assets(g));
    return Infinity;
  };
  // v6: borrowing is an APPLICATION (see credit.js). canBorrow kept for old callers: it applies and, if approved, returns ok.
  F.canBorrow = (g, type, amount, opts) => TG.CREDIT.apply(g, type, amount, Object.assign({}, opts, { dryApprove: true }));
  F.newLoan = (g, type, amount, opts) => {
    opts = opts || {};
    const L = TG.CONFIG.finance.loans[type];
    const rate = opts.rate || F.rateFor(g, type);
    const term = opts.term || L.term;
    const loan = { id: U.uid('l'), type, label: opts.label || L.label, principal: Math.round(amount), balance: Math.round(amount), rate, term, left: term,
      payment: Math.round(F.payment(amount, rate, term)), missed: 0, collateral: opts.collateral || null, bizId: opts.bizId || null, start: g.month, intPaid: 0, prinPaid: 0 };
    g.loans.push(loan);
    if (!opts.noCash) F.own(g, loan, () => F.earn(g, amount, 'Loan proceeds', null, true));
    return loan;
  };
  // v7: money for a loan lands on the line of whatever it pays for (a business, a rental, a building), else on "You"
  F.own = (g, l, fn) => (TG.LG && !g._own ? TG.LG.within(g, TG.LG.loanOwner(g, l), fn) : fn());
  F.takeLoan = (g, type, amount, opts) => {
    amount = Math.round(amount);
    if (!(amount > 0)) return { ok: false, msg: 'Enter an amount.' };
    return TG.CREDIT.apply(g, type, amount, opts);
  };
  F.payoff = (g, loanId, fromSale) => {
    const l = g.loans.find((x) => x.id === loanId); if (!l) return;
    F.own(g, l, () => F.spend(g, l.balance, 'Loan payoff', null, true));
    l.prinPaid = (l.prinPaid || 0) + l.balance;
    g.loans = g.loans.filter((x) => x !== l);
  };
  // v7: an extra payment goes straight to principal; the monthly payment stays the same, so the loan ends sooner
  // and you skip the interest on those months (like a real mortgage).
  F.prepay = (g, loanId, amt) => {
    const l = g.loans.find((x) => x.id === loanId); if (!l) return 0;
    amt = Math.min(Math.round(amt), l.balance, Math.max(0, g.cash)); if (amt <= 0) return 0;
    F.own(g, l, () => F.spend(g, amt, 'Loan prepayment', null, true)); l.balance -= amt; l.prinPaid = (l.prinPaid || 0) + amt;
    if (l.balance <= 1) g.loans = g.loans.filter((x) => x !== l);
    else l.left = Math.max(1, F.nper(l.balance, l.rate, l.payment));
    return amt;
  };
  // months needed to repay P at a fixed payment A
  F.nper = (P, rate, A) => { const r = rate / 12; if (P <= 0) return 0; if (r === 0) return Math.ceil(P / Math.max(1, A)); if (A <= P * r) return 999; return Math.ceil(-Math.log(1 - r * P / A) / Math.log(1 + r) - 1e-9); };
  // the full amortization schedule from now: each payment = interest on what is left + the rest off the balance
  F.schedule = (g, l, max) => {
    const rows = []; let bal = l.balance; const r = l.rate / 12; let left = Math.max(1, l.left || 1); max = max || 600;
    for (let n = 1; bal > 0.5 && n <= max; n++) {
      const int = bal * r; const pay = left <= 1 ? bal + int : Math.min(l.payment, bal + int);
      const prin = pay - int; bal = Math.max(0, bal - prin); left--;
      rows.push({ n, m: g.month + n - 1, pay, int, prin, bal });
    }
    return rows;
  };
  F.loanInfo = (g, l) => {
    const S = F.schedule(g, l); const int0 = l.balance * l.rate / 12;
    return { original: l.principal, balance: l.balance, rate: l.rate, term: l.term, payment: l.payment, thisInt: int0, thisPrin: Math.max(0, Math.min(l.payment, l.balance + int0) - int0),
      intPaid: l.intPaid || 0, prinPaid: l.prinPaid || 0, intLeft: U.sum(S, (x) => x.int), monthsLeft: S.length, payoffM: S.length ? S[S.length - 1].m : g.month, schedule: S, owner: TG.LG ? TG.LG.loanOwner(g, l) : 'you' };
  };
  // credit line as a loan: interest on what you owe + a minimum share of the balance each month
  F.locInfo = (g) => {
    const C = TG.CONFIG.finance.loc; const rate = g.loc.balance > 0 ? (g.loc.rate || F.rateFor(g, 'loc')) : F.rateFor(g, 'loc');
    const rows = []; let bal = g.loc.balance; const r = rate / 12;
    for (let n = 1; bal > 0.5 && n <= 600; n++) { const int = bal * r; const prin = Math.max(Math.min(bal, 25), Math.round(bal * C.minPayPct)); const pr = Math.min(bal, prin); bal -= pr; rows.push({ n, m: g.month + n - 1, pay: int + pr, int, prin: pr, bal }); }
    const int0 = g.loc.balance * r;
    return { original: g.loc.limit || 0, balance: g.loc.balance, rate, term: null, payment: rows.length ? rows[0].pay : 0, thisInt: int0, thisPrin: rows.length ? rows[0].prin : 0,
      intPaid: g.loc.intPaid || 0, prinPaid: g.loc.prinPaid || 0, intLeft: U.sum(rows, (x) => x.int), monthsLeft: rows.length, payoffM: rows.length ? rows[rows.length - 1].m : g.month, schedule: rows, owner: 'you' };
  };
  F.totalPayments = (g) => U.sum(g.loans, (l) => l.payment) + (g.loc ? Math.round(g.loc.balance * TG.CONFIG.finance.loc.minPayPct) : 0);
  F.debt = (g) => U.sum(g.loans, (l) => l.balance) + (g.loc ? g.loc.balance : 0) + (g.invest ? g.invest.marginDebt : 0);
  F.avgProfit = (g) => { const h = g.history.slice(-6); return h.length ? U.avg(h, (x) => x.profit) : 0; };

  // v6: the credit line limit is whatever a lender approved (apply in the Money tab); lenders cut it if your record turns bad
  F.locLimit = (g) => (g.player.noLoanUntil > g.month ? Math.round(g.loc.balance) : Math.max(0, g.loc.limit || 0));
  F.locDraw = (g, amt, by) => {
    const lim = F.locLimit(g); amt = Math.min(Math.round(amt), lim - g.loc.balance);
    if (amt <= 0) return 0;
    g.loc.balance += amt; const go = () => F.earn(g, amt, 'Credit line draw', null, true); if (TG.LG) TG.LG.within(g, 'you', go); else go();
    return amt;
  };
  F.locRepay = (g, amt) => { amt = Math.min(Math.round(amt), g.loc.balance, Math.max(0, g.cash)); if (amt <= 0) return 0; g.loc.balance -= amt; g.loc.prinPaid = (g.loc.prinPaid || 0) + amt; const go = () => F.spend(g, amt, 'Credit line repayment', null, true); if (TG.LG) TG.LG.within(g, 'you', go); else go(); return amt; };

  // ---------- monthly debt service ----------
  F.monthLoans = (g) => {
    const C = TG.CONFIG.finance; TG.CREDIT.month(g); let paidAll = g.loans.length > 0 || g.loc.balance > 0;
    for (const l of g.loans.slice()) F.own(g, l, () => {
      const interest = l.balance * l.rate / 12;
      // v7: amortizing like a real mortgage. The last payment clears whatever is left (nothing is ever forgiven).
      const pay = l.left <= 1 ? l.balance + interest : Math.min(l.payment, l.balance + interest);
      if (g.cash >= pay || F.autoCredit(g, pay - g.cash)) {
        const ri = Math.round(interest), rp = Math.round(pay - interest);
        F.spend(g, ri, 'Loan interest');
        F.spend(g, rp, 'Loan principal', null, true);
        l.balance = Math.max(0, l.balance - (pay - interest)); l.left--; l.missed = 0;
        l.intPaid = (l.intPaid || 0) + ri; l.prinPaid = (l.prinPaid || 0) + rp; l.lastInt = ri; l.lastPrin = rp; l.lastM = g.month;
        if (l.balance < 1 || l.left <= 0) { g.loans = g.loans.filter((x) => x !== l); TG.rep.event(g, null, 'good', `Paid off ${l.label}`, `All payments made. Interest paid over the loan: ${U.money(l.intPaid)}`); }
      } else {
        l.missed++; l.balance += Math.round(interest + pay * C.lateFeePct);
        l.payment = Math.round(F.payment(l.balance, l.rate, Math.max(1, l.left))); // missed interest is added on; payments rise to stay on schedule
        l.lastInt = 0; l.lastPrin = 0; l.lastM = g.month;
        paidAll = false; TG.CREDIT.late(g, 1);
        TG.rep.event(g, null, 'major', `Missed a payment on ${l.label}`, `Cash ${U.money(g.cash)} was below the ${U.money(pay)} payment; credit score now ${Math.round(g.player.credit)}. ${l.collateral ? `After ${C.repoAfterMissed} missed payments the lender takes the ${l.collateral.kind === 'equip' ? 'machine' : 'property'}.` : `After ${TG.CONFIG.credit.collectionsAfter} it goes to collections.`}`, { major: 'cash' });
        if (l.missed >= C.repoAfterMissed && l.collateral) { F.repossess(g, l); TG.CREDIT.derog(g, 'repo'); }
        else if (!l.collateral && l.missed >= TG.CONFIG.credit.collectionsAfter && !l.coll) { l.coll = true; TG.CREDIT.derog(g, 'collections'); TG.rep.event(g, null, 'major', `${l.label} was sent to collections`, `${l.missed} missed payments in a row: a big hit to your credit score for years`, { major: 'cash' }); }
      }
    });
    // credit line
    if (g.loc.balance > 0) {
      g.loc.rate = F.rateFor(g, 'loc');
      const interest = Math.round(g.loc.balance * g.loc.rate / 12);
      const minPay = Math.min(Math.round(g.loc.balance), Math.max(25, Math.round(g.loc.balance * C.loc.minPayPct)));
      F.spend(g, interest, 'Credit line interest'); g.loc.intPaid = (g.loc.intPaid || 0) + interest;
      if (g.cash >= minPay) { F.spend(g, minPay, 'Credit line repayment', null, true); g.loc.balance -= minPay; g.loc.prinPaid = (g.loc.prinPaid || 0) + minPay; }
      else { paidAll = false; TG.CREDIT.late(g, 0.6); TG.rep.event(g, null, 'bad', 'Missed the credit line minimum payment', `Cash ${U.money(g.cash)}`); }
    }
    if (paidAll) TG.CREDIT.onTime(g); // on-time record counts once a month, however many loans you have
    TG.CREDIT.sync(g);
  };
  F.repossess = (g, l) => {
    const c = l.collateral;
    if (c.kind === 'property') {
      const p = g.properties.find((x) => x.id === c.id);
      if (p) {
        if (p.bizId) { const b = g.businesses.find((x) => x.id === p.bizId); if (b) TG.B.close(g, b, 'Property repossessed by the lender', true); }
        const v = Math.round(TG.P.value(g, p) * TG.CONFIG.finance.bankruptcy.fireSale);
        g.properties = g.properties.filter((x) => x !== p);
        const surplus = v - l.balance; if (surplus > 0) F.earn(g, surplus, 'Repossession surplus', null, true);
        TG.rep.event(g, null, 'major', `Lender repossessed ${p.name}`, `${l.missed} missed payments on ${l.label}`, { major: 'cash' });
      }
      const rh = g.re.holdings.find((x) => x.id === c.id);
      if (rh) { const v = Math.round(TG.RE.value(g, rh) * 0.7); g.re.holdings = g.re.holdings.filter((x) => x !== rh); const s = v - l.balance; if (s > 0) F.earn(g, s, 'Repossession surplus', null, true); TG.rep.event(g, null, 'major', `Lender repossessed ${rh.name}`, `${l.missed} missed payments`, { major: 'cash' }); }
    } else if (c.kind === 'equip') {
      for (const b of g.businesses) { const it = b.equip.find((x) => x.id === c.id); if (it) { b.equip = b.equip.filter((x) => x !== it); TG.rep.event(g, b, 'major', `Lender repossessed ${it.label}`, `${l.missed} missed payments`, { major: 'breakdown' }); } }
    }
    g.loans = g.loans.filter((x) => x !== l);
  };
  // accountant / CFO / CEO draw on the credit line in a crunch
  F.autoCredit = (g, need) => {
    if (need <= 0) return true;
    const handler = F.moneyHandler(g); if (!handler) return false; // v6: only an accountant or CEO draws on the credit line for you
    const lim = F.locLimit(g); const room = lim - g.loc.balance;
    if (room < need) return false;
    F.locDraw(g, Math.ceil(need)); TG.rep.decision(g, null, handler ? handler.label : 'Auto-pay setting', `Drew ${U.money(need)} on the credit line to cover a payment`);
    return true;
  };
  F.moneyHandler = (g) => {
    if (g.ceo) return { label: 'CEO ' + g.ceo.name, emp: g.ceo };
    for (const b of g.businesses) if (b.spec && b.spec.accountant) return { label: 'Accountant ' + b.spec.accountant.name, emp: b.spec.accountant };
    return null;
  };

  // ---------- insurance ----------
  F.premium = (g, b, type) => {
    const I = TG.CONFIG.finance.insurance[type]; if (!I) return 0;
    let p = 0;
    const rev = Math.max(b.revAvg || 0, 3000);
    if (I.rev) p = rev * I.rev;
    if (I.val) p = (type === 'property' ? (b.propValue || 0) : TG.E.value(g, b)) * I.val;
    if (I.perAcre) p = (b.farm ? b.farm.acres : 0) * I.perAcre;
    if (I.perUnit) p = b.equip.filter((x) => x.type === 'truck').length * I.perUnit;
    if (type === 'malpractice') p = Math.max(p, I.min * Math.max(1, b.staff.filter((e) => TG.CONFIG.businesses[b.type].roles[e.role] && TG.CONFIG.businesses[b.type].roles[e.role].licensed).length));
    return Math.round(Math.max(I.min, p) * (b.insHike || 1) * g.world.priceIdx);
  };
  F.claim = (g, b, type, loss, label) => {
    const C = TG.CONFIG.finance;
    if (!b || !type || !b.ins || !b.ins[type] || loss <= 0) return 0;
    const pay = Math.round(Math.max(0, loss - C.insDeductible * g.world.priceIdx) * C.insCover);
    if (pay <= 0) return 0;
    F.earn(g, pay, 'Insurance payouts', b.id);
    b.insHike = (b.insHike || 1) + C.insClaimHike;
    TG.rep.event(g, b, 'info', `Insurance (${C.insurance[type].label}) paid ${U.money(pay)} toward ${label}`, `Covered ${Math.round(C.insCover * 100)}% after deductible; premiums rise after claims`);
    return pay;
  };

  // ---------- taxes ----------
  F.monthTax = (g, opProfit) => {
    const C = TG.CONFIG.finance;
    const hasAcc = g.businesses.some((b) => b.spec && b.spec.accountant) || !!g.ceo;
    let taxable = opProfit;
    if (taxable < 0) { g.taxLoss += -taxable; return 0; }
    const use = Math.min(g.taxLoss, taxable); taxable -= use; g.taxLoss -= use;
    let tax = Math.round(taxable * C.incomeTax * (hasAcc ? 1 - C.accountantTaxCut : 1));
    if (tax > 0) F.spend(g, tax, 'Income tax');
    g.taxPaid.push(tax); if (g.taxPaid.length > 12) g.taxPaid.shift();
    const messy = !hasAcc && g.businesses.length > 0;
    if (g.businesses.length && R.chance(C.auditBase * (messy ? C.auditMessyMult : 1))) {
      const t12 = U.sum(g.taxPaid);
      const pen = Math.round(R.range(C.auditPenalty[0], C.auditPenalty[1]) * Math.max(t12 * 4, 20000) * (messy ? 1 : 0.35));
      F.spend(g, pen, 'Tax audit penalty');
      TG.rep.event(g, null, 'bad', `Tax audit: penalties of ${U.money(pen)}`, messy ? `Messy books (no accountant) raise audit odds ${C.auditMessyMult}x and penalties` : 'Random audit; your accountant kept penalties small');
    }
    return tax;
  };

  // ---------- valuation & net worth ----------
  F.bizAssets = (g, b) => TG.E.value(g, b) + (b.inventoryValue ? b.inventoryValue(g) : TG.B.inventoryValue(g, b)) + U.sum(b.recv || [], (r) => r.amt);
  F.bizValue = (g, b) => {
    const C = TG.CONFIG.finance.saleMultiple;
    const h = b.hist.slice(-12); const p12 = U.sum(h, (x) => x.profit) * (12 / Math.max(1, h.length));
    let mult = C.base + C.rep * (b.rep - 50) / 10 * 10;
    mult = U.clamp(C.base + (b.rep - 50) * C.rep, 1, 6);
    let v = F.bizAssets(g, b) + Math.max(0, p12) * mult;
    if (b.type === 'tech' && b.tech && b.tech.phase === 'live') v = Math.max(v, b.tech.users * TG.CONFIG.businesses.tech.tech.arpu * 12 * (2 + 6 * b.tech.pmf));
    if (b.type === 'tech' && b.tech && b.tech.phase === 'build') v = Math.max(v, 400000 + b.tech.dev * 30000 * (0.5 + (b.tech.pmfEst || 0.3)));
    if (b.type === 'franchise' && b.fr) v = Math.max(v, b.fr.locations.length * 120000);
    return Math.round(Math.max(0, v));
  };
  F.netWorth = (g, detail) => {
    let assets = Math.max(0, g.cash);
    for (const p of g.properties) { if (p.owned) assets += TG.P.value(g, p); else if (p.landOwned) assets += p.landOwned * g.world.housing; }
    for (const b of g.businesses) assets += F.bizAssets(g, b) * (1 - (b.outside || 0));
    assets += TG.RE.totalValue(g);
    assets += TG.I.value(g);
    if (TG.CR) assets += TG.CR.value(g);
    const liab = F.debt(g) + Math.max(0, -g.cash);
    const nw = assets - liab;
    return detail ? { assets, liab, nw } : nw;
  };

  // ---------- investors ----------
  F.investorOffer = (g, b, pct) => {
    const v = F.bizValue(g, b);
    const C = TG.CONFIG.finance;
    const cash = Math.round(v * pct * C.investorDiscount);
    return { pct, cash, valuation: v };
  };
  F.takeInvestor = (g, b, pct) => {
    const o = F.investorOffer(g, b, pct);
    if (o.cash < 10000) return { ok: false, msg: 'Investors are not interested yet (valuation too low).' };
    if ((b.outside || 0) + pct > 0.9) return { ok: false, msg: 'You would give away almost everything.' };
    b.outside = (b.outside || 0) + pct;
    F.earn(g, o.cash, 'Investor funding', b.id, true);
    TG.rep.event(g, b, 'info', `Sold ${U.pct(pct)} of ${b.name} to investors for ${U.money(o.cash)}`, `Valuation ${U.money(o.valuation)}; investors now own ${U.pct(b.outside)}`);
    return { ok: true, cash: o.cash };
  };
  F.ipo = (g, b) => {
    const C = TG.CONFIG.finance; const v = F.bizValue(g, b);
    if (v < C.ipoMinValue) return { ok: false, msg: `Needs a valuation of ${U.money(C.ipoMinValue)}.` };
    if (b.public) return { ok: false, msg: 'Already public.' };
    const cash = Math.round(v * C.ipoPct * C.ipoPremium);
    b.outside = (b.outside || 0) + C.ipoPct; b.public = true;
    F.earn(g, cash, 'IPO proceeds', b.id, true);
    TG.rep.event(g, b, 'good', `${b.name} went public, raising ${U.money(cash)}`, `Valuation ${U.money(v)}`);
    return { ok: true, cash };
  };
  F.buyBack = (g, b) => {
    if (!b.outside) return { ok: false, msg: 'No outside owners.' };
    const cost = Math.round(F.bizValue(g, b) * b.outside * 1.2);
    if (g.cash < cost) return { ok: false, msg: `Need ${U.money(cost)}.` };
    F.spend(g, cost, 'Share buy-back', b.id, true); b.outside = 0; b.public = false;
    return { ok: true, cost };
  };

  // ---------- cash crunch & bankruptcy ----------
  F.monthEnd = (g) => {
    const C = TG.CONFIG.finance;
    if (g.cash < 0) F.autoCredit(g, -g.cash);
    if (g.cash < 0) {
      g.negMonths++;
      const fee = Math.round(-g.cash * C.negCashFeePct);
      F.spend(g, fee, 'Late fees');
      TG.CREDIT.late(g, 0.5);
      const left = C.bankruptcyMonths - g.negMonths;
      TG.rep.event(g, null, 'major', left > 0 ? `Unpaid bills: collections letters (${left} month${left === 1 ? '' : 's'} before creditors act)` : 'Creditors are acting on unpaid bills',
        `Cash is ${U.money(g.cash)}. Last chances: sell assets, take an emergency loan, cut staff, or find an investor.`, { major: 'cash' });
      if (g.negMonths >= C.bankruptcyMonths) F.insolvency(g);
    } else g.negMonths = 0;
  };
  F.insolvency = (g) => {
    const C = TG.CONFIG.finance, fs = C.bankruptcy.fireSale;
    const d = F.netWorth(g, true);
    const fireNW = d.assets * fs - d.liab;
    if (fireNW > 0) {
      // forced liquidation: sell assets until cash >= 0
      TG.I.liquidateAll(g, fs);
      let guard = 0;
      while (g.cash < 0 && guard++ < 200) {
        const rh = g.re.holdings[0];
        if (rh) { TG.RE.sell(g, rh.id, fs); continue; }
        const idle = g.properties.find((p) => !p.bizId && p.owned);
        if (idle) { TG.P.sell(g, idle.id); continue; }
        const b = g.businesses.slice().sort((x, y) => F.bizValue(g, x) - F.bizValue(g, y))[0];
        if (b) { TG.B.sell(g, b.id, fs, true); continue; }
        break;
      }
      TG.CREDIT.derog(g, 'collections');
      g.negMonths = 0;
      TG.rep.event(g, null, 'major', 'Creditors forced a liquidation of assets', 'Bills went unpaid for months; assets sold at fire-sale prices', { major: 'cash' });
      if (g.cash < 0) F.bankrupt(g, 'Fire sale did not cover the debts');
    } else F.bankrupt(g, 'Debts exceed the value of everything you own');
  };
  F.bankrupt = (g, why) => {
    const C = TG.CONFIG.finance.bankruptcy;
    for (const b of g.businesses.slice()) TG.B.close(g, b, 'bankruptcy', true);
    g.properties = []; g.re.holdings = []; g.loans = []; g.loc.balance = 0;
    TG.I.wipe(g); g.lawsuits = []; g.decisions = []; g.ceo = null;
    { const d = C.keepCash - g.cash; if (d > 0) F.earn(g, d, 'Debts wiped in bankruptcy', null, true); else if (d < 0) F.spend(g, -d, 'Cash taken in bankruptcy', null, true); }
    g.cash = C.keepCash; g.negMonths = 0;
    g.loc.limit = 0; g.player.bankruptcies++; TG.CREDIT.derog(g, 'bankruptcy'); g.player.noLoanUntil = g.month + C.noLoanMonths;
    g.player.ownerBiz = null;
    TG.rep.event(g, null, 'major', 'Full bankruptcy: you lost almost everything', `${why}. You keep ${U.money(C.keepCash)} and damaged credit. Rebuild from here: lease a cheap lot and start small.`, { major: 'cash' });
    TG.rep.news(g, 'You declared bankruptcy', 'bad');
  };
  // voluntary bankruptcy for one business (its loans are discharged, credit takes a hit)
  F.businessBankruptcy = (g, bizId) => {
    const C = TG.CONFIG.finance; const b = g.businesses.find((x) => x.id === bizId); if (!b) return { ok: false };
    const prop = g.properties.find((p) => p.id === b.propId);
    const linked = g.loans.filter((l) => l.bizId === b.id || (prop && l.collateral && l.collateral.id === prop.id) || (l.collateral && b.equip.some((e) => e.id === l.collateral.id)));
    const debt = U.sum(linked, (l) => l.balance);
    const assets = F.bizAssets(g, b) + (prop && prop.owned ? TG.P.value(g, prop) : 0);
    if (debt <= assets) return { ok: false, msg: 'Court refuses: the business can still cover its debts. Sell it instead.' };
    TG.B.close(g, b, 'business bankruptcy', true);
    if (prop) g.properties = g.properties.filter((p) => p !== prop);
    g.loans = g.loans.filter((l) => linked.indexOf(l) < 0);
    TG.CREDIT.derog(g, 'business');
    g.player.noLoanUntil = g.month + 12;
    TG.rep.event(g, null, 'major', `${b.name} filed for business bankruptcy`, `Debts of ${U.money(debt)} exceeded assets of ${U.money(assets)}; ${linked.length} loans discharged`, { major: 'cash' });
    return { ok: true };
  };
  TG.F = F;
})();
