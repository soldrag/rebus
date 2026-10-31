// Проверка замыслов ребусов: npm run proposals [-- файл.json]
// Без аргумента — все data/proposals/*.json. Схема — docs/REBUS-SPEC.md.
import fs from 'node:fs';
import { LEGEND_WORDS, normalize } from '../src/rebus-core.js';
import { specProblems, specPictures, specTechniques } from './rebus-spec.mjs';

const dir = new URL('../data/proposals/', import.meta.url);
const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));
const list = files.length ? files : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => new URL(f, dir).pathname);
const existing = JSON.parse(fs.readFileSync(new URL('../public/data/rebuses.json', import.meta.url), 'utf8')).rebuses;
const answers = new Set(existing.map((r) => normalize(r.answer)));

let problems = 0, total = 0;
const pics = new Map();
const tech = {};
for (const f of list) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  const seen = new Set();
  for (const r of json.proposals || []) {
    total++;
    const p = specProblems(r, { answers, legend: LEGEND_WORDS });
    if (seen.has(normalize(r.answer))) p.push('повтор ответа в замыслах');
    seen.add(normalize(r.answer));
    p.forEach((x) => console.log(`✗ ${r.id || '?'}: ${x}`));
    problems += p.length;
    if (!p.length) {
      const key = r.level + ': ' + specTechniques(r).join('+');
      tech[key] = (tech[key] || 0) + 1;
      for (const pic of specPictures(r)) pics.set(pic.word, pic.look);
    }
  }
}
console.log(`замыслов: ${total}, проблем: ${problems}`);
if (process.argv.includes('--stats')) {
  console.log('приёмы:', Object.entries(tech).sort().map(([k, n]) => `${k} ×${n}`).join(', '));
  console.log('картинки для дизайнера:', [...pics].map(([w, l]) => `${w} (${l})`).join('; '));
}
process.exit(problems ? 1 : 0);
