// Build a single self-contained HTML file: dist/tycoon.html (inlines css + all js in index.html order).
//   node tools/build.js
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>/* ${f} */\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
// single-file build: no manifest (file:// cannot load it); icons inlined as data URIs
html = html.replace(/<link rel="manifest"[^>]*>\n?/g, '').replace(/<script>\/\* app manifest[^<]*<\/script>\n?/g, '');
html = html.replace(/<link rel="(icon|apple-touch-icon)" href="([^"]+)">/g, (_, r, f) => `<link rel="${r}" href="data:image/png;base64,${fs.readFileSync(path.join(root, f)).toString('base64')}">`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'tycoon.html'), html);
console.log(`dist/tycoon.html written (${(html.length / 1024).toFixed(0)} KB)`);
