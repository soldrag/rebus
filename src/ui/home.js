// Главный экран: прогресс и плитки по уровням.
import { el, add } from './dom.js';
import { getState, resetAll, solvedCount, MAX_TRIES } from '../store.js';
import { canInstall, install, onInstallChange } from '../install.js';

const LEVELS = [
  { level: 1, title: 'Лёгкие', cls: 'lvl-1' },
  { level: 2, title: 'Средние', cls: 'lvl-2' },
  { level: 3, title: 'Трудные', cls: 'lvl-3' },
];

function header() {
  const head = el('header', 'home-head');
  const mascot = el('span', 'mascot', '🦉');
  mascot.setAttribute('aria-hidden', 'true');
  return add(head, mascot, el('h1', 'title', 'Ребусы'));
}

export function renderHome(app, data, signal) {
  const { list, byId } = data;
  document.title = 'Ребусы для детей';
  app.className = 'app home';
  app.replaceChildren(header());

  if (!list.length) {
    add(app, el('p', 'empty', 'Ребусы скоро появятся! 🌱'));
    return;
  }

  const done = solvedCount(list);
  const prog = el('div', 'progress');
  prog.setAttribute('role', 'img');
  prog.setAttribute('aria-label', 'Отгадано ' + done + ' из ' + list.length);
  const pt = el('span', 'progress-text');
  add(pt, el('b', null, String(done)), document.createTextNode(' из ' + list.length));
  const bar = el('div', 'progress-bar');
  const fill = el('div', 'progress-fill');
  fill.style.width = (done / list.length) * 100 + '%';
  add(prog, el('span', 'progress-star', '⭐'), pt, add(bar, fill));
  add(app, prog);

  if (done === list.length) add(app, el('p', 'all-done', '🎉 Ты отгадал все ребусы! Ура!'));

  for (const L of LEVELS) {
    const items = list.filter((r) => (r.level || 1) === L.level);
    if (!items.length) continue;
    const sec = el('section', 'level ' + L.cls);
    const h = el('h2', 'level-title');
    add(h, el('span', 'level-dots', '●'.repeat(L.level)), document.createTextNode(' ' + L.title));
    const grid = el('div', 'grid');
    for (const r of items) {
      const { num } = byId[r.id];
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
        add(a, el('span', 'tile-mark', '👀'));
        label += ', ответ показан';
      } else if (st.tries > 0) {
        const left = Math.max(0, MAX_TRIES - st.tries);
        a.classList.add('started');
        add(a, el('span', 'tile-mark tile-hearts', '♥'.repeat(left)));
        label += ', осталось попыток: ' + left;
      }
      a.setAttribute('aria-label', label);
      add(grid, a);
    }
    add(app, add(sec, h, grid));
  }

  const reset = el('button', 'reset', 'Начать заново');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    let ok = true;
    try { ok = window.confirm('Начать заново? Все звёздочки пропадут.'); } catch { /* ignore */ }
    if (!ok) return;
    resetAll();
    renderHome(app, data, signal);
    const title = app.querySelector('h1');
    title.setAttribute('tabindex', '-1');
    title.focus();
  });
  const foot = el('footer', 'home-foot');
  add(app, add(foot, installBlock(signal), reset));
}

function installBlock(signal) {
  const box = el('div', 'install');
  const draw = () => {
    box.replaceChildren();
    if (!canInstall()) return;
    const b = el('button', 'install-btn', '📲 Установить на телефон');
    b.type = 'button';
    b.addEventListener('click', async () => {
      if ((await install()) === 'ios') {
        b.replaceWith(el('p', 'install-tip', 'Нажми «Поделиться» ⬆️, а потом «На экран „Домой“» ➕'));
      }
    });
    add(box, b);
  };
  draw();
  const off = onInstallChange(draw);
  if (signal) signal.addEventListener('abort', off, { once: true });
  return box;
}

export function renderStatus(app, kind, onRetry) {
  app.className = 'app home';
  app.replaceChildren(header());
  const box = el('div', 'status status-' + kind);
  if (kind === 'loading') {
    add(box, el('div', 'loader'), el('p', null, 'Загружаем ребусы…'));
    box.setAttribute('aria-busy', 'true');
  } else {
    add(box, el('div', 'status-icon', '🙈'), el('p', null, 'Не получилось загрузить ребусы.'),
      el('p', 'status-sub', 'Проверь интернет и попробуй ещё раз.'));
    const b = el('button', 'btn btn-check', 'Попробовать ещё раз');
    b.type = 'button';
    b.addEventListener('click', onRetry);
    add(box, b);
  }
  add(app, box);
}
