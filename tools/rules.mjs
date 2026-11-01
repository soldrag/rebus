// Общие правила набора и замыслов: их проверяют и tools/validate.mjs, и tools/check-proposals.mjs.
// Сами правила — docs/REBUSES.md.
import { normalize, keepYo, innerPart, pictures, solve, techniques, POSITIONS } from '../src/core/solve.js';
import { shapeProblems, solveProblems } from '../src/core/format.js';
import { CARDS } from '../src/legend-data.js';

// --- Легенда «?» (src/legend-data.js).
// Слова легенды — всё, что напечатано на карточке: ответ примера (после «→» в подписи)
// и слова его картинок и чисел. Ответ ребуса не должен с ними совпадать — легенда его подскажет.
const legendParts = Object.values(CARDS).flatMap((c) => c.parts);
// Картинки примеров (inInitials — в первых буквах): подчиняются реестру, как картинки набора.
export const LEGEND_PICTURES = legendParts.flatMap((p) => pictures({ parts: [p] }));
export const LEGEND_WORDS = [...new Set([
  ...Object.values(CARDS).map((c) => normalize(c.words.split('→').pop())),
  ...LEGEND_PICTURES.map((p) => normalize(p.word)),
  ...legendParts.filter((p) => p.type === 'number').map((p) => normalize(p.word)),
])].filter(Boolean);

// Ответ ребуса не совпадает со словом легенды.
export const isLegendWord = (answer) => LEGEND_WORDS.includes(normalize(answer));

// --- «Обычно»-правила (docs/REBUSES.md, «Как устроены правила»): нарушение — ошибка, если в ребусе
// или замысле нет exceptions: { <правило>: "почему здесь можно" }. Принятые исключения копятся
// в accepted — проверка покажет их как «~ исключение».
export function exceptionRules() {
  const accepted = [];
  // out — куда записать ошибку; msg — её текст (как его покажет проверка).
  const should = (r, out, rule, msg) => {
    const why = r && r.exceptions && typeof r.exceptions[rule] === 'string' && r.exceptions[rule].trim();
    if (why) accepted.push(`${r.id}: ${rule} — ${why}`);
    else out.push(`${msg} [правило ${rule}; можно отступить через exceptions.${rule} с причиной]`);
  };
  const printAccepted = () => accepted.forEach((x) => console.log('~ исключение:', x));
  return { should, accepted, printAccepted };
}

// «Нельзя»: подсказка называет ответ (ответ — часть какого-то её слова).
export function hintNamesAnswer(hint, answer) {
  const a = normalize(answer);
  return !!a && String(hint || '').split(/\s+/).map(normalize).some((w) => w.includes(a));
}

// Слово картинки: в наборе — word, в замысле — pic.
export const pictureWord = (p) => normalize(p.word !== undefined ? p.word : p.pic);

// Зеркальная пара: картинкой одного ребуса стоит ответ другого (answers — нормализованные ответы).
export const isMirror = (picture, answers) => answers.includes(pictureWord(picture));

// --- Правила автора для ребуса набора. Приложение при загрузке проверяет только, можно ли
// ребус нарисовать и решить (src/core/format.js); остальное — здесь, до сборки.

// Темы набора — для разнообразия (не больше трёх ребусов одной темы подряд).
export const THEMES = ['звери', 'птицы', 'насекомые', 'вода', 'еда', 'фрукты', 'растения', 'природа',
  'игрушки', 'дом', 'одежда', 'транспорт', 'сказки', 'люди'];

// Цифры, которые в нашем шрифте выглядят как буквы. Пополняется по итогам
// визуальной проверки: если цифру на экране путают с буквой — добавить сюда.
export const DIGIT_LOOKALIKES = { '3': 'З', '0': 'О' };

// Число можно прочитать буквами, если каждая его цифра похожа на букву («3» → З, «30» → ЗО).
// «100» читается как число: единица на букву не похожа.
export function readsAsLetters(value) {
  const digits = String(value || '').split('');
  return digits.length > 0 && digits.every((d) => d in DIGIT_LOOKALIKES);
}

const readOf = (prep) => (POSITIONS[prep] || {}).read;

function authorPartProblems(part) {
  if (!part || typeof part !== 'object') return [];
  const p = [];
  const prep = normalize(part.prep);
  switch (part.type) {
    case 'position':
      if (innerPart(part)) authorPartProblems(innerPart(part)).forEach((x) => p.push('inner: ' + x));
      // Где читается предлог — POSITIONS[…].read (docs/REBUSES.md, «Буквы в позиции»).
      if (readOf(prep) === 'first' && !part.prepFirst) p.push('«' + prep + '» читается в начале слова: нужен prepFirst');
      if (readOf(prep) === 'between' && part.prepFirst) p.push('«' + prep + '» читается между частями: prepFirst не нужен');
      break;
    case 'number':
      if (readsAsLetters(part.value)) {
        const as = String(part.value).split('').map((d) => DIGIT_LOOKALIKES[d]).join('');
        p.push(`число ${part.value} на экране читается как буквы «${as}»`);
      }
      if (part.cutEnd && /[ЬЪ]$/.test(normalize(part.word))) p.push('запятая у числа срезает Ь/Ъ, которого не слышно');
      if (part.flip || part.pick || part.replace || part.replaceAt || part.remove) p.push('у числа можно только запятые');
      break;
    case 'pic':
      if (part.pick && (part.cutStart || part.cutEnd)) p.push('pick нельзя вместе с запятыми');
      if (Array.isArray(part.pick) && new Set(part.pick).size !== part.pick.length) p.push('pick: номера не должны повторяться');
  }
  return p;
}

// Все ошибки ребуса набора: можно ли его нарисовать (как при загрузке в браузере), правила автора,
// и только потом — складывается ли он в ответ (tools/validate.mjs, tools/transfer.mjs).
export function rebusProblems(r) {
  if (!r || typeof r !== 'object') return ['не объект'];
  const p = shapeProblems(r);
  if (typeof r.hint !== 'string' || !r.hint.trim()) p.push('нет hint');
  if (!THEMES.includes(r.theme)) p.push('theme должна быть одной из: ' + THEMES.join(', '));
  (Array.isArray(r.parts) ? r.parts : []).forEach((part, i) => authorPartProblems(part).forEach((x) => p.push(`часть ${i + 1}: ${x}`)));
  if (p.length) return p;
  // Разметка приёмов должна совпадать с тем, что на самом деле в частях ребуса.
  const real = techniques(r).sort().join(', ');
  const marked = Array.isArray(r.techniques) ? [...r.techniques].sort().join(', ') : '';
  if (real !== marked) return [`techniques: в разметке [${marked}], а по частям [${real}]`];
  const solved = solveProblems(r);
  if (solved.length) return solved;
  // Ребёнок не узнает МЕД в «мёде»: Ё из картинки должна остаться Ё в ответе, Е — Е.
  if (solve(r, keepYo) !== keepYo(r.answer)) return [`Ё/Е: ответ ${keepYo(r.answer)}, а по картинкам выходит ${solve(r, keepYo)}`];
  return [];
}
