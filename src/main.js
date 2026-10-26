// Точка входа: загрузка данных и маршрутизация по hash (#/ и #/r/<id>).
// Только кириллица и латиница: остальные наборы глифов не нужны и лишь раздувают офлайн-кеш.
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './styles/main.css';
import { loadRebuses } from './data.js';
import { reload, STORE_KEY } from './store.js';
import { renderHome, renderStatus } from './ui/home.js';
import { renderRebus } from './ui/rebus.js';
import { clearConfetti } from './ui/confetti.js';

const app = document.getElementById('app');
let data = null;

function route() {
  if (!data) return;
  clearConfetti();
  const m = /^#\/r\/(.+)$/.exec(location.hash);
  if (m) {
    let id;
    try { id = decodeURIComponent(m[1]); } catch { id = m[1]; }
    renderRebus(app, data, id);
  } else {
    renderHome(app, data);
  }
  window.scrollTo(0, 0);
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

// Высота видимой области (меньше, когда открыта экранная клавиатура):
// экран ребуса подстраивается под неё, и картинка сжимается, а не уезжает.
function syncViewportHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', Math.round(h) + 'px');
}
syncViewportHeight();
(window.visualViewport || window).addEventListener('resize', syncViewportHeight);
window.addEventListener('orientationchange', syncViewportHeight);

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY || e.key === null) { reload(); route(); }
});
start();
