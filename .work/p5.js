  // cheapest storage item per unit of space
  ST.bestStore = (b) => TG.CONFIG.businesses[b.type].equip.filter((x) => x.store).sort((x, y) => x.price / x.store - y.price / y.store)[0] || null;
  // buy enough storage to hold `need` units; returns count bought
  ST.addStorage = (g, b, need, tier) => {
    const it = ST.bestStore(b); if (!it) return 0; let n = 0;
    while (ST.cap(b) < need && n < 20) { const x = TG.E.buy(g, b, it.id, tier || 'standard'); if (!x) break; n++; }
    return n;
  };
