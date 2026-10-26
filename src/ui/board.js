// Картинка ребуса и разбор решения.
import { normalize, partLetters } from '../rebus-core.js';
import { el, add, plural } from './dom.js';

const LETTER_COLORS = 5;

// Размеры частей в «единицах эмодзи» (1 = размер эмодзи). По ним CSS
// (container queries) подбирает размер так, чтобы ребус занял всю область.
const GAP = 0.2;
function partUnits(p) {
  if (p.type === 'letters') return 0.74 * normalize(p.text).length + 0.04;
  const commas = (p.cutStart || 0) + (p.cutEnd || 0);
  const base = 1.26 + commas * 0.2;
  const removeW = (p.remove || []).length * 0.6;
  const swapW = (p.replace || []).length * 1.3 - 0.1;
  return Math.max(base, removeW, swapW);
}
function rowUnits(widths) {
  return widths.reduce((a, b) => a + b, 0) + GAP * Math.max(0, widths.length - 1) + 0.4;
}
function layoutVars(rebus) {
  const w = rebus.parts.map(partUnits);
  const u1 = rowUnits(w);
  // Лучшее деление на две строки (если частей больше одной).
  let u2 = u1;
  for (let k = 1; k < w.length; k++) {
    u2 = Math.min(u2, Math.max(rowUnits(w.slice(0, k)), rowUnits(w.slice(k))));
  }
  const hasTop = rebus.parts.some((p) => p.replace && p.replace.length);
  const hasBottom = rebus.parts.some((p) => p.remove && p.remove.length);
  const hf = 1.12 + (hasTop ? 0.42 : 0) + (hasBottom ? 0.58 : 0) + 0.12;
  return { u1, u2, hf, hasTop, hasBottom };
}

function renderPic(p) {
  const box = el('div', 'part pic');
  const top = el('div', 'part-top');
  for (const [from, to] of p.replace || []) add(top, el('span', 'swap', normalize(from) + ' = ' + normalize(to)));
  const row = el('div', 'pic-row');
  if (p.cutStart) add(row, el('span', 'commas commas-l', ','.repeat(p.cutStart)));
  const em = el('span', 'emoji' + (p.flip ? ' flip' : ''), p.emoji);
  em.setAttribute('role', 'img');
  em.setAttribute('aria-label', 'картинка' + (p.flip ? ' вверх ногами' : ''));
  add(row, em);
  if (p.cutEnd) add(row, el('span', 'commas commas-r', ','.repeat(p.cutEnd)));
  const bottom = el('div', 'part-bottom');
  for (const ch of p.remove || []) {
    const x = el('span', 'struck', normalize(ch));
    x.setAttribute('aria-label', 'без буквы ' + normalize(ch));
    add(bottom, x);
  }
  return add(box, top, row, bottom);
}

function renderLetters(p, seed) {
  const box = el('div', 'part text');
  const row = el('div', 'letters-row');
  normalize(p.text).split('').forEach((ch) => {
    add(row, el('span', 'big-letter c' + (seed.n++ % LETTER_COLORS), ch));
  });
  return add(box, el('div', 'part-top'), row, el('div', 'part-bottom'));
}

export function renderBoard(rebus) {
  const seed = { n: 0 };
  const board = el('div', 'board');
  const inner = el('div', 'board-inner');
  const v = layoutVars(rebus);
  inner.style.setProperty('--u1', v.u1.toFixed(2));
  inner.style.setProperty('--u2', v.u2.toFixed(2));
  inner.style.setProperty('--hf', v.hf.toFixed(2));
  if (!v.hasTop) inner.classList.add('no-top');
  if (!v.hasBottom) inner.classList.add('no-bottom');
  for (const p of rebus.parts) add(inner, p.type === 'letters' ? renderLetters(p, seed) : renderPic(p));
  return add(board, inner);
}

function without(n, where) {
  return 'без ' + n + ' ' + plural(n, 'буквы', 'букв', 'букв') + ' ' + where;
}

function explainPart(p) {
  const li = el('li', 'step');
  if (p.type === 'letters') {
    const pic = el('span', 'step-pic', '🔤');
    pic.setAttribute('aria-hidden', 'true');
    const what = el('span', 'step-what');
    add(what, el('span', 'step-word step-abc', 'просто буквы'));
    add(li, pic, what);
  } else {
    const pic = el('span', 'step-pic' + (p.flip ? ' flip' : ''), p.emoji);
    pic.setAttribute('aria-hidden', 'true');
    const what = el('span', 'step-what');
    add(what, el('b', 'step-word', normalize(p.word)));
    const notes = [];
    if (p.flip) notes.push('читаем наоборот');
    for (const [from, to] of p.replace || []) notes.push(normalize(from) + ' меняем на ' + normalize(to));
    for (const ch of p.remove || []) notes.push('убираем ' + normalize(ch));
    if (p.cutStart) notes.push(without(p.cutStart, 'в начале'));
    if (p.cutEnd) notes.push(without(p.cutEnd, 'в конце'));
    if (notes.length) add(what, el('span', 'step-notes', notes.join(', ')));
    add(li, pic, what);
  }
  add(li, el('span', 'step-arrow', '→'), el('span', 'step-res', partLetters(p)));
  return li;
}

export function renderExplain(rebus) {
  const box = el('div', 'explain');
  add(box, el('h3', 'explain-title', 'Как разгадать'));
  const ol = el('ol', 'steps');
  for (const p of rebus.parts) add(ol, explainPart(p));
  return add(box, ol);
}
