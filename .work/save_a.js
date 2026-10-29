  E.saveState = { ok: null, at: 0, where: '', err: '' };
  const IDB = {
    db: null, failed: false,
    open() {
      if (IDB.db || IDB.failed) return Promise.resolve(IDB.db);
      return new Promise((res) => {
        try {
          if (!globalThis.indexedDB) { IDB.failed = true; return res(null); }
