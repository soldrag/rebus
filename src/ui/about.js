// О приложении: условия использования, данные, лицензии.
import { el, add } from './dom.js';

const REPO = 'https://github.com/soldrag/rebus';
const GITHUB_PRIVACY = 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement';

function link(text, href) {
  const a = el('a', null, text);
  a.href = href;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}

function para(...parts) {
  const p = el('p');
  for (const x of parts) add(p, typeof x === 'string' ? document.createTextNode(x) : x);
  return p;
}

export function renderAbout(app) {
  document.title = 'Ребусы — о приложении';
  app.className = 'app about';
  const bar = el('div', 'topbar');
  const back = el('a', 'back', '←');
  back.href = '#/';
  back.setAttribute('aria-label', 'На главную');
  add(bar, back, el('h1', 'rebus-num', 'О приложении'));

  const card = el('article', 'about-card');
  add(card,
    el('h2', null, 'Как есть'),
    para('Ребусы для детей 5–8 лет. Бесплатно, для всех, кто захочет. Приложение предоставляется «как есть», без каких-либо гарантий и обязательств.'),
    el('h2', null, 'Данные'),
    para('Приложение ничего не собирает и никуда не отправляет: нет регистрации, рекламы, аналитики, трекеров и cookies. Прогресс (какие ребусы отгаданы) хранится только в браузере на этом устройстве. Его можно стереть кнопкой «Начать заново» или очисткой данных сайта.'),
    para('Сайт размещён на GitHub Pages. Как любой хостинг, GitHub обрабатывает технические данные запросов (например, IP-адрес) — по ',
      link('своей политике конфиденциальности', GITHUB_PRIVACY), '.'),
    el('h2', null, 'Исходный код и лицензии'),
    para('Код открыт: ', link('github.com/soldrag/rebus', REPO), ' (лицензия MIT). Сторонние компоненты — шрифт Nunito, Workbox, иконка из Noto Emoji: ',
      link('лицензии', 'licenses.txt'), '.'),
  );
  app.replaceChildren(bar, card);
}
