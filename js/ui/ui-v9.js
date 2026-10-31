/* ui-v9.js - v9: what's-new note after an update (Shift lead migration), cheaper fixed costs explained,
   tech funding rounds and "stalled: consider a pivot" hints. Loaded after ui-v8.js. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI; const U = TG.U; const esc = UI.esc; const m = UI.m;
  // ---- one-time note after loading a v8 save ----
  const render0 = UI.render;
  UI.render = () => {
    render0();
    const g = TG.G; if (!g || !g.v9notes || !g.v9notes.length || document.getElementById('modal')) return;
    UI.modal('🆕 Game updated (v9)', `<div class="card"><div class="mute">Some things changed. Here is what happened in your game:</div>
      ${g.v9notes.map((t) => `<div class="ev info">${esc(t)}</div>`).join('')}
      <div class="small" style="margin-top:6px">🛠️ No more Shift leads: managers (Ops, GM, CEO) order supplies and your crew works the site. GM and Ops managers also work at ${Math.round(TG.CONFIG.staff.mgrWorkFrac * 100)}% of a worker.<br>
      📈 Every worker now has a market value. Pay well under it and other companies may hire them away (see 🎯 on each worker). 🌱 Cheap trainees can be trained up.<br>
      🏢 Apartment rents are about 10% higher. 🌮🌿 Food trucks and lawn care have lower fixed costs. 💻 Tech startups burn less while building and get investor offers at user milestones.</div>
      <div class="btns">${UI.btn('👍 Got it', 'v9ok', null, 'pri')}</div></div>`);
  };
  UI.A.v9ok = () => { const g = TG.G; if (g) delete g.v9notes; UI.save(); UI.closeModal(); UI.render(); };
  // ---- tech: stalled hint, lean build pay, funding-round status (under the "What you have" card) ----
  const sc0 = UI.stockCard;
  UI.stockCard = (g, b) => {
    const o = sc0(g, b); if (!b.tech) return o;
    const T = TG.CONFIG.businesses.tech.tech, t = b.tech; let x = '';
    if (TG.M.techStalled && TG.M.techStalled(g, b)) x += `<div class="ev warn">🧊 Stalled: live for ${g.month - t.liveAt} months and still under 5,000 users. Most apps that stall never take off. Consider 🔄 pivoting (start over with a new idea and a fresh chance at fit).</div>`;
    if (t.phase === 'build' && T.buildPay < 1) x += `<div class="mute">⏳ While building, engineers take ${U.pct(1 - T.buildPay)} of their pay in stock options: you pay ${U.pct(T.buildPay)} of wages until launch.</div>`;
    if (T.rounds) x += UI.irow('tfr' + b.id, '💰', 'Investor rounds', T.rounds.map((r) => `${(t.rounds || {})[r.id] != null ? '✅' : '⬜'} ${N(r.users)}`).join(' · '), `When you pass a user milestone, investors offer cash for a share: ${T.rounds.map((r) => `${r.label} at ${N(r.users)} users: about ${m(r.perUser)} per user (at least ${m(r.min)}) for ${U.pct(r.pct)}`).join('; ')}. You decide (or your GM or accountant does). Cash now lowers the risk of running out; you keep less of the upside. Investors stop at 45% outside ownership.`, null, 'users needed');
    return o + (x ? `<div class="card"><h3>💻 Startup</h3>${x}</div>` : '');
  };
  // ---- why some businesses have lower fixed costs (shop listing + start dialog) ----
  UI.v9costNote = (d) => [d.fixedCutWhy ? `💸 ${d.fixedCutWhy}` : '', d.offSeason ? `❄️ ${d.offSeason.why}` : ''].filter(Boolean).join(' ');
  const N = (x) => Math.round(x).toLocaleString();
})();
/* v9: every herd stage explains itself in plain numbers (what it does, what it costs, what to do), plus dry/old cows:
   a count with feed cost and meat value next to a Sell button, and a heads-up when they pile up with nobody selling them. */
(function () {
  const TG = globalThis.TG; const UI = TG.UI; const U = TG.U; const m = UI.m;
  const N = (x) => Math.round(x).toLocaleString();
  UI.cowStageTip = (g, b, k) => {
    const HC = TG.CONFIG.cows, S = HC.stages[k], M = TG.M, a = b.farm.areas.cows; const n = Math.floor(a.st[k] || 0);
    const fp = M.feedPrice(g); const feedEach = S.feed * fp; const val = M.cowValue(g, k) * HC.sellDrop;
    const yrs = (r) => (1 / r / 12 >= 1 ? `${(1 / r / 12).toFixed(1).replace(/\.0$/, '')} year${1 / r / 12 >= 1.5 ? 's' : ''}` : `${Math.round(1 / r)} months`);
    const cost = `Each eats ${S.feed} t of food a month (grass first; when grass is short that is ${m(feedEach)} of bought feed) and takes 1 head of room on your pasture. About ${U.pct(S.death, 1)} die each month. Sells for about ${m(val)} each as meat.`;
    const bp = M.breeders(a), bulls = Math.floor(a.st.bull || 0), need = Math.ceil(bp / HC.breed.bullPer);
    const milkPer = M.areaE(b, 'cows').milkPerCow || 0.75; const milkVal = milkPer * TG.W.price(g, 'milk', 0);
    const T = {
      calf: `Born to your milking cows (and some dry cows). ${cost} After about ${yrs(HC.grow.calf)} half become heifers (future milkers) and half become steers (meat). What to do: let them grow. Sell calves only if the pasture is over-full.`,
      heifer: `Young females. No milk yet. ${cost} After about ${yrs(HC.grow.heifer)} they have their first calf and start milking. What to do: keep them, they are your future milking cows. Sell a few only if room is short.`,
      steer: `Young males raised for meat. No milk. ${cost} After about ${yrs(HC.grow.steer)} they reach market weight (🥩 market-ready). What to do: keep them until then.`,
      ready: `Steers at full market weight: worth the most now. ${cost} They will not get more valuable, so keeping them only costs food and room. What to do: sell them (💵 Sell, or your manager's "Sell market-ready cattle" order).`,
      milker: `Your money makers: each makes about ${milkPer} t of milk a month (about ${m(milkVal)} at today's price) if a parlor milks her (one parlor = ${HC.parlorCows || 160} cows) and she is fed. She also has calves. ${cost} After about ${yrs(HC.grow.milkerDry)} on average she goes dry (old). What to do: keep them fed and milked.`,
      dry: `Old cows that stopped milking: they make NO milk. They still eat ${S.feed} t of feed a month (${U.pct(S.feed)} of a full ration; a milking cow eats ${HC.stages.milker.feed} t; ${m(feedEach)} of feed when grass is short), take pasture room, and count only 30% as a mother for calves. About ${U.pct(S.death, 1)} die each month. Sold for meat they bring about ${m(val)} each (meat price: ${U.pct(S.value / HC.stages.ready.value)} of a market-ready steer). With no farm manager they pile up until YOU sell them. A GM or Ops manager with the "Sell dry / old cows" order (on by default) sells them every month. What to do: sell them.`,
      bull: `Needed for calves: one bull covers about ${HC.breed.bullPer} mothers. You have ${N(bulls)} for ${N(bp)} mothers (${N(need)} needed). Without a bull only ${U.pct(HC.breed.noBull)} of the calves come. ${cost} What to do: keep ${N(Math.max(1, need))}; sell extras.`,
    };
    return `${n ? `You have ${N(n)}. ` : ''}${T[k] || S.what}`;
  };
  // Now page: dry-cow line with Sell button (added under the farm's "What you have" card)
  const sc0 = UI.stockCard;
  UI.stockCard = (g, b) => {
    let o = sc0(g, b); if (!b.farm || !TG.M.dryPile) return o;
    const d = TG.M.dryPile(g, b); if (!d) return o;
    // v9: the dry-cow row with its Sell control now sits on the herd card right under Market-ready (UI farmRows); only the heads-up stays here
    if (!d.pile) return o;
    return o + `<div class="card"><div class="ev warn">👵 Dry cows are piling up: ${N(d.n)} eating up to ${m(d.feed)} of feed a month and making no milk (${d.why}). Sell them for about ${m(d.meat)} (👵 row under 🥩 Market-ready, or the button here). ${UI.btn(`💵 Sell all for ~${m(d.meat)}`, 'cowSellDry', b.id, 'xs goodb')}</div></div>`;
  };
  UI.A.cowSellDry = (id) => { const g = TG.G; const b = g.businesses.find((x) => x.id === id); if (!b) return; const r = TG.M.farmSellCattle(g, b, Math.floor(b.farm.areas.cows.st.dry || 0), 'dry'); if (r && r.ok) UI.toast(`Sold ${N(r.head)} dry cows for ${m(r.rev)}.`); else UI.toast((r && r.msg) || 'Nothing to sell.', true); UI.closeModal(); UI.refresh(); };
  // heads-up before Next Month / Skip (joins the supplies warning list)
  const sw0 = UI.supplyWarnings;
  UI.supplyWarnings = (g) => {
    const out = sw0(g);
    for (const b of g.businesses) { const d = b.farm && TG.M.dryPile && TG.M.dryPile(g, b); if (d && d.pile) out.push({ b, q: 0, bad: false, dry: d, text: `has ${N(d.n)} dry / old cows piling up (${d.why}): they make no milk and eat up to ${m(d.feed)} of feed a month. Sell them for about ${m(d.meat)} (farm Now tab).` }); }
    return out;
  };
})();
