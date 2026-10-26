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
  add(app, prog, installBlock(signal));

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
        add(a, el('span', 'tile-mark', '💡'));
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

  const reset = holdButton('Начать заново', 'Держи, чтобы начать заново', () => {
    resetAll();
    renderHome(app, data, signal);
    const title = app.querySelector('h1');
    title.setAttribute('tabindex', '-1');
    title.focus();
  }, signal);
  add(app, add(el('footer', 'home-foot'), reset));
}

// Кнопка, которая срабатывает только после удержания (~1,5 с): защита от случайного нажатия.
// Работает пальцем, мышью и клавиатурой (удержание пробела или Enter).
const HOLD_MS = 1500;
function holdButton(label, caption, onDone, signal) {
  const wrap = el('div', 'hold');
  const b = el('button', 'reset hold-btn');
  b.type = 'button';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'hold-ring');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('pathLength', '100');
  svg.appendChild(rect);
  add(b, svg, el('span', 'hold-label', label));
  const cap = el('p', 'hold-caption', caption);
  cap.id = 'hold-caption';
  b.setAttribute('aria-describedby', cap.id);

  let timer = 0;
  const start = () => {
    if (timer) return;
    b.classList.add('holding');
    timer = setTimeout(() => { timer = 0; b.classList.remove('holding'); onDone(); }, HOLD_MS);
  };
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
    b.classList.remove('holding');
  };
  const opts = signal ? { signal } : undefined;
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    start();
  }, opts);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) b.addEventListener(t, stop, opts);
  b.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
  b.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) start();
  }, opts);
  b.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); }
  }, opts);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (!timer) { cap.classList.remove('nudge'); void cap.offsetWidth; cap.classList.add('nudge'); }
  }, opts);
  if (signal) signal.addEventListener('abort', stop, { once: true });
  return add(wrap, b, cap);
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
