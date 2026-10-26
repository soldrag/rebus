// Мини-легенда ребусной записи: что значат запятые, зачёркнутая буква, «=», перевёрнутая картинка.
import { el, add } from './dom.js';
import { commaSvg, picEmoji, struckLetter } from './board.js';

const CARDS = {
  comma: {
    title: 'Запятая — убери букву с этого края',
    words: 'КОТ → КО',
    sample() {
      const row = el('div', 'pic-row');
      const c = el('span', 'commas commas-r');
      add(c, commaSvg());
      return add(row, picEmoji('🐱', false), c);
    },
  },
  remove: {
    title: 'Зачёркнутая буква — убери её',
    words: 'СЛОН → СОН',
    sample() {
      const box = el('div', 'legend-stack');
      return add(box, picEmoji('🐘', false), add(el('div', 'part-bottom'), struckLetter('Л')));
    },
  },
  replace: {
    title: 'З = С — замени букву',
    words: 'КОЗА → КОСА',
    sample() {
      const box = el('div', 'legend-stack');
      return add(box, add(el('div', 'part-top'), el('span', 'swap', 'З = С')), picEmoji('🐐', false));
    },
  },
  flip: {
    title: 'Вверх ногами — читай задом наперёд',
    words: 'КОТ → ТОК',
    sample() { return picEmoji('🐱', true); },
  },
};
export const ALL_KINDS = Object.keys(CARDS);

// Открывает легенду. kinds — какие карточки показать; fresh — «новый значок».
export function openLegend(kinds, { fresh = false, onClose } = {}) {
  const dlg = el('dialog', 'legend');
  dlg.setAttribute('aria-labelledby', 'legend-title');
  const title = el('h2', 'legend-title', fresh ? 'Новый значок! 👀' : 'Как читать ребус');
  title.id = 'legend-title';
  const list = el('div', 'legend-cards' + (kinds.length === 1 ? ' single' : ''));
  for (const k of kinds) {
    const c = CARDS[k];
    if (!c) continue;
    const card = el('div', 'legend-card');
    const pic = add(el('div', 'legend-pic'), c.sample());
    pic.setAttribute('aria-hidden', 'true');
    add(card, pic, add(el('div', 'legend-text'), el('p', 'legend-card-title', c.title), el('p', 'legend-words', c.words)));
    add(list, card);
  }
  const ok = el('button', 'btn btn-next legend-ok', 'Понятно!');
  ok.type = 'button';
  add(dlg, title, list, ok);
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
  ok.focus({ preventScroll: true });
  return close;
}
