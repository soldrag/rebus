// Проверка замыслов ребусов: npm run proposals [-- файл.json]
// Без аргумента — все data/proposals/*.json. Схема — docs/REBUS-SPEC.md.
import fs from 'node:fs';
import { LEGEND_WORDS, normalize, techniques } from '../src/rebus-core.js';
import { specProblems, specPictures, specTechniques, solveSpec, specTricks, setTricks, specSkeleton } from './rebus-spec.mjs';
import { paused, report, canon, spread, wouldPeak } from './diversity.mjs';

const dir = new URL('../data/proposals/', import.meta.url);
const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));
const list = files.length ? files : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => new URL(f, dir).pathname);
const existing = JSON.parse(fs.readFileSync(new URL('../public/data/rebuses.json', import.meta.url), 'utf8')).rebuses;
// Частотность слов-ответов (набор + замыслы выше по списку): одно слово можно загадать
// разными ребусами, лишь бы не было пиков (tools/diversity.mjs, spread).
const words = existing.map((r) => normalize(r.answer));
// Ходы набора и уже записанных замыслов: повтор хода — повтор идеи (ошибка).
const tricks = new Map();
existing.forEach((r) => setTricks(r).forEach((t) => tricks.set(t, `набор: ${r.id}`)));
const skeletons = new Map();

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
  for (const r of json.proposals || []) {
    total++;
    let p = specProblems(r, { legend: LEGEND_WORDS });
    // Новый вид узла, которого схема ещё не знает, — не ошибка: замысел ждёт обработчика.
    if (p.length && p.every((x) => x.includes('пока не поддержан'))) {
      console.log(`… ${r.id}: ${p.join('; ')}`);
      pending++; continue;
    }
    if (!p.length) {
      const sk = specSkeleton(r);
      if (skeletons.has(sk)) p.push(`тот же ребус, что ${skeletons.get(sk)}`);
      for (const t of specTricks(r)) if (tricks.has(t)) p.push(`ход ${t} уже есть (${tricks.get(t)}) — придумайте другой`);
    }
    const a = normalize(r.answer);
    if (wouldPeak(words, a)) p.push(`слово ${a} уже загадано (×${words.filter((w) => w === a).length}) — ещё один ребус на него дал бы пик частотности, придумайте другое слово`);
    if (!p.length) words.push(a);
    p.forEach((x) => console.log(`✗ ${r.id || '?'}: ${x}`));
    problems += p.length;
    if (!p.length) {
      skeletons.set(specSkeleton(r), r.id);
      specTricks(r).forEach((t) => tricks.set(t, `замысел ${r.id}`));
    }
    if (!p.length) {
      const key = r.level + ': ' + specTechniques(r).join('+');
      tech[key] = (tech[key] || 0) + 1;
      for (const pic of specPictures(r)) pics.set(pic.word, pic.look);
    }
  }
}
// Разнообразие: набор расширяем, а не переделываем — приёмы, перекошенные в будущем наборе
// (текущий + замыслы), на паузе; замысел с таким приёмом — ошибка (tools/diversity.mjs).
const all = list.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).proposals || [])
  .filter((r) => r && solveSpec(r) !== null);
for (const l of [1, 2, 3]) {
  const pr = all.filter((r) => r.level === l);
  if (!pr.length) continue;
  const { d, types } = paused(existing.filter((r) => r.level === l).map(techniques), pr.map(specTechniques));
  const hits = pr.filter((r) => canon(specTechniques(r)).some((t) => types.has(t)));
  if (hits.length) {
    console.log(report(`уровень ${l}: набор + замыслы`, d));
    hits.forEach((r) => console.log(`✗ ${r.id}: приём ${canon(specTechniques(r)).filter((t) => types.has(t)).join(', ')} на паузе — придумайте другой`));
    problems += hits.length;
  }
}
{ const sp = spread(words); if (sp.peaks.length) console.log('пики частотности слов:', sp.peaks.map(([w, n]) => `${w} ×${n}`).join(', ')); }
console.log(`замыслов: ${total}, проблем: ${problems}${pending ? `, ждут обработчика: ${pending}` : ''}`);
if (process.argv.includes('--stats')) {
  console.log('приёмы:', Object.entries(tech).sort().map(([k, n]) => `${k} ×${n}`).join(', '));
  console.log('картинки для дизайнера:', [...pics].map(([w, l]) => `${w} (${l})`).join('; '));
}
process.exit(problems ? 1 : 0);
