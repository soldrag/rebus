// Как ребус складывается в ответ: буквы каждой части, картинки ребуса и его приёмы.
// Используется в приложении и в tools/.

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

// Предлоги «букв в позиции»: как расположены буквы → приём (код в techniques()) и как читать.
// Рисует их src/ui/board.js (RELATIONS по коду tech), правила — docs/VISUAL-LANGUAGE.md.
//   В — внутри, НА — сверху, ПОД — снизу, У — рядом, ЗА — спрятана позади,
//   ПЕРЕД — загораживает спереди, ИЗ — выходит из контура, К — движется к, ОТ — уходит от, ДО — доходит до.
//   read — где читается предлог: 'first' — только в начале (prepFirst), 'between' — только между
//   частями; без read — как задано в ребусе. container — b рисуется контуром, который вмещает a
//   («В», «ИЗ»): картинку контуром не нарисовать, поэтому b там — только буквы. Не рисуем (и в набор не пускаем) НАД, ПО, С, ПРИ, О/ОБ.
export const POSITIONS = {
  'В': { tech: 'in', say: 'в', inside: 'внутри', container: true },
  'НА': { tech: 'on', say: 'на', inside: 'над' },
  'ПОД': { tech: 'under', say: 'под', inside: 'под', read: 'first' },
  'У': { tech: 'near', say: 'у', inside: 'рядом с', read: 'between' },
  'ЗА': { tech: 'behind', say: 'за', inside: 'за', read: 'first' },
  'ПЕРЕД': { tech: 'front', say: 'перед', inside: 'перед', read: 'first' },
  'ИЗ': { tech: 'out', say: 'из', inside: 'выходит из', read: 'first', container: true },
  'К': { tech: 'to', say: 'к', inside: 'движется к', read: 'between' },
  'ОТ': { tech: 'from', say: 'от', inside: 'уходит от', read: 'first' },
  'ДО': { tech: 'till', say: 'до', inside: 'доходит до', read: 'between' },
};
export const PREPOSITIONS = Object.keys(POSITIONS);

// Внутренняя часть позиции: строка — это буквы, объект — часть ребуса (картинка, число, первые буквы).
// «🧀 без Р в Е» = В-Е-СЫ: { type: 'position', prep: 'В', outer: 'Е', inner: { type: 'pic', … }, prepFirst: true }.
export const innerPart = (part) => (part && part.inner && typeof part.inner === 'object' ? part.inner : null);
// Внешняя часть (b) — так же: строка — буквы, объект — картинка, число или первые буквы.
// «БУ к 🍵 без Ч» = БУ-К-АШКА: { type: 'position', prep: 'К', outer: { type: 'pic', … }, inner: 'БУ' }.
// У отношений с container (В, ИЗ) b — контур, там только буквы (src/core/format.js).
export const outerPart = (part) => (part && part.outer && typeof part.outer === 'object' ? part.outer : null);
// Буквы слота: часть ребуса или строка букв.
const slotLetters = (obj, str, norm) => (obj ? partLetters(obj, norm) : norm(str));

// Картинка: эмодзи или своя иллюстрация (image — путь в public/, одобряет дизайнер).
export const picKey = (p) => `${p.emoji || p.image} ${normalize(p.word)}`;

// Все картинки ребуса (в том числе в «первых буквах» и внутри позиции): [{ emoji, image, word, … }].
export function pictures(rebus) {
  const out = [];
  const visit = (p) => {
    if (!p) return;
    if (p.type === 'pic') out.push(p);
    if (p.type === 'initials') (p.items || []).forEach((it) => out.push({ ...it, inInitials: true }));
    if (p.type === 'position') { visit(innerPart(p)); visit(outerPart(p)); }
  };
  (rebus.parts || []).forEach(visit);
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
    case 'position': { // «ДА в О» = В-О-ДА, «СО в А» = СО-В-А, «ПА на МА» = ПА-НА-МА, «К у Б» = К-У-Б, «ОВА под К» = ПОД-К-ОВА,
      // «Й перед А» = ПЕРЕД-А-Й, «М из Ю» = ИЗ-Ю-М, «ЧАЙ к А» = ЧАЙ-К-А, «Ц от Е» = ОТ-Е-Ц, «ЛА до ШКА» = ЛА-ДО-ШКА
      const prep = norm(part.prep);
      const outer = slotLetters(outerPart(part), part.outer, norm);
      const inner = slotLetters(innerPart(part), part.inner, norm);
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

// Приёмы записи в ребусе — для легенды, чередования и статистики.
export function techniques(rebus) {
  const t = new Set();
  const parts = [];
  (rebus.parts || []).forEach((p) => {
    parts.push(p);
    if (p.type === 'position') [innerPart(p), outerPart(p)].filter(Boolean).forEach((x) => parts.push(x));
  });
  for (const p of parts) {
    if (p.type === 'initials') t.add('initials');
    else if (p.type === 'position') t.add((POSITIONS[normalize(p.prep)] || POSITIONS['В']).tech);
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
