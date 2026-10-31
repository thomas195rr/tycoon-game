/* herd.js - v6 cows. One herd gives milk AND meat:
   calf -> heifer (no milk) -> milking cow -> dry/old cow -> sell;  calf -> steer -> market-ready -> sell.
   Cows eat grass from the cow area and FEED from storage (you buy it, a manager can keep it topped up).
   No feed = health drops, less milk, more sickness and deaths. Calves come from bulls + cows: small herds breed faster per cow,
   full pasture or hunger stops breeding. */
(function () {
  const TG = globalThis.TG; const R = TG.R, U = TG.U; const M = TG.M;
  const HC = () => TG.CONFIG.cows; const FD = () => TG.CONFIG.businesses.farm.farm;
  const ST = ['calf', 'heifer', 'steer', 'ready', 'milker', 'dry', 'bull'];
  M.cowStages = ST;
  const blank = () => ({ calf: 0, heifer: 0, steer: 0, ready: 0, milker: 0, dry: 0, bull: 0 });
  const E = () => FD().enterprises.cows;
  M.herdSync = (a) => { if (!a.st) a.st = blank(); for (const k of ST) a.st[k] = Math.max(0, a.st[k] || 0); a.herd = U.sum(ST, (k) => a.st[k]); return a.herd; };
  M.herdInit = (a, total) => { // a balanced starter herd
    total = Math.max(0, Math.round(total)); const bull = total > 0 ? Math.max(1, Math.round(total / 40)) : 0; const t = Math.max(0, total - bull);
    a.st = { calf: t * 0.16, heifer: t * 0.12, steer: t * 0.1, ready: t * 0.04, milker: t * 0.48, dry: t * 0.1, bull };
    if (a.health == null) a.health = 0.9; M.herdSync(a);
  };
  M.pastureCap = (b, a) => Math.round((a || b.farm.areas.cows).acres * E().headPerAcre);
  M.farmHeadCap = (b) => M.pastureCap(b) + Math.round(TG.E.sumField(b, 'head'));
  M.farmHerdCap = (prop) => Math.round(prop.acres * E().headPerAcre);
  M.breeders = (a) => a.st.milker + 0.3 * a.st.dry;
  M.breedRate = (n) => HC().breed.base * 2 / (1 + n / HC().breed.half); // per breeding cow per month
  // grass this month (tons) and what the herd needs
  M.grass = (g, b, w, moyOverride) => {
    const c = HC(), a = b.farm.areas.cows; const moy = moyOverride || U.moy(g.month);
    const wf = w && w.kind && c.grassWeather[w.kind] ? c.grassWeather[w.kind] : 1;
    return a.acres * E().headPerAcre * c.grassPerHead * c.grassSeason[moy] * wf * (0.7 + 0.3 * (b.farm.rain || 0.6));
  };
  M.feedNeed = (a) => U.sum(ST, (k) => (a.st[k] || 0) * HC().stages[k].feed);
  M.feedPrice = (g) => HC().feedPrice * g.world.priceIdx * (TG.IN ? TG.IN.cost(g, 'farming') : 1);
  M.feedMonths = (g, b) => { const a = b.farm.areas.cows; const need = Math.max(0, M.feedNeed(a) - M.grass(g, b, null, U.moy(g.month + 1))); return need > 0.1 ? (b.farm.feed || 0) / need : 99; };
  M.farmBuyFeed = (g, b, tons, by, premium) => {
    const f = M.farmEnsure(b); tons = Math.floor(Math.max(0, tons));
    tons = Math.min(tons, Math.floor(M.farmStoreFree(b) / HC().feedTonsCap));
    const per = M.feedPrice(g) * (1 + (premium || 0)) * (b.fixes.integrate ? 0.85 : 1); tons = Math.min(tons, Math.floor(Math.max(0, g.cash) / per));
    if (tons <= 0) return { ok: false, msg: M.farmStoreFree(b) < 1 ? 'Storage is full: build more storage.' : 'Not enough cash.' };
    TG.F.spend(g, Math.round(tons * per), 'Feed & hay', b.id); f.feed = (f.feed || 0) + tons; f.m.feedIn = (f.m.feedIn || 0) + tons;
    return { ok: true, tons, cost: Math.round(tons * per) };
  };
  M.cowValue = (g, k) => TG.W.price(g, 'beef', 0) * HC().stages[k].value;
  M.cowPrice = (g, b, k) => M.cowValue(g, k || 'milker') * HC().buyMarkup;
  M.farmBuyCattle = (g, b, head, k) => {
    const a = M.farmEnsure(b).areas.cows; k = k || 'milker'; head = Math.round(head); if (!(head > 0)) return { ok: false, msg: 'Pick how many.' };
    if (!a.acres) return { ok: false, msg: 'Give some acres to the cow area first.' };
    if (!HC().stages[k]) return { ok: false };
    const cost = Math.round(head * M.cowPrice(g, b, k));
    if (g.cash < cost) return { ok: false, msg: `Costs ${U.money(cost)}.` }; TG.F.spend(g, cost, 'Livestock purchases', b.id, true);
    M.herdSync(a); a.st[k] += head; M.herdSync(a); return { ok: true, cost };
  };
  // sell for meat: buyers pay the beef price x the stage value (big sales push the price down a little)
  M.farmSellCattle = (g, b, head, k) => {
    const a = M.farmEnsure(b).areas.cows; M.herdSync(a); k = k === 'cows' ? 'dry' : (k || 'ready');
    head = Math.min(Math.max(0, Math.round(head)), Math.floor(a.st[k] || 0));
    if (!head) return { ok: false, msg: `No ${HC().stages[k].label.toLowerCase()} to sell.` };
    const rev = Math.round(head * TG.W.price(g, 'beef', head / 2) * HC().stages[k].value * HC().sellDrop * M.plantMult(b, 'cows'));
    a.st[k] -= head; TG.F.earn(g, rev, 'Cattle sales', b.id); TG.W.sell(g, 'beef', head * HC().stages[k].value);
    a.m.soldHead = (a.m.soldHead || 0) + head; a.m.meatRev = (a.m.meatRev || 0) + rev; M.herdSync(a);
    return { ok: true, rev, head };
  };
  M.sickOdds = (g, b, w) => {
    const f = b.farm, a = f.areas.cows; if (!a.herd) return { p: 0, why: '' };
    const over = a.herd / Math.max(1, M.farmHeadCap(b)); const hp = a.health == null ? 0.9 : a.health; const bl = TG.B.backlogMult(b);
    const p = U.clamp(E().diseaseBase * (1 + 3 * Math.max(0, over - 1)) * (1 + HC().hunger.sickK * (1 - hp)) * (b.spec.ops ? 0.6 : 1) * bl, 0, 0.9);
    return { p, why: `herd at ${U.pct(over)} of room, health ${U.pct(hp)}${hp < 0.8 ? ' (hungry cows get sick more)' : ''}${b.spec.ops ? ', ops manager helps' : ''}${bl > 1.05 ? `, unfinished work x${bl.toFixed(2)}` : ''}` };
  };
  M.herdForecast = (g, b) => {
    const a = b.farm.areas.cows, c = HC(); M.herdSync(a);
    const room = a.herd / Math.max(1, M.farmHeadCap(b)); const bullF = M.bullF(a);
    const births = M.breeders(a) * M.breedRate(a.herd) * bullF * M.roomF(room) * Math.pow(Math.min(1, M.feedMonths(g, b) > 1 ? 1 : 0.6), 2) * (a.health || 0.9);
    const deaths = U.sum(ST, (k) => a.st[k] * c.stages[k].death);
    const need = M.feedNeed(a), grass = M.grass(g, b, null, U.moy(g.month + 1));
    return { births, deaths, culls: 0, matured: a.st.steer * c.grow.steer, ready: a.st.ready + a.st.steer * c.grow.steer, need, grass, buy: Math.max(0, need - grass), feed: Math.max(0, need - grass) * M.feedPrice(g), months: M.feedMonths(g, b) };
  };
  M.bullF = (a) => { const br = M.breeders(a); if (br < 0.5) return 0; return a.st.bull >= 0.5 ? Math.min(1, a.st.bull * HC().breed.bullPer / br) : HC().breed.noBull; };
  M.roomF = (room) => U.clamp((1 - room) / (1 - HC().breed.roomFull), 0, 1); // full rate up to 85% of room, none when full

  M.models.farm.feedCost = (g, b) => M.herdForecast(g, b).feed;
  M.models.farm.herdMonth = function (g, b, ctx, cov, q) {
    const f = b.farm, a = f.areas.cows, c = HC(), m = a.m; M.herdSync(a);
    if (a.health == null) a.health = 0.9;
    if (!a.herd) { m.feedEaten = 0; return; }
    const cap = M.farmHeadCap(b), room = a.herd / Math.max(1, cap);
    // 1) eat: grass first, then feed from storage
    const need = M.feedNeed(a) * (1 + Math.max(0, room - 1)), grass = Math.min(need, M.grass(g, b, ctx.weather));
    const fromStore = Math.min(f.feed || 0, need - grass); f.feed = (f.feed || 0) - fromStore;
    const fed = need > 0 ? (grass + fromStore) / need : 1; m.grass = grass; m.feedEaten = fromStore; m.fed = fed;
    const work = 0.6 + 0.4 * cov.hcov; // farmhands do the feeding and care
    a.health = U.clamp(fed >= 0.99 ? a.health + c.hunger.healthGain * work : a.health - c.hunger.healthDrop * (1 - fed), 0.2, 1);
    if (fed < 0.99) TG.rep.event(g, b, fed < 0.7 ? 'major' : 'bad', `Cows went hungry: only ${U.pct(fed)} of the food they needed`, `Grass gave ${Math.round(grass)} t, storage had ${Math.round(fromStore)} t of ${Math.round(need - grass)} t needed. Health now ${U.pct(a.health)}: less milk, more sickness and deaths. Buy feed (Cows) ${TG.D.handler(g, b, 'farm') ? '' : '- no manager, you must do this yourself'}.`, fed < 0.7 ? { major: 'harvest' } : null);
    // 2) deaths (more when hungry or crowded or short of farmhands)
    const stress = (1 - a.health) * c.hunger.deathK + Math.max(0, room - 1) * 0.02 + (1 - cov.hcov) * 0.01;
    let died = 0; for (const k of ST) { const d = a.st[k] * (c.stages[k].death + stress); a.st[k] -= d; died += d; }
    const sk = M.sickOdds(g, b, ctx.weather);
    if (R.chance(sk.p)) { const x = R.range(0.05, 0.2); let lost = 0; for (const k of ST) { lost += a.st[k] * x; a.st[k] *= 1 - x; } died += lost; TG.rep.event(g, b, 'major', `Sick cows: lost ${Math.round(lost)} head`, `${U.pct(sk.p, 1)} odds this month: ${sk.why}`, { major: 'harvest' }); }
    m.died = died;
    // 3) growing up
    const G = c.grow; const cg = a.st.calf * G.calf, hg = a.st.heifer * G.heifer, sg = a.st.steer * G.steer, md = a.st.milker * G.milkerDry;
    a.st.calf -= cg; a.st.heifer += cg / 2 - hg; a.st.steer += cg / 2 - sg; a.st.milker += hg - md; a.st.ready += sg; a.st.dry += md;
    m.newMilkers = hg; m.newReady = sg; m.newDry = md;
    // 4) calves: bulls + cows; small herds faster per cow; stops near full room; hunger and poor health cut it
    M.herdSync(a);
    const births = M.breeders(a) * M.breedRate(a.herd) * M.bullF(a) * M.roomF(room) * fed * fed * a.health * work;
    a.st.calf += births; m.born = births;
    // 5) milk: milking cows that fit in the parlors, every day (collected and sold for you at your milk price)
    const milked = Math.min(a.st.milker, M.farmParlorCap(b));
    const milk = milked * E().milkPerCow * (0.4 + 0.6 * a.health) * Math.min(1, 0.5 + 0.5 * fed) * work * q;
    m.milk = milk; m.notMilked = Math.max(0, a.st.milker - milked);
    if (milk > 0) { const o = this.offer(g, b, 'cows', milk, 'Milk sales'); m.lost = (m.lost || 0) + o.unsold; TG.M.logVolX(g, f, o.sold); }
    // 6) manager orders: sell market-ready, cull dry cows, keep within room, keep feed topped up
    TG.D.farmCowOrders(g, b);
    M.herdSync(a);
  };
  M.models.farm.inventoryHerd = (g, b) => { const a = b.farm.areas.cows; if (!a.st) return 0; return U.sum(ST, (k) => a.st[k] * M.cowValue(g, k)) * HC().inventoryValue + (b.farm.feed || 0) * M.feedPrice(g) * 0.8; };

  // ---------- old saves: beef / dairy cow areas become one mixed herd ----------
  M.herdMigrate = (g, b) => {
    const f = b.farm; if (!f || !f.areas) return; const a = f.areas.cows;
    const old = a.kind != null || a.cows != null || a.young != null || a.ready != null;
    if (a.st && !old) return; if (!old && !(a.herd > 0)) { M.herdSync(a); return; }
    const dairy = a.kind === 'dairy'; const total = a.herd || 0; const cows = Math.min(total, a.cows != null ? a.cows : total / 2.07);
    const ready = Math.min(a.ready || 0, Math.max(0, total - cows)); const young = Math.max(U.sum(a.young || [], (x) => x.n), total - cows - ready); // anything not counted is young stock
    a.st = { calf: young * 0.45, heifer: young * 0.3, steer: young * 0.25, ready, milker: cows * (dairy ? 0.85 : 0.8), dry: cows * (dairy ? 0.15 : 0.2), bull: 0 };
    a.st.bull = (cows + young + ready) > 0 ? Math.max(1, Math.round((cows + young + ready) / 40)) : 0;
    const fromM = Math.min(a.st.bull, a.st.milker); a.st.milker -= fromM; a.st.dry = Math.max(0, a.st.dry - (a.st.bull - fromM)); // bulls are part of the old head count
    a.health = 0.9; delete a.kind; delete a.cows; delete a.young; delete a.ready; M.herdSync(a);
    const need = M.feedNeed(a); f.feed = Math.round(need); // one month of feed so nobody starves on load
    if (f.orders && f.orders.spray) delete f.orders.spray.cows;
    if (f.orders && !f.orders.cows) f.orders.cows = M.cowOrderDefaults();
    const spr = b.equip.filter((x) => x.type === 'sprCow'); // cow sprinklers are gone: sold back at a fair used price
    if (spr.length) { const v = Math.round(spr.length * 25000 * g.world.priceIdx * 0.45); TG.F.earn(g, v, 'Asset sales', b.id, true); }
    b.equip = b.equip.filter((x) => x.type !== 'sprCow');
  };
  M.cowOrderDefaults = () => ({ sellReady: true, cullDry: true, keepRoom: true, feedMonths: 2 });
})();
