const fs = require('fs');
const [file, marker, part] = process.argv.slice(2);
let s = fs.readFileSync(file, 'utf8');
const i = s.indexOf(marker);
if (i < 0) { console.log('marker not found'); process.exit(1); }
const j = s.indexOf('\n', i) + 1;
s = s.slice(0, j) + fs.readFileSync(part, 'utf8') + s.slice(j);
fs.writeFileSync(file, s);
console.log('inserted');
