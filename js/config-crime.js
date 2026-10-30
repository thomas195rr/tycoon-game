/* config-crime.js - the optional crime side (all goods and places are fictional; mechanics only). Every number the crime engine uses lives here. */
(function () {
  const C = globalThis.TG.CONFIG;
  C.crime = {
    // ---- products: fictional street goods. buy = wholesale per unit, street = normal street price, want = units a client buys a month,
    //      heat = heat per unit sold, work = how much dealing/running effort one unit takes, unlock = turf blocks + street rep needed
    products: {
      sugar: { icon: '🍬', label: 'Sugar Rush', buy: 18, street: 40, want: 4, heat: 0.001, work: 1, unlock: { turf: 0, rep: 0 }, desc: 'Cheap, lots of buyers, little heat. Thin margin.' },
      glow:  { icon: '✨', label: 'Glow', buy: 70, street: 150, want: 1.2, heat: 0.003, work: 1, unlock: { turf: 1, rep: 25 }, desc: 'Mid price, steady buyers.' },
      haze:  { icon: '🔮', label: 'Haze', buy: 290, street: 600, want: 0.3, heat: 0.012, work: 1.5, unlock: { turf: 3, rep: 45 }, desc: 'Pricey, fewer buyers, draws police attention.' },
      void:  { icon: '🌑', label: 'Void', buy: 1250, street: 2500, want: 0.06, heat: 0.05, work: 2, unlock: { turf: 7, rep: 60 }, desc: 'Top tier. Huge margin, huge heat. Only big connects sell it.' },
    },
    priceVol: 0.07, priceShock: 0.04, // monthly price wander and odds of a shortage/glut
    // ---- suppliers: price multiplier on wholesale, odds the order arrives in full / short / not at all, sting = undercover police
    suppliers: {
      plug:   { icon: '🧔', label: 'Corner plug', mult: 1.22, ok: 0.9, short: 0.06, sting: 0, goods: ['sugar', 'glow'], maxOrder: 3000, unlock: { turf: 0, rep: 0 }, desc: 'Small and fairly reliable. Costs more.' },
      harbor: { icon: '🚤', label: 'Harbor crew', mult: 1.06, ok: 0.8, short: 0.1, sting: 0.01, goods: ['sugar', 'glow', 'haze'], maxOrder: 8000, unlock: { turf: 2, rep: 30 }, desc: 'Normal prices, sometimes late or short.' },
      connect:{ icon: '🌎', label: 'Big connect', mult: 0.86, ok: 0.86, short: 0.08, sting: 0.01, goods: ['sugar', 'glow', 'haze', 'void'], maxOrder: 40000, minOrder: 50000, orderHeat: 3, unlock: { turf: 6, rep: 60 }, desc: 'Cheapest real supply, big minimum order, adds heat.' },
      newguy: { icon: '🕶️', label: 'New guy', mult: 0.62, ok: 0.55, short: 0.15, sting: 0.1, goods: ['sugar', 'glow', 'haze', 'void'], maxOrder: 5000, unlock: { turf: 0, rep: 0 }, desc: 'Too cheap to be true. Often flakes; sometimes it is a police sting.' },
    },
    noShowLoss: 0.6, // share of the money lost when an order does not show up
    sellBackShare: 0.35, // dumping stock back to a supplier returns this share of wholesale
    // ---- crew (work-capacity model): cap = work units a month at skill 50, wage in dirty cash
    crew: {
      dealer:   { icon: '🧍', label: 'Dealer', wage: 2200, cap: 500, desc: 'Sells to clients: about 500 deals a month.' },
      runner:   { icon: '🏃', label: 'Runner', wage: 1600, cap: 1400, desc: 'Moves product from the stash to dealers: about 1,400 a month.' },
      enforcer: { icon: '💪', label: 'Enforcer', wage: 3200, cap: 2, desc: 'Guards 2 turf blocks: fewer robberies and turf losses.' },
      lookout:  { icon: '👀', label: 'Lookout', wage: 1100, cap: 2, desc: 'Watches 2 blocks: lower raid odds and less is seized when raids come.' },
      cook:     { icon: '🧪', label: 'Cook', wage: 3800, cap: 1, desc: 'Makes product in a workshop for less than buying it. Adds heat.' },
    },
    cookMakes: { sugar: 700, glow: 240, haze: 55, void: 11 }, cookCostShare: 0.45, // units a cook makes a month, cost vs wholesale
    hireCost: 0.5, // months of wage paid up front to bring someone in
    trainCost: 1500, trainSkill: [4, 10], trainPerMonth: 1, bonusPerMonth: 1,
    youDeal: 250, youRun: 500, // what you do yourself while not in jail
    // ---- gear (dirty cash)
    gear: {
      stash:    { icon: '🏚️', label: 'Stash house', price: 25000, upkeep: 600, store: 3000, life: 240, desc: '+3,000 units of storage.' },
      van:      { icon: '🚐', label: 'Delivery van', price: 26000, upkeep: 300, cap: 900, life: 72, wear: true, desc: 'Moves about 900 units a month. Wears faster when busy.' },
      workshop: { icon: '🏭', label: 'Workshop', price: 60000, upkeep: 1500, cap: 2, life: 120, wear: true, heat: 1, desc: 'Room for 2 cooks. Adds heat; can be busted or catch fire.' },
      safe:     { icon: '🔐', label: 'Hidden safe', price: 9000, upkeep: 0, life: 360, desc: 'Hides 40% of dirty cash from raids and robbers (one is enough).' },
      cameras:  { icon: '📹', label: 'Cameras', price: 6000, upkeep: 100, life: 96, desc: 'Robbery odds -25% and a little warning before raids.' },
      phones:   { icon: '📱', label: 'Burner phones', price: 3000, upkeep: 200, life: 12, desc: 'Less evidence: your arrest odds in a raid -15%. Wear out in a year.' },
    },
    baseStore: 800,
    // ---- clients, street rep, turf
    perBlock: 160, newPerBlock: 22, churn: 0.07, startBlocks: 0, // clients one turf block can hold, new clients a month per block
    cheapGrowth: 1.6, dearChurn: 3, dearRoom: 1.5, elasticity: 2.0, // cheap = faster growth; expensive = more churn
    repDrift: 0.12, outOfStockRep: 6,
    turfCost: 15000, turfGrow: 1.35, turfWinBase: 0.7, // price of the next block = turfCost * (blocks+1)^turfGrow
    // ---- heat
    heatDecay: 0.08, heatFlat: 0.8, lookoutCool: 0.6, crewHeat: 0.12, blockHeat: 0.35,
    raid: { base: 0.004, k: 0.2, lookout: 0.35, bribe: 0.45, min: 0.004, stash: [0.5, 0.9], dirty: [0.3, 0.7], you: 0.35, crew: [1, 3] },
    rob:  { base: 0.012, k: 0.05, enforcer: 0.6, cameras: 0.25, take: [0.2, 0.5] },
    snitch: { base: 0.002, low: 0.03 },
    war: { base: 0.02, enforcer: 0.6 },
    bust: 0.01, // workshop accident / bust odds at 100% use
    // ---- law: lawyer tiers (monthly clean cash) and bribes (monthly dirty cash)
    lawyers: { none: { label: 'No lawyer', cost: 0, cut: 0, jail: 1 }, public: { label: 'Cheap lawyer', cost: 2500, cut: 0.12, jail: 0.85 }, sharp: { label: 'Sharp lawyer', cost: 12000, cut: 0.25, jail: 0.7 }, elite: { label: 'Elite firm', cost: 45000, cut: 0.38, jail: 0.55 } },
    convict: 0.78, convictMin: 0.18,
    bribes: { none: { label: 'No bribes', cost: 0, lvl: 0 }, cop: { label: 'A few cops', cost: 6000, lvl: 0.4 }, captain: { label: 'A captain', cost: 25000, lvl: 0.7 }, judge: { label: 'Cops + a judge', cost: 80000, lvl: 1, judge: 0.15 } },
    bribeScandal: 0.012, // monthly odds per bribe level that someone talks
    jail: { base: 3, perHeat: 0.18, perRecord: 4, fine: [0.15, 0.35], max: 60 },
    seize: { base: 0.15, perLaunder: 0.7, max: 0.9 }, // odds each legit business tied to laundering is taken on conviction
    // ---- laundering through your legit businesses
    cashShare: { cafe: 0.35, foodtruck: 0.4, bakery: 0.35, salon: 0.35, carwash: 0.5, lawn: 0.3, auto: 0.25, gym: 0.25, hotel: 0.2, farm: 0.1, freight: 0.1, brand: 0.1, law: 0.1, clinic: 0.05, construction: 0.15, factory: 0.05, tech: 0.03, franchise: 0.15 },
    launderFee: 0.25, shadyCap: 4000, shadyFee: 0.4, // with no businesses a shady money man cleans a little at a bad rate
    audit: { base: 0.003, k: 0.09, heat: 0.03, fine: 0.5, seize: 0.3 },
    // ---- protection racket: dirty cash per block a month
    racket: { perBlock: 3500, heat: 1.2, report: 0.02 },
    // ---- one-off jobs
    heists: {
      branch: { icon: '🏦', label: 'Small bank branch', pay: [60000, 180000], odds: 0.32, max: 0.72, heat: 30, crew: 3 },
      city:   { icon: '🏛️', label: 'City bank', pay: [300000, 900000], odds: 0.2, max: 0.58, heat: 45, crew: 5 },
      vault:  { icon: '🏰', label: 'Central vault', pay: [2000000, 6000000], odds: 0.08, max: 0.42, heat: 70, crew: 8 },
    },
    heistPlan: { perMonth: 0.06, maxMonths: 3, leak: 0.07 }, heistGear: [[0, 0], [12000, 0.05], [45000, 0.1], [140000, 0.15]],
    heistPros: [[0, 0], [0.05, 0.07], [0.12, 0.14]], // [share of mid payout paid up front, odds bonus]
    heistArrest: 0.7, heistPartial: 0.25, heistCooldown: 6,
    sabotage: {
      smear: { icon: '🗣️', label: 'Smear campaign', cost: 6000, ok: 0.7, boost: 1.08, months: 6, caught: 0.15, suit: [30000, 120000], heat: 4, arrest: 0, revenge: 0.2 },
      wreck: { icon: '🔧', label: 'Wreck their gear', cost: 18000, ok: 0.6, boost: 1.16, months: 5, caught: 0.3, suit: [60000, 250000], heat: 15, arrest: 0.3, revenge: 0.3 },
    },
    sabCooldown: 4,
    insider: { odds: 0.58, up: [0.15, 0.4], down: [0.25, 0.45], probe: 0.1, probePer: 0.08, fine: 2, heat: 20, arrest: 0.3, max: 1000000, cooldown: 3 },
    theft: { ok: 0.68, pay: [4000, 14000], arrest: 0.14, youShare: 0.35, heat: 5, maxCrew: 4 },
  };
})();
