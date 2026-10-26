// Все ребусы по номерам — для тех, кто хочет выбрать конкретный ребус.
import { el, add } from './dom.js';
import { getState, MAX_TRIES } from '../store.js';
import { LEVELS, levelItems } from '../levels.js';

function tile(r, num) {
  const st = getState(r.id);
  const a = el('a', 'tile');
  a.href = '#/r/' + encodeURIComponent(r.id);
  a.dataset.id = r.id;
  add(a, el('span', 'tile-num', String(num)));
  let label = 'Ребус ' + num;
  if (st.status === 'solved') {
    a.classList.add('solved');
    add(a, el('span', 'tile-mark', '⭐'));
    label += ', отгадан';
  } else if (st.status === 'revealed') {
    a.classList.add('revealed');
    add(a, el('span', 'tile-mark', '💡'));
    label += ', ответ показан';
  } else if (st.tries > 0) {
    const left = Math.max(0, MAX_TRIES - st.tries);
    a.classList.add('started');
    add(a, el('span', 'tile-mark tile-hearts', '♥'.repeat(left)));
    label += ', осталось попыток: ' + left;
  }
  a.setAttribute('aria-label', label);
  return a;
}

export function renderAll(app, data) {
  document.title = 'Ребусы — все по номерам';
  app.className = 'app all';
  const bar = el('div', 'topbar');
  const back = el('a', 'back', '←');
  back.href = '#/';
  back.setAttribute('aria-label', 'На главную');
  add(bar, back, el('h1', 'rebus-num', 'Все ребусы'));
  app.replaceChildren(bar);

  for (const L of LEVELS) {
    const items = levelItems(data.list, L.level);
    if (!items.length) continue;
    const h = el('h2', 'level-title');
    add(h, el('span', 'level-dots', '●'.repeat(L.level)), document.createTextNode(' ' + L.title));
    const grid = el('div', 'grid');
    items.forEach((r) => add(grid, tile(r, data.byId[r.id].num)));
    add(app, add(el('section', 'all-level ' + L.cls), h, grid));
  }
}
