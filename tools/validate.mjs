// Проверка данных: node tools/validate.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const core = require('../js/rebus-core.js');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../data/rebuses.js', import.meta.url), 'utf8'), ctx);
const list = ctx.window.REBUSES || [];
let bad = 0;
const ids = new Set();
for (const r of list) {
  if (ids.has(r.id)) { console.log('DUP id', r.id); bad++; }
  ids.add(r.id);
  const got = core.solve(r);
  if (got !== core.normalize(r.answer)) {
    console.log(`FAIL ${r.id}: answer=${r.answer} solve=${got}`);
    bad++;
  }
}
console.log(`${list.length} rebuses, ${bad} problems`);
process.exit(bad ? 1 : 0);
