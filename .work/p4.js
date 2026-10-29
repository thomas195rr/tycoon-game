    // v2: a market for every good; exact prices replace low/normal/premium
    for (const id in TG.CONFIG.markets) if (!g.markets[id]) { const m = TG.CONFIG.markets[id]; g.markets[id] = { demand12: m.demand12, comp: 1, player12: 0, sales: [], price: m.base, hist: [] }; }
    if ((g.v || 1) < 2) {
      for (const b of g.businesses) {
        if (b.price && b.price !== 'normal' && TG.PR.hasPrice(b)) { const mk = TG.PR.market(g, b); if (mk > 0) b.ask = Math.round(mk * (b.price === 'low' ? 0.9 : 1.1) * 100) / 100; }
        delete b.price; if (b.ask === undefined) b.ask = null;
      }
      g.v = 2;
    }
