// Главный экран: три больших кнопки уровней с прогрессом.
import { el, add } from './dom.js';
import { resetAll, solvedCount } from '../store.js';
import { canInstall, install, onInstallChange } from '../install.js';
import { LEVELS, levelProgress } from '../levels.js';

function header() {
  const head = el('header', 'home-head');
  const mascot = el('span', 'mascot', '🦉');
  mascot.setAttribute('aria-hidden', 'true');
  return add(head, mascot, el('h1', 'title', 'Ребусы'));
}

function levelCard(list, L) {
  const p = levelProgress(list, L.level);
  const a = el('a', 'level-card ' + L.cls + (p.done ? ' done' : ''));
  a.href = '#/level/' + L.level;
  a.dataset.level = String(L.level);
  const icon = el('span', 'level-emoji', L.emoji);
  icon.setAttribute('aria-hidden', 'true');
  const body = el('span', 'level-body');
  const bar = el('span', 'level-bar');
  const fill = el('span', 'level-fill');
  fill.style.width = (p.total ? (p.finished / p.total) * 100 : 0) + '%';
  add(body,
    el('span', 'level-name', L.title),
    el('span', 'level-count', '⭐ ' + p.solved + ' из ' + p.total),
    add(bar, fill));
  const cta = p.done ? 'Ещё раз' : p.finished ? 'Дальше' : 'Играть';
  add(a, icon, body, el('span', 'level-go', p.done ? '🏆' : '▶'));
  a.setAttribute('aria-label', `${L.title}: отгадано ${p.solved} из ${p.total}. ${cta}`);
  return a;
}

export function renderHome(app, data, signal) {
  const { list } = data;
  document.title = 'Ребусы для детей';
  app.className = 'app home';
  app.replaceChildren(header());

  if (!list.length) {
    add(app, el('p', 'empty', 'Ребусы скоро появятся! 🌱'));
    return;
  }

  const done = solvedCount(list);
  if (done === list.length) add(app, el('p', 'all-done', '🎉 Ты отгадал все ребусы! Ура!'));

  const levels = el('nav', 'levels');
  levels.setAttribute('aria-label', 'Уровни');
  for (const L of LEVELS) {
    if (levelProgress(list, L.level).total) add(levels, levelCard(list, L));
  }
  add(app, levels);

  const reset = holdButton('Начать заново', 'Держи, чтобы начать заново', () => {
    resetAll();
    renderHome(app, data, signal);
    const title = app.querySelector('h1');
    title.setAttribute('tabindex', '-1');
    title.focus();
  }, signal);
  add(app, add(el('footer', 'home-foot'), installBlock(signal), reset));
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
