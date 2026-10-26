// Логика ребусов: используется в приложении и в tools/validate.mjs.

// Приводит ответ к сравнимому виду: регистр, Ё→Е, без пробелов и знаков.
export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^А-ЯA-Z0-9]/g, '');
}

// Как normalize, но Ё остаётся Ё — для проверки, что буквы ребуса честно дают ответ.
export function keepYo(s) {
  return String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
}

export const PREPOSITIONS = ['В', 'НА'];

// Цифры, которые в нашем шрифте выглядят как буквы. Пополняется по итогам
// визуальной проверки: если цифру на экране путают с буквой — добавить сюда.
export const DIGIT_LOOKALIKES = { '3': 'З', '0': 'О' };

// Число можно прочитать буквами, если каждая его цифра похожа на букву («3» → З, «30» → ЗО).
// «100» читается как число: единица на букву не похожа.
export function readsAsLetters(value) {
  const digits = String(value || '').split('');
  return digits.length > 0 && digits.every((d) => d in DIGIT_LOOKALIKES);
}

// Слова из примеров легенды (src/ui/legend.js): ответы набора не должны с ними совпадать,
// иначе легенда подскажет ответ.
export const LEGEND_WORDS = ['КИТЫ', 'КЛЮЧ', 'ТОРТ', 'ТОТ', 'ТРОТ', 'СЫР', 'СЫН', 'СОР', 'КУБ',
  'СТО', 'СТОЛБ', 'ЛИСА', 'СОВА', 'ВОРОТА', 'КАНАВА'];
// Картинки легенды: как они там используются (flip — перевёрнута, initials — в первых буквах).
export const LEGEND_PICTURES = [
  { emoji: '🐳', word: 'КИТ' }, { emoji: '🔑', word: 'КЛЮЧ' }, { emoji: '🎂', word: 'ТОРТ' },
  { emoji: '🎂', word: 'ТОРТ', flip: true }, { emoji: '🧀', word: 'СЫР' }, { emoji: '🦊', word: 'ЛИСА' },
  { emoji: '🦘', word: 'КЕНГУРУ', initials: true }, { emoji: '🦆', word: 'УТКА', initials: true },
  { emoji: '🦛', word: 'БЕГЕМОТ', initials: true },
];

// Этапы уровня: по 20 ребусов подряд, хвост короче 10 присоединяется к предыдущему.
export const STAGE_SIZE = 20;
export function chunkStages(items) {
  const out = [];
  for (let i = 0; i < items.length; i += STAGE_SIZE) out.push(items.slice(i, i + STAGE_SIZE));
  if (out.length > 1 && out[out.length - 1].length < STAGE_SIZE / 2) out[out.length - 2].push(...out.pop());
  return out;
}

// Все картинки ребуса (в том числе внутри «первых букв»): [{ emoji, word }].
export function pictures(rebus) {
  const out = [];
  for (const p of rebus.parts || []) {
    if (p && p.type === 'pic') out.push({ emoji: p.emoji, word: p.word });
    if (p && p.type === 'initials') (p.items || []).forEach((it) => out.push({ emoji: it.emoji, word: it.word }));
  }
  return out;
}

// Буквы, которые даёт одна часть ребуса.
// Картинка и число: переворот → замены букв → замены по номеру → зачёркивание
// → цифры над картинкой (какие буквы и в каком порядке) → запятые.
export function partLetters(part, norm = normalize) {
  switch (part.type) {
    case 'letters':
      return norm(part.text);
    case 'initials': // первые буквы картинок
      return (part.items || []).map((it) => norm(it.word).charAt(0)).join('');
    case 'position': { // «ДА в О» = В-О-ДА, «СО в А» = СО-В-А, «ПА на МА» = ПА-НА-МА
      const prep = norm(part.prep), outer = norm(part.outer), inner = norm(part.inner);
      return part.prepFirst ? prep + outer + inner : inner + prep + outer;
    }
    default:
      return wordLetters(part, norm);
  }
}

function wordLetters(part, norm) {
  let w = norm(part.word);
  if (part.flip) w = w.split('').reverse().join('');
  (part.replace || []).forEach(function (pair) {
    w = w.split(norm(pair[0])).join(norm(pair[1]));
  });
  (part.replaceAt || []).forEach(function (pair) {
    const i = pair[0] - 1;
    if (i >= 0 && i < w.length) w = w.slice(0, i) + norm(pair[1]) + w.slice(i + 1);
  });
  (part.remove || []).forEach(function (ch) {
    const i = w.indexOf(norm(ch));
    if (i >= 0) w = w.slice(0, i) + w.slice(i + 1);
  });
  if (part.pick) w = part.pick.map((n) => w.charAt(n - 1)).join('');
  const start = part.cutStart || 0;
  const end = part.cutEnd || 0;
  return w.slice(start, w.length - end);
}

export function solve(rebus, norm = normalize) {
  return rebus.parts.map((p) => partLetters(p, norm)).join('');
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
      if (readsAsLetters(part.value)) {
        const as = String(part.value).split('').map((d) => DIGIT_LOOKALIKES[d]).join('');
        p.push(`число ${part.value} на экране читается как буквы «${as}»`);
      }
      if (part.cutEnd && /[ЬЪ]$/.test(normalize(part.word))) p.push('запятая у числа срезает Ь/Ъ, которого не слышно');
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
  } else if (!p.length && solve(r, keepYo) !== keepYo(r.answer)) {
    // Ребёнок не узнает МЕД в «мёде»: Ё из картинки должна остаться Ё в ответе, Е — Е.
    p.push(`Ё/Е: ответ ${keepYo(r.answer)}, а по картинкам выходит ${solve(r, keepYo)}`);
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
