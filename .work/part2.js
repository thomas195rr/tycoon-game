  E.save = (g) => {
    let txt; try { g.savedAt = Date.now(); txt = E.serialize(g); } catch (e) { E.saveState = { ok: false, at: Date.now(), where: '', err: 'could not package the game' }; return false; }
    if (E.onSaved) E.onSaved(st); return lsOk; };
  E.loadAsync = () => IDB.get(SAVE_KEY).then((s2) => { let a = null, b = null; const s1 = store.get(SAVE_KEY);
    try { if (s1) a = E.deserialize(s1); } catch (e) { a = null; } try { if (s2) b = E.deserialize(s2); } catch (e) { b = null; }
    const g = a && b ? ((b.savedAt || 0) > (a.savedAt || 0) ? b : a) : a || b; if (g) TG.G = g; return g; });
