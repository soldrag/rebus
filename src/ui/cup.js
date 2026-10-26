// Награда за пройденный этап: кубок, звёзды этапа и путь дальше.
import { el, add } from './dom.js';
import { levelInfo, stages, stageProgress } from '../levels.js';
import { celebrate } from './confetti.js';

export function renderCup(app, data, level, index) {
  const all = stages(data.list, level);
  const items = all[index - 1];
  // Сюда попадают по кнопке после этапа; незаконченный этап — играем дальше.
  if (!items || !stageProgress(items).done) { location.replace('#/level/' + level); return; }
  const L = levelInfo(level);
  const p = stageProgress(items);
  document.title = 'Ребусы — кубок!';
  app.className = 'app cup';

  const box = el('section', 'cup-card');
  const trophy = el('div', 'cup-trophy', '🏆');
  trophy.setAttribute('aria-hidden', 'true');
  const title = el('h1', 'cup-title', all.length > 1 ? `Этап ${index} пройден!` : `${L.title} пройдены!`);
  add(box, trophy, title,
    el('p', 'cup-level', L.emoji + ' ' + L.title),
    el('p', 'cup-stars', '⭐ ' + p.solved + ' из ' + p.total));

  const actions = el('div', 'cup-actions');
  const hasNext = index < all.length;
  const next = el('a', 'btn btn-next', hasNext ? 'Следующий этап ▶' : 'На главную');
  next.href = hasNext ? '#/level/' + level : '#/';
  add(actions, next);
  if (hasNext) {
    const home = el('a', 'cup-home', 'На главную');
    home.href = '#/';
    add(actions, home);
  }
  app.replaceChildren(add(box, actions));
  celebrate();
}
