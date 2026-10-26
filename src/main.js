// Точка входа: загрузка данных и маршрутизация по hash
// (#/, #/all, #/about, #/level/<n>, #/r/<id>, #/cup/<уровень>/<этап>).
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
import { renderCup } from './ui/cup.js';
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
  } else if (/^#\/cup\/\d\/\d+$/.test(location.hash)) {
    const [, level, stage] = location.hash.match(/(\d)\/(\d+)$/);
    renderCup(app, data, Number(level), Number(stage));
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

// Высота экрана для раскладки (--app-h) и класс раскладки на <html>. Экранная клавиатура их НЕ меняет:
// макет заранее оставляет под клавиатуру место, поэтому при её появлении ничего
// не прыгает. Обновляем при повороте/смене ширины и при изменении окна, пока
// не идёт ввод (на Android с resizes-content клавиатура уменьшает окно).
let appW = 0;
function syncAppHeight() {
  const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  const cw = document.documentElement.clientWidth;
  if (typing && cw === appW) return;
  appW = cw;
  const w = window.innerWidth, h = window.innerHeight;
  const root = document.documentElement;
  root.style.setProperty('--app-h', h + 'px');
  // Раскладка экрана ребуса — классами, а не media-запросами по ориентации:
  // на Android (resizes-content) клавиатура уменьшает окно, и планшет «становится»
  // альбомным. Классы меняются только вместе с --app-h, то есть не во время ввода.
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const portrait = h >= w;
  const land = !portrait && (h <= 560 || coarse);
  root.classList.toggle('lay-portrait', portrait);
  root.classList.toggle('lay-portrait-wide', portrait && w >= 600);
  root.classList.toggle('lay-land', land);
  root.classList.toggle('lay-land-phone', !portrait && h <= 560);
  root.classList.toggle('lay-short', h <= 820 && w >= 600);
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 300));

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
