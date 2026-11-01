// Разбор решения: как разгадать ребус, по шагу на каждую часть (после трёх ошибок и на готовом ребусе).
import { partLetters, normalize, keepYo, POSITIONS, innerPart, outerPart } from '../core/solve.js';
import { el, add, plural } from './dom.js';
import { show } from './board.js';
function without(n, where) {
  return 'без ' + n + ' ' + plural(n, 'буквы', 'букв', 'букв') + ' ' + where;
}

// Что даёт картинка внутри позиции: «СЫР без Р → СЫ».
function partNote(p) {
  if (p.type === 'initials') return p.items.map((it) => show(it.word)).join(', ') + ' — первые буквы';
  const ops = [];
  for (const [from, to] of p.replace || []) ops.push(show(from) + ' = ' + show(to));
  for (const [n, to] of p.replaceAt || []) ops.push(n + '-ю букву на ' + show(to));
  for (const ch of p.remove || []) ops.push('без ' + show(ch));
  if (p.cutStart) ops.push(without(p.cutStart, 'в начале'));
  if (p.cutEnd) ops.push(without(p.cutEnd, 'в конце'));
  return show(p.word) + (ops.length ? ' ' + ops.join(', ') : '') + ' → ' + partLetters(p, keepYo);
}

function explainPart(p) {
  const li = el('li', 'step');
  const what = el('span', 'step-what');
  let pic;
  if (p.type === 'letters') {
    pic = el('span', 'step-pic step-chip', 'АБВ');
    add(what, el('span', 'step-notes step-plain', 'просто буквы'));
  } else if (p.type === 'initials') {
    pic = el('span', 'step-pic step-multi', p.items.map((it) => it.emoji).join(''));
    add(what, el('b', 'step-word step-wrap', p.items.map((it) => show(it.word)).join(', ')),
      el('span', 'step-notes', 'берём первые буквы'));
  } else if (p.type === 'position') {
    const prep = normalize(p.prep);
    const info = POSITIONS[prep] || POSITIONS['В'];
    const part = innerPart(p), outer = outerPart(p);
    pic = el('span', 'step-pic step-chip', prep);
    // Картинка в слоте: «СЫ (СЫР без Р) в Е», «БУ к АШКА (ЧАШКА без Ч)».
    const innerText = part ? partLetters(part, keepYo) : show(p.inner);
    const outerText = outer ? partLetters(outer, keepYo) : show(p.outer);
    const notes = [p.prepFirst ? 'слово «' + prep + '» ставим в начало' : 'между буквами слово «' + prep + '»'];
    if (outer) notes.unshift(partNote(outer));
    if (part) notes.unshift(partNote(part));
    add(what, el('b', 'step-word', innerText + ' ' + info.say + ' ' + outerText),
      el('span', 'step-notes', notes.join('; ')));
  } else {
    pic = el('span', 'step-pic' + (p.flip ? ' flip' : '') + (p.type === 'number' ? ' step-num' : ''), p.type === 'number' ? String(p.value) : (p.emoji || ''));
    if (p.image) { const img = el('img', 'step-img'); img.src = './' + p.image; img.alt = ''; add(pic, img); }
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
  add(li, pic, what, arrow, el('span', 'step-res', partLetters(p, keepYo)));
  return li;
}

export function renderExplain(rebus) {
  const box = el('div', 'explain');
  add(box, el('h2', 'explain-title', 'Как разгадать'));
  const ol = el('ol', 'steps');
  for (const p of rebus.parts) add(ol, explainPart(p));
  return add(box, ol);
}
