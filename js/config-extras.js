/* config-extras.js - v2 additions to TG.CONFIG (all tunable):
   - pricing: a market for every sellable good, elasticity and fairness rules
   - equipment categories, per-business capacity items (seating, machines, storage, boosts) with upkeep
   - supplies / stock (what each business consumes, spoil rates, storage)
   - farm v2: seeds, storage bins, planters/combines, cattle life cycle, dairy
   - icons used by the UI.
   Equipment item fields: cat (category), pool (capacity pool; items in the same pool add up, default = id),
   seat (seating: max count limited by floor space), store (adds supply storage), ticketBoost (+avg sale, one per type),
   staffBoost (+key staff output, one per type), upkeep ($/month while working), max (max count). */
(function () {
  const C = globalThis.TG.CONFIG; const BZ = C.businesses;

  // ---------------- PRICING ----------------
  C.pricing = {
    minRatio: 0.3, maxRatio: 4,          // allowed price range vs market
    elasticUp: 3.4,                      // demand falls fast above market (revenue falls too)
    elasticDown: 1.15,                   // demand rises slowly below market
    maxBoost: 1.5,                       // most extra demand from cutting price
    collapseAt: 1.25, collapseK: 5,      // beyond 25% over market buyers walk away
    commodityUp: 4.5,                    // commodity buyers (crops, cattle, goods) have many other sellers
    fairUp: 70, fairFreeBand: 0.08,      // reputation target lost per 100% over market (beyond an 8% band)
    fairDown: 12, fairDownMax: 4,        // small goodwill from being cheap
    techChurnPerOver: 0.035,             // tech: extra monthly churn per 100% over market
  };
  // Every service business sells into its own local market (its price moves with economy, trends and supply incl. yours)
  const svcMarket = (type, units, unit) => {
    const d = BZ[type], s = d.svc;
    const monthly = s.baseDemand || 2400;
    C.markets['svc_' + type] = { label: d.name + ' ' + unit, unit, base: s.ticket, demand12: monthly * 12 * 22, sens: 0.25 * (d.econSens || 0.5), drop: 0.55, shape: 1, compElast: 0.25, trendCat: d.cat, local: true };
  };
  C.markets.milk = { label: 'Milk', unit: 'ton', base: 470, demand12: 260000, sens: 0.2, drop: 0.68, shape: 0.9, compElast: 0.5, trendCat: 'food' };
  C.markets.hotel = null; delete C.markets.hotel;

  // goods each business sells: icon, unit, market, kind ('service' = demand responds to price; 'commodity' = ask price)
  const GOODS = {
    cafe: ['☕', 'Coffee & food', 'order'], foodtruck: ['🌮', 'Meals', 'meal'], bakery: ['🥐', 'Baked goods', 'order'], salon: ['💇', 'Haircuts', 'visit'],
    carwash: ['🚗', 'Car washes', 'wash'], lawn: ['🌿', 'Lawn jobs', 'job'], auto: ['🔧', 'Repairs', 'job'], gym: ['🏋️', 'Memberships', 'member/mo'],
    hotel: ['🛏️', 'Room nights', 'night'], law: ['⚖️', 'Legal hours', 'hour'], clinic: ['🩺', 'Patient visits', 'visit'],
  };
  for (const t in GOODS) { svcMarket(t, GOODS[t][1], GOODS[t][2]); BZ[t].good = { icon: GOODS[t][0], label: GOODS[t][1], unit: GOODS[t][2], market: 'svc_' + t, kind: 'service' }; }
  BZ.freight.good = { icon: '📦', label: 'Freight loads', unit: 'load', market: 'freight', kind: 'service' };
  BZ.brand.good = { icon: '👕', label: 'Clothing', unit: 'item', market: 'apparel', kind: 'service' };
  BZ.factory.good = { icon: '📦', label: 'Products', unit: 'unit', market: 'goods', kind: 'commodity' };
  BZ.tech.good = { icon: '📱', label: 'Subscriptions', unit: 'user/mo', market: 'software', kind: 'service', base: 9 };
  // farm goods depend on the enterprise; see C.farmGoods
  C.farmGoods = { crops: { icon: '🌾', label: 'Grain', unit: 't', market: 'grain' }, orchard: { icon: '🍎', label: 'Fruit', unit: 't', market: 'fruit' }, cattle: { icon: '🐄', label: 'Cattle', unit: 'head', market: 'beef' }, dairy: { icon: '🥛', label: 'Milk', unit: 't', market: 'milk' } };

  // ---------------- EQUIPMENT CATEGORIES ----------------
  C.equipCats = {
    machines: ['⚙️', 'Machines', 'Make the product. More machines = more served per month.'],
    seating: ['🪑', 'Seating', 'Tables and seats. Customers need a seat; limited by floor space.'],
    kitchen: ['🍳', 'Kitchen', 'Grills and ovens add menu items: bigger average order.'],
    storage: ['📦', 'Storage', 'Shelves, fridges, bins, tanks. Sets how much stock you can hold.'],
    tools: ['🧰', 'Tools & tech', 'Make each worker faster: an alternative to hiring.'],
    front: ['🛋️', 'Front of house', 'Makes the place nicer: more customers.'],
    vehicles: ['🚚', 'Vehicles', 'Get the work to the customer.'],
    power: ['⚡', 'Power', 'Keeps everything running. Fails = lost days.'],
    lifts: ['🛠️', 'Bays & lifts', 'Each bay handles a number of jobs per month.'],
    diag: ['🔌', 'Diagnostics', 'Find faults faster.'],
    cardio: ['🏃', 'Cardio', 'Members per month the cardio floor can handle.'],
    strength: ['🏋️', 'Strength', 'Members per month the weights area can handle.'],
    rooms: ['🛏️', 'Rooms & laundry', 'Clean rooms per month.'],
    building: ['🏢', 'Building systems', 'HVAC and boilers. Failure = flood or closure risk.'],
    it: ['💻', 'IT & software', 'Systems that make staff faster.'],
    exam: ['🩺', 'Exam rooms', 'Patient visits per month.'],
    imaging: ['🩻', 'Imaging & lab', 'Draws patients; adds billing.'],
    heavy: ['🏗️', 'Heavy machinery', 'Excavators and cranes some projects need.'],
    crew: ['🦺', 'Crew gear', 'Tools and trucks: how many workers can be on site.'],
    tractors: ['🚜', 'Tractors', 'Plant, harvest and haul. Each covers a number of acres.'],
    farmgear: ['🌱', 'Farm equipment', 'Planters and combines speed up planting and harvest.'],
    livestock: ['🐄', 'Livestock', 'Barns, pens and milking parlors: how many animals you can keep.'],
    trucks: ['🚛', 'Trucks', 'Each truck hauls a number of loads a month.'],
    trailers: ['🧊', 'Trailers', 'Special trailers earn higher rates.'],
    warehouse: ['🏬', 'Warehouse', 'Shelving and packing gear.'],
    studio: ['📸', 'Marketing gear', 'Better photos = more sales.'],
    lines: ['🏭', 'Production lines', 'Units made per month.'],
    handling: ['🚜', 'Material handling', 'Forklifts and robots.'],
    servers: ['🖥️', 'Servers', 'Users your servers can handle.'],
    devtools: ['🧑‍💻', 'Dev tools', 'Make engineers faster.'],
    systems: ['🏫', 'Systems', 'Training and support for franchisees.'],
  };
  // category per existing item, plus new items per business
  const SET = (type, cats, extra) => {
    const d = BZ[type];
    for (const it of d.equip) if (cats[it.id]) Object.assign(it, typeof cats[it.id] === 'string' ? { cat: cats[it.id] } : cats[it.id]);
    for (const it of extra || []) d.equip.push(Object.assign({ brk: 0.008, life: 120, cap: 0 }, it));
  };
  SET('cafe', { espresso: { cat: 'machines', pool: 'machines' }, fridge: { cat: 'storage', store: 2500 } }, [
    { id: 'iced', label: 'Iced coffee machine', cat: 'machines', pool: 'machines', price: 5500, cap: 1600, critical: true, brk: 0.012, life: 84, upkeep: 40, desc: '+1,600 drinks/mo' },
    { id: 'tables', label: 'Table (4 seats)', cat: 'seating', pool: 'seats', seat: true, price: 650, cap: 330, critical: true, brk: 0.002, life: 180, desc: '+330 customers/mo' },
    { id: 'grill', label: 'Panini grill', cat: 'kitchen', price: 3200, ticketBoost: 0.04, upkeep: 150, brk: 0.015, life: 72, desc: '+4% per order (food)' },
    { id: 'rack', label: 'Dry storage rack', cat: 'storage', price: 800, store: 1500, brk: 0.001, life: 240, desc: '+1,500 stock' },
    { id: 'kiosk', label: 'Order kiosk', cat: 'tools', price: 6500, staffBoost: 0.12, upkeep: 110, brk: 0.01, life: 72, desc: 'Baristas +12% faster' },
  ]);
  SET('foodtruck', { truck: { cat: 'vehicles', pool: 'truck' }, generator: 'power' }, [
    { id: 'fryer', label: 'Extra fryer & griddle', cat: 'kitchen', pool: 'truck', price: 7500, cap: 650, critical: true, max: 2, upkeep: 60, brk: 0.014, life: 72, desc: '+650 meals/mo' },
    { id: 'cooler', label: 'Cooler', cat: 'storage', price: 2400, store: 900, brk: 0.008, life: 96, desc: '+900 stock' },
    { id: 'pos', label: 'POS tablet', cat: 'tools', price: 1500, staffBoost: 0.08, upkeep: 40, brk: 0.01, life: 48, desc: 'Cooks +8% faster' },
  ]);
  SET('bakery', { oven: { cat: 'machines', pool: 'oven' }, mixer: { cat: 'machines', pool: 'mixer' } }, [
    { id: 'tables', label: 'Café table', cat: 'seating', pool: 'seats', seat: true, price: 600, cap: 380, critical: true, brk: 0.002, life: 180, desc: '+380 customers/mo' },
    { id: 'walkin', label: 'Walk-in cooler', cat: 'storage', price: 7000, store: 2500, brk: 0.008, life: 144, failRisk: 'spoil', desc: '+2,500 stock' },
    { id: 'bins', label: 'Flour bins', cat: 'storage', price: 900, store: 1200, brk: 0.001, life: 240, desc: '+1,200 stock' },
    { id: 'display', label: 'Display case', cat: 'front', price: 4000, demandBoost: 0.05, upkeep: 50, brk: 0.006, life: 120, desc: '+5% customers' },
    { id: 'proofer', label: 'Proofer cabinet', cat: 'tools', price: 5200, staffBoost: 0.1, upkeep: 60, brk: 0.01, life: 96, desc: 'Bakers +10% faster' },
  ]);
  SET('salon', { chair: { cat: 'machines', pool: 'chair' }, dryer: 'tools' }, [
    { id: 'shelf', label: 'Product shelf', cat: 'storage', price: 600, store: 400, brk: 0.001, life: 240, desc: '+400 stock' },
    { id: 'lounge', label: 'Waiting lounge', cat: 'front', price: 3500, demandBoost: 0.04, upkeep: 40, brk: 0.004, life: 120, desc: '+4% customers' },
    { id: 'booking', label: 'Online booking', cat: 'tools', price: 1200, staffBoost: 0.06, upkeep: 60, brk: 0.004, life: 60, desc: 'Stylists +6% (fewer gaps)' },
  ]);
  BZ.salon.equipCatsLabel = { machines: ['💺', 'Stations'] };
  SET('carwash', { tunnel: { cat: 'machines', pool: 'tunnel' }, vacuum: 'front' }, [
    { id: 'tank', label: 'Chemical tank', cat: 'storage', price: 4000, store: 3000, brk: 0.004, life: 144, desc: '+3,000 stock' },
    { id: 'paystation', label: 'Pay station', cat: 'tools', price: 15000, staffBoost: 0.15, upkeep: 150, brk: 0.012, life: 96, desc: 'Attendants +15%' },
    { id: 'shine', label: 'Tire shine applicator', cat: 'machines', price: 9000, ticketBoost: 0.05, upkeep: 120, brk: 0.012, life: 96, desc: '+5% per wash' },
  ]);
  SET('lawn', { mower: { cat: 'machines', pool: 'mower' }, trailer: { cat: 'vehicles', pool: 'trailer' } }, [
    { id: 'blower', label: 'Blower & trimmer kit', cat: 'tools', price: 2500, staffBoost: 0.08, upkeep: 60, brk: 0.02, life: 48, desc: 'Crews +8% faster' },
    { id: 'shed', label: 'Fuel & parts shed', cat: 'storage', price: 3000, store: 600, brk: 0.002, life: 180, desc: '+600 stock' },
    { id: 'aerator', label: 'Aerator', cat: 'machines', price: 6000, ticketBoost: 0.05, upkeep: 50, brk: 0.015, life: 84, desc: '+5% per job (extra service)' },
  ]);
  SET('auto', { lift: { cat: 'lifts', pool: 'lift' }, scanner: { cat: 'diag', pool: 'scanner' } }, [
    { id: 'align', label: 'Alignment rack', cat: 'lifts', pool: 'lift', price: 22000, cap: 70, critical: true, brk: 0.008, life: 144, desc: '+70 jobs/mo' },
    { id: 'parts', label: 'Parts shelving', cat: 'storage', price: 1500, store: 120, brk: 0.001, life: 240, desc: '+120 stock' },
    { id: 'tirem', label: 'Tire machine', cat: 'tools', price: 8000, ticketBoost: 0.05, upkeep: 50, brk: 0.01, life: 120, desc: '+5% per job' },
    { id: 'impact', label: 'Air tools set', cat: 'tools', price: 4500, staffBoost: 0.08, upkeep: 40, brk: 0.015, life: 72, desc: 'Techs +8% faster' },
  ]);
  SET('gym', { cardio: { cat: 'cardio', pool: 'cardio' }, weights: { cat: 'strength', pool: 'weights' } }, [
    { id: 'lockers', label: 'Locker room upgrade', cat: 'front', price: 25000, demandBoost: 0.06, upkeep: 200, brk: 0.003, life: 180, desc: '+6% members' },
    { id: 'gates', label: 'Smart access gates', cat: 'it', price: 9000, staffBoost: 0.1, upkeep: 90, brk: 0.008, life: 96, desc: 'Coaches +10%' },
    { id: 'rack2', label: 'Squat rack', cat: 'strength', pool: 'weights', price: 1800, cap: 40, critical: true, brk: 0.005, life: 144, desc: '+40 members' },
  ]);
  SET('hotel', { laundry: { cat: 'rooms', pool: 'laundry' }, hvac: 'building' }, [
    { id: 'linen', label: 'Linen stock room', cat: 'storage', price: 6000, store: 2500, brk: 0.002, life: 240, desc: '+2,500 stock' },
    { id: 'breakfast', label: 'Breakfast bar', cat: 'front', price: 30000, ticketBoost: 0.05, upkeep: 900, brk: 0.008, life: 120, desc: '+5% per night' },
    { id: 'carts', label: 'Laundry chutes & carts', cat: 'rooms', price: 12000, staffBoost: 0.1, upkeep: 60, brk: 0.006, life: 120, desc: 'Housekeepers +10%' },
  ]);
  SET('law', { software: 'it' }, [
    { id: 'research', label: 'Legal research subscription', cat: 'it', price: 5000, staffBoost: 0.08, upkeep: 1500, brk: 0.002, life: 60, desc: 'Attorneys +8%' },
    { id: 'office', label: 'Partner office fit-out', cat: 'front', price: 40000, demandBoost: 0.04, upkeep: 200, brk: 0.002, life: 180, desc: '+4% clients' },
  ]);
  SET('clinic', { exam: { cat: 'exam', pool: 'exam' }, imaging: 'imaging' }, [
    { id: 'supply', label: 'Medical supply room', cat: 'storage', price: 9000, store: 2000, brk: 0.003, life: 180, desc: '+2,000 stock' },
    { id: 'portal', label: 'Patient portal', cat: 'it', price: 30000, staffBoost: 0.06, upkeep: 400, brk: 0.006, life: 60, desc: 'Doctors +6%' },
    { id: 'lab', label: 'Lab analyzer', cat: 'imaging', price: 120000, ticketBoost: 0.05, upkeep: 1500, brk: 0.01, life: 96, desc: '+5% per visit' },
  ]);
  SET('construction', { excavator: 'heavy', crane: 'heavy', tools: { cat: 'crew', pool: 'tools' } }, [
    { id: 'skid', label: 'Crew van & tool trailer', cat: 'crew', pool: 'tools', price: 15000, cap: 4, critical: true, brk: 0.012, life: 84, desc: '+4 crew on site' },
  ]);
  SET('farm', { tractor: { cat: 'tractors' }, robot: { cat: 'tractors' } }, [
    { id: 'planter', label: 'Seed planter', cat: 'farmgear', price: 45000, plantEq: 0.8, brk: 0.01, life: 144, desc: 'Plants like 0.8 tractor' },
    { id: 'combine', label: 'Combine harvester', cat: 'farmgear', price: 180000, harvestEq: 1.2, seasonalCut: 0.25, brk: 0.012, life: 144, upkeep: 300, desc: 'Harvests like 1.2 tractors, −25% seasonal labor' },
    { id: 'bin', label: 'Grain bin', cat: 'storage', price: 28000, storeTons: 600, upkeep: 40, brk: 0.003, life: 240, desc: '+600 t storage' },
    { id: 'silo', label: 'Silo', cat: 'storage', price: 90000, storeTons: 2500, upkeep: 120, brk: 0.003, life: 300, desc: '+2,500 t storage' },
    { id: 'pen', label: 'Feedlot pen', cat: 'livestock', price: 15000, head: 25, upkeep: 60, brk: 0.004, life: 180, desc: '+25 head (bought feed)' },
    { id: 'barn', label: 'Cattle barn', cat: 'livestock', price: 60000, head: 90, upkeep: 150, brk: 0.004, life: 300, desc: '+90 head (bought feed)' },
    { id: 'parlor', label: 'Milking parlor', cat: 'livestock', price: 220000, milkCows: 160, upkeep: 1200, brk: 0.012, life: 180, desc: 'Milks 160 cows (dairy)' },
  ]);
  SET('freight', { truck: { cat: 'trucks', pool: 'truck' } }, [
    { id: 'reefer', label: 'Reefer trailer', cat: 'trailers', price: 60000, ticketBoost: 0.06, upkeep: 300, max: 99, perTruck: true, brk: 0.012, life: 120, desc: '+6% rate on its truck\'s loads' },
    { id: 'eld', label: 'Route & dispatch software', cat: 'trailers', price: 20000, demandBoost: 0.05, upkeep: 400, brk: 0.004, life: 60, desc: '+5% loads found' },
  ]);
  BZ.freight.equipCatsLabel = { trailers: ['🧭', 'Trailers & dispatch'] };
  SET('brand', { shelving: { cat: 'warehouse', storeUnits: 8000 } }, [
    { id: 'packst', label: 'Packing station', cat: 'warehouse', price: 8000, staffBoost: 0.1, upkeep: 80, brk: 0.008, life: 96, desc: 'Packers +10%' },
    { id: 'photo', label: 'Photo studio', cat: 'studio', price: 15000, demandBoost: 0.06, upkeep: 150, brk: 0.006, life: 96, desc: '+6% orders' },
    { id: 'racking', label: 'Pallet racking', cat: 'warehouse', price: 12000, storeUnits: 15000, brk: 0.002, life: 240, desc: '+15,000 units storage' },
  ]);
  SET('factory', { line: { cat: 'lines', pool: 'line' }, forklift: 'handling' }, [
    { id: 'rawsilo', label: 'Raw material silo', cat: 'storage', price: 150000, store: 20000, upkeep: 300, brk: 0.004, life: 240, desc: '+20,000 stock' },
    { id: 'robotarm', label: 'Robotic arm cell', cat: 'handling', price: 850000, staffBoost: 0.1, upkeep: 9000, brk: 0.014, life: 120, desc: 'Workers +10%' },
  ]);
  SET('tech', { server: { cat: 'servers', pool: 'server' } }, [
    { id: 'cdn', label: 'CDN & caching', cat: 'servers', pool: 'server', price: 25000, cap: 30000, upkeep: 1500, brk: 0.01, life: 60, desc: '+30,000 users' },
    { id: 'cicd', label: 'Dev tooling & CI', cat: 'devtools', price: 30000, staffBoost: 0.1, upkeep: 2000, brk: 0.005, life: 60, desc: 'Engineers +10%' },
  ]);
  SET('franchise', { systems: 'systems' }, [
    { id: 'lms', label: 'Online training portal', cat: 'systems', price: 40000, staffBoost: 0.15, upkeep: 800, brk: 0.004, life: 72, desc: 'Regional managers cover +15%' },
  ]);
  // anything still without a category
  for (const t in BZ) for (const it of BZ[t].equip) if (!it.cat) it.cat = it.critical ? 'machines' : it.support ? 'power' : 'tools';

  // ---------------- SUPPLIES / STOCK ----------------
  // per unit of output; unitCost = svc.cogs * ticket (so margins are unchanged at market price); spoil = share of leftover lost per month
  const SUP = {
    cafe: ['🫘', 'Beans, milk & food', 0.18, 1200], foodtruck: ['🥩', 'Food supplies', 0.22, 500], bakery: ['🌾', 'Flour, butter & fillings', 0.15, 1000],
    salon: ['🧴', 'Hair products', 0.02, 150], carwash: ['🧼', 'Soap & wax', 0.01, 1500], lawn: ['⛽', 'Fuel & parts', 0.01, 250],
    auto: ['🔩', 'Parts', 0.005, 40], hotel: ['🧺', 'Linens & amenities', 0.02, 1200], clinic: ['💊', 'Medical supplies', 0.03, 900],
  };
  for (const t in SUP) BZ[t].supply = { icon: SUP[t][0], label: SUP[t][1], spoil: SUP[t][2], baseStore: SUP[t][3], unitCostShare: 1 };
  BZ.factory.supply = { icon: '🪨', label: 'Raw materials', spoil: 0.002, baseStore: 0, perSqft: 1.2, unitCostFrom: 'materialCost' };
  C.supply = { staffReorderPremium: 0.06, staffReorderCover: [0.9, 1.08], sellBack: 0.5 };
  // make-ahead: bakeries and food trucks prepare before customers arrive; unsold goods are waste
  BZ.bakery.svc.makeAhead = 1.1; BZ.foodtruck.svc.makeAhead = 1.06;
  BZ.gym.svc.churn = 0.045;  // members leaving per month (gym flow)
  BZ.brand.brand.fade = 0.015; // share of clothing stock going out of season per month

  // ---------------- FARM v2 ----------------
  const FD = BZ.farm.farm;
  Object.assign(FD.enterprises.crops, { seedPerAcre: 110, inputPerAcre: 150, seedTonsPerAcre: 0.08 });
  Object.assign(FD.enterprises.cattle, {
    matureAge: 15, lifespan: 120, calfDeath: 0.006, adultDeath: 0.002, youngFeed: 0.6, cullValue: 0.6, replaceShare: 0.18, barnFeed: 1.6,
  });
  FD.enterprises.dairy = Object.assign({}, FD.enterprises.cattle, { label: 'Dairy cows', market: 'milk', milkPerCow: 0.75, feed: 190, headPerHand: 60, lifespan: 72, stockCost: 1800, saleRate: 0, best: 'grassland', parlorNeeded: true });
  FD.baseStoreTons = 60; FD.storePerAcre = 0.12;
  BZ.farm.equipCatsLabel = {};
  C.markets.beef.base = 2700;

  // ---------------- ICONS (UI) ----------------
  C.icons = {
    cash: '💵', nw: '📈', profit: '💰', rev: '⬆️', cost: '⬇️', rep: '⭐', quality: '🎯', staff: '👥', equip: '🛠️', risk: '⚠️', cap: '📊', demand: '🧲', served: '✅', lost: '❌',
    price: '🏷️', market: '📉', stock: '📦', spoil: '🗑️', in: '📥', made: '🏭', sold: '🛒', waste: '🗑️', next: '🔮', time: '⏳', storage: '🏚️', seeds: '🌱', harvest: '🌾',
    herd: '🐄', calf: '🐮', ready: '🥩', old: '👴', death: '💀', feed: '🌽', milk: '🥛', pace: '🏃', owner: '👤', ads: '📣', pr: '📰', ins: '🛡️', fix: '🔧', loan: '🏦', tax: '🧾',
    users: '📱', loc: '🏬', jobs: '🏗️', loads: '📦', truck: '🚛', rooms: '🛏️', members: '🏋️', patients: '🩺', cases: '⚖️', info: 'ℹ️',
  };
})();
