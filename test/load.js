// Loads the game modules into Node (same order as index.html) and returns the TG namespace.
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const FILES = ['core', 'config', 'config-businesses', 'config-businesses2', 'config-extras', 'world', 'pricing', 'work', 'property', 'staff', 'equipment', 'finance', 'business', 'models', 'models2', 'managers', 'realestate', 'invest', 'engine'];
module.exports = function load() {
  delete globalThis.TG;
  for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
  return globalThis.TG;
};
module.exports.FILES = FILES;
