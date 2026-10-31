// Проверка замыслов ребусов: npm run proposals [-- файл.json]
// Без аргумента — все data/proposals/*.json. Схема — docs/REBUS-SPEC.md.
import fs from 'node:fs';
import { LEGEND_WORDS, normalize } from '../src/rebus-core.js';
import { specProblems, specPictures, specTechniques, solveSpec } from './rebus-spec.mjs';
import { diversity, report } from './diversity.mjs';

const dir = new URL('../data/proposals/', import.meta.url);
const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));
const list = files.length ? files : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => new URL(f, dir).pathname);
const existing = JSON.parse(fs.readFileSync(new URL('../public/data/rebuses.json', import.meta.url), 'utf8')).rebuses;
const answers = new Set(existing.map((r) => normalize(r.answer)));

let problems = 0, total = 0, pending = 0;
// Образцы схемы: расширение схемы не должно ломать то, что уже решалось.
const fixtures = JSON.parse(fs.readFileSync(new URL('./spec-fixtures.json', import.meta.url), 'utf8')).fixtures;
for (const f of fixtures) {
  const got = solveSpec(f), tech = specTechniques(f).join(', ');
  if (got !== normalize(f.answer)) { console.log(`✗ образец ${f.answer}: выходит ${got} — изменение схемы сломало старые замыслы`); problems++; }
  if (tech !== [...f.techniques].sort().join(', ')) { console.log(`✗ образец ${f.answer}: приёмы [${tech}], было [${f.techniques}]`); problems++; }
}
const pics = new Map();
const tech = {};
for (const f of list) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  const seen = new Set();
  for (const r of json.proposals || []) {
    total++;
    let p = specProblems(r, { answers, legend: LEGEND_WORDS });
    // Новый вид узла, которого схема ещё не знает, — не ошибка: замысел ждёт обработчика.
    if (p.length && p.every((x) => x.includes('пока не поддержан'))) {
      console.log(`… ${r.id}: ${p.join('; ')}`);
      pending++; continue;
    }
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
// Разнообразие замыслов по уровням — ошибка, если приём больше двух честных долей.
const all = list.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).proposals || [])
  .filter((r) => solveSpec(r) !== null);
for (const l of [1, 2, 3]) {
  const d = diversity(all.filter((r) => r && r.level === l && Array.isArray(r.parts)).map(specTechniques));
  if (!d.total) continue;
  if (d.over.length) { console.log('✗ ' + report(`уровень ${l}`, d)); problems += d.over.length; }
}
console.log(`замыслов: ${total}, проблем: ${problems}${pending ? `, ждут обработчика: ${pending}` : ''}`);
if (process.argv.includes('--stats')) {
  console.log('приёмы:', Object.entries(tech).sort().map(([k, n]) => `${k} ×${n}`).join(', '));
  console.log('картинки для дизайнера:', [...pics].map(([w, l]) => `${w} (${l})`).join('; '));
}
process.exit(problems ? 1 : 0);
