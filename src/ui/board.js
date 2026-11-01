// Картинка ребуса и раскладка под размер экрана (разбор решения — explain.js).
import { normalize, keepYo, POSITIONS } from '../core/solve.js';
import { el, add } from './dom.js';

const LETTER_COLORS = 5;

// Для показа: заглавные буквы, Ё остаётся Ё (normalize — только для сравнения).
export const show = keepYo;
const SVG_NS = 'http://www.w3.org/2000/svg';
const E_MAX = 240;   // самый крупный размер эмодзи, px
const E_MIN = 32;
const GAP = 0.2;     // промежуток между частями, в долях эмодзи (как в CSS)
const ROW_GAP = 0.15;
const PAD = 0.3;     // запас по краям, в долях эмодзи
const ONE_ROW_BIAS = 0.68; // одна строка, если картинки в ней не меньше ~2/3 от двухстрочных

// Запятая — нарисованная (круглая головка и хвостик), чтобы не путалась с апострофом.
function commaSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 40');
  svg.setAttribute('class', 'comma');
  svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', '10'); c.setAttribute('cy', '11'); c.setAttribute('r', '9');
  const t = document.createElementNS(SVG_NS, 'path');
  t.setAttribute('d', 'M15.5 13 C19 22 15 33 4 39 C9 32 11 25 9.5 19 Z');
  add(svg, c, t);
  return svg;
}

function commas(n, side) {
  const box = el('span', 'commas commas-' + side);
  for (let i = 0; i < n; i++) add(box, commaSvg());
  return box;
}

// Картинка: эмодзи или своя иллюстрация (src — путь в public/, docs/ILLUSTRATIONS.md).
function picEmoji(emoji, flip, image) {
  const wrap = el('span', 'emoji-wrap');
  let em;
  if (image) {
    em = el('img', 'emoji emoji-img' + (flip ? ' flip' : ''));
    em.src = './' + image;
    em.alt = '';
    em.decoding = 'async';
    em.draggable = false;
  } else {
    em = el('span', 'emoji' + (flip ? ' flip' : ''), emoji);
  }
  em.setAttribute('role', 'img');
  em.setAttribute('aria-label', 'картинка' + (flip ? ' вверх ногами' : ''));
  add(wrap, em);
  if (flip) {
    const badge = el('span', 'flip-badge', '↺');
    badge.setAttribute('aria-hidden', 'true');
    add(wrap, badge);
  }
  return wrap;
}

function struckLetter(ch) {
  const x = el('span', 'struck', show(ch));
  x.setAttribute('aria-label', 'без буквы ' + show(ch));
  return x;
}

// Цифры над картинкой: какие буквы слова взять и в каком порядке.
function pickNumbers(pick) {
  const box = el('span', 'pick');
  box.setAttribute('aria-label', 'буквы номер ' + pick.join(', '));
  for (const n of pick) add(box, el('span', 'pick-n', String(n)));
  return box;
}

// Замена по номеру: номер — в кружке, как в цифрах над картинкой, чтобы «3» не читалась как «З».
function numberSwap(n, to) {
  const box = el('span', 'swap swap-n');
  box.setAttribute('aria-label', 'букву номер ' + n + ' меняем на ' + show(to));
  return add(box, el('span', 'pick-n', String(n)), document.createTextNode(' = ' + show(to)));
}

// ---------- Язык ребуса: заготовки (docs/VISUAL-LANGUAGE.md) ----------
// Каждая заготовка знает только свой узел и свои слоты: сверху — значки операций,
// снизу — зачёркнутые буквы. Размеры — от единиц --e (картинка) и --el (буквы);
// внутри отношения слот задаёт их заново (--e = --R × доля слота), поэтому любая
// заготовка вкладывается в любую, рекурсивно, без особых случаев.

// Картинка или число (у числа вместо эмодзи — крупные цифры).
function renderPic(p) {
  const box = el('div', 'part pic' + (p.type === 'number' ? ' number' : ''));
  const top = el('div', 'part-top');
  if (p.pick) add(top, pickNumbers(p.pick));
  for (const [from, to] of p.replace || []) add(top, el('span', 'swap', show(from) + ' = ' + show(to)));
  for (const [n, to] of p.replaceAt || []) add(top, numberSwap(n, to));
  const row = el('div', 'pic-row');
  if (p.cutStart) add(row, commas(p.cutStart, 'l'));
  if (p.type === 'number') {
    const num = el('span', 'num-digits', String(p.value));
    num.setAttribute('aria-label', 'число ' + p.value);
    add(row, num);
  } else {
    add(row, picEmoji(p.emoji, p.flip, p.image));
  }
  if (p.cutEnd) add(row, commas(p.cutEnd, 'r'));
  const bottom = el('div', 'part-bottom');
  for (const ch of p.remove || []) add(bottom, struckLetter(ch));
  if (bottom.childElementCount) box.classList.add('has-bottom');
  return add(box, top, row, bottom);
}

// Следующий цвет букв; красная «Х» похожа на крестик «нельзя» — её красим другим цветом.
function nextColor(seed, ch) {
  if (ch === 'Х' && seed.n % LETTER_COLORS === 0) seed.n++;
  return seed.n++ % LETTER_COLORS;
}

// Буквы. В слоте отношения буквы — один предмет, поэтому одного цвета.
function renderLetters(p, seed, ctx = {}) {
  const box = el('div', 'part text');
  const row = el('div', 'letters-row');
  const letters = show(p.text).split('');
  const mono = ctx.slot ? nextColor(seed, letters.includes('Х') ? 'Х' : '') : null;
  for (const ch of letters) add(row, el('span', 'big-letter c' + (mono ?? nextColor(seed, ch)), ch));
  return add(box, el('div', 'part-top'), row, el('div', 'part-bottom'));
}

// Первые буквы: несколько картинок в рамке, над ней — значок «А…».
function renderInitials(p) {
  const box = el('div', 'part pic initials');
  const top = el('div', 'part-top');
  const mark = el('span', 'initials-mark', 'А…');
  mark.setAttribute('aria-label', 'по первым буквам');
  add(top, mark);
  const row = el('div', 'pic-row initials-row');
  for (const it of p.items) add(row, picEmoji(it.emoji, false, it.image));
  return add(box, top, row, el('div', 'part-bottom'));
}

// ---------- Отношения: композиция двух слотов ----------
// a — что ставим, b — относительно чего (REBUS-SPEC.md, узел rel). Рисунок показывает только,
// ГДЕ части стоят (docs/VISUAL-LANGUAGE.md): КОНТУР — то, что вмещает или стоит сзади,
// СПЛОШНОЕ — содержимое или переднее; у сплошного поверх контура — кремовая кромка.
// Правило композиции одно на отношение и не зависит от содержимого слотов: роли слотов — здесь,
// размеры и расположение — в CSS-классе rb-<код> (доли --ka/--kb, касание/зазор/перекрытие).
//   order — порядок на экране (= порядок чтения: сверху вниз, слева направо; цвета идут так же);
//     кроме слотов в нём бывают значки движения из MARKS: 'arrow' — стрелка, 'stop' — черта «до»;
//   outline — какой слот рисуется контуром; front — сплошной слот поверх контура (с кромкой);
//   fit — a ужимается, чтобы поместиться в b; half — a наполовину выходит за правый край b («ИЗ»).
const RELATIONS = {
  in: { order: ['b', 'a'], outline: 'b', front: 'a', fit: true },
  on: { order: ['a', 'b'] },
  under: { order: ['b', 'a'] },
  near: { order: ['a', 'b'] },
  behind: { order: ['b', 'a'], outline: 'a', front: 'b' },
  front: { order: ['b', 'a'], outline: 'b', front: 'a' },
  out: { order: ['b', 'a', 'arrow'], outline: 'b', front: 'a', half: true },
  to: { order: ['a', 'arrow', 'b'] },
  from: { order: ['b', 'a', 'arrow'] },
  till: { order: ['a', 'stop', 'b'] },
};
// Доля внутреннего слота «В» от ширины и высоты контура.
const FIT_W = 0.62;
const FIT_H = 0.62;

// Значки движения (К, ОТ, ДО, ИЗ) — один стиль: скруглённая линия цвета приглушённого текста.
// Координаты — в сотых --R (у значка font-size = --R, svg — в em), толщина — как контур (0.06 --R).
// Стрелка: линия 0.3 --R и шеврон; черта «до»: линия без острия и поперечная черта, в неё упирается b.
const MARKS = {
  arrow: { w: 36, h: 28, d: 'M3 14H33M22 3L33 14L22 25' },
  stop: { w: 34, h: 34, d: 'M3 17H31M31 3V31' },
};
function renderMark(kind) {
  const m = MARKS[kind];
  const box = el('span', 'rel-mark rel-mark-' + kind);
  box.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${m.w} ${m.h}`);
  svg.style.width = m.w / 100 + 'em';
  svg.style.height = m.h / 100 + 'em';
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', m.d);
  add(svg, path);
  return add(box, svg);
}

// Слоты отношения из данных: в наборе — outer/inner (буквы-строка или узел), в схеме замыслов — b/a.
const asNode = (v) => (v && typeof v === 'object' ? v : { type: 'letters', text: v });
const relSlots = (p) => ({ a: asNode(p.a ?? p.inner), b: asNode(p.b ?? p.outer) });
const relInfo = (p) => POSITIONS[normalize(p.prep || p.rel)] || POSITIONS['В'];
const hasPic = (n) => n.type === 'position' ? hasPic(relSlots(n).a) || hasPic(relSlots(n).b) : n.type !== 'letters';
const label = (n) => n.type === 'letters' ? show(n.text) : n.type === 'position' ? 'отношение' : 'картинка';

function renderRelation(p, seed) {
  const info = relInfo(p);
  const rel = RELATIONS[info.tech] || RELATIONS.in;
  const nodes = relSlots(p);
  // С картинкой вся композиция считается от --e, как картинка (без класса text — см. measure).
  const box = el('div', 'part rel rel-' + info.tech + (hasPic(p) ? ' pic' : ' text'));
  const stack = el('span', 'rel-box rb-' + info.tech);
  // Слоты рисуются в порядке чтения — поэтому и цвета идут по порядку: верх/лево — первый цвет.
  const items = rel.order.map((k) => {
    if (MARKS[k]) return renderMark(k);
    const s = el('span', 'slot slot-' + k + (rel.outline === k ? ' is-outline' : '') + (rel.front === k ? ' is-front' : ''));
    return add(s, renderPart(nodes[k], seed, { slot: k }));
  });
  if (rel.fit) stack.dataset.fit = '';
  if (rel.half) stack.dataset.half = '';
  stack.setAttribute('aria-label', label(nodes.a) + ' ' + info.inside + ' ' + label(nodes.b));
  add(stack, ...items);
  return add(box, el('div', 'part-top'), add(el('div', 'rel-row'), stack), el('div', 'part-bottom'));
}

// Размеры, которые зависят от содержимого слотов. Меряются один раз (доли не зависят от размера),
// сначала самые вложенные.
//   «В»: внутренний слот ужимается так, чтобы целиком лечь в контур.
//   «ИЗ»: a выходит за правый край b ровно на половину своей ширины; ширина — в долях --R
//   (у значка движения font-size = --R); значки a — справа от неё, снаружи b.
export function fitRelations(root) {
  for (const box of [...root.querySelectorAll('.rel-box[data-fit], .rel-box[data-half]')].reverse()) {
    const slotA = box.querySelector(':scope > .slot-a');
    if (box.dataset.half !== undefined) {
      // Наполовину выходит сама a (картинка или буквы); её значки (зачёркнутая буква) стоят справа
      // от неё — целиком снаружи b, на чистом месте.
      const rowA = slotA.querySelector(':scope > .part > :is(.pic-row, .letters-row, .rel-row)') || slotA;
      const w = rowA.getBoundingClientRect().width;
      const R = parseFloat(getComputedStyle(box.querySelector(':scope > .rel-mark')).fontSize);
      if (w && R) box.style.setProperty('--half', (w / 2 / R).toFixed(3));
      continue;
    }
    box.style.setProperty('--fit', '1');
    const a = slotA.getBoundingClientRect();
    const b = box.querySelector(':scope > .slot-b').getBoundingClientRect();
    if (!a.width || !b.width) continue;
    const f = Math.min(1, (FIT_W * b.width) / a.width, (FIT_H * b.height) / a.height);
    box.style.setProperty('--fit', f.toFixed(3));
  }
}

// Реестр заготовок по виду узла. Новый вид — новая запись (и блок CSS), старые не трогаются.
const NODES = {
  letters: renderLetters,
  pic: renderPic,
  number: renderPic,
  initials: renderInitials,
  position: renderRelation,
};

export function renderPart(p, seed = { n: 0 }, ctx = {}) {
  return (NODES[p.type] || renderPic)(p, seed, ctx);
}

// ---------- Раскладка ----------
// Части с картинками масштабируются от --e (размер эмодзи), буквы — от --el.
// Буквы могут быть мельче картинок (до 70 %), чтобы не «съедать» их размер.
// Ширины частей меряются один раз при --e = --el = 100px.

function measure(inner, parts, rows) {
  rows[0].append(...parts);
  rows[1].remove();
  inner.classList.add('measuring');
  inner.style.setProperty('--e', '100px');
  inner.style.setProperty('--el', '100px');
  fitRelations(inner);
  const items = parts.map((node) => ({
    w: node.getBoundingClientRect().width / 100,
    letters: node.classList.contains('text'),
  }));
  const hf = inner.scrollHeight / 100;
  inner.classList.remove('measuring');
  return { items, hf };
}

function rowWidth(items, s) {
  let w = 0;
  for (const it of items) w += it.letters ? it.w * s : it.w;
  return w + GAP * Math.max(0, items.length - 1) + PAD;
}

// Лучший размер для заданного числа строк: сначала уменьшаем буквы, потом всё.
function fit(rows, W, H, hf) {
  const eH = Math.min(E_MAX, H / (rows.length * hf + (rows.length - 1) * ROW_GAP));
  let best = null;
  for (let s = 1; s >= 0.7 - 1e-9; s -= 0.05) {
    const uw = Math.max(...rows.map((r) => rowWidth(r, s)));
    const e = Math.min(eH, W / uw);
    if (!best || e > best.e + 0.5) best = { e, s };
    if (e >= eH - 0.5) break;
  }
  return best;
}

function bestSplit(items) {
  let best = 1, bestW = Infinity;
  for (let k = 1; k < items.length; k++) {
    const w = Math.max(rowWidth(items.slice(0, k), 1), rowWidth(items.slice(k), 1));
    if (w < bestW) { bestW = w; best = k; }
  }
  return best;
}

function layout(board, inner, parts, rows, m) {
  const W = board.clientWidth;
  const H = board.clientHeight;
  if (!W || !H) return;
  const one = fit([m.items], W, H, m.hf);
  let use = one, split = 0;
  if (m.items.length > 1) {
    const k = bestSplit(m.items);
    const two = fit([m.items.slice(0, k), m.items.slice(k)], W, H, m.hf);
    // Одна строка читается проще: переносим, только если иначе картинки станут мелкими.
    if (one.e < ONE_ROW_BIAS * two.e) { use = two; split = k; }
  }
  const e = Math.max(E_MIN, Math.floor(use.e));
  inner.style.setProperty('--e', e + 'px');
  inner.style.setProperty('--el', Math.floor(e * use.s) + 'px');
  // Строки — отдельные блоки: порядок чтения слева направо, сверху вниз.
  rows[0].append(...parts.slice(0, split || parts.length));
  if (split) { rows[1].append(...parts.slice(split)); inner.append(rows[1]); }
  else rows[1].remove();
}

export function renderBoard(rebus, signal) {
  const seed = { n: 0 };
  const board = el('div', 'board');
  const inner = el('div', 'board-inner');
  const hasTop = rebus.parts.some((p) => (p.replace && p.replace.length) || (p.replaceAt && p.replaceAt.length) || p.pick || p.type === 'initials');
  // У картинки в отношении («🐝 под Н») зачёркнутая буква стоит в самом отношении, место снизу ей не нужно.
  const hasBottom = rebus.parts.some((p) => p.remove && p.remove.length);
  if (!hasTop) inner.classList.add('no-top');
  if (!hasBottom) inner.classList.add('no-bottom');
  const parts = rebus.parts.map((p) => renderPart(p, seed));
  // Запятые справа у одной части и слева у следующей не должны слиться в одну группу.
  rebus.parts.forEach((p, i) => {
    const next = rebus.parts[i + 1];
    if (p.cutEnd && next && next.cutStart) parts[i].classList.add('comma-gap');
  });
  const rows = [el('div', 'board-row'), el('div', 'board-row')];
  add(rows[0], ...parts);
  add(inner, rows[0]);
  add(board, inner);

  let m = null;
  const relayout = () => {
    if (!board.isConnected) return;
    if (!m) m = measure(inner, parts, rows);
    layout(board, inner, parts, rows, m);
  };
  const ro = new ResizeObserver(relayout);
  ro.observe(board);
  signal.addEventListener('abort', () => ro.disconnect(), { once: true });
  // После загрузки шрифта ширина букв меняется — перемеряем.
  if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(() => { m = null; relayout(); });
  }
  return board;
}
