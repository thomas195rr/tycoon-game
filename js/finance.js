/* finance.js - cash flow, loans, credit line, credit score, taxes, insurance, investors, valuation, bankruptcy. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const F = {};
  const acc = (g) => (g.acc = g.acc || F.newAcc());
  F.newAcc = () => ({ inc: {}, exp: {}, capIn: {}, capOut: {} });

  F.earn = (g, amt, label, bizId, capital) => {
    amt = U.num(amt); if (!amt) return;
    g.cash += amt; const a = acc(g);
    const bucket = capital ? a.capIn : a.inc; bucket[label] = (bucket[label] || 0) + amt;
    if (bizId && !capital) { const b = g.businesses.find((x) => x.id === bizId); if (b && b.m) { b.m.rev += amt; b.m.lines[label] = (b.m.lines[label] || 0) + amt; } }
  };
  F.spend = (g, amt, label, bizId, capital) => {
    amt = U.num(amt); if (!amt) return;
    g.cash -= amt; const a = acc(g);
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
    const C = TG.CONFIG.finance;
    const spread = type === 'loc' ? C.loc.spread : C.loans[type].spread;
    return U.clamp(g.world.baseRate + spread + Math.max(0, 800 - g.player.credit) * C.creditSpreadPerPoint, 0.01, 0.45);
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
  F.canBorrow = (g, type, amount) => {
    const C = TG.CONFIG.finance, L = C.loans[type];
    if (type !== 'emergency' && g.player.noLoanUntil > g.month) return { ok: false, msg: 'Lenders refuse: recent bankruptcy.' };
    if (g.player.credit < L.minCredit) return { ok: false, msg: `Credit score too low (need ${L.minCredit}).` };
    const max = F.maxLoan(g, type);
    if (amount > max) return { ok: false, msg: `Lender caps this loan at ${U.money(max)}.` };
    const pay = F.payment(amount, F.rateFor(g, type), L.term);
    const income = Math.max(0, F.avgProfit(g)) + F.totalPayments(g);
    if (type === 'business' && F.totalPayments(g) + pay > Math.max(4000, income * 0.9 + F.netWorth(g) * 0.02)) return { ok: false, msg: 'Debt payments would be too high for your income.' };
    return { ok: true, pay };
  };
  F.newLoan = (g, type, amount, opts) => {
    opts = opts || {};
    const L = TG.CONFIG.finance.loans[type];
    const rate = F.rateFor(g, type);
    const term = opts.term || L.term;
    const loan = { id: U.uid('l'), type, label: opts.label || L.label, principal: Math.round(amount), balance: Math.round(amount), rate, term, left: term,
      payment: Math.round(F.payment(amount, rate, term)), missed: 0, collateral: opts.collateral || null, bizId: opts.bizId || null, start: g.month };
    g.loans.push(loan);
    if (!opts.noCash) F.earn(g, amount, 'Loan proceeds', null, true);
    return loan;
  };
  F.takeLoan = (g, type, amount, opts) => {
    amount = Math.round(amount);
    if (!(amount > 0)) return { ok: false, msg: 'Enter an amount.' };
    const ok = F.canBorrow(g, type, amount); if (!ok.ok) return ok;
    return { ok: true, loan: F.newLoan(g, type, amount, opts) };
  };
  F.payoff = (g, loanId, fromSale) => {
    const l = g.loans.find((x) => x.id === loanId); if (!l) return;
    F.spend(g, l.balance, 'Loan payoff', null, true);
    g.loans = g.loans.filter((x) => x !== l);
  };
  F.prepay = (g, loanId, amt) => {
    const l = g.loans.find((x) => x.id === loanId); if (!l) return;
    amt = Math.min(Math.round(amt), l.balance, Math.max(0, g.cash)); if (amt <= 0) return;
    F.spend(g, amt, 'Loan prepayment', null, true); l.balance -= amt;
    if (l.balance <= 1) g.loans = g.loans.filter((x) => x !== l);
    else { l.payment = Math.round(F.payment(l.balance, l.rate, Math.max(1, l.left))); }
  };
  F.totalPayments = (g) => U.sum(g.loans, (l) => l.payment) + (g.loc ? Math.round(g.loc.balance * TG.CONFIG.finance.loc.minPayPct) : 0);
  F.debt = (g) => U.sum(g.loans, (l) => l.balance) + (g.loc ? g.loc.balance : 0) + (g.invest ? g.invest.marginDebt : 0);
  F.avgProfit = (g) => { const h = g.history.slice(-6); return h.length ? U.avg(h, (x) => x.profit) : 0; };

  F.locLimit = (g) => {
    const C = TG.CONFIG.finance.loc;
    if (g.player.credit < C.minCredit || g.player.noLoanUntil > g.month) return 0;
    const cf = U.clamp((g.player.credit - 600) / 200, 0.2, 1.3);
    return Math.round((C.limitBase + C.limitNW * Math.max(0, F.netWorth(g))) * cf / 1000) * 1000;
  };
  F.locDraw = (g, amt, by) => {
    const lim = F.locLimit(g); amt = Math.min(Math.round(amt), lim - g.loc.balance);
    if (amt <= 0) return 0;
    g.loc.balance += amt; F.earn(g, amt, 'Credit line draw', null, true);
    return amt;
  };
  F.locRepay = (g, amt) => { amt = Math.min(Math.round(amt), g.loc.balance, Math.max(0, g.cash)); if (amt <= 0) return 0; g.loc.balance -= amt; F.spend(g, amt, 'Credit line repayment', null, true); return amt; };

  // ---------- monthly debt service ----------
  F.monthLoans = (g) => {
    const C = TG.CONFIG.finance;
    for (const l of g.loans.slice()) {
      const interest = l.balance * l.rate / 12;
      const pay = Math.min(l.payment, l.balance + interest);
      if (g.cash >= pay || F.autoCredit(g, pay - g.cash)) {
        F.spend(g, Math.round(interest), 'Loan interest');
        F.spend(g, Math.round(pay - interest), 'Loan principal', null, true);
        l.balance = Math.max(0, l.balance - (pay - interest)); l.left--; l.missed = 0;
        g.player.credit = Math.min(C.creditMax, g.player.credit + C.onTimeCredit);
        if (l.balance < 1 || l.left <= 0) { g.loans = g.loans.filter((x) => x !== l); TG.rep.event(g, null, 'good', `Paid off ${l.label}`, 'All payments made'); }
      } else {
        l.missed++; l.balance += Math.round(interest + pay * C.lateFeePct);
        g.player.credit = Math.max(C.creditMin, g.player.credit + C.missedPaymentCredit);
        TG.rep.event(g, null, 'major', `Missed a payment on ${l.label}`, `Cash ${U.money(g.cash)} was below the ${U.money(pay)} payment; credit score now ${Math.round(g.player.credit)}`, { major: 'cash' });
        if (l.missed >= C.repoAfterMissed && l.collateral) F.repossess(g, l);
      }
    }
    // credit line
    if (g.loc.balance > 0) {
      g.loc.rate = F.rateFor(g, 'loc');
      const interest = Math.round(g.loc.balance * g.loc.rate / 12);
      const minPay = Math.round(g.loc.balance * C.loc.minPayPct);
      F.spend(g, interest, 'Credit line interest');
      if (g.cash >= minPay) { F.spend(g, minPay, 'Credit line repayment', null, true); g.loc.balance -= minPay; }
      else { g.player.credit = Math.max(C.creditMin, g.player.credit + C.missedPaymentCredit / 2); TG.rep.event(g, null, 'bad', 'Missed the credit line minimum payment', `Cash ${U.money(g.cash)}`); }
      const lim = F.locLimit(g);
      if (lim > 0 && g.loc.balance / lim > 0.7) g.player.credit = Math.max(C.creditMin, g.player.credit - 1);
    }
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
    const handler = F.moneyHandler(g); if (!handler && !g.settings.autoCredit) return false;
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
    F.earn(g, o.cash, 'Investor funding', null, true);
    TG.rep.event(g, b, 'info', `Sold ${U.pct(pct)} of ${b.name} to investors for ${U.money(o.cash)}`, `Valuation ${U.money(o.valuation)}; investors now own ${U.pct(b.outside)}`);
    return { ok: true, cash: o.cash };
  };
  F.ipo = (g, b) => {
    const C = TG.CONFIG.finance; const v = F.bizValue(g, b);
    if (v < C.ipoMinValue) return { ok: false, msg: `Needs a valuation of ${U.money(C.ipoMinValue)}.` };
    if (b.public) return { ok: false, msg: 'Already public.' };
    const cash = Math.round(v * C.ipoPct * C.ipoPremium);
    b.outside = (b.outside || 0) + C.ipoPct; b.public = true;
    F.earn(g, cash, 'IPO proceeds', null, true);
    TG.rep.event(g, b, 'good', `${b.name} went public, raising ${U.money(cash)}`, `Valuation ${U.money(v)}`);
    return { ok: true, cash };
  };
  F.buyBack = (g, b) => {
    if (!b.outside) return { ok: false, msg: 'No outside owners.' };
    const cost = Math.round(F.bizValue(g, b) * b.outside * 1.2);
    if (g.cash < cost) return { ok: false, msg: `Need ${U.money(cost)}.` };
    F.spend(g, cost, 'Share buy-back', null, true); b.outside = 0; b.public = false;
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
      g.player.credit = Math.max(C.creditMin, g.player.credit + C.negCashCredit);
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
      g.player.credit = Math.max(C.creditMin, g.player.credit - 60);
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
    g.cash = C.keepCash; g.negMonths = 0;
    g.player.credit = R.int(C.credit[0], C.credit[1]); g.player.bankruptcies++; g.player.noLoanUntil = g.month + C.noLoanMonths;
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
    g.player.credit = Math.max(C.creditMin, g.player.credit + C.businessBankruptcyCredit);
    g.player.noLoanUntil = g.month + 12;
    TG.rep.event(g, null, 'major', `${b.name} filed for business bankruptcy`, `Debts of ${U.money(debt)} exceeded assets of ${U.money(assets)}; ${linked.length} loans discharged`, { major: 'cash' });
    return { ok: true };
  };
  TG.F = F;
})();
