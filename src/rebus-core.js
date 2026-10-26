// Логика ребусов: используется в приложении и в tools/validate.mjs.

// Приводит ответ к сравнимому виду: регистр, Ё→Е, без пробелов и знаков.
export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^А-ЯA-Z0-9]/g, '');
}

// Буквы, которые даёт одна часть ребуса.
// Порядок: переворот → замены → зачёркивание → запятые.
export function partLetters(part) {
  if (part.type === 'letters') return normalize(part.text);
  let w = normalize(part.word);
  if (part.flip) w = w.split('').reverse().join('');
  (part.replace || []).forEach(function (pair) {
    w = w.split(normalize(pair[0])).join(normalize(pair[1]));
  });
  (part.remove || []).forEach(function (ch) {
    const i = w.indexOf(normalize(ch));
    if (i >= 0) w = w.slice(0, i) + w.slice(i + 1);
  });
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


const PART_TYPES = ['pic', 'letters'];

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
  r.parts.forEach((part, i) => {
    if (!part || !PART_TYPES.includes(part.type)) p.push(`часть ${i + 1}: неизвестный type`);
    else if (part.type === 'pic' && (!part.emoji || !normalize(part.word))) p.push(`часть ${i + 1}: нет emoji или word`);
    else if (part.type === 'letters' && !normalize(part.text)) p.push(`часть ${i + 1}: нет text`);
  });
  if (!p.length && solve(r) !== normalize(r.answer)) {
    p.push(`ответ ${r.answer}, а по картинке выходит ${solve(r)}`);
  }
  return p;
}

// Список ребусов из содержимого public/data/rebuses.json.
export function rebusList(json) {
  if (!json || !Array.isArray(json.rebuses)) throw new Error('ожидается { "rebuses": [...] }');
  return json.rebuses;
}
