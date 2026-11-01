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
//   В — внутри, НА — сверху, ПОД — снизу, У — рядом, ЗА — спрятана позади.
//   «ПОД» и «ЗА» ставим только в начало слова (prepFirst), «У» — только между буквами.
export const POSITIONS = {
  'В': { tech: 'in', say: 'в', inside: 'внутри' },
  'НА': { tech: 'on', say: 'на', inside: 'над' },
  'ПОД': { tech: 'under', say: 'под', inside: 'под' },
  'У': { tech: 'near', say: 'у', inside: 'рядом с' },
  'ЗА': { tech: 'behind', say: 'за', inside: 'за' },
};
export const PREPOSITIONS = Object.keys(POSITIONS);
// Отношения, которые приложение уже умеет рисовать (docs/VISUAL-LANGUAGE.md), но в набор
// пока не пускает: нет карточки в легенде у ребёнка и не решено, где читается предлог.
// Перенести строку в POSITIONS — и отношение станет доступно ребусам.
//   НАД — сверху с зазором, ПЕРЕД — загораживает, ИЗ — b сложено из маленьких a, ПО — a написано по всей b.
export const POSITIONS_NEXT = {
  'НАД': { tech: 'over', say: 'над', inside: 'над' },
  'ПЕРЕД': { tech: 'before', say: 'перед', inside: 'перед' },
  'ИЗ': { tech: 'from', say: 'из', inside: 'из' },
  'ПО': { tech: 'along', say: 'по', inside: 'по' },
};

// Внутренняя часть позиции: строка — это буквы, объект — часть ребуса (картинка, первые буквы).
// «🧀 без Р в Е» = В-Е-СЫ: { type: 'position', prep: 'В', outer: 'Е', inner: { type: 'pic', … }, prepFirst: true }.
export const innerPart = (part) => (part && part.inner && typeof part.inner === 'object' ? part.inner : null);

// Картинка: эмодзи или своя иллюстрация (image — путь в public/, одобряет дизайнер).
export const picKey = (p) => `${p.emoji || p.image} ${normalize(p.word)}`;

// Все картинки ребуса (в том числе в «первых буквах» и внутри позиции): [{ emoji, image, word, … }].
export function pictures(rebus) {
  const out = [];
  const visit = (p) => {
    if (!p) return;
    if (p.type === 'pic') out.push(p);
    if (p.type === 'initials') (p.items || []).forEach((it) => out.push({ ...it, inInitials: true }));
    if (p.type === 'position') visit(innerPart(p));
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
    case 'position': { // «ДА в О» = В-О-ДА, «СО в А» = СО-В-А, «ПА на МА» = ПА-НА-МА, «К у Б» = К-У-Б, «ОВА под К» = ПОД-К-ОВА
      const prep = norm(part.prep), outer = norm(part.outer);
      const inner = innerPart(part) ? partLetters(innerPart(part), norm) : norm(part.inner);
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
  (rebus.parts || []).forEach((p) => { parts.push(p); if (p.type === 'position' && innerPart(p)) parts.push(innerPart(p)); });
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
