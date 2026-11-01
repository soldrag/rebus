// Мини-легенда ребусной записи: по карточке на каждый приём.
// Примеры карточек — в src/legend-data.js (там же — правила для слов и картинок примеров).
import { el, add } from './dom.js';
import { renderPart, fitRelations } from './board.js';
import { POSITIONS } from '../core/solve.js';
import { CARDS } from '../legend-data.js';

const sample = (parts) => {
  const seed = { n: 0 };
  return add(el('div', 'legend-sample'), ...parts.map((p) => renderPart(p, seed)));
};
// Отношения (предлоги) — для общего правила чтения над карточками.
const RELATION_KINDS = Object.values(POSITIONS).map((p) => p.tech);
// Приёмы с карточками; «plain» — только для ребусов без особых значков, сам не показывается.
export const ALL_KINDS = Object.keys(CARDS).filter((k) => k !== 'plain');

// Открывает легенду. kinds — какие карточки показать; fresh — «новый значок».
export function openLegend(kinds, { fresh = false, onClose } = {}) {
  const dlg = el('dialog', 'legend');
  dlg.setAttribute('aria-labelledby', 'legend-title');
  const title = el('h2', 'legend-title', fresh ? 'Новый значок! 👀' : 'Как читать ребус');
  title.id = 'legend-title';
  const list = el('div', 'legend-cards' + (kinds.length === 1 ? ' single' : ''));
  // Общее правило чтения предлогов — один раз, если в легенде есть хоть одно отношение.
  const rule = kinds.some((k) => RELATION_KINDS.includes(k))
    ? el('p', 'legend-rule', 'Читай сверху вниз и слева направо.')
    : null;
  for (const k of kinds) {
    const c = CARDS[k];
    if (!c) continue;
    const card = el('div', 'legend-card');
    const box = add(el('div', 'legend-pic'), sample(c.parts));
    box.setAttribute('aria-hidden', 'true');
    add(card, box, add(el('div', 'legend-text'), el('p', 'legend-card-title', c.title), el('p', 'legend-words', c.words)));
    add(list, card);
  }
  const ok = el('button', 'btn btn-next legend-ok', 'Понятно!');
  ok.type = 'button';
  add(dlg, title, rule, list, ok);
  document.body.appendChild(dlg);

  const close = () => {
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    else dlg.dispatchEvent(new Event('close'));
  };
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (onClose) onClose();
  }, { once: true });
  ok.addEventListener('click', close);
  // Нажатие на затемнённый фон тоже закрывает.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  if (typeof dlg.showModal === 'function') dlg.showModal();
  else { dlg.setAttribute('open', ''); dlg.classList.add('no-modal'); }
  fitRelations(dlg);
  ok.focus({ preventScroll: true });
  return close;
}
