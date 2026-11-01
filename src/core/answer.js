// Ответ ребёнка: верно ли, близко ли, и не та ли это орфографическая ошибка в верном слове.
import { normalize, keepYo } from './solve.js';

export function isCorrect(rebus, input) {
  const n = normalize(input);
  if (!n) return false;
  return [rebus.answer].concat(rebus.accept || []).some(function (a) {
    return normalize(a) === n;
  });
}

// Расстояние Левенштейна: насколько ответ похож на правильный.
function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Неверный ответ, но близко к правильному (не больше двух букв не так) — «Почти!».
export function isClose(rebus, input) {
  const n = normalize(input);
  return [rebus.answer].concat(rebus.accept || []).some((a) => distance(normalize(a), n) <= 2);
}

// --- Орфография: слово угадано, но написано с детской ошибкой («ВАРОНА» вместо «ВОРОНА»).
// Такая попытка засчитывается как ошибка, но ребёнку показываем, как слово пишется.
// Сравниваем «на слух»: стираем то, в чём дети чаще всего ошибаются.
const VOICED = { Б: 'П', В: 'Ф', Г: 'К', Д: 'Т', Ж: 'Ш', З: 'С' };
const VOWEL = { О: 'А', Е: 'И', Я: 'И', Э: 'И', Ю: 'У' };
// Какая согласная может «пропасть» на слух и перед чем: СОЛНЦЕ, ЛЕСТНИЦА, СЕРДЦЕ, ЧУВСТВО.
const SILENT = { Л: 'Н', Т: 'НЛСЦК', Ф: 'СТ' };

export function soundKey(word) {
  let w = normalize(word).replace(/[^А-Я]/g, '')
    .replace(/[ЬЪ]/g, '')
    .replace(/Й/g, 'И')
    .replace(/([ЖШЦЧЩ])Ы/g, '$1И')        // ЖЫ, ШЫ, ЦЫ, ЩЫ
    .replace(/([ЧЩ])Я/g, '$1А')           // ЧЯ, ЩЯ
    .replace(/([ЧЩ])Ю/g, '$1У')           // ЧЮ, ЩЮ
    .replace(/Щ/g, 'Ш');
  // Звонкая на конце слова и перед согласной звучит глухо: ДУБ — «ДУП», ЛОЖКА — «ЛОШКА».
  w = w.replace(/[БВГДЖЗ](?=$|[БВГДЖЗКПСТФХЦЧШЩ])/g, (c) => VOICED[c]);
  w = w.replace(/[ОЕЯЭЮ]/g, (c) => VOWEL[c]);
  return w.replace(/(.)\1+/g, '$1');      // удвоенные: КЛАСС — «КЛАС»
}

// Непроизносимые согласные: СОЛНЦЕ — «СОНЦЕ», ЛЕСТНИЦА — «ЛЕСНИЦА».
function dropsSilent(key, answerKey) {
  if (answerKey.length !== key.length + 1) return false;
  for (let i = 0; i < answerKey.length; i++) {
    if (answerKey.slice(0, i) + answerKey.slice(i + 1) === key) {
      return i > 0 && (SILENT[answerKey[i]] || '').includes(answerKey[i + 1] || '-');
    }
  }
  return false;
}

// Если ответ — это правильное слово с орфографической ошибкой, возвращает,
// как его правильно писать (с Ё, как в наборе). Иначе null.
export function spellingFix(rebus, input) {
  const n = normalize(input);
  if (n.length < 2 || /[^А-Я]/.test(n) || isCorrect(rebus, input)) return null;
  const not = (rebus.notMisspelled || []).map(normalize);
  if (not.includes(n)) return null;
  const key = soundKey(n);
  for (const a of [rebus.answer].concat(rebus.accept || [])) {
    const ak = soundKey(a);
    if (ak === key || dropsSilent(key, ak)) return keepYo(a);
  }
  return null;
}

// Какие буквы правильного слова ребёнок написал не так (номера с 0): выравнивание
// по расстоянию Левенштейна. Лишние буквы ребёнка в правильном слове не отметить —
// тогда отмечаем соседнюю.
export function spellingMarks(correct, input) {
  const a = normalize(correct);
  const b = normalize(input);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const marks = new Set();
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) marks.add(i - 1);
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      marks.add(i - 1); i--;               // ребёнок пропустил букву
    } else {
      marks.add(Math.min(Math.max(i - 1, 0), a.length - 1)); j--; // лишняя буква ребёнка
    }
  }
  return [...marks].sort((x, y) => x - y);
}
