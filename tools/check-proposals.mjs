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
let warns = 0;

// «Обычно»-правила: нарушение — ошибка, если в замысле нет exceptions.<правило> с причиной
// (docs/REBUSES.md, «Как устроены правила»).
const accepted = [];
function should(r, p, rule, msg) {
  const why = r.exceptions && typeof r.exceptions[rule] === 'string' && r.exceptions[rule].trim();
  if (why) accepted.push(`${r.id}: ${rule} — ${why}`);
  else p.push(`${msg} [правило ${rule}; можно отступить через exceptions.${rule} с причиной]`);
}

// Содержательные правила, которые можно проверить механически (выводы редактора, data/proposals/REVIEW.md).
const allAnswers = () => new Set(words);
function contentProblems(r, a) {
  const p = [];
  const others = [...allAnswers()].filter((w) => w !== a && w.length >= 3);
  // Ответ встраивает другой ответ набора или замыслов (КОСА ← ОСА).
  const inside = others.filter((w) => a.includes(w));
  if (inside.length) should(r, p, 'embedded', `ответ встраивает другой ответ: ${inside.join(', ')}`);
  const walkPics = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.pic) walkPics.push(n);
    (n.initials || []).forEach((it) => walkPics.push({ ...it, inInitials: true }));
    (n.seq || []).forEach(visit); visit(n.a); visit(n.b);
  };
  (r.parts || []).forEach(visit);
  for (const pic of walkPics) {
    const w = normalize(pic.pic);
    const plain = !['cutStart', 'cutEnd', 'remove', 'replace', 'replaceAt', 'pick', 'flip'].some((k) => pic[k] !== undefined);
    // Ответ вырастает из картинки: слово картинки + окончание/суффикс (ДОМ → ДОМИК, СЛОН → СЛОНЁНОК) —
    // скорее всего однокоренное. Буква спереди (Ч + ЁЛКА, Г + РОЗА) даёт другое слово — это можно.
    if (!pic.inInitials && plain && a.startsWith(w) && a.length > w.length) { console.log(`! ${r.id}: ответ начинается со слова картинки ${w} — не однокоренное ли? (решает редактор)`); warns++; }
    // В описании картинки — только предмет: операции, буквы и цифры рисует приложение (docs/ILLUSTRATIONS.md).
    if (/зач[её]рк|вверх ногами|перев[её]рн|перевернут|цифр|букв|[=↺]/i.test(pic.look || '')) { console.log(`! ${r.id}: look картинки ${w} — описывайте только предмет: операции, буквы и цифры рисует приложение`); warns++; }
    // Зеркальная пара: картинкой стоит ответ набора или замыслов — предупреждение (развести по этапам).
    if (others.includes(w)) { console.log(`! ${r.id}: картинка ${w} — это ответ другого ребуса (зеркальная пара, развести по этапам)`); warns++; }
    if (/на фоне|\bфон|на воде|рядом с/i.test(pic.look || '')) { console.log(`! ${r.id}: look картинки ${w} — один предмет без фона и соседей`); warns++; }
  }
  return p;
}
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
    if (!p.length) p.push(...contentProblems(r, a));
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
{ const fresh = words.slice(existing.length), known = new Set(existing.map((r) => normalize(r.answer)));
  const rep = fresh.filter((w) => known.has(w)).length;
  if (fresh.length) console.log(`новые слова: ${fresh.length - rep}, повторы слов набора: ${rep} — ориентир на новые слова`); }
{ const sp = spread(words); if (sp.peaks.length) console.log('пики частотности слов:', sp.peaks.map(([w, n]) => `${w} ×${n}`).join(', ')); }
accepted.forEach((x) => console.log('~ исключение:', x));
console.log(`замыслов: ${total}, проблем: ${problems}${warns ? `, предупреждений: ${warns}` : ''}${pending ? `, ждут обработчика: ${pending}` : ''}`);
if (process.argv.includes('--stats')) {
  console.log('приёмы:', Object.entries(tech).sort().map(([k, n]) => `${k} ×${n}`).join(', '));
  console.log('картинки для дизайнера:', [...pics].map(([w, l]) => `${w} (${l})`).join('; '));
}
process.exit(problems ? 1 : 0);
