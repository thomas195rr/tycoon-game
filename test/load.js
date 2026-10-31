// Loads the game modules into Node (same order as index.html) and returns the TG namespace.
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const FILES = ['core', 'config', 'config-businesses', 'config-businesses2', 'config-extras', 'config-crime', 'config-v6', 'config-v10', 'world', 'industry', 'pricing', 'work', 'property', 'staff', 'equipment', 'finance', 'credit', 'business', 'models', 'models2', 'farm', 'herd', 'managers', 'realestate', 'invest', 'crime', 'ledger', 'engine', 'v10'];
module.exports = function load() {
  delete globalThis.TG;
  for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
  return globalThis.TG;
};
module.exports.FILES = FILES;
