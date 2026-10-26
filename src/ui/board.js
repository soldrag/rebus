// Картинка ребуса, раскладка под размер экрана, разбор решения.
import { partLetters, normalize } from '../rebus-core.js';
export { techniques } from '../rebus-core.js';
import { el, add, plural } from './dom.js';

const LETTER_COLORS = 5;

// Для показа: заглавные буквы, Ё остаётся Ё (normalize — только для сравнения).
export function show(text) {
  return String(text || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
}
const SVG_NS = 'http://www.w3.org/2000/svg';
const E_MAX = 240;   // самый крупный размер эмодзи, px
const E_MIN = 32;
const GAP = 0.2;     // промежуток между частями, в долях эмодзи (как в CSS)
const ROW_GAP = 0.15;
const PAD = 0.3;     // запас по краям, в долях эмодзи
const ONE_ROW_BIAS = 0.68; // одна строка, если картинки в ней не меньше ~2/3 от двухстрочных

// Запятая — нарисованная (круглая головка и хвостик), чтобы не путалась с апострофом.
export function commaSvg() {
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

export function picEmoji(emoji, flip) {
  const wrap = el('span', 'emoji-wrap');
  const em = el('span', 'emoji' + (flip ? ' flip' : ''), emoji);
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

export function struckLetter(ch) {
  const x = el('span', 'struck', show(ch));
  x.setAttribute('aria-label', 'без буквы ' + show(ch));
  return x;
}

// Цифры над картинкой: какие буквы слова взять и в каком порядке.
export function pickNumbers(pick) {
  const box = el('span', 'pick');
  box.setAttribute('aria-label', 'буквы номер ' + pick.join(', '));
  for (const n of pick) add(box, el('span', 'pick-n', String(n)));
  return box;
}

// Картинка или число (у числа вместо эмодзи — крупные цифры).
function renderPic(p) {
  const box = el('div', 'part pic' + (p.type === 'number' ? ' number' : ''));
  const top = el('div', 'part-top');
  if (p.pick) add(top, pickNumbers(p.pick));
  for (const [from, to] of p.replace || []) add(top, el('span', 'swap', show(from) + ' = ' + show(to)));
  for (const [n, to] of p.replaceAt || []) add(top, el('span', 'swap swap-n', n + ' = ' + show(to)));
  const row = el('div', 'pic-row');
  if (p.cutStart) add(row, commas(p.cutStart, 'l'));
  if (p.type === 'number') {
    const num = el('span', 'num-digits', String(p.value));
    num.setAttribute('aria-label', 'число ' + p.value);
    add(row, num);
  } else {
    add(row, picEmoji(p.emoji, p.flip));
  }
  if (p.cutEnd) add(row, commas(p.cutEnd, 'r'));
  const bottom = el('div', 'part-bottom');
  for (const ch of p.remove || []) add(bottom, struckLetter(ch));
  return add(box, top, row, bottom);
}

function renderLetters(p, seed) {
  const box = el('div', 'part text');
  const row = el('div', 'letters-row');
  show(p.text).split('').forEach((ch) => {
    add(row, el('span', 'big-letter c' + (seed.n++ % LETTER_COLORS), ch));
  });
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
  for (const it of p.items) add(row, picEmoji(it.emoji, false));
  return add(box, top, row, el('div', 'part-bottom'));
}

// Буквы в букве («В») или над буквами («НА»).
function renderPosition(p, seed) {
  const on = normalize(p.prep) === 'НА';
  const box = el('div', 'part text position ' + (on ? 'on' : 'in'));
  const color = () => 'c' + (seed.n++ % LETTER_COLORS);
  const outer = el('span', 'pos-outer ' + color(), show(p.outer));
  const inner = el('span', 'pos-inner ' + color(), show(p.inner));
  const stack = el('span', 'pos-stack');
  stack.setAttribute('aria-label', show(p.inner) + (on ? ' над ' : ' внутри ') + show(p.outer));
  if (on) add(stack, inner, outer);
  else add(stack, outer, inner);
  return add(box, el('div', 'part-top'), add(el('div', 'letters-row'), stack), el('div', 'part-bottom'));
}

function renderPart(p, seed) {
  switch (p.type) {
    case 'letters': return renderLetters(p, seed);
    case 'initials': return renderInitials(p);
    case 'position': return renderPosition(p, seed);
    default: return renderPic(p);
  }
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
  inner.classList.toggle('two-rows', split > 0);
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
  const hasBottom = rebus.parts.some((p) => p.remove && p.remove.length);
  if (!hasTop) inner.classList.add('no-top');
  if (!hasBottom) inner.classList.add('no-bottom');
  const parts = rebus.parts.map((p) => renderPart(p, seed));
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
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(relayout);
    ro.observe(board);
    if (signal) signal.addEventListener('abort', () => ro.disconnect(), { once: true });
  } else {
    requestAnimationFrame(relayout);
    window.addEventListener('resize', relayout, signal ? { signal } : undefined);
  }
  // После загрузки шрифта ширина букв меняется — перемеряем.
  if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(() => { m = null; relayout(); });
  }
  return board;
}

// ---------- Разбор ----------
function without(n, where) {
  return 'без ' + n + ' ' + plural(n, 'буквы', 'букв', 'букв') + ' ' + where;
}

function explainPart(p) {
  const li = el('li', 'step');
  const what = el('span', 'step-what');
  let pic;
  if (p.type === 'letters') {
    pic = el('span', 'step-pic', '🔤');
    add(what, el('span', 'step-notes step-plain', 'просто буквы'));
  } else if (p.type === 'initials') {
    pic = el('span', 'step-pic step-multi', p.items.map((it) => it.emoji).join(''));
    add(what, el('b', 'step-word', p.items.map((it) => show(it.word)).join(', ')),
      el('span', 'step-notes', 'берём первые буквы'));
  } else if (p.type === 'position') {
    const on = normalize(p.prep) === 'НА';
    pic = el('span', 'step-pic step-pos', on ? '⬆️' : '🔠');
    add(what, el('b', 'step-word', show(p.inner) + (on ? ' на ' : ' в ') + show(p.outer)),
      el('span', 'step-notes', 'читаем со словом «' + (on ? 'НА' : 'В') + '»'));
  } else {
    pic = el('span', 'step-pic' + (p.flip ? ' flip' : '') + (p.type === 'number' ? ' step-num' : ''), p.type === 'number' ? String(p.value) : p.emoji);
    add(what, el('b', 'step-word', show(p.word)));
    const notes = [];
    if (p.flip) notes.push('читаем наоборот');
    for (const [from, to] of p.replace || []) notes.push(show(from) + ' меняем на ' + show(to));
    for (const [n, to] of p.replaceAt || []) notes.push(n + '-ю букву меняем на ' + show(to));
    if (p.pick) notes.push('берём буквы ' + p.pick.join(', '));
    for (const ch of p.remove || []) notes.push('убираем ' + show(ch));
    if (p.cutStart) notes.push(without(p.cutStart, 'в начале'));
    if (p.cutEnd) notes.push(without(p.cutEnd, 'в конце'));
    if (notes.length) add(what, el('span', 'step-notes', notes.join(', ')));
  }
  pic.setAttribute('aria-hidden', 'true');
  const arrow = el('span', 'step-arrow', '→');
  arrow.setAttribute('aria-hidden', 'true');
  add(li, pic, what, arrow, el('span', 'step-res', p.type === 'letters' ? show(p.text) : partLetters(p)));
  return li;
}

export function renderExplain(rebus) {
  const box = el('div', 'explain');
  add(box, el('h2', 'explain-title', 'Как разгадать'));
  const ol = el('ol', 'steps');
  for (const p of rebus.parts) add(ol, explainPart(p));
  return add(box, ol);
}
