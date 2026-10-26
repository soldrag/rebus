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

