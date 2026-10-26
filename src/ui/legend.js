// Мини-легенда ребусной записи: по карточке на каждый приём.
import { el, add } from './dom.js';
import { commaSvg, picEmoji, struckLetter, pickNumbers } from './board.js';

const stack = (...nodes) => add(el('div', 'legend-stack'), ...nodes);
const top = (...nodes) => add(el('div', 'part-top'), ...nodes);
const bigLetters = (text, cls = 'c0') => add(el('span', 'letters-row'), ...text.split('').map((ch) => el('span', 'big-letter ' + cls, ch)));

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
      return stack(picEmoji('🐘', false), add(el('div', 'part-bottom'), struckLetter('Л')));
    },
  },
  replace: {
    title: 'З = С — замени букву',
    words: 'КОЗА → КОСА',
    sample() {
      return stack(top(el('span', 'swap', 'З = С')), picEmoji('🐐', false));
    },
  },
  flip: {
    title: 'Вверх ногами — читай задом наперёд',
    words: 'КОТ → ТОК',
    sample() { return picEmoji('🐱', true); },
  },
  initials: {
    title: 'А… — возьми первые буквы картинок',
    words: 'МЫШЬ, АРБУЗ, КОТ → МАК',
    sample() {
      return stack(top(el('span', 'initials-mark', 'А…')), add(el('div', 'pic-row initials-row'), picEmoji('🐭'), picEmoji('🍉'), picEmoji('🐈')));
    },
  },
  number: {
    title: 'Цифру читай словом',
    words: '7 + Я → СЕМЬЯ',
    sample() { return add(el('div', 'pic-row'), el('span', 'num-digits', '7'), bigLetters('Я')); },
  },
  pick: {
    title: 'Цифры сверху — возьми буквы с этими номерами',
    words: 'КОТ, 3 2 1 → ТОК',
    sample() { return stack(top(pickNumbers([3, 2, 1])), picEmoji('🐱')); },
  },
  replaceAt: {
    title: '2 = И — поменяй вторую букву',
    words: 'КОТ → КИТ',
    sample() { return stack(top(el('span', 'swap swap-n', '2 = И')), picEmoji('🐱')); },
  },
  in: {
    title: 'Буквы внутри буквы — читай со словом «В»',
    words: 'ДА в О → ВОДА',
    sample() {
      return add(el('span', 'position in'), add(el('span', 'pos-stack'), el('span', 'pos-outer c1', 'О'), el('span', 'pos-inner c0', 'ДА')));
    },
  },
  on: {
    title: 'Буквы над буквами — читай со словом «НА»',
    words: 'ПА на МА → ПАНАМА',
    sample() {
      return add(el('span', 'position on'), add(el('span', 'pos-stack'), el('span', 'pos-inner c0', 'ПА'), el('span', 'pos-outer c1', 'МА')));
    },
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
