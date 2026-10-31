/* =====================================================================
   config.js  -  THE ONE PLACE FOR TUNABLE NUMBERS.
   Every odds value, cost, price, wage, margin, market size and event
   rate in the game lives here (businesses are in the same object, split
   across config.js + config-businesses.js only to keep files readable).
   Game numbers are game numbers: none are real-world statistics.
   ===================================================================== */
(function () {
  const TG = (globalThis.TG = globalThis.TG || {});
  const C = {};
  C.version = 1;
  C.start = { year: 2026, cash: [90000, 260000], credit: [610, 760], listings: 36, newListingsPerMonth: 5, maxListings: 40 };
  C.difficulty = {
    eventFreq: { calm: 0.7, normal: 1.0 },          // no hard / ironman mode by design
    startMoney: { random: 1, low: 0.6, high: 1.6 },
  };
  C.riskLabels = { moderate: 0.03, high: 0.08, critical: 0.16 };
  C.maxLog = 600;
  C.maxHistory = 240;

  // manager perks: unlocked by the manager's skill. [skill needed, effect key, amount, plain words]
  C.perks = {
    gm: [[40, 'demand', 0.02, '+2% customers (better service)'], [60, 'supplyCut', 0.03, '-3% supply costs (better deals)'], [80, 'demand', 0.03, '+3% more customers']],
    ops: [[40, 'breakCut', 0.1, '-10% breakdown odds'], [60, 'wearCut', 0.1, '-10% machine wear'], [80, 'breakCut', 0.1, 'another -10% breakdowns']],
    hr: [[40, 'quitCut', 0.15, '-15% odds staff quit'], [60, 'morale', 3, '+3 morale for everyone'], [80, 'quitCut', 0.15, 'another -15% quits']],
    accountant: [[40, 'supplyCut', 0.02, '-2% supply costs (catches overbilling)'], [70, 'supplyCut', 0.02, 'another -2% supply costs']],
    mechanic: [[40, 'wearCut', 0.1, '-10% machine wear'], [60, 'breakCut', 0.1, '-10% breakdown odds'], [80, 'wearCut', 0.1, 'another -10% wear']],
  };
  C.owner = {
    operatedQuality: 0, operatedCogsCut: 0, absentQuality: 0, // owner labor removed in v4
    expQualityPerYear: 1.2, expQualityCap: 10,
  };

  C.locations = {
    city:   { label: 'City',   pps: 260, ppa: 1800000, traffic: [0.85, 1.0], labor: [0.8, 1.0],  tax: 0.016, crime: 1.3, wage: 1.15 },
    suburb: { label: 'Suburb', pps: 170, ppa: 260000,  traffic: [0.5, 0.75], labor: [0.6, 0.85], tax: 0.013, crime: 0.9, wage: 1.05 },
    town:   { label: 'Town',   pps: 110, ppa: 35000,   traffic: [0.3, 0.55], labor: [0.35, 0.6], tax: 0.011, crime: 0.8, wage: 0.95 },
    rural:  { label: 'Rural',  pps: 65,  ppa: 2800,    traffic: [0.08, 0.25], labor: [0.15, 0.35], tax: 0.008, crime: 0.6, wage: 0.88 },
    remote: { label: 'Remote', pps: 40,  ppa: 1200,    traffic: [0.01, 0.07], labor: [0.03, 0.14], tax: 0.006, crime: 0.5, wage: 0.85 },
  };
  C.regions = {
    harbor: { label: 'Harbor City metro', price: 1.15, wage: 1.08, demand: 1.08, climate: { drought: 0.6, storm: 1.2, frost: 0.8, rain: 1.2, heat: 1, flood: 1.1, snow: 0.8 } },
    maple:  { label: 'Maple Valley',      price: 0.95, wage: 0.97, demand: 0.97, climate: { drought: 0.8, storm: 1.0, frost: 1.3, rain: 1.0, heat: 0.8, flood: 1, snow: 1.3 } },
    mesa:   { label: 'Red Mesa',          price: 0.82, wage: 0.92, demand: 0.93, climate: { drought: 1.7, storm: 0.8, frost: 0.6, rain: 0.6, heat: 1.6, flood: 0.6, snow: 0.3 } },
  };
  C.propertyKinds = {
    storefront: { label: 'Storefront',        locs: ['city', 'suburb', 'town'], sqft: [600, 3200], acres: [0.03, 0.25] },
    office:     { label: 'Office space',      locs: ['city', 'suburb', 'town'], sqft: [1200, 12000], acres: [0.05, 0.6] },
    lot:        { label: 'Commercial lot',    locs: ['city', 'suburb', 'town', 'rural', 'remote'], sqft: [300, 2500], acres: [0.3, 3] },
    warehouse:  { label: 'Warehouse / industrial', locs: ['suburb', 'town', 'rural'], sqft: [8000, 90000], acres: [1, 15] },
    farmland:   { label: 'Farmland',          locs: ['rural', 'remote', 'town'], sqft: [800, 4000], acres: [40, 900] },
    ranch:      { label: 'Ranch land',        locs: ['rural', 'remote'], sqft: [800, 3000], acres: [200, 4000] },
    hillside:   { label: 'Hillside acreage',  locs: ['rural', 'town', 'remote'], sqft: [600, 2500], acres: [30, 350] },
    hotelbldg:  { label: 'Hotel building',    locs: ['city', 'suburb', 'town'], sqft: [14000, 80000], acres: [0.5, 4] },
    medical:    { label: 'Medical building',  locs: ['city', 'suburb', 'town'], sqft: [3000, 20000], acres: [0.3, 2] },
  };
  C.landTypes = {
    flat:       { label: 'Rich flat soil, steady rain', soil: [0.7, 0.95], water: [0.6, 0.9], flood: 0.01, frost: 1.0 },
    hillside:   { label: 'Hillside, mild climate, good drainage', soil: [0.5, 0.75], water: [0.45, 0.7], flood: 0, frost: 0.6 },
    grassland:  { label: 'Rolling grassland, plenty of water', soil: [0.45, 0.7], water: [0.7, 0.95], flood: 0.005, frost: 1.0 },
    dry:        { label: 'Dry land, no irrigation', soil: [0.2, 0.45], water: [0.05, 0.3], flood: 0, frost: 0.8 },
    floodplain: { label: 'Flood plain', soil: [0.8, 1.0], water: [0.8, 1.0], flood: 0.06, frost: 1.0 },
    frostvalley:{ label: 'Frost-prone valley', soil: [0.55, 0.8], water: [0.5, 0.8], flood: 0.01, frost: 2.2 },
    urban:      { label: 'Built-up ground', soil: [0.05, 0.2], water: [0.3, 0.5], flood: 0.003, frost: 0.8 },
  };
  C.property = {
    mortgageDown: 0.2, leaseRatePerMonth: 0.0075, landLeaseRatePerMonth: 0.0028, landLeaseKinds: ['farmland', 'ranch', 'hillside'], leaseDeposit: 2, sellCostPct: 0.05, buyCostPct: 0.02,
    suitBands: [[0.72, 'Great', 'good'], [0.56, 'Good', 'good'], [0.4, 'Fair', 'warn'], [0, 'Poor', 'bad']],
    suitNoise: 0.07, valueDrift: 1.0,
  };

  C.economy = {
    phases: {
      boom:      { label: 'Boom',      econ: 1.10, dur: [18, 42], next: { slowdown: 1 }, rate: 0.055, housing: 0.007 },
      slowdown:  { label: 'Slowdown',  econ: 0.98, dur: [6, 16],  next: { recession: 0.55, recovery: 0.2, boom: 0.25 }, rate: 0.05, housing: 0.001 },
      recession: { label: 'Recession', econ: 0.84, dur: [8, 20],  next: { recovery: 1 }, rate: 0.025, housing: -0.008 },
      /* v9 audit: house prices now rise about with inflation (+2.6%/yr vs 1.5% before; prices rise 2.4%/yr) */
      recovery:  { label: 'Recovery',  econ: 1.0,  dur: [10, 26], next: { boom: 0.7, slowdown: 0.3 }, rate: 0.035, housing: 0.004 },
    },
    rateDrift: 0.08, rateNoise: 0.0008, rateMin: 0.005, rateMax: 0.12,
    inflationPerMonth: 0.0018, fuelNoise: 0.04, housingNoise: 0.006, crashChance: 0.0025, crashDrop: [0.12, 0.28],
  };
  C.weather = {
    kinds: {
      rain:    { label: 'Rainy stretch', sev: 0.35, base: 0.12 },
      storm:   { label: 'Storms', sev: 0.6, base: 0.05 },
      heat:    { label: 'Heat wave', sev: 0.4, base: 0.06, months: [5, 6, 7] },
      drought: { label: 'Drought', sev: 0.7, base: 0.05, months: [4, 5, 6, 7, 8] },
      frost:   { label: 'Early / late frost', sev: 0.7, base: 0.06, months: [2, 3, 9, 10] },
      flood:   { label: 'Flooding', sev: 0.8, base: 0.015 },
      snow:    { label: 'Heavy snow', sev: 0.5, base: 0.25, months: [0, 1, 11] },
    },
  };
  C.worldEvents = [
    { id: 'minwage', label: 'Minimum wage hike', p: 0.006, effect: { wageIdx: [0.04, 0.09] } },
    { id: 'license', label: 'New licensing rules for an industry', p: 0.004, effect: { licenseFee: [3000, 40000] } },
    { id: 'rentcap', label: 'Rent cap law passed', p: 0.003, effect: { rentCap: [24, 60] } },
    { id: 'emissions', label: 'New emissions rules', p: 0.003, effect: { emissions: [24, 60] } },
    { id: 'ratejump', label: 'Central bank rate jump', p: 0.006, effect: { rate: [0.01, 0.02] } },
    { id: 'ratecut', label: 'Surprise rate cut', p: 0.005, effect: { rate: [-0.015, -0.007] } },
    { id: 'trend', label: 'New consumer trend', p: 0.03, effect: { trend: [0.15, 0.35] } },
    { id: 'fade', label: 'A trend fades', p: 0.02, effect: { trend: [-0.25, -0.1] } },
    { id: 'crime', label: 'Crime wave', p: 0.008, effect: { crime: [6, 14] } },
    { id: 'shortage', label: 'Supply shortage', p: 0.02, effect: { shortage: [2, 6] } },
    { id: 'fuel', label: 'Fuel price spike', p: 0.012, effect: { fuel: [0.15, 0.4] } },
    { id: 'drivers', label: 'Driver shortage', p: 0.006, effect: { driverShortage: [6, 18] } },
    { id: 'hours', label: 'Driving-hours regulation', p: 0.002, effect: { hoursReg: [24, 72] } },
  ];
  C.trendCats = ['food', 'fitness', 'beauty', 'auto', 'fashion', 'tech', 'travel', 'home', 'health', 'legal'];

  // price = base * econ^sens * trend * comp^-compElast * (1 - drop * share^shape)
  C.markets = {
    grain:    { label: 'Grain', unit: 'ton', base: 340, demand12: 420000, sens: 0.3, drop: 0.68, shape: 0.9, compElast: 0.5, trendCat: 'food' },
    fruit:    { label: 'Fruit', unit: 'ton', base: 440, demand12: 150000, sens: 0.5, drop: 0.68, shape: 0.9, compElast: 0.5, trendCat: 'food' },
    beef:     { label: 'Cattle', unit: 'head', base: 2250, demand12: 90000, sens: 0.5, drop: 0.68, shape: 0.9, compElast: 0.5, trendCat: 'food' },
    freight:  { label: 'Freight', unit: 'load', base: 1980, demand12: 720000, sens: 0.8, drop: 0.68, shape: 0.9, compElast: 0.6, trendCat: 'home' },
    apparel:  { label: 'Apparel', unit: 'item', base: 42, demand12: 5000000, sens: 0.9, drop: 0.6, shape: 0.8, compElast: 0.3, trendCat: 'fashion' },
    goods:    { label: 'Manufactured goods', unit: 'unit', base: 42, demand12: 4000000, sens: 0.8, drop: 0.68, shape: 0.9, compElast: 0.5, trendCat: 'home' },
    software: { label: 'Software users', unit: 'user', base: 9, demand12: 4000000, sens: 0.4, drop: 0.5, shape: 1.0, compElast: 0.2, trendCat: 'tech' },
  };
  C.marketRules = { compReactUp: 0.012, compReactDown: 0.018, compMin: 0.4, compMax: 1.8, antitrustShare: 0.35, antitrustChance: 0.03, antitrustFine: [0.04, 0.1], demandGrowth: 0.0012 };

  C.equipTiers = {
    used:     { label: 'Used',     price: 0.35, out: 0.9,  brk: 1.6,  wear: [25, 70], age: [36, 150], warranty: 0 },
    budget:   { label: 'Budget',   price: 0.6,  out: 0.95, brk: 1.25, wear: [0, 5],   age: [0, 0],    warranty: 6 },
    standard: { label: 'Standard', price: 1.0,  out: 1.0,  brk: 1.0,  wear: [0, 3],   age: [0, 0],    warranty: 12 },
    premium:  { label: 'Premium',  price: 1.85, out: 1.2,  brk: 0.6,  wear: [0, 2],   age: [0, 0],    warranty: 24, advanced: true },
  };
  C.equipment = {
    wearPerMonth: 1.1, maintPlanWearMult: 0.4, maintPlanCostPct: 0.006,
    mechanicWearMult: 0.55, mechanicBreakMult: 0.55, mechanicCovers: 12, mechanicRepairMult: 0.7,
    serviceWearCut: 35, serviceCostPct: 0.04,
    breakFormula: { ageWeight: 1.5, wearBase: 0.4, wearMult: 4.0 },
    severity: { minor: 0.6, major: 0.32, catastrophic: 0.08 },
    repairPct: { minor: 0.03, major: 0.14 }, minorDowntime: 0.12, majorDowntime: 0.5,
    usedHiddenWear: [0, 25], inspectCost: 0.015,
    leaseMonthlyPct: 0.032, resaleBase: 0.75, resaleAgeDecay: 0.012, resaleWearWeight: 0.5,
    advancedNoMechRepairMult: 1.8, advancedSmallOpBreakMult: 1.3, warnAt: 0.08, theftBase: 0.0015,
  };

  C.staff = {
    poolSize: [3, 7], skillByQuals: [20, 60], skillNoise: 14,
    trainBasic: { cost: 1500, skill: [3, 10], attitude: [0, 5] },
    trainAdvanced: { cost: 5000, skill: [8, 20], attitude: [2, 8] },
    learnNoResponse: 0.15, expSkillPerYear: 3, expMarket: 0.4, // v9: share of on-the-job skill that raises market value (training counts fully)
   
    moraleDrift: 0.15, quitBase: 0.01, quitLowMorale: 0.08,
    counterOfferPct: 0.15,
    theftBase: 0.012, fightBase: 0.006, noShowBase: 0.04,
    strikeMinStaff: 40, strikeBase: 0.012,
    backgroundCheck: 250, severanceMonths: 0.5, wrongfulFireChance: 0.05,
    specWageByTier: { small: 0.62, between: 0.85, corp: 1.0 }, // smaller businesses pay managers less
    payrollTax: 0.08, missedPayrollMorale: -25, raisePct: 0.08, raiseMorale: 12, bonusMorale: 8,
    // per person per month: 1 raise, 1 bonus, 2 trainings. Past that it backfires (morale drops) and gives nothing
    perMonth: { raise: 1, bonus: 1, train: 2 }, spamMorale: 3,
    overheadPerStaffAbove: 60, overheadPerStaff: 120,
    // v9: managers (GM, Ops) also lend a hand on the job, at this share of one regular worker
    mgrWorkFrac: 0.25, mgrWorkRoles: ['gm', 'ops'],
    // v9: personalities. poach = how hard they look for better pay; payWeight = how much pay below market hurts morale
    pers: {
      loyal:   { w: 0.25, poach: 0.3, payWeight: 0.4, accept: 0.95, icon: '🤝', label: 'Loyal', txt: 'Happy where they are: stays even when paid a bit below market.' },
      steady:  { w: 0.5, poach: 1, payWeight: 1, accept: 0.8, icon: '🙂', label: 'Steady', txt: 'Stays if paid fairly; listens to good offers.' },
      climber: { w: 0.25, poach: 1.9, payWeight: 1.4, accept: 0.6, icon: '📈', label: 'Climber', txt: 'Wants top pay: looks for better offers when underpaid.' },
    },
    // v9: other companies try to hire away people paid under their market value. Monthly odds =
    // demand(skill) x (base + gapK x share underpaid) x personality x loyalty x (HR 0.8)
    poach: { base: 0.001, gapK: 0.2, tol: 0.12, skillFrom: 30, skillSpan: 50, warnAt: 0.03, offer: [1.0, 1.08], max: 0.35 },
    // v9: trainees: low skill, cheap, eager to learn
    trainee: { n: [1, 2], quals: [0, 0.12], pay: [0.82, 0.94], learn: [0.7, 1.5] },
    trainAway: { basic: 0.15, advanced: 0.35 }, // share of their month spent in training (not working)
  };
  C.specialists = {
    gm:         { label: 'General manager', icon: '🧑‍💼', wage: [3500, 12000], desc: 'Runs the business and makes day-to-day calls when you are not there. Orders supplies. Also works on the job at 25% of a worker.' },
    ops:        { label: 'Ops manager', icon: '📋', wage: [3800, 11000], desc: 'Lowers mistakes everywhere; handles equipment and orders supplies. Also works on the job at 25% of a worker.' },
    hr:         { label: 'HR manager', icon: '🤝', wage: [3500, 9000], desc: 'Better hires, fewer conflicts, better morale; replaces staff who leave.' },
    accountant: { label: 'Accountant', icon: '🧮', wage: [3200, 8500], desc: 'Lowers taxes legally, catches theft and errors, uses credit in a crunch.' },
    mechanic:   { label: 'Mechanic', icon: '🔧', wage: [3400, 7500], desc: 'Services equipment: much lower wear and breakdowns. Covers about 12 machines.' },
    lawyer:     { label: 'In-house lawyer', icon: '⚖️', wage: [8000, 16000], desc: 'Better odds in lawsuits; handles legal decisions.' },
    safety:     { label: 'Safety officer', icon: '🦺', wage: [4000, 8000], desc: 'Cuts injury and accident odds. No visible return on good days.' },
    ads:        { label: 'Ads manager', icon: '📣', wage: [3800, 10000], desc: 'Makes ad spend work harder; runs campaigns after reputation drops.' },
  };
  C.ceo = { wage: [22000, 65000], profitShare: [0.02, 0.06], spanFree: 3, spanPenalty: 0.06 };
  C.decisions = { baseGood: 0.2, skillWeight: 0.0065, moraleWeight: 0.004, minGood: 0.05, maxGood: 0.94, okShare: 0.55, skimChance: 0.03 };
  C.traits = { reckless: 0.12, cautious: 0.15, dishonest: 0.06 };

  C.reputation = {
    start: 35, upRate: 0.9, priceFairness: { low: 6, normal: 0, premium: -6 },
    priceMult: { low: 0.88, normal: 1, premium: 1.15 }, priceDemand: { low: 1.12, normal: 1, premium: 0.86 },
    adChannels: {
      flyers: { label: 'Flyers & local', costPer: 1.4, eff: 0.8, flop: 0.15 },
      social: { label: 'Social media', costPer: 1.0, eff: 1.0, flop: 0.25 },
      search: { label: 'Search ads', costPer: 1.2, eff: 1.1, flop: 0.12 },
      tv:     { label: 'TV & radio', costPer: 1.6, eff: 1.4, flop: 0.3 },
    },
    adBoostScale: 0.25, adMaxBoost: 0.6, lowRepAdPenalty: 1.8,
    pr: {
      apology: { label: 'Public apology', cost: 0, rep: [1, 4], fail: 0.35 },
      refunds: { label: 'Refunds & comps', costRev: 0.05, rep: [3, 7], fail: 0.15 },
      prfirm:  { label: 'PR firm', cost: 15000, rep: [5, 12], fail: 0.2 },
      charity: { label: 'Charity event', cost: 6000, rep: [3, 9], fail: 0.1 },
    },
    viralBad: 0.002, chainSpill: 0.35,
    // PR is limited: 2 actions a business per month; the 2nd does half; every one past the limit looks desperate and LOSES reputation
    prPerMonth: 2, prSecond: 0.5, prSpamLoss: [1, 3],
  };

  C.finance = {
    incomeTax: 0.21, accountantTaxCut: 0.15, auditBase: 0.004, auditMessyMult: 2.5, auditPenalty: [0.02, 0.08],
    loans: {
      business:  { label: 'Small business loan', minCredit: 620, spread: 0.035, term: 84, maxBase: 60000, maxNW: 0.6 },
      equipment: { label: 'Equipment loan', minCredit: 580, spread: 0.03, term: 60, ltv: 0.9 },
      mortgage:  { label: 'Mortgage', minCredit: 600, spread: 0.02, term: 300, ltv: 0.8 },
      emergency: { label: 'Emergency loan', minCredit: 0, spread: 0.22, term: 24, maxBase: 15000, maxAssets: 0.08 },
    },
    loc: { minCredit: 640, spread: 0.05, limitBase: 20000, limitNW: 0.15, minPayPct: 0.02 },
    creditSpreadPerPoint: 0.0002, missedPaymentCredit: -28, onTimeCredit: 0.6, lateFeePct: 0.05, repoAfterMissed: 3,
    negCashFeePct: 0.025, negCashCredit: -12, bankruptcyMonths: 3,
    bankruptcy: { keepCash: 6000, credit: [470, 520], noLoanMonths: 18, fireSale: 0.7 },
    businessBankruptcyCredit: -110, creditMin: 300, creditMax: 850,
    insurance: {
      liability:   { label: 'Liability', rev: 0.012, min: 90 },
      property:    { label: 'Property', val: 0.00035, min: 40 },
      equipment:   { label: 'Equipment', val: 0.0012, min: 30 },
      malpractice: { label: 'Malpractice', rev: 0.035, min: 1500 },
      crop:        { label: 'Crop', perAcre: 2.2, min: 60 },
      cargo:       { label: 'Cargo', perUnit: 260, min: 200 },
      damage:      { label: 'Damage & bonding', rev: 0.01, min: 60 },
    },
    insCover: 0.8, insDeductible: 1000, insClaimHike: 0.25, insHikeDecay: 0.02,
    takeoverOutside: 0.5, takeoverChance: 0.02,
    investorOffers: [0.1, 0.2, 0.35], investorDiscount: 0.75,
    saleMultiple: { base: 3.0, rep: 0.04 },
    ipoMinValue: 200000000, ipoPct: 0.25, ipoPremium: 1.1,
  };

  C.invest = {
    assets: {
      IDX:  { label: 'Total Market Index', kind: 'stock', desc: 'A basket of all big companies. Moves with the economy: up in booms, down in recessions. The safest way to own stocks.', mu: 0.005, sd: 0.035, beta: 1.0, start: 100 },
      BLUE: { label: 'Bluechip Industrials', kind: 'stock', desc: 'Big, old factory companies. A bit bumpier than the index and moves a little more with the economy.', mu: 0.005, sd: 0.05, beta: 1.1, start: 80 },
      GROW: { label: 'Growth Tech Co', kind: 'stock', desc: 'A fast-growing tech company. Big swings both ways and it moves 1.6x as hard as the economy, so it falls hardest in crashes.', mu: 0.006, sd: 0.09, beta: 1.6, start: 50 },
      SAFE: { label: 'Utility & Bonds Fund', kind: 'stock', desc: 'Power companies and bonds. Small, steady gains and tiny swings. Barely moves with the economy.', mu: 0.0028, sd: 0.012, beta: 0.2, start: 50 },
      PNY:  { label: 'Penny Miner', kind: 'penny', desc: 'A tiny mining company. Wild swings, drifts DOWN on average, and can go bust (price to zero) any month.', mu: -0.004, sd: 0.22, beta: 1.5, start: 1, zero: 0.006 },
      MOON: { label: 'MoonCoin', kind: 'coin', desc: 'A made-up crypto coin. Huge swings, drifts DOWN on average, and can crash to zero any month.', mu: -0.006, sd: 0.28, beta: 0.8, start: 1, zero: 0.008 },
      HYPE: { label: 'HypeToken', kind: 'coin', desc: 'A hyped crypto token. The wildest swings, the worst average drift, and the highest chance of going to zero.', mu: -0.01, sd: 0.35, beta: 0.5, start: 0.5, zero: 0.012 },
    },
    econShockSd: 0.03, crashDrop: [0.18, 0.35], tradeFee: 0.002,
    margin: { maxLev: 2, spread: 0.03, callAt: 0.3 },
    angel: { min: 25000, max: 500000, offers: 3, horizon: [24, 72], outcomes: [[0.66, 0, 0], [0.24, 0.5, 2.0], [0.085, 3, 8], [0.015, 15, 30]] },
  };
  C.casino = {
    maxBet: 5000, minBet: 10, betsPerMonth: 25, banAtNetWin: 250000, limitShrinkAt: 50000,
    games: {
      red:   { label: 'Roulette: red / black', p: 18 / 37, pays: 1 },
      dozen: { label: 'Roulette: dozen', p: 12 / 37, pays: 2 },
      num:   { label: 'Roulette: single number', p: 1 / 37, pays: 35 },
      dice:  { label: 'Dice: roll over 7', p: 15 / 36, pays: 1.3 },
      slots: { label: 'Slots', rtp: 0.92 },
    },
    horses: { field: 6, overround: 1.2 }, sports: { vig: 0.048 },
    habitPerBigBet: 6, habitDecay: 4, habitChase: 60, chaseLoss: [0.01, 0.05],
  };

  C.realEstate = {
    kinds: {
      condo:      { label: 'Condo', units: 1, price: [90000, 260000], rentPct: 0.0094, icon: '🏢' },
      house:      { label: 'Single-family house', units: 1, price: [120000, 420000], rentPct: 0.0088, icon: '🏠' },
      duplex:     { label: 'Duplex', units: 2, price: [200000, 520000], rentPct: 0.0094, icon: '🏘️' },
      smallapt:   { label: 'Small apartment building', units: [4, 12], price: [500000, 2200000], rentPct: 0.0097, commercial: true, icon: '🏬' },
      apartment:  { label: 'Apartment building', units: [20, 120], price: [3000000, 22000000], rentPct: 0.0090, commercial: true, icon: '🏙️' },
      strip:      { label: 'Strip mall', units: [4, 10], price: [1500000, 6000000], rentPct: 0.0086, commercial: true, lease: 36, icon: '🛍️' },
      officebldg: { label: 'Office building', units: [3, 15], price: [4000000, 30000000], rentPct: 0.0079, commercial: true, lease: 60, icon: '🏢' },
      warehouse:  { label: 'Warehouse (leased out)', units: 1, price: [1200000, 8000000], rentPct: 0.0083, commercial: true, lease: 60, icon: '🏭' },
      land:       { label: 'Development land', units: 0, price: [400000, 6000000], rentPct: 0, commercial: true, icon: '🗺️' },
      tower:      { label: 'Mixed-use tower', units: [80, 300], price: [40000000, 180000000], rentPct: 0.007, commercial: true, lease: 48, icon: '🌆' },
    },
    listingCount: 12, newPerMonth: 4,
    vacancyFillBase: 0.45, tenantBadChance: 0.2, screenedBadChance: 0.07, screeningCost: 60,
    lateRentChance: { good: 0.02, bad: 0.25 }, damageChance: { good: 0.004, bad: 0.04 }, damageCost: [0.004, 0.02],
    evictionMonths: [2, 5], evictionCost: [2500, 8000], lawyerEvictionCut: 0.4,
    repairChance: 0.018, repairCost: [0.003, 0.02], bigRepairChance: 0.004, bigRepairCost: [0.02, 0.07],
    injuryChance: 0.0004, injurySuit: [20000, 250000], disasterChance: 0.002, disasterCost: [0.1, 0.45],
    taxHikeChance: 0.004, upkeepPct: 0.0005, insurancePct: 0.00035, conditionDecay: 0.12, /* v9 audit: running costs were ~7% of the price a year vs ~9% rent, so no rental could pay a mortgage */ propertyTax: 0.012,
    managerFeePct: 0.08, handymanFee: 900, typicalRunPct: 0.048, /* v9 audit: measured running costs (tools/audit.js) for the listing's 'typical month' */ selfManageLimit: 6, selfManagePenalty: 0.03,
    neighborhoodShift: 0.015, rentGrowthCap: 0.002,
    flip: {
      inspectionCost: 600, inspectReveal: 0.65, hiddenProblem: 0.35, hiddenCost: [0.04, 0.18],
      levels: {
        cosmetic: { label: 'Cosmetic refresh', cost: 0.08, months: 2, value: 0.14, cond: 25 },
        full:     { label: 'Full renovation', cost: 0.22, months: 4, value: 0.32, cond: 55 },
        luxury:   { label: 'Luxury remodel', cost: 0.45, months: 6, value: 0.5, cond: 75, overNeighborhood: true },
      },
      contractors: {
        cheap:   { label: 'Cheap contractor', costMult: 0.8, overrun: 0.35, delay: 0.35, vanish: 0.04, quality: 0.85 },
        trusted: { label: 'Trusted general contractor', costMult: 1.15, overrun: 0.12, delay: 0.12, vanish: 0.003, quality: 1.0 },
      },
      contingencyPct: 0.12, saleChanceBase: 0.32, distressDiscount: [0.68, 0.85],
    },
    develop: { permitMonths: [4, 18], stallChance: 0.04, costPerUnit: [110000, 240000], buildMonths: [10, 30], overrun: 0.3, overrunPct: [0.05, 0.3], unitsPerAcre: 18, maxUnits: 400 },
    refinanceLtv: 0.75, refinanceFee: 0.015,
    fund: { minPortfolio: 20000000, raisePct: 0.4, investorShare: 0.3 },
  };

  C.lawsuits = { months: [2, 5], baseWin: 0.4, lawyerWinBonus: 0.22, repWin: 0.002, fees: 0.12, settleShare: [0.35, 0.6], defaultMult: 1.25, suitMin: 15000, injurySuitChance: 0.5 };
  C.streak = { window: 3, threshold: 3, mult: 0.7 };
  C.goodEvents = {
    viral:       { label: 'A viral review brings a rush of customers', p: 0.006, rep: [4, 10], boost: [1.2, 1.6] },
    celebrity:   { label: 'Celebrity visit', p: 0.003, rep: [5, 12], boost: [1.2, 1.5] },
    regulars:    { label: 'A group of loyal regulars forms', p: 0.01, rep: [2, 5], boost: [1.05, 1.1] },
    festival:    { label: 'Big festival booking', p: 0.012, rep: [1, 3], boost: [1.2, 1.5] },
    catering:    { label: 'Large catering order', p: 0.012, cashRev: [0.1, 0.3] },
    fleet:       { label: 'Local company signs a fleet deal', p: 0.008, rep: [1, 3], boost: [1.1, 1.25] },
    contract:    { label: 'Big contract lands', p: 0.008, cashRev: [0.15, 0.5], rep: [1, 4] },
    fitnesscraze:{ label: 'Fitness craze hits town', p: 0.006, rep: [1, 3], boost: [1.15, 1.35] },
    bumper:      { label: 'Bumper crop conditions', p: 0.05, yield: [1.08, 1.25] },
    influencer:  { label: 'An influencer wears your brand', p: 0.008, rep: [4, 10], boost: [1.5, 3] },
    convention:  { label: 'Convention in town fills rooms', p: 0.01, boost: [1.15, 1.35] },
    bigwin:      { label: 'Big case win makes headlines', p: 0.012, rep: [5, 11], cashRev: [0.2, 0.8] },
    referral:    { label: 'Referral network sends work', p: 0.012, rep: [2, 5], boost: [1.1, 1.25] },
    grant:       { label: 'Health grant awarded', p: 0.004, cashRev: [0.2, 0.6] },
    press:       { label: 'Glowing press coverage', p: 0.006, rep: [5, 10], boost: [1.2, 1.6] },
  };
  C.achievements = {
    first_profit: 'First profitable month', nw_1m: 'Net worth $1 million', nw_10m: 'Net worth $10 million',
    nw_100m: 'Net worth $100 million', nw_1b: 'Billionaire', three_biz: 'Own three businesses at once',
    five_ind: 'Businesses in five industries', no_loans: 'Reach $1M net worth with no loans',
    comeback: 'Recover to $1M after a bankruptcy', landlord: 'Own 10 rental units', flipper: 'Complete 5 profitable flips',
    market_share: 'Own 25% of a market', survivor: 'Profitable year during a recession', decade: 'Play 10 years', century: 'Play 100 years',
  };
  C.leaderboardTargets = [1e6, 1e7, 1e8, 1e9];
  C.tiers = {
    small: { label: 'Small & hands-on', desc: 'Good margins, hard cap: one location and your own time.' },
    between: { label: 'Start small, no ceiling', desc: 'Cheap to start, slow and costly to grow; limited by supply and demand.' },
    corp: { label: 'Corporation', desc: 'Expensive, licensed or costly people, big risks, big upside.' },
  };
  // helpers used by config-businesses.js
  C._risk = (id, label, base, mods, sev, why) => ({ id, label, base, mods, sev, why });
  C._fix = (id, label, cost, monthly, reduces, extra) => Object.assign({ id, label, cost, monthly, reduces }, extra || {});
  C.businesses = {};
  TG.CONFIG = C;
})();
