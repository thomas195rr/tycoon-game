// Playtest driver: HTTP server holding live Puppeteer sessions so a tester can look/click step by step.
const puppeteer = require('puppeteer-core'); const http = require('http'); const path = require('path'); const fs = require('fs');
const URL0 = process.env.GAME || 'http://127.0.0.1:8765/index.html';
let br; const S = {};
const LOG = path.join(__dirname, 'log.txt');
function log(...a) { fs.appendFileSync(LOG, a.join(' ') + '\n'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function newSess(id, w, h, mobile) {
  if (S[id]) { try { await S[id].ctx.close(); } catch (e) {} }
  const ctx = await br.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const s = { ctx, p, errs: [], cons: [], mobile: !!mobile, n: 0, els: [] }; S[id] = s;
  const hook = (pg) => {
    pg.on('pageerror', (e) => { s.errs.push('PAGEERROR ' + e.message); log(id, 'PAGEERROR', e.message); });
    pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { s.cons.push(m.type() + ' ' + m.text()); log(id, 'CONSOLE', m.type(), m.text()); } });
    pg.on('dialog', async (d) => { log(id, 'DIALOG', d.type(), d.message()); s.cons.push('DIALOG ' + d.type() + ': ' + d.message()); if (d.type() === 'prompt') await d.accept(s.promptAnswer ?? ''); else if (d.type() === 'confirm' && s.confirmNo) await d.dismiss(); else await d.accept(); });
  };
  s.hook = hook; hook(p);
  await p.goto(URL0, { waitUntil: 'networkidle0' });
  return 'ok';
}
async function elements(s) {
  return s.p.evaluate(() => {
    const out = []; const seen = new Set();
    const cand = document.querySelectorAll('button, a, input, select, textarea, summary, [data-act], [onclick], [role=button], [tabindex]');
    const all = [...cand, ...[...document.querySelectorAll('div,span,li,td,img,svg,section,article,label')].filter((e) => getComputedStyle(e).cursor === 'pointer')];
    for (const e of all) {
      if (seen.has(e)) continue; seen.add(e);
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const cx = r.left + r.width / 2, cy = Math.max(1, Math.min(r.top + r.height / 2, innerHeight - 2)); const top = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), cy);
      const covered = top && !(e === top || e.contains(top) || top.contains(e));
      let t = (e.innerText || e.value || e.getAttribute('aria-label') || e.title || e.alt || e.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      out.push({ tag: e.tagName.toLowerCase() + (e.type ? ':' + e.type : ''), t, x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height), covered, dis: !!e.disabled });
    }
    return out;
  });
}
async function look(s, id, name) {
  s.n++; const f = path.join(__dirname, 'shots', `${id}-${String(s.n).padStart(2, '0')}-${(name || 'look').replace(/[^\w-]/g, '_').slice(0, 30)}.png`);
  await sleep(250);
  await s.p.screenshot({ path: f }); s.els = await elements(s);
  const info = await s.p.evaluate(() => ({ sy: Math.round(scrollY), sh: document.documentElement.scrollHeight, vh: innerHeight }));
  const weird = await s.p.evaluate(() => { const t = document.body.innerText; const m = t.match(/.{0,30}(NaN|undefined|null\b|Infinity|\[object|-\$-|\$-0\b).{0,30}/g); return m || []; });
  const ov = await s.p.evaluate(() => { const r = []; document.querySelectorAll('body *').forEach((e) => { const b = e.getBoundingClientRect(); if (e.children.length === 0 && e.innerText && b.width > 0 && b.right > innerWidth + 1) r.push('OFFSCREEN-X:' + e.innerText.slice(0, 40)); if (e.children.length === 0 && e.innerText && e.scrollWidth > e.clientWidth + 2 && /hidden|clip/.test(getComputedStyle(e).overflowX)) r.push('CLIPPED:' + e.innerText.slice(0, 40)); }); return [...new Set(r)].slice(0, 15); });
  return { shot: f, info, weird, overflow: ov, errs: s.errs.splice(0), cons: s.cons.splice(0), els: s.els.map((e, i) => `${i}|${e.tag}|${e.t}|${e.x},${e.y}|${e.w}x${e.h}${e.covered ? '|COVERED' : ''}${e.dis ? '|DISABLED' : ''}`) };
}
async function tap(s, x, y) { if (s.mobile) await s.p.touchscreen.tap(x, y); else await s.p.mouse.click(x, y); }
async function handle(q) {
  const s = S[q.id];
  switch (q.cmd) {
    case 'new': return newSess(q.id, +q.w || 375, +q.h || 812, q.mobile === '1');
    case 'look': return look(s, q.id, q.name);
    case 'tap': { const e = s.els[+q.i]; await tap(s, e.x, e.y); await sleep(+q.wait || 350); return q.nolook ? 'tapped ' + e.t : look(s, q.id, q.name || ('tap-' + e.t.slice(0, 20))); }
    case 'tapxy': await tap(s, +q.x, +q.y); await sleep(350); return q.nolook ? 'ok' : look(s, q.id, q.name);
    case 'text': { const re = new RegExp(q.re, 'i'); s.els = await elements(s); const cands = s.els.filter((e) => re.test(e.t) && !e.covered); const e = cands[+(q.k || 0)]; if (!e) return 'NOTFOUND ' + q.re; for (let i = 0; i < (+q.times || 1); i++) await tap(s, e.x, e.y); await sleep(+q.wait || 350); return q.nolook ? 'tapped ' + e.t : look(s, q.id, q.name || ('tap-' + e.t.slice(0, 20))); }
    case 'type': { const e = s.els[+q.i]; await tap(s, e.x, e.y); await s.p.keyboard.down('Control'); await s.p.keyboard.press('a'); await s.p.keyboard.up('Control'); await s.p.keyboard.press('Backspace'); await s.p.keyboard.type(q.v); if (q.enter) await s.p.keyboard.press('Enter'); await sleep(300); return look(s, q.id, q.name || 'type'); }
    case 'key': await s.p.keyboard.press(q.k); return look(s, q.id, q.name || 'key');
    case 'scroll': await s.p.evaluate((dy) => { const m = [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return /(auto|scroll)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 5 && r.height > 100 && r.width > 0; }).pop(); if (m) m.scrollBy(0, dy); else scrollBy(0, dy); }, +q.dy || 500); return look(s, q.id, q.name || 'scroll');
    case 'top': await s.p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }); return look(s, q.id, q.name || 'top');
    case 'dump': return s.p.evaluate(() => document.body.innerText);
    case 'reload': await s.p.reload({ waitUntil: 'networkidle0' }).catch((e) => s.errs.push('RELOADFAIL ' + e.message)); return look(s, q.id, q.name || 'reload');
    case 'back': await s.p.goBack().catch(() => {}); await sleep(500); return look(s, q.id, q.name || 'back');
    case 'viewport': await s.p.setViewport({ width: +q.w, height: +q.h, isMobile: s.mobile, hasTouch: s.mobile }); return look(s, q.id, q.name || 'viewport');
    case 'offline': await s.p.setOfflineMode(q.on === '1'); return 'offline=' + q.on;
    case 'prompt': s.promptAnswer = q.v; return 'ok';
    case 'confirmno': s.confirmNo = q.on === '1'; return 'ok';
    case 'eval': return JSON.stringify(await s.p.evaluate(q.js));
    case 'newtab': { const p2 = await s.ctx.newPage(); await p2.setViewport(s.p.viewport()); s.hook(p2); await p2.goto(URL0, { waitUntil: 'networkidle0' }).catch((e) => s.errs.push('GOTOFAIL ' + e.message)); s.p = p2; return look(s, q.id, q.name || 'newtab'); }
  }
}
(async () => {
  br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); const q = Object.fromEntries(u.searchParams); q.cmd = u.pathname.slice(1);
    try { const r = await handle(q); res.end(typeof r === 'string' ? r : JSON.stringify(r)); } catch (e) { res.end('ERR ' + e.stack); }
  }).listen(18791, '127.0.0.1', () => console.log('driver on 8790'));
})();
