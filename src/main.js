// Точка входа: загрузка данных и маршрутизация по hash (#/, #/all, #/about, #/level/<n>, #/r/<id>).
// Только кириллица и латиница: остальные наборы глифов не нужны и лишь раздувают офлайн-кеш.
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './styles/main.css';
import { loadRebuses } from './data.js';
import { registerSW } from 'virtual:pwa-register';
import { getState, reload, STORE_KEY } from './store.js';
import { renderHome, renderStatus } from './ui/home.js';
import { renderRebus } from './ui/rebus.js';
import { renderAll } from './ui/all.js';
import { renderAbout } from './ui/about.js';
import { levelStart } from './levels.js';
import { clearConfetti } from './ui/confetti.js';

const app = document.getElementById('app');
let data = null;
let current = null; // { id, controller } — открытый экран
let lastLevel = null;
let lastId = null;
let backTo = '#/'; // куда ведёт «назад» с ребуса: на главную или к списку по номерам

function currentId() {
  const m = /^#\/r\/(.+)$/.exec(location.hash);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

// Перерисовка экрана. Слушатели прошлого экрана снимаются через AbortController.
function route({ keepScroll = false } = {}) {
  if (!data) return;
  clearConfetti();
  if (current) current.controller.abort();
  const lv = /^#\/level\/(\d)$/.exec(location.hash);
  if (lv) {
    const r = levelStart(data.list, Number(lv[1]));
    location.replace(r ? '#/r/' + encodeURIComponent(r.id) : '#/');
    return;
  }
  const id = currentId();
  current = { id, controller: new AbortController() };
  const { signal } = current.controller;
  if (id) {
    renderRebus(app, data, id, signal, backTo);
    if (data.byId[id]) { lastLevel = data.byId[id].rebus.level; lastId = id; }
  } else if (location.hash === '#/about') {
    renderAbout(app);
  } else if (location.hash === '#/all') {
    backTo = '#/all';
    renderAll(app, data);
  } else {
    backTo = '#/';
    renderHome(app, data, signal);
  }
  if (keepScroll) return;
  window.scrollTo(0, 0);
  focusAfterRoute(id);
}

// Для клавиатуры и скринридера: фокус на заголовок или на уровень, откуда пришли.
function focusAfterRoute(id) {
  const tile = !id && (location.hash === '#/all'
    ? lastId && app.querySelector(`.tile[data-id="${CSS.escape(lastId)}"]`)
    : lastLevel && app.querySelector(`.level-card[data-level="${lastLevel}"]`));
  const target = tile || app.querySelector('h1');
  if (!target) return;
  if (!tile) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

async function start() {
  renderStatus(app, 'loading');
  try {
    data = await loadRebuses();
  } catch (err) {
    console.error('Не удалось загрузить ребусы', err);
    renderStatus(app, 'error', start);
    return;
  }
  route();
}

// Видимая область (меньше, когда открыта экранная клавиатура). iOS при открытой
// клавиатуре ещё и прокручивает страницу — --vvtop говорит, где сейчас видимая часть.
// Экран ребуса встаёт ровно в неё: картинка сжимается, а не уезжает вверх.
function syncViewportHeight() {
  const vv = window.visualViewport;
  const root = document.documentElement.style;
  root.setProperty('--vvh', Math.round(vv ? vv.height : window.innerHeight) + 'px');
  root.setProperty('--vvtop', Math.round(vv ? vv.offsetTop : 0) + 'px');
}
syncViewportHeight();
(window.visualViewport || window).addEventListener('resize', syncViewportHeight);
if (window.visualViewport) window.visualViewport.addEventListener('scroll', syncViewportHeight);
window.addEventListener('orientationchange', syncViewportHeight);

window.addEventListener('hashchange', () => route());

// Прогресс поменяли в другой вкладке. Открытый ребус перерисовываем, только если
// поменялся именно он, чтобы не стереть то, что ребёнок сейчас печатает.
window.addEventListener('storage', (e) => {
  if (e.key !== STORE_KEY && e.key !== null) return;
  const id = currentId();
  const before = id && JSON.stringify(getState(id));
  reload();
  if (!id || before !== JSON.stringify(getState(id))) route({ keepScroll: true });
});

// Офлайн-режим. Service worker регистрируется после загрузки страницы, чтобы не
// отнимать канал у шрифтов. Открытое надолго приложение проверяет обновления, когда
// его снова показывают. Новую версию ставим (с перезагрузкой), только когда это
// не мешает: страница скрыта или ребёнок на главной, — чтобы не стереть набранный ответ.
let applyUpdate = null;
const updateIfIdle = () => {
  if (applyUpdate && (document.visibilityState === 'hidden' || !currentId())) applyUpdate();
};
window.addEventListener('hashchange', updateIfIdle);
document.addEventListener('visibilitychange', updateIfIdle);
const updateSW = registerSW({
  onNeedRefresh() {
    applyUpdate = () => { applyUpdate = null; updateSW(true); };
    updateIfIdle();
  },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  },
});
start();
