/* invest.js - stocks, penny stocks & coins, margin, angel investing, casino, horse & sports betting.
   House edges and negative drifts are real; there are no patterns to exploit. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U;
  const I = {};
  const IC = () => TG.CONFIG.invest, CC = () => TG.CONFIG.casino;

  I.init = (g) => {
    const A = IC().assets; g.invest = { prices: {}, hist: {}, pos: {}, marginDebt: 0, angels: [], angelOffers: [], casino: { net: 0, bets: 0, banned: false, lifetimeNet: 0 }, habit: 0, gambleNet: 0, betsNet: 0, race: null, game: null };
    for (const s in A) { g.invest.prices[s] = A[s].start; g.invest.hist[s] = [A[s].start]; }
    I.newRace(g); I.newGame(g);
  };
  I.high = (s) => IC().assets[s].kind !== 'stock';
  I.posValue = (g) => U.sum(Object.keys(g.invest.pos), (s) => g.invest.pos[s].qty * g.invest.prices[s]);
  I.angelValue = (g) => U.sum(g.invest.angels, (a) => a.amt * (a.mark != null ? a.mark : 0.7));
  I.value = (g) => (g.invest ? Math.round(I.posValue(g) + I.angelValue(g)) : 0);
  I.equity = (g) => I.posValue(g) - g.invest.marginDebt;
  I.marginRoom = (g) => Math.max(0, Math.round(I.equity(g) * (IC().margin.maxLev - 1) - g.invest.marginDebt));

  I.buy = (g, sym, amount, useMargin) => {
    amount = Math.round(amount); if (!(amount > 0)) return { ok: false, msg: 'Enter an amount.' };
    if (I.high(sym) && !g.settings.gambling) return { ok: false, msg: 'High-risk assets are turned off in settings.' };
    const p = g.invest.prices[sym]; if (!(p > 0)) return { ok: false, msg: 'Not trading.' };
    let fromMargin = 0;
    if (useMargin) {
      if (!g.settings.gambling) return { ok: false, msg: 'Margin is turned off with high-risk investing.' };
      const room = Math.max(0, Math.round((I.equity(g) + amount) * (IC().margin.maxLev - 1) - g.invest.marginDebt));
      fromMargin = Math.min(room, Math.round(amount / 2));
    }
    const cashPart = amount - fromMargin;
    if (g.cash < cashPart) return { ok: false, msg: `Need ${U.money(cashPart)} in cash.` };
    const fee = Math.round(amount * IC().tradeFee);
    TG.F.spend(g, cashPart, 'Investments bought', null, true); TG.F.spend(g, fee, 'Trading fees');
    g.invest.marginDebt += fromMargin;
    const pos = g.invest.pos[sym] || (g.invest.pos[sym] = { qty: 0, cost: 0 });
    pos.qty += amount / p; pos.cost += amount;
    return { ok: true, fromMargin };
  };
  I.sell = (g, sym, frac, mult, quiet) => {
    const pos = g.invest.pos[sym]; if (!pos || pos.qty <= 0) return 0;
    frac = U.clamp(frac == null ? 1 : frac, 0, 1);
    const q = pos.qty * frac; let v = q * g.invest.prices[sym] * (mult || 1);
    const fee = v * IC().tradeFee; v -= fee;
    const costPart = pos.cost * frac; pos.qty -= q; pos.cost -= costPart;
    if (pos.qty < 1e-9) delete g.invest.pos[sym];
    // repay margin first
    const repay = Math.min(g.invest.marginDebt, v); g.invest.marginDebt -= repay;
    TG.F.earn(g, Math.round(v - repay), 'Investments sold', null, true);
    const gain = v - costPart; if (gain > 0) g.invest.realized = (g.invest.realized || 0) + gain;
    if (!quiet) TG.rep.event(g, null, gain >= 0 ? 'good' : 'bad', `Sold ${TG.CONFIG.invest.assets[sym].label}: ${gain >= 0 ? 'gain' : 'loss'} of ${U.money(Math.abs(gain))}`, `Cost basis ${U.money(costPart)}`);
    return v;
  };
  I.repayMargin = (g, amt) => { amt = Math.min(Math.round(amt), g.invest.marginDebt, Math.max(0, g.cash)); if (amt <= 0) return; TG.F.spend(g, amt, 'Margin repayment', null, true); g.invest.marginDebt -= amt; };

  I.month = (g) => {
    const A = IC().assets, iv = g.invest, w = g.world, C = IC();
    const drift = { boom: 0.006, recovery: 0.004, slowdown: -0.004, recession: -0.012 }[w.phase] || 0;
    let mkt = drift + R.normal(0, C.econShockSd);
    const crashP = 0.004 * (w.phase === 'slowdown' || w.phase === 'recession' ? 3 : 0.6);
    if (R.chance(crashP)) { const d = R.range(C.crashDrop[0], C.crashDrop[1]); mkt -= d; TG.rep.news(g, `Stock market crash: index falls about ${U.pct(d)}`, 'bad', true); }
    for (const s in A) {
      const a = A[s]; let p = iv.prices[s];
      if (!(p > 0)) { // relaunch a dead ticker as a fresh one
        iv.prices[s] = a.start; iv.hist[s] = [a.start]; continue;
      }
      if (a.zero && R.chance(a.zero)) {
        if (iv.pos[s]) { TG.rep.event(g, null, 'major', `${a.label} collapsed to zero: you lost ${U.money(iv.pos[s].cost)}`, `${a.kind === 'coin' ? 'Coins' : 'Penny stocks'} carry a ${U.pct(a.zero, 1)} monthly wipe-out risk`, { major: 'cash' }); delete iv.pos[s]; }
        iv.prices[s] = 0; iv.hist[s].push(0); continue;
      }
      const r = a.mu + a.beta * mkt + R.normal(0, a.sd) - a.sd * a.sd / 2;
      p = Math.max(a.start * 0.0005, p * Math.exp(r));
      iv.prices[s] = p; iv.hist[s].push(+p.toFixed(4)); if (iv.hist[s].length > 120) iv.hist[s].shift();
    }
    // margin interest & calls
    if (iv.marginDebt > 0) {
      const int = Math.round(iv.marginDebt * (w.baseRate + C.margin.spread) / 12);
      TG.F.spend(g, int, 'Margin interest');
      const pv = I.posValue(g);
      if (pv <= 0 || (pv - iv.marginDebt) / pv < C.margin.callAt) {
        const before = iv.marginDebt;
        for (const s of Object.keys(iv.pos)) I.sell(g, s, 1, 1, true);
        if (iv.marginDebt > 0) { TG.F.spend(g, iv.marginDebt, 'Margin call shortfall', null, true); iv.marginDebt = 0; }
        TG.rep.event(g, null, 'major', `Margin call! Broker sold all your positions`, `Equity fell below ${U.pct(C.margin.callAt)} of positions; margin debt was ${U.money(before)}`, { major: 'cash' });
      }
    }
    // angel investments
    for (const a of iv.angels.slice()) {
      a.left--;
      if (a.left === Math.floor(a.horizon / 2)) { a.mark = a.outcome[1] === 0 ? R.range(0.1, 0.5) : R.range(0.6, 1.6); TG.rep.event(g, null, 'info', `${a.name} update: ${a.mark < 0.6 ? 'struggling to raise more money' : 'growing, raising a new round'}`, 'Startup progress is noisy; early signals can mislead'); }
      if (a.left <= 0) {
        const pay = Math.round(a.amt * a.mult);
        iv.angels = iv.angels.filter((x) => x !== a);
        if (pay > 0) TG.F.earn(g, pay, 'Angel exits', null, true);
        TG.rep.event(g, null, pay > a.amt ? 'good' : 'bad', pay > 0 ? `${a.name} ${a.mult >= 3 ? 'was acquired' : 'returned money'}: you got ${U.money(pay)} (${a.mult.toFixed(1)}x)` : `${a.name} failed: ${U.money(a.amt)} lost`, 'Most startups fail; a few return many times the money');
      }
    }
    // offers
    iv.angelOffers = iv.angelOffers.filter((o) => o.expires > g.month);
    while (iv.angelOffers.length < IC().angel.offers) iv.angelOffers.push(I.angelOffer(g));
    // casino & habit
    iv.casino.bets = 0;
    iv.habit = Math.max(0, iv.habit - CC().habitDecay);
    if (g.settings.gambling && g.settings.habit && iv.habit >= CC().habitChase && g.cash > 20000) {
      const loss = Math.round(g.cash * R.range(CC().chaseLoss[0], CC().chaseLoss[1]));
      TG.F.spend(g, loss, 'Gambling losses'); iv.gambleNet -= loss;
      TG.rep.event(g, null, 'bad', `You chased losses at the casino (${U.money(loss)})`, `Gambling habit ${Math.round(iv.habit)}/100: big bets build a habit; it fades if you stop`);
    }
    I.newRace(g); I.newGame(g);
  };
  I.angelOffer = (g) => {
    const A = IC().angel; const sectors = ['food delivery app', 'battery startup', 'pet tech', 'farm robotics', 'fintech', 'biotech lab', 'fashion marketplace', 'logistics software', 'game studio'];
    const roll = R.next(); let acc = 0, oc = A.outcomes[0];
    for (const o of A.outcomes) { acc += o[0]; if (roll < acc) { oc = o; break; } }
    const signal = U.clamp((oc[1] > 0 ? 0.6 : 0.4) + R.normal(0, 0.25), 0, 1);
    return { id: U.uid('a'), name: `${R.pick(['Nova', 'Bright', 'Kite', 'Atlas', 'Ember', 'Pivot', 'Orbit', 'Juniper'])} ${R.pick(['Labs', 'Works', 'AI', 'Co', 'Systems'])}`, sector: R.pick(sectors),
      min: Math.round(R.range(A.min, A.max / 4) / 5000) * 5000, buzz: signal > 0.66 ? 'Strong team, early traction' : signal > 0.45 ? 'Promising idea, unproven' : 'Heavy competition, thin traction', outcome: oc, expires: g.month + 2 };
  };
  I.angelInvest = (g, offerId, amt) => {
    if (!g.settings.gambling) return { ok: false, msg: 'High-risk investing is off in settings.' };
    const o = g.invest.angelOffers.find((x) => x.id === offerId); if (!o) return { ok: false, msg: 'Offer gone.' };
    amt = Math.round(Math.max(o.min, Math.min(amt || o.min, IC().angel.max)));
    if (g.cash < amt) return { ok: false, msg: `Need ${U.money(amt)}.` };
    TG.F.spend(g, amt, 'Angel investments', null, true);
    const H = IC().angel.horizon; const horizon = R.int(H[0], H[1]);
    g.invest.angels.push({ id: o.id, name: o.name, sector: o.sector, amt, horizon, left: horizon, outcome: o.outcome, mult: o.outcome[1] === 0 ? 0 : R.range(o.outcome[1], o.outcome[2]), mark: null });
    g.invest.angelOffers = g.invest.angelOffers.filter((x) => x !== o);
    return { ok: true };
  };

  // ---------- casino ----------
  I.betLimit = (g) => { const c = g.invest.casino; let m = CC().maxBet; if (c.net > CC().limitShrinkAt) m *= 0.4; return Math.round(m); };
  I.canBet = (g, amt) => {
    const c = g.invest.casino;
    if (!g.settings.gambling) return 'Gambling is turned off in settings.';
    if (c.banned) return 'The casino has banned you for winning too much.';
    if (c.bets >= CC().betsPerMonth) return `Bet limit reached (${CC().betsPerMonth} per month). Come back next month.`;
    if (!(amt >= CC().minBet)) return `Minimum bet ${U.money(CC().minBet)}.`;
    if (amt > I.betLimit(g)) return `Table limit is ${U.money(I.betLimit(g))}.`;
    if (amt > g.cash) return 'Not enough cash.';
    return null;
  };
  // net > 0 = winnings, net < 0 = loss
  I.settle = (g, amt, net) => {
    const c = g.invest.casino, iv = g.invest; c.bets++;
    if (amt > Math.max(1000, g.cash * 0.02)) iv.habit = Math.min(100, iv.habit + CC().habitPerBigBet);
    net = Math.round(net);
    if (net > 0) TG.F.earn(g, net, 'Gambling winnings'); else if (net < 0) TG.F.spend(g, -net, 'Gambling losses');
    c.net += net; c.lifetimeNet += net; iv.gambleNet += net;
    if (!c.banned && c.net > CC().banAtNetWin) { c.banned = true; TG.rep.event(g, null, 'warn', 'The casino banned you after your winning streak', `Net winnings over ${U.money(CC().banAtNetWin)}`); }
    return net;
  };
  I.casinoBet = (g, game, amt) => {
    amt = Math.round(amt); const err = I.canBet(g, amt); if (err) return { ok: false, msg: err };
    const G = CC().games[game]; if (!G) return { ok: false, msg: 'Unknown game.' };
    if (game === 'slots') {
      // paytable (total returned per $1): 0.1% x200, 1% x20, 5% x5, 20% x1.5 -> 0.95, scaled to the configured RTP
      const r = R.next(); let mult = r < 0.001 ? 200 : r < 0.011 ? 20 : r < 0.061 ? 5 : r < 0.261 ? 1.5 : 0;
      mult *= G.rtp / 0.95;
      const net = I.settle(g, amt, amt * (mult - 1));
      return { ok: true, win: net > 0, text: mult > 0 ? `Slots returned ${mult.toFixed(2)}x (${net >= 0 ? '+' : '-'}${U.money(Math.abs(net))})` : `Slots: nothing (-${U.money(amt)})` };
    }
    const won = R.chance(G.p);
    I.settle(g, amt, won ? amt * G.pays : -amt);
    return { ok: true, win: won, text: won ? `${G.label}: won ${U.money(amt * G.pays)}` : `${G.label}: lost ${U.money(amt)}` };
  };
  I.newRace = (g) => {
    const H = CC().horses; const raw = []; for (let i = 0; i < H.field; i++) raw.push(Math.pow(R.range(0.3, 1), 2.2));
    const tot = U.sum(raw, (x) => x);
    const names = ['Copper Dash', 'Midnight Rye', 'Lucky Seven', 'Paper Moon', 'Iron Lady', 'Quick Sand', 'Blue Comet', 'Old Faithful', 'Silver Bell', 'Prairie Fire'];
    const pick = R.shuffle(names.slice()).slice(0, H.field);
    g.invest.race = { horses: raw.map((x, i) => { const p = x / tot; return { name: pick[i], p, odds: +(1 / (p * H.overround)).toFixed(2) }; }) };
  };
  I.betHorse = (g, idx, amt) => {
    amt = Math.round(amt); const err = I.canBet(g, amt); if (err) return { ok: false, msg: err };
    const hs = g.invest.race.horses; const r = R.next(); let acc = 0, winner = hs.length - 1;
    for (let i = 0; i < hs.length; i++) { acc += hs[i].p; if (r < acc) { winner = i; break; } }
    const won = winner === idx; I.settle(g, amt, won ? amt * (hs[idx].odds - 1) : -amt);
    const txt = `${hs[winner].name} won the race. ${won ? `You won ${U.money(amt * (hs[idx].odds - 1))}` : `You lost ${U.money(amt)}`}`;
    I.newRace(g);
    return { ok: true, win: won, text: txt };
  };
  I.newGame = (g) => {
    const teams = ['Harbor Hawks', 'Maple Miners', 'Mesa Suns', 'River Kings', 'Valley Bears', 'Coast Pilots', 'Ridge Wolves', 'Lake Comets'];
    const [a, c] = R.shuffle(teams.slice()).slice(0, 2); const p = R.range(0.3, 0.7); const v = CC().sports.vig;
    g.invest.game = { a, b: c, p, oddsA: +(1 / (p * (1 + v))).toFixed(2), oddsB: +(1 / ((1 - p) * (1 + v))).toFixed(2) };
  };
  I.betSports = (g, side, amt) => {
    amt = Math.round(amt); const err = I.canBet(g, amt); if (err) return { ok: false, msg: err };
    const gm = g.invest.game; const aWins = R.chance(gm.p); const won = (side === 'a') === aWins; const odds = side === 'a' ? gm.oddsA : gm.oddsB;
    I.settle(g, amt, won ? amt * (odds - 1) : -amt);
    const txt = `${aWins ? gm.a : gm.b} won. ${won ? `You won ${U.money(amt * (odds - 1))}` : `You lost ${U.money(amt)}`}`;
    I.newGame(g);
    return { ok: true, win: won, text: txt };
  };

  I.liquidateAll = (g, mult) => { for (const s of Object.keys(g.invest.pos)) I.sell(g, s, 1, mult || 1, true); for (const a of g.invest.angels) { const v = Math.round(a.amt * (a.mark || 0.5) * 0.3); if (v > 0) TG.F.earn(g, v, 'Angel stakes sold', null, true); } g.invest.angels = []; };
  I.wipe = (g) => { g.invest.pos = {}; g.invest.marginDebt = 0; g.invest.angels = []; };
  TG.I = I;
})();
