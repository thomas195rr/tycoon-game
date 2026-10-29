/* core.js - shared helpers, seeded RNG, formatting. Loaded first. */
(function () {
  const TG = (globalThis.TG = globalThis.TG || {});
  TG.G = null; // current game state

  // ---------- Seeded RNG (mulberry32); state lives in the save so runs are reproducible ----------
  const R = {
    next() {
      const g = TG.G;
      let s = g ? g.rngState : (R._s = (R._s || 12345));
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      if (g) g.rngState = s; else R._s = s;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) { return a + (b - a) * R.next(); },
    int(a, b) { return Math.floor(R.range(a, b + 1)); },
    chance(p) { return R.next() < p; },
    pick(arr) { return arr[Math.floor(R.next() * arr.length)]; },
    normal(mu = 0, sd = 1) {
      let u = 0, v = 0;
      while (u === 0) u = R.next();
      v = R.next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted(obj) { // {key: weight}
      let tot = 0; for (const k in obj) tot += Math.max(0, obj[k]);
      let r = R.next() * tot;
      for (const k in obj) { r -= Math.max(0, obj[k]); if (r <= 0) return k; }
      return Object.keys(obj)[0];
    },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  TG.R = R;

  const U = {
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    lerp: (a, b, t) => a + (b - a) * t,
    num(x, d = 0) { return Number.isFinite(x) ? x : d; },
    sum: (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0),
    avg: (arr, f, d = 0) => (arr.length ? U.sum(arr, f) / arr.length : d),
    uid(prefix) { const g = TG.G; g.nextId = (g.nextId || 1) + 1; return (prefix || 'id') + g.nextId; },
    money(x, opts) {
      if (!Number.isFinite(x)) return '$0';
      const neg = x < 0; const a = Math.abs(x);
      let s;
      if (a >= 1e12) s = (a / 1e12).toFixed(2) + 'T';
      else if (a >= 1e9) s = (a / 1e9).toFixed(2) + 'B';
      else if (a >= 1e6) s = (a / 1e6).toFixed(2) + 'M';
      else if (a >= 1e4) s = (a / 1e3).toFixed(1) + 'k';
      else s = Math.round(a).toLocaleString('en-US');
      return (neg ? '-$' : '$') + s;
    },
    pct(x, d = 0) { return (Number.isFinite(x) ? (x * 100).toFixed(d) : '0') + '%'; },
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    moy(m) { return ((m % 12) + 12) % 12; },
    dateStr(m) { const c = TG.CONFIG; return U.months[U.moy(m)] + ' ' + (c.start.year + Math.floor(m / 12)); },
    yrsMo(n) {
      n = Math.max(0, Math.floor(n || 0));
      const y = Math.floor(n / 12), mo = n % 12;
      if (!y) return mo + ' mo';
      return y + (y === 1 ? ' yr' : ' yrs') + (mo ? ' ' + mo + ' mo' : '');
    },
    riskLabel(p) {
      const t = TG.CONFIG.riskLabels;
      if (p >= t.critical) return { label: 'Critical', tone: 'bad' };
      if (p >= t.high) return { label: 'High', tone: 'bad' };
      if (p >= t.moderate) return { label: 'Moderate', tone: 'warn' };
      return { label: 'Low', tone: 'good' };
    },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    stars(q) { const n = U.clamp(Math.round(q * 5), 1, 5); return '★'.repeat(n) + '☆'.repeat(5 - n); },
    clone: (o) => JSON.parse(JSON.stringify(o)),
  };
  TG.U = U;
})();
