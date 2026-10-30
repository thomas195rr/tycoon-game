# Tycoon: Business Life Sim

A turn-based, mobile-first business tycoon game that runs in the browser with no build step, no server and no dependencies.

## How to run
- **Easiest:** open `dist/tycoon.html` in any browser (one self-contained file, works offline, phone or desktop).
- **From source:** open `index.html` (works from `file://`; all scripts are classic scripts, no modules).
- Rebuild the single file after editing: `node tools/build.js`.

- **Play online / add to home screen:** open https://thomas195rr.github.io/tycoon-game/ (GitHub Pages; works offline after the first visit). On iPhone use Share > Add to Home Screen; on Android/Chrome use Install app.

Progress autosaves after every month and every tap, and again when the app is hidden or closed (`visibilitychange` / `pagehide`). Each save goes to `localStorage` and to an IndexedDB copy; on start the newest of the two is loaded. The header shows **💾 Saved ✓ time**. If the browser blocks storage (some sandboxes or embeds), a red banner offers **Export save**: use **More > Settings > Export save code** and **Import** to keep progress.

## Version 2 highlights
- **Live prices:** each business sells at a market price that moves with the economy and with everyone's supply (including yours). You can follow the market or type your own exact price. Above market, customers or buyers drop off steeply and reputation suffers; below market, you sell more but earn less each. A huge price never wins.
- **Supplies & stock:** every business uses up stock (beans, parts, feed, raw materials...). Stock has a storage cap, spoils, and is reordered by you, your staff (slightly pricier) or a manager (good or bad calls).
- **Equipment by category:** each item raises one kind of capacity (machines, seating, storage...). Output is limited by the weakest link: staff, each equipment group, space, helpers or stock. Items have upkeep and wear out.
- **Life cycles:** cows are born, grow for 15 months, can be sold, retire at 10 years (dairy 6) and sometimes die; crops need seed and storage; gym members join and leave; fresh goods are wasted; clothes go out of style; trucks and machines wear out.
- **This month / Next month:** every business shows a simple flow (in, made, sold, lost and why) with green/yellow/red dots, plus what to expect next month.
- **Kid-friendly look:** light colours, big rounded buttons and cards, big icons, short words; tap any (i) or row label to show a short explanation, tap again to hide it. No animations.

## How to play (short)
Pick a business in **Market**. Listings are scored for that business, with pros and cons; you can buy, mortgage or lease. Open the business (quick setup buys basic gear and hires a team), then press **Next Month**, or type a number of months and press **Skip** (each month is still simulated one by one). Each report explains income, expenses, events and *why* things happened, with the odds. Lower risk with maintenance, upgrades, insurance and good managers. Grow into more businesses, real estate and investments. There is no forced ending.

## Contents
- 18 businesses, defined as data in `js/config-businesses*.js`:
  - **8 small:** cafe, food truck, bakery, salon, car wash, lawn care, auto repair, gym.
  - **3 in-between** (start small, no ceiling): farm, trucking, clothing brand.
  - **7 corporations:** hotel, law firm, clinic, construction, factory, tech startup, franchise chain.
- Seven simulation models:
  - `service` (most businesses)
  - `farm`: crops, orchard or cattle; weather, futures, storage, land
  - `freight`: rates, fuel and hedging, crashes
  - `brand`: inventory orders, lead times, virality
  - `projects`: construction bids, crews, heavy gear, deadlines
  - `factory`: production lines, market price, holding stock
  - `tech`: build phase, hidden product-market fit, users, churn, servers
  - `franchise`: applicants with hidden quality, royalties, scandals
- Staff with hidden traits (background checks reveal them), training, raises, promotions, poaching and quitting.
- Specialists and managers who resolve decision cards based on their skill and morale, plus an optional CEO. There are no standing orders and no spending limits.
- Equipment:
  - four tiers (used, budget, standard, premium)
  - wear, hidden wear and break odds shown up front
  - repair, service, maintenance plans, leasing
- Finance:
  - business, emergency and equipment loans, mortgages and a credit line
  - credit score and taxes (an accountant cuts tax and audit risk)
  - investors, IPO and buy-back
  - business and personal bankruptcy (the game continues afterwards)
- Real estate:
  - rentals with tenants, screening, evictions, upkeep and insurance
  - flips (contractor choice, hidden problems found by inspection)
  - land development, refinancing, a property manager and a fund
- Investing: stocks, penny stocks and coins, margin, angel deals.
- Casino, horse and sports betting: house edge, bet caps, bans and an optional habit. All of it can be turned off in Settings.
- World:
  - an economic cycle that moves interest rates and inflation
  - housing, fuel and commodity markets with supply and demand (your own output moves prices)
  - weather, news events and trends
- Achievements, net-worth milestones and a local leaderboard.
- Scenarios: classic, inherit a failing farm, recession start, rebuild after bankruptcy, silver spoon.

## Architecture
All code lives under one global namespace `TG`. Load order matters (see `index.html`):

| File | Namespace | Role |
|---|---|---|
| `js/core.js` | `TG.R`, `TG.U` | seeded RNG (mulberry32, state kept in the save), formatting helpers |
| `js/config.js` | `TG.CONFIG` | **all tunable numbers**: economy, staff, equipment, finance, real estate, investing, casino |
| `js/config-businesses*.js` | `TG.CONFIG.businesses` | one data entry per business: roles, equipment, site weights, risks, fixes, insurance, model parameters |
| `js/world.js` | `TG.W` | economy phases, markets/prices, weather, world events, news |
| `js/property.js` | `TG.P` | property listings, suitability, pros/cons, buy/lease/sell |
| `js/staff.js` | `TG.S` | candidates, hiring, traits, morale, quitting, poaching |
| `js/equipment.js` | `TG.E` | tiers, wear, break odds, repair/service/lease |
| `js/finance.js` | `TG.F` | the only path for money (`earn`/`spend`/`book`), loans, credit, tax, valuation, bankruptcy |
| `js/business.js` | `TG.B` | generic monthly business loop, risks with visible odds, reputation, lawsuits, PR |
| `js/models.js`, `models2.js` | `TG.M` | per-model monthly logic (service, farm, freight / brand, factory, projects, tech, franchise) |
| `js/managers.js` | `TG.D` | decision cards, who handles them, manager quality rolls, day-to-day management, CEO |
| `js/realestate.js` | `TG.RE` | rental portfolio, flips, development |
| `js/invest.js` | `TG.I` | markets, margin, angel deals, casino and betting |
| `js/engine.js` | `TG.Game`, `TG.rep`, `TG.store`, `TG.LB` | new game, monthly turn order, skip, reports, achievements, save/load/export |
| `js/ui/*.js` | `TG.UI` | rendering (string templates + one delegated click handler using `data-act`), screens, modals |

Turn order (`TG.Game.nextMonth`):
1. Unanswered decisions are auto-resolved.
2. World, then property, then real estate, then investments are updated.
3. Each business runs its month, then its managers act.
4. Lawsuits, loans, CEO, tax and month-end are processed.
5. History is updated and the report is built.

### Adding a business
1. Add an entry to `TG.CONFIG.businesses` (copy a similar one). Most businesses only need the generic `service` model: set `svc`, `roles`, `equip`, `site`, `risks`, `fixes` and `insurance`.
2. For new mechanics, add `TG.M.models.<name>` with `init / needs / baseRev / month / extraRisks` and an optional UI panel in `js/ui/ui-models.js` (`UI.modelPanel.<name>`).
3. Run the tests.

## Tests and tools (Node 18+)
- `node test/sim.test.js --months 1200 --seeds 8` runs a headless simulation. It includes:
  - a random "fuzz" bot that tries every action
  - careful and reckless bots for each of the 18 businesses
  - every scenario

  It checks for crashes, NaN/Infinity, negative stock and save round-trips.
- `node test/exploits.test.js` runs "no free money" checks (mortgage, real estate, refinance, loan, stock and investor round-trips) and confirms the house edge on every bet.
- `node tools/balance.js 8 120 [--json]` compares ROI and risk of ruin per business at similar capital.
- `node tools/econ.js` shows unit economics. `node tools/diag.js` shows a single-business diagnostic.
- Browser tests (optional; need `puppeteer-core` and Chrome):
  - `NODE_PATH=... node test/ui.test.js --clicks 600 [--width 375] [--file dist/tycoon.html]` does random clicking and checks errors, overflow, bad text and save restore.
  - `NODE_PATH=... node test/ui-cover.test.js [--width 375]` presses every button on every tab for all 18 businesses.
