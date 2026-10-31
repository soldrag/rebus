// Орфография: какие настоящие слова звучат как ответ, но ошибкой не считаются.
//
// Приложение показывает «Пишется так: ВОРОНА», если ребёнок написал ответ с детской
// ошибкой (src/rebus-core.js, spellingFix). Но «ПЛОТ» — не ошибка в слове ПЛОД, а другое
// слово: ребёнок не угадал, и показывать ему ответ нельзя. Такие слова ищем в словаре
// (dictionary-ru, Hunspell, только при сборке — в приложение не попадает) и пишем
// в поле notMisspelled ребуса.
//
//   npm run spelling          — заполнить notMisspelled в public/data/rebuses.json
//   npm run validate          — проверяет, что ничего не пропущено
import fs from 'node:fs';
import ru from 'dictionary-ru';
import { normalize, soundKey, rebusList } from '../src/rebus-core.js';

let index = null;
function dictionary() {
  if (index) return index;
  const dic = new TextDecoder().decode(ru.dic);
  index = new Map();
  for (const line of dic.split('\n').slice(1)) {
    const w = normalize(line.split('/')[0]);
    if (!/^[А-Я]{2,}$/.test(w)) continue;
    const k = soundKey(w);
    if (!index.has(k)) index.set(k, new Set());
    index.get(k).add(w);
  }
  return index;
}

// Слова, которые надо записать в notMisspelled ребуса: из словаря и из других ответов набора.
export function confusables(rebus, all) {
  const dict = dictionary();
  const own = [rebus.answer].concat(rebus.accept || []).map(normalize);
  const out = new Set();
  for (const a of own) {
    for (const w of dict.get(soundKey(a)) || []) out.add(w);
    for (const r of all) {
      for (const b of [r.answer].concat(r.accept || []).map(normalize)) if (soundKey(b) === soundKey(a)) out.add(b);
    }
  }
  own.forEach((w) => out.delete(w));
  return [...out].sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = new URL('../public/data/rebuses.json', import.meta.url);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = rebusList(json);
  let changed = 0;
  for (const r of list) {
    const need = confusables(r, list);
    const before = JSON.stringify(r.notMisspelled || []);
    if (need.length) r.notMisspelled = need; else delete r.notMisspelled;
    if (JSON.stringify(r.notMisspelled || []) !== before) { changed++; console.log(r.id, r.answer, '→', need.join(' ') || '—'); }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`обновлено ребусов: ${changed}`);
}
