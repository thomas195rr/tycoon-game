/* config-v6.js - v6 numbers: industry cycles, mechanics, cow herd life cycle + feed, credit & loans. Every number v6 uses lives here. */
(function () {
  const C = globalThis.TG.CONFIG, BZ = C.businesses;

  // ---------------- INDUSTRY CYCLES ----------------
  // Each industry has its own boom / slump cycle: level x (log of "how good things are"), speed v.
  // Each month: v = keep*v - pull*x + noise (part shared with the whole economy); x = x + v.
  // The pull back to normal makes slumps end and booms fade (mean-reverting), but the noise means timing is never certain.
  // demandK / priceK / costK: how much x moves customer demand, selling prices and input costs.
  C.industryCycle = { keep: 0.93, pull: 0.011, noise: 0.0042, shared: 0.35, econLink: 0.08, max: 0.45 };
  C.industries = {
    food:   { label: 'Food & restaurants', icon: '🍔', biz: ['cafe', 'foodtruck', 'bakery', 'franchise'], demandK: 0.8, priceK: 0.35, costK: 0.4,
      up: ['Eating out is back in fashion', 'Food delivery apps send more orders', 'Tourists are back in town'], down: ['Grocery prices squeeze diners', 'People cook at home to save money', 'A food-safety scare keeps customers away'] },
    farming: { label: 'Farming', icon: '🚜', biz: ['farm'], markets: ['grain', 'fruit', 'beef', 'milk'], demandK: 0.3, priceK: 0.9, costK: 0.35,
      up: ['Export deals raise crop prices', 'Bad harvests overseas push prices up', 'More demand for local food'], down: ['A record harvest floods the market', 'Export ban hits farm prices', 'Feed and fertilizer prices jump'] },
    freight: { label: 'Trucking & freight', icon: '🚛', biz: ['freight'], markets: ['freight'], demandK: 0.7, priceK: 0.8, costK: 0.3,
      up: ['Online shopping boom fills trucks', 'Ports are busy again', 'New warehouses open nearby'], down: ['Too many trucks chasing too few loads', 'Factories ship less', 'Shippers switch to rail'] },
    tech:   { label: 'Tech', icon: '📱', biz: ['tech'], markets: ['software'], demandK: 1.2, priceK: 0.7, costK: 0.3,
      up: ['Investors pour money into apps', 'Businesses go digital', 'A new gadget craze'], down: ['Tech bubble pops', 'Businesses cut software budgets', 'Privacy scandal scares users'] },
    retail: { label: 'Clothing & retail', icon: '👕', biz: ['brand'], markets: ['apparel'], demandK: 0.8, priceK: 0.6, costK: 0.35,
      up: ['A new fashion trend takes off', 'Shoppers are spending again', 'Influencers push online brands'], down: ['Shoppers cut back on clothes', 'Cheap imports undercut prices', 'Online ad costs soar'] },
    health: { label: 'Health care', icon: '🩺', biz: ['clinic'], demandK: 0.6, priceK: 0.4, costK: 0.4,
      up: ['Insurers pay more per visit', 'An aging town needs more care', 'Flu season fills waiting rooms'], down: ['Insurers cut what they pay', 'A big hospital opens nearby', 'Fewer people can afford care'] },
    construction: { label: 'Construction', icon: '🏗️', biz: ['construction'], demandK: 0.9, priceK: 0.5, costK: 0.45,
      up: ['Housing boom: everyone is building', 'The city funds new roads', 'Low rates spark new projects'], down: ['Building permits dry up', 'Lumber and steel prices spike', 'Developers cancel projects'] },
    hospitality: { label: 'Hotels & travel', icon: '🏨', biz: ['hotel'], demandK: 0.9, priceK: 0.5, costK: 0.35,
      up: ['Travel is booming', 'A big festival comes to town', 'Business trips are back'], down: ['Travel slump', 'Airlines cut routes', 'Short-term rentals steal guests'] },
    legal:  { label: 'Legal services', icon: '⚖️', biz: ['law'], demandK: 0.6, priceK: 0.4, costK: 0.3,
      up: ['New rules mean more legal work', 'Lots of deals need lawyers', 'A wave of lawsuits'], down: ['Online legal forms replace lawyers', 'Fewer company deals', 'Clients haggle over fees'] },
    manufacturing: { label: 'Manufacturing', icon: '🏭', biz: ['factory'], markets: ['goods'], demandK: 0.6, priceK: 0.7, costK: 0.45,
      up: ['Stores reorder in bulk', 'Factories move back home', 'Big export order'], down: ['Raw material prices spike', 'Stores are overstocked', 'Cheap imports flood in'] },
    personal: { label: 'Salons & gyms', icon: '💇', biz: ['salon', 'gym'], demandK: 0.7, priceK: 0.35, costK: 0.3,
      up: ['A fitness craze sweeps town', 'Self-care is trendy', 'New Year crowds stay longer'], down: ['People cut treats to save money', 'Home workouts go viral', 'Cheap chains open nearby'] },
    autos:  { label: 'Car services', icon: '🚗', biz: ['carwash', 'auto'], demandK: 0.7, priceK: 0.35, costK: 0.35,
      up: ['More cars on the road', 'Older cars need more repairs', 'Road trips are popular'], down: ['People drive less', 'Car parts prices jump', 'Dealers offer free washes and service'] },
    home:   { label: 'Home & garden', icon: '🏡', biz: ['lawn'], demandK: 0.8, priceK: 0.35, costK: 0.3,
      up: ['Home owners spend on yards', 'New houses need landscaping', 'Garden shows are a hit'], down: ['Home owners tighten budgets', 'Do-it-yourself is trendy', 'Water limits hurt lawn work'] },
  };
  // which industry each business / market belongs to
  C.indOf = {}; C.marketInd = {};
  for (const k in C.industries) { for (const t of C.industries[k].biz) { C.indOf[t] = k; if (BZ[t]) BZ[t].ind = k; } for (const m of C.industries[k].markets || []) C.marketInd[m] = k; }
  for (const t in BZ) if (C.markets['svc_' + t]) C.marketInd['svc_' + t] = C.indOf[t];
  C.indStates = [[0.12, 'Boom', 'good'], [0.04, 'Growing', 'good'], [-0.04, 'Steady', ''], [-0.12, 'Weak', 'warn'], [-9, 'Slump', 'bad']];
})();
// ---------------- MECHANICS (v6) ----------------
// Machines are NOT fixed or serviced unless you do it, or you hire a mechanic (a staff role in every business with machines).
// A mechanic looks after `per` machines a month (more with skill), repairs and services at a discount, and picks when to service.
(function () {
  const C = globalThis.TG.CONFIG, BZ = C.businesses;
  C.mechanic = { per: 10, repairMult: [0.85, 0.5], serviceMult: [0.9, 0.6], serviceAt: [70, 30], slop: [16, 3], catchHidden: [0.1, 0.6], miss: [0.25, 0.02], repairUnits: 2 };
  const W = { small: [3000, 5600], between: [3600, 6600], corp: [4200, 8200] };
  const TECHY = { tech: 1, law: 1, clinic: 1, brand: 1 };
  for (const t in BZ) {
    const d = BZ[t]; if (!d.equip || !d.equip.length) continue;
    d.roles.mech = { label: TECHY[t] ? 'Repair tech' : 'Mechanic', icon: '🔧', wage: W[d.tier] || W.small, cap: C.mechanic.per, mech: true, min: 0,
      desc: `Repairs broken ${TECHY[t] ? 'machines and computers' : 'machines'} right away and services them at the best time, for less than you pay. One looks after about ${C.mechanic.per} machines (more if skilled).` };
  }
  delete C.specialists.mechanic; delete C.perks.mechanic; // v6: mechanics are staff (Staff tab), not a one-person specialist; old saves move theirs over
})();
// ---------------- CREDIT & LOANS (v6) ----------------
// Score 300-850 is worked out from what you did, never handed out: payment history, credit line use, debt vs what you own,
// how long you have had credit, recent applications, and bankruptcies/defaults. Loans are applied for: odds, not a sure yes.
(function () {
  const C = globalThis.TG.CONFIG;
  C.credit = {
    pts: { pay: 190, util: 165, debt: 85, age: 85, inq: 45 }, // max points for each part (300 + parts, capped at 850)
    lateHalfLife: 24, lateHit: 0.22, thinMonths: 36, ageFull: 180, inqHit: 0.2, inqMonths: 12,
    derog: { bankruptcy: [180, 84], business: [110, 60], collections: [90, 48], repo: [70, 48] }, // points, months to fade
    fee: { business: 0.015, equipment: 0.015, mortgage: 0.01, emergency: 0.03, loc: 250 },
    base: { business: 0.4, equipment: 1.0, mortgage: 0.9, emergency: 1.8, loc: 0.6 },   // easy/hard to get (logit)
    terms: { business: [36, 60, 84, 120], equipment: [36, 48, 60], mortgage: [180, 240, 300, 360], emergency: [12, 24], loc: [0] },
    collectionsAfter: 4, // unsecured loans: this many missed payments = sent to collections (big score hit)
    rateSpread: 0.00025, indRate: 0.02,
  };
  C.finance.loans.loc = { label: 'Business credit line', minCredit: 0, spread: 0.05, term: 0 };
})();
// ---------------- RENTALS: rent you set + paid tenant search (v6) ----------------
(function () {
  const C = globalThis.TG.CONFIG;
  C.tenants = {
    rentSteps: [0.7, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2, 1.3, 1.4], // your rent as a share of local market rent
    search: { base: 200, perRent: 0.3, maxUnitsScale: 25, expires: 2 },     // ads, showings and background checks
    pool: { atMarket: 6, slope: 5.5, max: 16, commercial: 0.5 },             // applicants at market rent; fewer when rent is high
    quality: { atMarket: 0.5, slope: 1.1, sd: 0.2, cond: 1 / 400 },          // average applicant quality; better when rent is low
    late: { base: 0.008, k: 0.32, pow: 2, recession: 1.6, missShare: [0.55, 0.4] },
    damage: { base: 0.003, k: 0.06 }, turnover: 0.6, // cleaning/paint when someone moves out (x monthly rent)
    lifeEvent: 0.003, lifeDrop: 0.35,
    leave: { base: 0.15, k: 0.25, overRent: 0.3 },
    lateFee: 0.05,
  };
})();
// ---------------- COWS: one herd for milk AND meat, life stages, feed in storage (v6) ----------------
(function () {
  const C = globalThis.TG.CONFIG, BZ = C.businesses, FD = BZ.farm.farm;
  FD.enterprises.cows = {
    label: 'Cows (milk + meat)', market: 'milk', headPerAcre: 1.0, headPerHand: 120, headPerTractor: 450, diseaseBase: 0.006, best: 'grassland',
    milkPerCow: 0.75, parlorCows: 160,
  };
  C.cows = {
    stages: {
      calf:   { icon: '🐮', label: 'Calves',          feed: 0.15, value: 0.35, death: 0.006, what: 'Born on the farm. After about a year they become heifers (girls) or steers (boys).' },
      heifer: { icon: '🐄', label: 'Heifers',         feed: 0.35, value: 0.85, death: 0.002, what: 'Young females: no milk yet. After about a year they have a calf and start milking.' },
      steer:  { icon: '🐂', label: 'Steers',          feed: 0.4,  value: 0.75, death: 0.002, what: 'Young males raised for meat. About 6 months later they reach market weight.' },
      ready:  { icon: '🥩', label: 'Market-ready',    feed: 0.45, value: 1.0,  death: 0.002, what: 'At market weight: sell them for meat. Keeping them just costs feed.' },
      milker: { icon: '🥛', label: 'Milking cows',    feed: 0.55, value: 1.1,  death: 0.002, what: 'Make milk every day (needs parlor space) and can have calves.' },
      dry:    { icon: '👵', label: 'Dry / old cows',  feed: 0.4,  value: 0.6,  death: 0.004, what: 'No more milk. Still eat. Sell them for meat (cull), or keep them a little longer.' },
      bull:   { icon: '🐃', label: 'Bulls',           feed: 0.6,  value: 1.2,  death: 0.002, what: 'Needed for calves: one bull for about 40 cows. No bull = far fewer calves.' },
    },
    grow: { calf: 1 / 12, heifer: 1 / 12, steer: 1 / 6, milkerDry: 1 / 72 },
    // calves per breeding cow per month. Small herds breed much faster per cow (more attention, less crowding);
    // big herds slow down a lot. Full pasture or too little feed stops it. Never a free money machine.
    breed: { base: 0.07, half: 30, bullPer: 40, noBull: 0.35, roomFull: 0.85 },
    grassPerHead: 0.45, grassSeason: [0, 0.15, 0.15, 0.5, 0.9, 1.2, 1.2, 1.2, 1.2, 1.2, 0.9, 0.5, 0.15], // by month of year (1-12)
    grassWeather: { drought: 0.55, heat: 0.75 },
    feedPrice: 160, feedTonsCap: 0.5, // tons of storage space per ton of feed (bales stack well)
    hunger: { healthDrop: 0.25, healthGain: 0.04, deathK: 0.05, sickK: 3 },
    buyMarkup: 1.15, sellDrop: 0.97, inventoryValue: 0.7, milkCalfDip: 0.9,
  };
  C.farmGoods.cows = { icon: '🥛', label: 'Milk', unit: 't', market: 'milk' };
  FD.areas.cows.what = 'Grass for your cows. Cows also need FEED from storage when grass is short (winter, dry months).';
  FD.areas.cows.spr = null; FD.areas.cows.treat = 0;
  BZ.farm.equip = BZ.farm.equip.filter((x) => x.id !== 'sprCow');
  // planting now only costs fuel (fertilizer comes from spraying, which you choose); orchard care is pruning and fuel
  FD.enterprises.crops.inputPerAcre = 40; FD.enterprises.orchard.inputPerAcre = 150;
})();
