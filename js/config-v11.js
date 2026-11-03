/* config-v11.js - v11 settings: ad channels / fit / targeting, law firm rework, no training downtime,
   personal lawyer, property-manager training, long-run cost anchors. */
(function () {
  const TG = globalThis.TG; const C = TG.CONFIG; const BZ = C.businesses;

  // ---------- ads: 4 ad types, each fits some businesses better ----------
  const R = C.reputation;
  R.adChannels = {
    flyers: { label: 'Flyers & posters', ic: '📄', costPer: 1.0, eff: 0.9, flop: 0.12, what: 'Cheap, close to home. Best for shops people walk or drive to.' },
    social: { label: 'Social media', ic: '📱', costPer: 1.0, eff: 1.0, flop: 0.22, what: 'Pictures and videos. Best for food, beauty, fitness and brands.' },
    search: { label: 'Online search', ic: '🔎', costPer: 1.15, eff: 1.15, flop: 0.1, what: 'People already looking for you. Best when customers search first (lawyers, doctors, repairs, apps).' },
    tv: { label: 'Radio & TV', ic: '📻', costPer: 1.4, eff: 1.35, flop: 0.28, what: 'Reaches the most people, flops the most. Best for big places and well-known names.' },
  };
  R.adMaxBoost = 0.8; // most extra customers ads can bring (before reputation and fit)
  // fit of each ad type per business (1 = normal; shown as stars)
  const fit = (fl, so, se, tv) => ({ flyers: fl, social: so, search: se, tv });
  C.v11 = {
    adFit: {
      cafe: fit(1.25, 1.3, 0.8, 0.7), foodtruck: fit(1.1, 1.4, 0.7, 0.6), bakery: fit(1.3, 1.2, 0.8, 0.7), salon: fit(1.2, 1.35, 0.9, 0.6),
      carwash: fit(1.35, 0.9, 0.9, 0.9), lawn: fit(1.4, 0.8, 1.1, 0.6), auto: fit(1.1, 0.7, 1.35, 1.0), gym: fit(1.1, 1.3, 0.9, 1.0),
      farm: fit(1, 1, 1, 1), freight: fit(0.6, 0.6, 1.3, 0.9), brand: fit(0.5, 1.4, 1.1, 1.1), hotel: fit(0.6, 1.1, 1.35, 1.1),
      law: fit(0.8, 0.7, 1.45, 1.1), clinic: fit(1.0, 0.8, 1.35, 1.0), construction: fit(1.0, 0.6, 1.3, 0.9), factory: fit(1, 1, 1, 1),
      tech: fit(0.4, 1.2, 1.3, 1.0), franchise: fit(0.9, 1.1, 1.0, 1.35),
    },
    local: ['cafe', 'foodtruck', 'bakery', 'salon', 'carwash', 'lawn', 'auto', 'gym', 'clinic', 'law', 'construction'],
    // who the ads are shown to
    adTarget: {
      near: { label: 'People nearby', ic: '📍', local: 1.25, far: 0.75, cap: 1, flop: 1, what: 'Only people close by. Great for local shops, wasted on online or travel businesses.' },
      all: { label: 'Everyone', ic: '🌍', local: 0.85, far: 1.15, cap: 1.15, flop: 1.1, what: 'The biggest crowd, but many will never come.' },
      past: { label: 'Past customers', ic: '🔁', local: 1.1, far: 1.1, cap: 0.55, flop: 0.5, what: 'Reminds people who already know you. Rarely flops, but it cannot bring many new faces.' },
    },
    trainAway: { basic: 0, advanced: 0 },
    // personal lawyer (on YOUR payroll, not a business): perks only
    lawyer: { wage: [5200, 9800], approvalZ: [0.25, 0.75], rateCut: [0.002, 0.008], suitStop: [0.25, 0.5], suitCut: [0.15, 0.35], winAdd: [0.08, 0.18] },
    // property manager training / raises
    remTrain: { basic: { cost: 1500, skill: [3, 8] }, advanced: { cost: 4500, skill: [7, 15] } },
    // long-run anchors (so costs and pay stay in step with prices and rents over centuries)
    world: { wageBand: [0.85, 1.2], wagePull: 0.02, housingBand: [0.35, 2.5], housingPull: 0.004 },
  };
  C.staff.trainAway = C.v11.trainAway; // v11: training never takes people off the job (it always raises output)

  // ---------- law firm: playable from a normal start ----------
  const L = BZ.law;
  L.setupCost = 55000; L.space = { unit: 'sqft', min: 800, ideal: 4000 };
  L.startRep = 25; L.svc.repExp = 1.4; L.svc.baseDemand = 380; L.svc.ticket = 230; L.svc.utilPerSpace = 0.9;
  L.receivable = { delay: 1, badDebt: 0.05 };
  L.roles.attorney.wage = [6800, 13500]; L.roles.attorney.cap = 150;
  L.blurb = 'Clients pay by the hour, a month after the work. A good name brings more clients; search ads work best. Lawyers are expensive, so keep them busy.';
})();
