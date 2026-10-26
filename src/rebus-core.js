// Логика ребусов: используется в приложении и в tools/validate.mjs.

// Приводит ответ к сравнимому виду: регистр, Ё→Е, без пробелов и знаков.
export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^А-ЯA-Z0-9]/g, '');
}

export const PREPOSITIONS = ['В', 'НА'];

// Буквы, которые даёт одна часть ребуса.
// Картинка и число: переворот → замены букв → замены по номеру → зачёркивание
// → цифры над картинкой (какие буквы и в каком порядке) → запятые.
export function partLetters(part) {
  switch (part.type) {
    case 'letters':
      return normalize(part.text);
    case 'initials': // первые буквы картинок
      return (part.items || []).map((it) => normalize(it.word).charAt(0)).join('');
    case 'position': { // «ДА в О» = В-О-ДА, «СО в А» = СО-В-А, «ПА на МА» = ПА-НА-МА
      const prep = normalize(part.prep), outer = normalize(part.outer), inner = normalize(part.inner);
      return part.prepFirst ? prep + outer + inner : inner + prep + outer;
    }
    default:
      return wordLetters(part);
  }
}

function wordLetters(part) {
  let w = normalize(part.word);
  if (part.flip) w = w.split('').reverse().join('');
  (part.replace || []).forEach(function (pair) {
    w = w.split(normalize(pair[0])).join(normalize(pair[1]));
  });
  (part.replaceAt || []).forEach(function (pair) {
    const i = pair[0] - 1;
    if (i >= 0 && i < w.length) w = w.slice(0, i) + normalize(pair[1]) + w.slice(i + 1);
  });
  (part.remove || []).forEach(function (ch) {
    const i = w.indexOf(normalize(ch));
    if (i >= 0) w = w.slice(0, i) + w.slice(i + 1);
  });
  if (part.pick) w = part.pick.map((n) => w.charAt(n - 1)).join('');
  const start = part.cutStart || 0;
  const end = part.cutEnd || 0;
  return w.slice(start, w.length - end);
}

export function solve(rebus) {
  return rebus.parts.map(partLetters).join('');
}

export function isCorrect(rebus, input) {
  const n = normalize(input);
  if (!n) return false;
  return [rebus.answer].concat(rebus.accept || []).some(function (a) {
    return normalize(a) === n;
  });
}


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
      else if (part.items.some((it) => !it || !it.emoji || !normalize(it.word))) p.push('у картинки в items нет emoji или word');
      break;
    case 'position':
      if (!PREPOSITIONS.includes(normalize(part.prep))) p.push('prep должен быть ' + PREPOSITIONS.join(' или '));
      if (!normalize(part.outer) || !normalize(part.inner)) p.push('нет outer или inner');
      break;
    case 'number':
      if (!/^\d+$/.test(String(part.value || ''))) p.push('value должно быть числом');
      if (!len) p.push('нет word');
      if (part.flip || part.pick || part.replace || part.replaceAt || part.remove) p.push('у числа можно только запятые');
      break;
    default: // pic
      if (!part.emoji || !len) p.push('нет emoji или word');
      if (part.pick) {
        if (part.cutStart || part.cutEnd) p.push('pick нельзя вместе с запятыми');
        if (!Array.isArray(part.pick) || !part.pick.length || part.pick.some((n) => !Number.isInteger(n) || n < 1 || n > len)) p.push('pick — номера букв слова');
        else if (new Set(part.pick).size !== part.pick.length) p.push('pick: номера не должны повторяться');
      }
      if (part.replaceAt && part.replaceAt.some((r) => !Array.isArray(r) || !Number.isInteger(r[0]) || r[0] < 1 || r[0] > len || !normalize(r[1]))) p.push('replaceAt — пары [номер буквы, новая буква]');
  }
  return p;
}

// Ошибки формата одного ребуса (пустой список — всё в порядке).
// Используется и при загрузке в браузере, и в tools/validate.mjs.
export function formatProblems(r) {
  if (!r || typeof r !== 'object') return ['не объект'];
  const p = [];
  if (typeof r.id !== 'string' || !r.id) p.push('нет id');
  if (typeof r.answer !== 'string' || !normalize(r.answer)) p.push('нет answer');
  if (![1, 2, 3].includes(r.level)) p.push('level должен быть 1, 2 или 3');
  if (typeof r.hint !== 'string' || !r.hint.trim()) p.push('нет hint');
  if (!Array.isArray(r.parts) || !r.parts.length) return p.concat('нет parts');
  r.parts.forEach((part, i) => partProblems(part).forEach((x) => p.push(`часть ${i + 1}: ${x}`)));
  if (!p.length && solve(r) !== normalize(r.answer)) {
    p.push(`ответ ${r.answer}, а по картинке выходит ${solve(r)}`);
  }
  return p;
}

// Приёмы записи в ребусе — для легенды, чередования и статистики.
export function techniques(rebus) {
  const t = new Set();
  for (const p of rebus.parts || []) {
    if (p.type === 'initials') t.add('initials');
    else if (p.type === 'position') t.add(normalize(p.prep) === 'НА' ? 'on' : 'in');
    else if (p.type === 'number') { t.add('number'); if (p.cutStart || p.cutEnd) t.add('comma'); }
    else if (p.type === 'pic') {
      if (p.cutStart || p.cutEnd) t.add('comma');
      if (p.remove && p.remove.length) t.add('remove');
      if (p.replace && p.replace.length) t.add('replace');
      if (p.replaceAt && p.replaceAt.length) t.add('replaceAt');
      if (p.pick) t.add('pick');
      if (p.flip) t.add('flip');
    }
  }
  if (!t.size) t.add('plain'); // картинки и буквы целиком
  return [...t];
}

// Список ребусов из содержимого public/data/rebuses.json.
export function rebusList(json) {
  if (!json || !Array.isArray(json.rebuses)) throw new Error('ожидается { "rebuses": [...] }');
  return json.rebuses;
}
