// usage: node rep.js spec.txt   spec: "@@@ FILE path" lines, then blocks "<<<\nfind\n>>>\nreplacement\n==="
const fs = require('fs');
const txt = fs.readFileSync(process.argv[2], 'utf8');
let file = null, ok = 0, bad = 0;
const re = /@@@ FILE (.+)\n|<<<\n([\s\S]*?)\n>>>\n([\s\S]*?)\n===\n/g;
let m;
while ((m = re.exec(txt))) {
  if (m[1]) { file = m[1].trim(); continue; }
  const s = fs.readFileSync(file, 'utf8');
  const n = s.split(m[2]).length - 1;
  if (n !== 1) { console.log(`FAIL (${n} matches) in ${file}: ${m[2].slice(0, 80)}`); bad++; continue; }
  fs.writeFileSync(file, s.replace(m[2], () => m[3])); ok++;
}
console.log(`replaced ${ok}, failed ${bad}`);
