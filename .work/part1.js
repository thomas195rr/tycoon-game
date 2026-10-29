  E.saveState = { ok: null, at: 0, where: '', err: '' };
  const IDB = {
    db: null, failed: false,
    open() {
      if (IDB.db || IDB.failed) return Promise.resolve(IDB.db);
      return new Promise((res) => {
        try {
          const f = globalThis.indexedDB; if (!f) { IDB.failed = true; return res(null); }
          const rq = f.open('tycoon', 1);
          rq.onupgradeneeded = () => { try { rq.result.createObjectStore('saves'); } catch (e) { res(null); } };
          rq.onsuccess = () => { IDB.db = rq.result; res(IDB.db); };
          rq.onerror = () => { IDB.failed = true; res(null); };
          rq.onblocked = () => { IDB.failed = true; res(null); };
        } catch (e) { IDB.failed = true; res(null); }
      });
    },
    put(k, v) {
      return IDB.open().then((db) => new Promise((res) => { if (!db) return res(false);
        try { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(v, k);
          tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false);
        } catch (e) { res(false); } })); },
    get(k) { return IDB.open().then((db) => new Promise((res) => { if (!db) return res(null);
        try { const rq = db.transaction('saves', 'readonly').objectStore('saves').get(k);
          rq.onsuccess = () => res(rq.result == null ? null : rq.result); rq.onerror = () => res(null);
        } catch (e) { res(null); } })); },
    del(k) { return IDB.open().then((db) => { if (!db) return;
      return IDB.put(k, null); }); },
  };
  TG.IDB = IDB;
