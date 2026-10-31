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

## Version 4 highlights
- **🕶️ Crime side (optional, can be turned off in Settings):** a fictional street-goods empire (Sugar Rush, Glow, Haze, Void: made-up products, no real-world detail), suppliers with different reliability, a stash with limited storage, a crew (dealers, runners, enforcers, lookouts, cooks) on the same work-capacity model as legit staff, turf blocks, laundering through your legit businesses (limited and audited), plus bank jobs, sabotage of rival businesses, insider trading and petty theft.
- **Crime is risky:** heat, raids, robberies, snitches, arrests, jail (months pass while your managers run things), seizure of the stash and even your legit companies. Lawyers and bribes lower the odds but never make you safe. Every risk shows its odds and why.
- **Street pricing:** sell at the street price or set your own. Cheap grows clients fast but earns less each; dear earns more each but scares clients off and hurts street rep. Clients and street rep are visible.
- **No free buttons:** PR, raises, bonuses, training, servicing and crew perks have a few useful uses per month; pressing past the limit backfires. The screens show uses left.
- **Every business needs staff:** the "work it yourself" option and the Replace button are gone (sell, then buy).
- **Skills in real numbers**, manager perks unlocked by level, a **next-month forecast** for each business and **forecast vs actual** after the month. Candidates show what they would add before you hire.

## Version 5 highlights
- **Farm land by area:** give acres to a 🐄 cow area, a 🌾 crop area and a 🍎 orchard area (Land tab, in that order). Each area has its own soil, water and price. Buying land is a small button; new land arrives as ⬜ free acres. Moving acres between areas costs money and takes 1-2 months (orchards must be planted), so it is not a free switch. Old saves move the old farm into the matching area and turn old irrigation into sprinklers.
- **Soil %:** drops every month (faster when high, slower when low). Spray & feed brings it back (once a month per area; less effect near the top, so keeping it near 100% costs more). Soil sets yield (x0.55 at 0% to x1.15 at 100%) and pest odds. Everything is shown in numbers.
- **Water %** = how much of the area your sprinklers cover. Sprinklers are machines (they wear and break). Low water raises the odds of dry-outs (crops/trees) and sick cows in heat; weather and season change the odds, and the reason is shown.
- **🧑‍💼 Manager tab** for every business: your standing orders (how many to keep, keep spare staff, service machines at X% wear, fix broken machines right away, reorder supplies; farms: spray when soil is below X%, buy seed, harvest policy). Your manager carries them out; skill decides how well (forgotten orders, wasted spray, rushed hires). The old "Team plan" is gone.
- **👥 Staff tab** for every business: per job, people, work needed vs what they can do (bar), spare %. People call out or slack; with no spare, work is left undone and the odds of that business's disasters go up (shown as "x1.6 disaster odds") until the team catches up.
- **Upgrades say exactly what they do**, in numbers, for all 18 businesses (e.g. the mega processing plant: +35% for grain/fruit and +20% for milk/beef, only with 12,500 t a year through it; "vertical integration" is now "Own seed & feed supply": seed, feed, spray and trees 20% cheaper).

## Version 6 highlights
- **📈 Industry Outlook** (☰ More, and a card on Home): 13 industries each have their own booms and slumps. They drift back toward normal, partly follow the economy, and show a state, a trend arrow and the reasons. They change customers, prices and costs for every business in that industry. The arrow is a hint, not a promise.
- **No free automation.** Machines no longer fix or service themselves. A broken machine stays broken until you tap Fix (full price) or a **🔧 mechanic** (a staff role) fixes it. Mechanics repair and service for less, choose when to service based on their skill, and each one looks after about 10 machines. Supplies, seed, cow feed and spraying only happen when you do them or a manager does. The Manager tab shows "No manager: you must do this yourself" for each job nobody covers, and **Now** shows a "You must do this yourself" list.
- **Cows have a life cycle:** calf → heifer → milking cow → dry/old cow → sell, and calf → steer → market-ready → sell. Bulls are needed for calves. Small herds breed faster per cow than big ones (30 head ≈ 4× the rate per cow of 200 head), and breeding stops when the pasture is full or the cows are hungry. Cows eat grass first, then **feed** you buy into storage. Without feed they lose health and milk, and get sick and die more often. Tap "🐄 See all cows" to buy or sell by stage.
- **Credit & loans:** a 300-850 credit score built from payment history, credit line use, debt vs assets, credit age and recent applications. Every part shows its points and why. Loan applications show your approval odds with good/okay/bad factors, the rate, the payment and the fee before you apply. Every application counts, even when the bank says no. Rates follow your score (and your industries for business loans). Missed payments lead to collections and repossession.
- **Property financing and tenants:** see the full monthly payment (loan, tax, insurance) and cash needed before buying. Set the rent per rental against the market. Pay for a tenant search to get a pool of applicants, then accept or decline them one at a time (no going back). Evictions, income and credit are visible clues; reliability is hidden. A property manager can run searches for you. Very high or very low rents lose money.
- **📊 Reports tab** for every business (and crime): this month, next month, the forecast and forecast vs actual moved off the working view. **Now** is for doing things.
- **Instant updates:** every change (hire, fire, buy or sell a machine, move acres, change a price, buy feed/seed/supplies, change an order) updates capacity, work bars, spare %, what limits you and the forecast straight away. `TG.B.live(g, b)` is the one recompute: it runs the coming month on a throw-away copy (nothing is kept) and is cached until the business changes. Next Month still simulates the month for real.
- Money you spend between months (supplies, feed, repairs) now counts in that month's results and tax.
- Old saves move over: the mechanic specialist becomes a staff mechanic, auto-fix orders are removed, old herds split into stages with a bull and a month of feed, cow sprinklers are sold, and you get a credit record and a credit line like the one you had.

## Version 7 highlights
- **No manager = nobody runs the shop.** Without a manager (or an ops manager/CEO handling stock), staff never order supplies. When the shelf is empty the shop **closes**: no sales, but wages, rent and bills keep coming. The business shows "🚫 Closed: no supplies, no manager" with a one-tap supplies buy. While closed, idle staff lose morale and may quit (the odds rise with every closed month and with low morale). Starting a business with Quick setup buys a first batch of supplies (you pay for it); after that it is up to you.
- **One tenant per home.** Every unit has its own row: vacant/occupied, tenant quality, rent and lease months left, plus any open repair. Each empty unit needs its own paid tenant search: you see one applicant at a time, accept or decline, and declined applicants are gone.
- **Property manager:** finds and screens a tenant for every empty unit and pays for repairs as they happen. Skill changes tenant quality and what searches and repairs cost; the wage plus a share of rent is a real cost (on one small building it usually costs more than it saves). Without one, repairs wait for you to tap Fix: unfixed repairs annoy tenants (late or half rent, more move-outs), wear the building and can bring city fines.
- **Money report** after every Next Month and every skip: Money in (sales, rent, investments, other) with a total, then Money out in collapsible groups with subtotals (Loans: interest + principal; Property; Wages; Cost of product; Equipment; Other), then the bottom line: cash at the start, what you are left with and cash at the end. It always matches your real cash change (borrowing, buying buildings and paying down loans are labelled as such). Skips show totals for the whole stretch plus a month-by-month list.
- **True result per business and property:** "Who made or lost money" lists every business, every building, real estate (grouped, each property expandable), investments, crime and personal costs. Each line includes everything: machines, damage, loan payments, upkeep. Red = losing. The lines add up to the total cash change. Business cards and the Now tab show this true result.
- **Loans like real mortgages:** every loan amortizes (interest = balance × rate / 12; the rest pays the balance down). The loan list shows rate, monthly payment and balance; tap a loan for amount borrowed, balance, term, this month's interest vs principal, interest paid so far and still to pay, months left, payoff date, what secures it, the full schedule, and extra payments or payoff (extra payments shorten the loan; the payment stays the same). The credit line works the same way with minimum payments.
- **HR manager:** hires for the same skill cost less (the discount grows with HR skill) and more unreliable or dishonest applicants are screened out. It is odds, not a promise: the deepest bargains are more often duds, people paid under the going rate are a bit less happy, and the HR salary is real (it pays off only with a lot of hiring). The hiring screen shows what HR changed for each applicant.
- **Rebalance:** charging over market now hurts reputation more (5% free band, then a steeper drop), so "always charge 15% more" is no longer a safe edge. In the crime balance tool you can no longer run your shop yourself while in jail (matching the game).
- Old saves move over: a building-wide tenant search moves to one empty unit, loans get interest/principal counters ("since v7" for interest paid before), and the ledger starts from your current cash.

## Version 8 highlights (first-time player fixes)
- **Rent per unit first:** every building listing, the finance screen and the rental rows show "$X/unit × N units = $T/mo when full", plus how many units are rented now and what they pay. Bigger buildings now have more units for their price, so rent per unit stays sensible.
- **Supplies are clear:** the Now tab shows "📦 Fill for next month: N ($)" and "🤖 Auto: needs a manager" until you have a Shift lead (new, cheap, supplies only), Ops manager, GM or CEO. Next Month warns before a shop runs out (Fill / Fill all / Next anyway / Don't warn me), and a skip checks first ("Before you skip": shops with no manager, empty rental units).
- **Skip stops early on trouble** (on by default, toggle under the Next Month button and in Settings): a shop closing, missed payments, cash below zero, crime trouble. Skip boxes take whole months only ("1e3" now means 1000, a blank box uses the default).
- **Quick setup shows the real cost** before you open: cash spent today, cash left, wages, first month and 3-month average from a practice run, and how long your cash lasts, with a "this is risky" warning and tips. Leasing or buying a place you can't afford to set up, or spending over 40% of your cash, asks first.
- **Loans explain themselves:** each odds factor says why, "What would raise your odds" tips, "Need $X more" when cash is short, mortgage buttons show cash needed now and the odds, emergency loans check if you can pay them back.
- **Header ❓ Help** with a visible how-to list; header chips are labelled ("Economy: Boom"); phone tabs wrap; landscape and 320px phones fit; the Back button closes popups, then goes to the previous screen or tab.
- **Saves:** a second open tab can no longer overwrite newer progress (it shows "Opened in another tab: Reload"). A new game's code is random unless you type one.
- **Whole cows only** (fractions are carried over, not shown); the inherited farm starts at a size its staff can work; seed and feed buys say when only part fit.
- Smaller fixes: sales cards say "Sales last month" vs "Expected next month"; manager status on business cards ("No manager: you run it"); bankruptcy and cash-below-zero banners; deposits, late fees, returned deposits and debts wiped by bankruptcy have their own money-report lines (not income); refinance fees are shown; tenants have names; "Busiest: <job>" tile matches the work bars; crime and gambling are Off by default in a new game.
- Old v7 saves move over: skip-stop and supply warnings switch on, cattle become whole numbers.

## Version 9 highlights (staff market, cheaper starts, help everywhere)
- **No more Shift lead:** managers (Ops manager, GM, CEO) order supplies and your crew works the site. A GM or Ops manager also works on the job at 25% of a worker; the Staff tab and the 💪 Work card say so. Old saves: a Shift lead becomes your Ops manager (same pay) or joins the crew if that seat is taken, with a one-time note.
- **Workers have a market value:** every worker row shows ⭐ skill, 💵 pay, 📈 market value (what other companies would pay), personality (🤝 loyal · 🙂 steady · 📈 climber · ❓ not known yet) and 🎯 the monthly chance another company hires them away, with the reasons. Small gaps (under 12%) rarely matter; skill they pick up just doing the job counts 40% to other companies, training counts fully. Odds-based job-offer cards let you match (with the chance they stay) or let them go; a heads-up comes first.
- **Raises show their effect:** "+8%" and "To market" buttons show the new pay, the monthly cost (with payroll tax) and the poach odds before → after. HR managers and GMs raise good people at risk.
- **Cheap hires and training:** 🌱 trainees (low skill, cheaper) show up in the hiring list. Training shows the cost, the skill range and usual gain, the chance it barely sticks, the share of their month spent training (less work done) and how much more they will be worth to other companies. Gains shrink above skill 60; people learn at different speeds.
- **Help works everywhere:** every "i" now opens in place, including inside popups (worker, listing, loan) and inside folded sections (before, tapping an "i" in a popup or in "🔧 Yours" showed nothing). The 📈 Investing screen explains every number, every stock (average yearly drift, normal yearly range, chance of going to zero), buying, margin and angel deals; the casino explains each game's odds.
- **Machine counts are right on the Now page:** the live preview no longer "breaks" machines (a farm with a working tractor showed "Tractors x0"). Machine groups show what you own and how many are broken; two groups in one category get their own names.
- **Cows explain themselves:** tap any herd group (calves, heifers, steers, market-ready, milking cows, dry/old cows, bulls) for what it does, what it costs and what to do. Dry cows get their own row ("N dry / old cows, $X/mo feed, Sell all for ~$Y") and a heads-up on Home and before Next Month when they pile up with nobody selling them.
- **Balance audit (every business can work):** `tools/audit.js` plays every business (farm split into cows / crops / orchard) from 4 starts (half budget + lease, normal cash/mortgage, normal lease, big budget) and every rental kind (cash, mortgage, "mortgage only if the rent covers it"), 24 seeds x 10 years, random start years (booms and slumps), with a careful bot that only acts on what the screens show. Fixes from it:
  - **Rentals could not pay for themselves:** running costs were about 7% of the price a year against about 9% rent, and big buildings fell apart (one unit's damage knocked 5 points off a 100-unit building). Now: repairs 0.035 → 0.018/mo, big repairs 0.006 → 0.004, upkeep 0.12% → 0.05%/mo, tenant-injury suits 0.0012 → 0.0004, wear 0.25 → 0.12/mo, unit damage wears a building by 5/units, house/condo/duplex/commercial rents +10%, and house prices now rise with inflation (+2.7%/yr, was +1.5% while prices rose 2.4%). Careful landlord median: about -8%/yr → +3-4%/yr.
  - **Rental listings show "A typical month with this loan":** rent you can count on − running costs − loan = what you keep or pay from your own cash, with a warning when the rent does not cover the loan.
  - **Start dialog plays a practice YEAR** (was 3 months), so seasons and harvests count: whole first year, and warnings when cash runs out before the money comes in or when a shop/farm still loses money at the end of the year and is not getting better ("likely to lose money for good").
  - **Cows:** buying markup 1.15 → 1.08 and herd value in your net worth 70% → 90% (a cow you could sell for 97% counted as 70%).
  - **Clinics outside the city and rural gyms** lost money in nearly every run: their listings now rate those places as a poor fit.
- **Balance:** apartment and small-apartment rents up about 10%. Food trucks (shared commissary: 60% of shop rent, utilities and insurance) and lawn care (shared yard: 85%, plus half wages in the Nov-Feb off-season) have lower fixed costs. Tech startups: engineers take part of their pay in options until launch (65% wages), lower churn, and investors offer cash for a share at 1,000 and 40,000 users; a stalled app gets a "consider a pivot" hint.

## Version 10 highlights (upgrades with payback, takeovers, per-unit rentals)
- **Upgrades:** every business has at least 4 new upgrades, with its own customers and choices. Each card shows its price, what it adds per month and how many months it takes to pay back, best payback first. Selling more per customer costs some extra product, so no upgrade is free money.
- **Ads:** the Ads tab previews a budget before you save it, then shows what the ads really did last month, with the last 6 months of history. Sales also have busy and slow months.
- **Costs before buying:** every "how many" box shows `N × price each = total` while you type.
- **Take over a failing business:** pick this in the start dialog, or as a new-game start, for any of the 18 types. It is cheaper than opening a new one, but comes with worn gear, a low-morale team, a weak reputation and the old owner's debt.
- **Machines:**
  - The mechanic now services and repairs machines, so maintenance plans are gone.
  - Optional machine insurance pays for a new machine if one is destroyed.
  - A destroyed machine waits for you, or the GM/Ops manager replaces it. Turn on the like-for-like order to make them replace it with the same kind and quality.
- **GM vs Ops:**
  - The GM runs people and sales.
  - The Ops manager runs machines, stock and the farm.
  - Each makes better calls in their own area.
- **Bonuses:** a bonus raises loyalty, which visibly cuts the odds that a rival hires the worker away.
- **Rentals:**
  - A building you buy is empty, and each unit gets its own tenant and its own rent.
  - Listings show the rent per unit and the total when full.
  - You choose a down payment of 20-50% on a mortgage.
  - Listings stay on the market for 3-7 months, and a first rental is always for sale.
- **Other changes:**
  - Total play time is counted in game years across all your games.
  - The casino has no table limit (the odds are unchanged).
  - The dry cows row always shows on the farm.
  - Crowded cows give less milk.
  - City gyms charge more.
- **Fix:** 2.5 seconds after start, the boot load fallback no longer swaps the live game for the saved copy.
- **Tests:** `test/v10.test.js` (rules), `test/v10-ui.test.js` (browser checks at 375 and 1280 px), and `tools/playtest/personas10.js` (5 kid personas plus the "how it should work" checklist, written to `tools/playtest/log10.txt`). `tools/upg-calib.js` prints the payback for each upgrade, and `tools/audit10-table.txt` holds the balance audit.

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
| `js/finance.js` | `TG.F` | the only path for money (`earn`/`spend`/`book`), loans, tax, valuation, bankruptcy |
| `js/credit.js` | `TG.CREDIT` | credit score parts, loan quotes/odds/applications, credit line reviews |
| `js/industry.js` | `TG.IN` | industry cycles (demand, price and cost multipliers, trend, reasons) |
| `js/herd.js` | `TG.M` (farm) | cow stages, breeding, grass and feed, cattle buying/selling, migration of old herds |
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
- `node test/exploits.test.js` runs "no free money" checks (mortgage, real estate, refinance, loan, stock and investor round-trips) and confirms the house edge on every bet. It also presses every free/repeatable button 1000 times in one month (PR, raise, bonus, train, service, crew train/bonus, turf, theft, heists, sabotage, cash moves, farm spraying) and asserts no net gain, checks that moving farm acres around never makes money or soil, checks that laundering always loses money, that raid/conviction odds never reach zero, and that jail blocks crime actions. v6 adds: cattle buy/sell round trips, mass-buying or overstocking cows, starving cows, industry-cycle timing, borrow/repay and application spam on credit, tenant search spam and extreme rents.
- `node test/ledger.test.js [--seeds=6]` (v7) checks that every monthly report and every skip reconciles (money in − money out = the real cash change, and the per-business/property lines add up to it) across random play and all 18 business types, and checks loan amortization, extra payments, missed payments and the credit line.
- v7 exploit checks: one search fills one unit, ignoring repairs loses money, a property manager on one duplex is a real cost, a closed shop sells nothing but still pays wages, HR does not pay for itself at a small business and deep bargains are riskier, borrow-and-pay-off never makes money.
- `node test/v9.test.js` (v9) checks training (cost, range, time away, market value), poaching and raises (gap, skill, personality, tolerance, offer cards, matching), managers working at a fraction, Shift-lead migration, the cheaper fixed costs, higher rents, tech rounds and that the live preview never breaks machines.
- `node tools/exploit9.js [seeds]` (v9) compares "hire cheap trainees, train them, never raise" with the normal careful owner.
- `node tools/audit.js all [seeds=24] [months=120]` (v9) runs the balance audit in parallel; `node tools/audit-table.js after.json [before.json] [--detail]` prints the table (median yearly growth, % of seeds that grew, % profitable in years 2-3, ruin, worst 10%, boom vs slump starts, reckless play) and each start option and location. `node test/audit.test.js [seeds]` asserts every unit has a start where a careful player usually grows, careful ruin stays at or under 15%, nothing beats 25%/yr, and reckless play loses.
- `node test/v8.test.js` (v8) checks rent-per-unit math, random game codes, whole cattle, skip stops, loan odds tips and the two-tab save guard.
- `node test/crime.test.js [seeds]` runs `tools/crime-balance.js` and asserts that crime plans do not beat careful legit play and that reckless crime is ruined most of the time.
- `node test/migrate.test.js` loads v4-style farm saves and v5 saves and checks they move to the current layout (areas, cow stages, mechanics, credit, tenants) and keep running.
- `node tools/balance.js 8 120 [--json]` compares ROI and risk of ruin per business at similar capital, from different start years (the world runs 0-10 years first), split by whether the industry started in good or bad times, and prints how far each industry swings.
- `node tools/econ.js` shows unit economics. `node tools/diag.js` shows a single-business diagnostic.
- Browser tests (optional; need `puppeteer-core` and Chrome):
  - `NODE_PATH=... node test/ui.test.js --clicks 600 [--width 375] [--file dist/tycoon.html]` does random clicking and checks errors, overflow, bad text and save restore.
  - `NODE_PATH=... node test/ui-cover.test.js [--width 375]` presses every button on every tab for all 18 businesses, and on every crime tab (free and in jail). It also hires, fires and buys a machine by clicking and checks that capacity and the forecast change in the same month.
  - `NODE_PATH=... node tools/shots.js` saves phone-size screenshots (land areas, staff, manager orders, upgrades) to `tools/`.
  - `NODE_PATH=... node tools/shots7.js` saves the v7 screenshots (money report, loans and loan detail, apartment units, unit search, closed shop, HR hiring) to `tools/shot7-*.png`.
  - `NODE_PATH=... node test/v8-ui.test.js [--width 375] [--shots tools]` (v8) checks the rent display, supplies/Auto, skip stop, quick setup cost, phone tabs and Help, and saves `shots8-*.png`.
  - `NODE_PATH=... node test/tips.test.js [--width 375]` (v9) taps every info (i) button on every screen, tab and popup for all 18 businesses (incl. the stock market and casino) and checks each one shows text.
  - `NODE_PATH=... node test/now-counts.test.js` (v9) buys and breaks every machine type and checks the Now page shows the right counts.
  - `NODE_PATH=... node test/herd-help.test.js` (v9) checks every herd stage explains itself and the dry-cow row, Sell button and heads-ups.
  - `NODE_PATH=... node tools/shots9.js` (v9, uses a local server: `python3 -m http.server 8765`) saves `tools/shots9-*.png`.
  - `NODE_PATH=... node tools/shots6.js` saves the v6 screenshots (industry outlook, cows, mechanic, manager, reports, credit, finance preview, tenant search) to `tools/shot6-*.png`.
