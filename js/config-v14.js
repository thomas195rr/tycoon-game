/* config-v14.js - v14 numbers: people manager, crime street boss, save-slot labels. */
(function () {
  const C = globalThis.TG.CONFIG;
  C.specialists.people = {
    label: 'People manager', icon: '💛', wage: [9000, 22000],
    desc: 'Late-game boss for a big team. Keeps morale up, makes people want to stay (fewer quits and poach offers), and hires so nobody is overworked. Expensive. Part of the pay is team perks.',
  };
  C.perks.people = [
    [40, 'morale', 2, '+2 morale for everyone'],
    [60, 'quitCut', 0.1, '-10% odds staff quit'],
    [80, 'morale', 2, 'another +2 morale'],
  ];
  C.v14 = {
    people: {
      perkShare: 0.35, // share of the salary that is team perks (still a wage cost)
      morale: [4, 12], // added to the morale target at skill 0 → 100
      quitCut: [0.2, 0.55], // multiplies quit odds (lower is better)
      poachCut: [0.25, 0.6],
      over: 1.05, // work bar above this → hire one person, if it fits the cash
      maxHire: 1, // hires per month (skill can raise this)
    },
    crimeMgr: {
      boss: { icon: '🕶️', label: 'Street boss', wage: [5500, 14000], desc: 'Buys product for what your clients want and replaces crew who leave. Without one, nothing on the street is ordered for you.' },
    },
  };
})();
