// Формат ребуса в public/data/rebuses.json: можно ли его нарисовать и решить.
// Это проверка при загрузке в браузере: ребус с такой ошибкой приложение пропускает.
// Правила автора (подсказка, тема, разметка приёмов, Ё/Е, как читается предлог и т. п.)
// проверяет только tools/validate.mjs (tools/rules.mjs, rebusProblems) — до сборки.
import { normalize, POSITIONS, PREPOSITIONS, innerPart, outerPart, solve } from './solve.js';

const PART_TYPES = ['pic', 'letters', 'number', 'initials', 'position'];

function partProblems(part) {
  if (!part || !PART_TYPES.includes(part.type)) return ['неизвестный type'];
  const p = [];
  const len = normalize(part.word).length;
  switch (part.type) {
    case 'letters':
      if (!normalize(part.text)) p.push('нет text');
      break;
    case 'initials':
      if (!Array.isArray(part.items) || part.items.length < 2) p.push('нужно хотя бы 2 картинки в items');
      else if (part.items.some((it) => !it || !(it.emoji || it.image) || !normalize(it.word))) p.push('у картинки в items нет emoji/image или word');
      break;
    case 'position': {
      if (!PREPOSITIONS.includes(normalize(part.prep))) p.push('prep должен быть ' + PREPOSITIONS.join(', '));
      const prep = normalize(part.prep);
      const inner = innerPart(part), outer = outerPart(part);
      for (const [key, slot] of [['inner', inner], ['outer', outer]]) {
        if (!slot) continue;
        if (!['pic', 'number', 'initials'].includes(slot.type)) p.push(key + ' — буквы, картинка, число или первые буквы');
        else partProblems(slot).forEach((x) => p.push(key + ': ' + x));
      }
      // У «В» и «ИЗ» outer рисуется контуром-вместилищем, а картинку контуром не нарисовать.
      if (outer && POSITIONS[prep] && POSITIONS[prep].container) p.push(`outer у «${prep.toLowerCase()}» рисуется контуром — только буквы`);
      if ((!outer && !normalize(part.outer)) || (!inner && !normalize(part.inner))) p.push('нет outer или inner');
      break;
    }
    case 'number':
      if (!/^\d+$/.test(String(part.value || ''))) p.push('value должно быть числом');
      if (!len) p.push('нет word');
      break;
    default: // pic
      if (!(part.emoji || part.image) || !len) p.push('нет emoji/image или word');
      if (part.pick && (!Array.isArray(part.pick) || !part.pick.length || part.pick.some((n) => !Number.isInteger(n) || n < 1 || n > len))) p.push('pick — номера букв слова');
      if (part.replaceAt && part.replaceAt.some((r) => !Array.isArray(r) || !Number.isInteger(r[0]) || r[0] < 1 || r[0] > len || !normalize(r[1]))) p.push('replaceAt — пары [номер буквы, новая буква]');
  }
  return p;
}

// Можно ли ребус нарисовать: поля на месте и каждая часть понятна.
export function shapeProblems(r) {
  if (!r || typeof r !== 'object') return ['не объект'];
  const p = [];
  if (typeof r.id !== 'string' || !r.id) p.push('нет id');
  if (typeof r.answer !== 'string' || !normalize(r.answer)) p.push('нет answer');
  if (![1, 2, 3].includes(r.level)) p.push('level должен быть 1, 2 или 3');
  if (!Array.isArray(r.parts) || !r.parts.length) return p.concat('нет parts');
  r.parts.forEach((part, i) => partProblems(part).forEach((x) => p.push(`часть ${i + 1}: ${x}`)));
  return p;
}

// Нарисованный ребус складывается в свой ответ.
export const solveProblems = (r) => (solve(r) === normalize(r.answer) ? [] : [`ответ ${r.answer}, а по картинке выходит ${solve(r)}`]);

// Ошибки формата одного ребуса (пустой список — ребус можно нарисовать и решить).
export function formatProblems(r) {
  const p = shapeProblems(r);
  return p.length ? p : solveProblems(r);
}

// Список ребусов из содержимого public/data/rebuses.json.
export function rebusList(json) {
  if (!json || !Array.isArray(json.rebuses)) throw new Error('ожидается { "rebuses": [...] }');
  return json.rebuses;
}
