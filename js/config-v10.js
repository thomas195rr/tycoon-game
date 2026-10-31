/* config-v10.js - v10 numbers: more upgrades for every business (each with a visible payoff), who each business's
   customers are, machine insurance, gambling without a table limit, listing turnover, play time, struggling-business takeovers.
   Upgrade effect keys added in v10 (see js/v10.js): staffMult (+key staff output), capMult (+machine capacity),
   supplyCut (supplies cheaper), salesUp (+ on every sale), costCut {money line: share cut}, plus the old ones
   (demand, ticketMult, repTarget, seasonFloor, seasonDamp, hitSoften, badDebtMult, otaCut, loadMult, fuelCut ...). */
(function () {
  const C = globalThis.TG.CONFIG, BZ = C.businesses, fix = C._fix;
  const add = (type, list) => { for (const f of list) { f.v10 = true; f.raw = JSON.parse(JSON.stringify(f)); if (!BZ[type].fixes.some((x) => x.id === f.id)) BZ[type].fixes.push(f); } };
  // v10 balance: one dial for how strong the new upgrades are (1 = as written above). Tuned with tools/audit.js so upgrades
  // reward good moves without doubling a careful player's growth.
  const ADDK = ['demand', 'staffMult', 'capMult', 'supplyCut', 'salesUp', 'churnCut', 'seasonDamp', 'fuelCut', 'hitSoften'], MULK = ['ticketMult', 'organicMult', 'loadMult', 'appMult'];
  C.v10scale = (k0) => { for (const t in BZ) for (const f of BZ[t].fixes) { if (!f.v10) continue; const r = f.raw; const k = k0 * (((C.v10upg || {}).kBy || {})[t] || 1);
    for (const key of ADDK) if (r[key] != null) f[key] = r[key] * k;
    for (const key of MULK) if (r[key] != null) f[key] = r[key] >= 1 ? 1 + (r[key] - 1) * k : r[key];
    if (r.costCut) { f.costCut = {}; for (const l in r.costCut) f.costCut[l] = r.costCut[l] * k; }
    // selling more per customer is not free: extra product, ingredients and time cost part of it (shown as "costs X% of sales")
    const extra = (r.ticketMult > 1 ? (r.ticketMult - 1) * k * C.v10upg.ticketCost : 0) + (r.salesUp > 0 ? r.salesUp * k * C.v10upg.salesCost : 0);
    f.revCostPct = (r.revCostPct || 0) + (extra ? Math.round(extra * 1000) / 1000 : 0); if (!f.revCostPct) delete f.revCostPct; } };
  C.v10upg = { k: 0.7, ticketCost: 0.5, salesCost: 0.4, kBy: { tech: 0.5, construction: 0.7, lawn: 0.6, farm: 0.4 } };
  const U = (ic, f) => Object.assign(f, { ic });
  // ---------- MORE UPGRADES (every business gets at least 4 new ones) ----------
  add('cafe', [
    U('📱', fix('mobileorder', 'Mobile order-ahead app', 6000, 180, {}, { demand: 0.05, staffMult: 0.06 })),
    U('🥐', fix('pastry', 'Pastry & sandwich case', 9000, 120, { spoil: 1.15 }, { ticketMult: 1.07 })),
    U('🔥', fix('roaster', 'Roast your own beans', 22000, 300, {}, { supplyCut: 0.12 })),
    U('⛱️', fix('patio', 'Outdoor patio', 12000, 90, {}, { demand: 0.05, capMult: 0.08 })),
    U('💡', fix('ecofit', 'LED lights & efficient fridges', 8000, 0, {}, { costCut: { Utilities: 0.3 } })),
  ]);
  add('foodtruck', [
    U('📍', fix('social', 'Daily "where we park" posts', 1500, 120, {}, { demand: 0.06 })),
    U('🎉', fix('catering', 'Catering & event bookings', 4000, 150, {}, { demand: 0.05, seasonDamp: 0.2 })),
    U('🥤', fix('combo', 'Combo meals with drinks', 2000, 0, {}, { ticketMult: 1.06 })),
    U('🏬', fix('depot', 'Restaurant-depot membership', 9000, 120, {}, { supplyCut: 0.08 })),
  ]);
  add('bakery', [
    U('🏪', fix('wholesale', 'Wholesale to local cafes', 8000, 200, {}, { demand: 0.08, ticketMult: 0.97 })),
    U('🎂', fix('cakes', 'Custom cakes & orders', 6000, 150, {}, { ticketMult: 1.07 })),
    U('🌾', fix('flourdeal', 'Flour mill contract', 10000, 50, {}, { supplyCut: 0.1 })),
    U('🛒', fix('preorder', 'Online pre-orders (bake to order)', 4000, 120, { stale: 0.7 }, {})),
    U('💡', fix('ecoovens', 'Energy-saving ovens', 15000, 0, {}, { costCut: { Utilities: 0.3 } })),
  ]);
  add('salon', [
    U('📅', fix('onlinebook', 'Online booking & reminders', 3000, 120, {}, { demand: 0.05, staffMult: 0.05 })),
    U('🧴', fix('retail', 'Retail product shelf', 5000, 60, {}, { ticketMult: 1.06 })),
    U('🎨', fix('color', 'Color specialist training', 8000, 100, { botched: 0.8 }, { ticketMult: 1.05 })),
    U('📦', fix('proacct', 'Wholesale product account', 3000, 30, {}, { supplyCut: 0.1 })),
    U('💌', fix('referral', 'Loyalty & referral cards', 2500, 150, {}, { demand: 0.05, hitSoften: 0.4 })),
  ]);
  add('carwash', [
    U('✨', fix('detail', 'Detailing bay', 25000, 300, {}, { ticketMult: 1.1 })),
    U('♾️', fix('plans', 'Unlimited wash plans', 6000, 200, {}, { demand: 0.04, seasonDamp: 0.4 })),
    U('💧', fix('reclaim', 'Water reclaim system', 30000, 100, { water: 0.5 }, { costCut: { Utilities: 0.35 } })),
    U('🚐', fix('fleet', 'Fleet contracts (company cars)', 5000, 100, {}, { demand: 0.07, ticketMult: 0.97 })),
  ]);
  add('lawn', [
    U('🗺️', fix('routes', 'Route-planning app', 6000, 120, {}, { staffMult: 0.08, supplyCut: 0.08 })),
    U('🌷', fix('landscape', 'Landscaping & planting jobs', 8000, 150, {}, { ticketMult: 1.08 })),
    U('📝', fix('contracts', 'Prepaid season contracts', 2500, 100, { noshow: 0.8 }, { demand: 0.05 })),
    U('🍂', fix('leaves', 'Fall clean-up & gutters', 9000, 80, {}, { seasonFloor: 0.25 })),
  ]);
  add('auto', [
    U('🚕', fix('fleetacc', 'Fleet accounts (taxis, vans)', 5000, 150, {}, { demand: 0.08 })),
    U('🛞', fix('tires', 'Tire storage & seasonal swaps', 9000, 100, {}, { ticketMult: 1.04, seasonDamp: 0.3 })),
    U('🔋', fix('ev', 'Electric-car repair license', 15000, 200, {}, { ticketMult: 1.06, demand: 0.03 })),
    U('📦', fix('partsacct', 'Parts distributor account', 18000, 100, {}, { supplyCut: 0.1 })),
    U('⭐', fix('reviews', 'Review & service-reminder texts', 1500, 80, {}, { demand: 0.04, repTarget: 3 })),
  ]);
  add('gym', [
    U('💪', fix('pt', 'Personal training packages', 6000, 200, {}, { ticketMult: 1.08 })),
    U('🏢', fix('corp', 'Corporate memberships', 4000, 150, {}, { demand: 0.08, ticketMult: 0.96 })),
    U('📱', fix('gymapp', 'Member app & class booking', 5000, 150, {}, { demand: 0.04, repTarget: 3 })),
    U('🥤', fix('juice', 'Smoothie bar', 10000, 120, {}, { ticketMult: 1.05 })),
    U('💡', fix('ecogym', 'LED & efficient heating', 20000, 0, {}, { costCut: { Utilities: 0.3 } })),
  ]);
  add('hotel', [
    U('🍽️', fix('restaurant', 'Hotel restaurant & bar', 120000, 1500, {}, { ticketMult: 1.08 })),
    U('💒', fix('events', 'Meeting & wedding rooms', 80000, 800, {}, { demand: 0.06, seasonDamp: 0.15 })),
    U('📈', fix('revmgmt', 'Revenue-management software', 70000, 900, {}, { ticketMult: 1.05 })),
    U('🎟️', fix('hloyal', 'Guest loyalty club', 30000, 500, {}, { demand: 0.04, repTarget: 3 })),
    U('☀️', fix('ecohotel', 'Energy retrofit', 150000, 0, {}, { costCut: { Utilities: 0.3 } })),
  ]);
  add('law', [
    U('🤖', fix('docauto', 'Document automation', 30000, 800, {}, { staffMult: 0.08 })),
    U('🤝', fix('referrals', 'Referral network', 15000, 500, {}, { demand: 0.06 })),
    U('📋', fix('flatfee', 'Flat-fee packages', 10000, 200, {}, { demand: 0.08, ticketMult: 0.96 })),
    U('💳', fix('collect', 'Billing & collections team', 20000, 600, { billing: 0.6 }, { badDebtMult: 0.6 })),
  ]);
  add('clinic', [
    U('💻', fix('telehealth', 'Telehealth visits', 40000, 1200, {}, { demand: 0.06, staffMult: 0.05 })),
    U('🚑', fix('urgent', 'Walk-in urgent-care hours', 60000, 1500, {}, { demand: 0.08 })),
    U('📦', fix('groupbuy', 'Group purchasing for supplies', 90000, 1000, {}, { supplyCut: 0.1 })),
    U('🧾', fix('coders', 'Certified billing coders', 90000, 2500, { paydelay: 0.7 }, { ticketMult: 1.05 })),
  ]);
  add('construction', [
    U('📐', fix('estimator', 'Estimating software', 40000, 1000, {}, { costCut: { 'Materials & subcontractors': 0.04 } })),
    U('🚚', fix('yard', 'Own equipment yard & trucks', 150000, 1500, {}, { costCut: { 'Materials & subcontractors': 0.03, 'Equipment lease': 0.3 } })),
    U('🦺', fix('safetyc', 'Safety program & site cameras', 30000, 800, { injury: 0.6 }, {})),
    U('🏛️', fix('designbuild', 'In-house design-build team', 120000, 3000, {}, { salesUp: 0.05 })),
  ]);
  add('factory', [
    U('🧭', fix('lean', 'Lean production coaching', 150000, 2000, {}, { staffMult: 0.08 })),
    U('⚡', fix('motors', 'Energy-efficient motors', 300000, 0, {}, { costCut: { Utilities: 0.35 } })),
    U('🏷️', fix('ownbrand', 'Own-brand packaging', 200000, 3000, {}, { salesUp: 0.04 })),
    U('♻️', fix('scrap', 'Scrap recycling', 80000, 500, {}, { supplyCut: 0.04 })),
  ]);
  add('tech', [
    U('🧭', fix('onboard', 'Better sign-up & onboarding', 60000, 1500, {}, { churnCut: 0.008 })),
    U('🎁', fix('referral', 'Invite-a-friend rewards', 40000, 2000, {}, { organicMult: 1.25 })),
    U('📆', fix('annual', 'Annual plans (pay for a year)', 20000, 500, {}, { salesUp: 0.04, churnCut: 0.004 })),
    U('☁️', fix('cloudopt', 'Cloud cost tuning', 50000, 0, {}, { costCut: { Hosting: 0.25 } })),
  ]);
  add('franchise', [
    U('🎓', fix('academy', 'Franchisee training academy', 300000, 5000, {}, { salesUp: 0.04, driftCut: 0.3 })),
    U('📺', fix('adfund', 'National ad fund', 500000, 8000, {}, { salesUp: 0.06, appMult: 1.2 })),
    U('📱', fix('orderapp', 'Ordering app for every shop', 400000, 6000, {}, { salesUp: 0.05 })),
    U('🚛', fix('supplydeal', 'Central supply deals (you take a cut)', 200000, 2000, {}, { salesUp: 0.03 })),
  ]);
  add('freight', [
    U('🌬️', fix('aero', 'Aero kits & tire-pressure checks', 0, 0, {}, { perUnitMonthly: 60, fuelCut: 0.06 })),
    U('🔁', fix('backhaul', 'Backhaul load board', 8000, 300, {}, { loadMult: 1.06 })),
    U('📜', fix('lanes', 'Dedicated contract lanes', 15000, 400, {}, { salesUp: 0.04, seasonDamp: 0.3 })),
    U('🎯', fix('coach', 'Driver coaching telematics', 0, 0, { missed: 0.7 }, { perUnitMonthly: 40, wearMult: 0.9 })),
  ]);
  add('brand', [
    U('🤳', fix('influencer', 'Influencer program', 8000, 1500, {}, { demand: 0.08 })),
    U('✉️', fix('email', 'Email & text list', 3000, 300, {}, { demand: 0.05 })),
    U('📏', fix('sizing', 'Size guides & fit photos', 5000, 150, { chargeback: 0.7 }, { salesUp: 0.02 })),
    U('🛍️', fix('boutiques', 'Wholesale to boutiques', 10000, 400, {}, { demand: 0.1, salesUp: -0.03 })),
    U('🏭', fix('quotes', 'Second factory quotes', 5000, 0, {}, { costCut: { 'Inventory orders': 0.06 } })),
  ]);
  add('farm', [
    U('🧺', fix('farmstand', "Farm stand & farmers' markets", 15000, 600, {}, { salesUp: 0.04 })),
    U('🌽', fix('feedmix', 'Mix your own feed (cows)', 40000, 300, {}, { costCut: { 'Feed & hay': 0.15 } })),
    U('🛰️', fix('precision', 'GPS precision planting', 60000, 400, {}, { costCut: { Seed: 0.12, 'Spray & fertilizer': 0.12, 'Planting fuel': 0.1 } })),
    U('🤝', fix('coop', 'Join a farm co-op', 5000, 200, {}, { salesUp: 0.03 })),
    U('☀️', fix('solarbarn', 'Solar barn roofs', 80000, 0, {}, { costCut: { Utilities: 0.4 } })),
  ]);
  // labels for fixes that came before v10 (so every card has an icon)
  for (const t in BZ) for (const f of BZ[t].fixes) if (!f.ic) f.ic = f.demand ? '📣' : f.equipBreak ? '🔧' : f.reduces && Object.keys(f.reduces).length ? '🛡️' : '⬆️';

  // ---------- WHO YOUR CUSTOMERS ARE (shown on the 📣 Ads tab; what brings more of each) ----------
  const cu = (ic, who, share, wants) => ({ ic, who, share, wants });
  const CU = {
    cafe: [cu('🚶', 'Commuters', 0.4, 'speed: enough baristas, mobile ordering'), cu('💻', 'Remote workers', 0.2, 'seats and a patio'), cu('🎓', 'Students', 0.2, 'prices near market'), cu('🥐', 'Food lovers', 0.2, 'pastries and quality')],
    foodtruck: [cu('👷', 'Lunch crowds', 0.5, 'a good spot and fast service'), cu('🎉', 'Events & festivals', 0.3, 'catering bookings, summer'), cu('🌙', 'Late-night crowd', 0.2, 'social posts so they find you')],
    bakery: [cu('🏠', 'Neighbours', 0.45, 'fresh bread every morning'), cu('🎂', 'Parties & weddings', 0.2, 'custom cakes'), cu('☕', 'Cafes & shops', 0.2, 'wholesale deals'), cu('🎄', 'Holiday shoppers', 0.15, 'Nov-Dec rush')],
    salon: [cu('💇', 'Regulars', 0.55, 'the same stylist, easy booking'), cu('🎨', 'Color clients', 0.25, 'trained colorists (pay more)'), cu('👰', 'Weddings & events', 0.2, 'reputation and reviews')],
    carwash: [cu('🚗', 'Drivers passing by', 0.55, 'a busy road (traffic)'), cu('♾️', 'Members', 0.25, 'unlimited plans'), cu('🚐', 'Company fleets', 0.2, 'fleet contracts')],
    lawn: [cu('🏡', 'Homeowners', 0.65, 'reliable weekly visits'), cu('🏢', 'Offices & HOAs', 0.25, 'contracts, a big crew'), cu('🌷', 'Garden makeovers', 0.1, 'landscaping jobs (pay more)')],
    auto: [cu('🚙', 'Local drivers', 0.6, 'honest work, reminders'), cu('🚕', 'Fleets', 0.25, 'fleet accounts'), cu('🔋', 'Electric cars', 0.15, 'an EV license')],
    gym: [cu('🏃', 'Fitness regulars', 0.5, 'enough machines, not crowded'), cu('🎯', 'New Year joiners', 0.2, 'January ads (they quit by summer)'), cu('🏢', 'Office workers', 0.2, 'corporate deals'), cu('💪', 'Serious lifters', 0.1, 'personal trainers')],
    farm: [cu('🏭', 'Grain & meat buyers', 0.6, 'price: they pay the market price'), cu('🥛', 'Dairy truck', 0.3, 'milk every day'), cu('🧺', 'Local shoppers', 0.1, 'a farm stand pays a bit more')],
    freight: [cu('🏭', 'Shippers', 0.6, 'on-time loads and fair rates'), cu('🛒', 'Online retailers', 0.25, 'busy Sep-Dec'), cu('❄️', 'Cold-chain clients', 0.15, 'reefer trailers')],
    brand: [cu('📱', 'Online shoppers', 0.6, 'ads, influencers, good photos'), cu('❤️', 'Fans & followers', 0.25, 'new drops and emails'), cu('🛍️', 'Boutiques', 0.15, 'wholesale (lower price)')],
    hotel: [cu('🧳', 'Tourists', 0.5, 'summer, reviews, booking sites'), cu('💼', 'Business travellers', 0.3, 'all year, meeting rooms'), cu('💒', 'Weddings & events', 0.2, 'event rooms')],
    law: [cu('🏢', 'Companies', 0.5, 'senior attorneys, referrals'), cu('🏠', 'Families', 0.3, 'flat-fee packages'), cu('⚖️', 'Court cases', 0.2, 'winning record (reputation)')],
    clinic: [cu('👨‍👩‍👧', 'Families', 0.5, 'short waits, enough doctors'), cu('👵', 'Older patients', 0.3, 'winter, regular visits'), cu('🚑', 'Walk-ins', 0.2, 'urgent-care hours')],
    construction: [cu('🏠', 'Home builders', 0.4, 'small jobs, fair bids'), cu('🏢', 'Developers', 0.4, 'bigger crews, reputation'), cu('🛣️', 'The city', 0.2, 'bonding and heavy machines')],
    factory: [cu('🏬', 'Wholesale buyers', 0.8, 'price: they pay the market price'), cu('🏷️', 'Store brands', 0.2, 'quality and own-brand packaging')],
    tech: [cu('🧪', 'Early adopters', 0.3, 'a product that fits'), cu('📈', 'Mainstream users', 0.5, 'ads and referrals once it fits'), cu('🏢', 'Business customers', 0.2, 'annual plans')],
    franchise: [cu('🧑‍💼', 'Would-be owners', 0.6, 'reputation and an ad fund'), cu('🍔', 'Shoppers at your shops', 0.4, 'training and an ordering app')],
  };
  for (const t in CU) BZ[t].customers = CU[t];

  // ---------- v10 knobs ----------
  C.v10 = {
    // sales vary: a slow "buzz" that drifts (word of mouth, trends nearby) plus a fresh month-to-month wobble
    buzz: { keep: 0.8, sd: 0.035, max: 0.25, noise: 0.05 },
    // machine insurance: monthly premium as a share of what a new machine of the same kind costs; pays that new price on a total loss
    machineIns: { pct: 0.0011, min: 15, cover: 0.9 },
    // listings stay on the market this many months, then a new one takes their place
    listingLife: [3, 7],
    // bonus: lifts morale and loyalty (loyalty gain shrinks as loyalty gets high)
    bonusLoyalty: 12, bonusLoyaltyMin: 2,
    // a struggling business you take over: price as a share of a new one's setup, plus the old owner's debt
    takeover: { price: 0.4, debt: 0.35, rep: [12, 22], wear: [50, 80], morale: [28, 45], broken: 0.25 },
    // rentals: down-payment choices for a rental mortgage (bigger down = smaller monthly payment)
    reDown: [0.2, 0.3, 0.4, 0.5],
  };
  C.v10scale(C.v10upg.k);
  // big-revenue businesses: % upgrades are worth more there, so they cost more (keeps payback in the 1-3 year range)
  C.v10upg.costMult = { tech: 2, construction: 2, salon: 1.5, foodtruck: 1.3, lawn: 1.3 };
  for (const t in C.v10upg.costMult) for (const f of C.businesses[t].fixes) if (f.v10) { const m = C.v10upg.costMult[t]; f.cost = Math.round(f.raw.cost * m / 100) * 100; f.monthly = Math.round((f.raw.monthly || 0) * m / 10) * 10; }
  C.casino.maxBet = Infinity; // v10: no table limit (odds unchanged)
  C.finance.insurance.equipment.label = 'Machine insurance';
})();
