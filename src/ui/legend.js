// Мини-легенда ребусной записи: по карточке на каждый приём.
// Примеры не должны совпадать с ответами набора — их список в LEGEND_WORDS (rebus-core.js),
// валидатор это проверяет.
import { el, add } from './dom.js';
import { commaSvg, picEmoji, struckLetter, pickNumbers } from './board.js';

const stack = (...nodes) => add(el('div', 'legend-stack'), ...nodes);
const top = (...nodes) => add(el('div', 'part-top'), ...nodes);
const bigLetters = (text, cls = 'c0') => add(el('span', 'letters-row'), ...text.split('').map((ch) => el('span', 'big-letter ' + cls, ch)));

const CARDS = {
  comma: {
    title: 'Запятая — убери букву с этого края',
    words: 'КЛЮЧ → КЛЮ',
    sample() {
      const row = el('div', 'pic-row');
      const c = el('span', 'commas commas-r');
      add(c, commaSvg());
      return add(row, picEmoji('🔑', false), c);
    },
  },
  remove: {
    title: 'Зачёркнутая буква — убери её',
    words: 'ТОРТ → ТОТ',
    sample() {
      return stack(picEmoji('🎂', false), add(el('div', 'part-bottom'), struckLetter('Р')));
    },
  },
  replace: {
    title: 'Р = Н — замени букву',
    words: 'СЫР → СЫН',
    sample() {
      return stack(top(el('span', 'swap', 'Р = Н')), picEmoji('🧀', false));
    },
  },
  flip: {
    title: 'Вверх ногами — читай задом наперёд',
    words: 'КИТ → ТИК',
    sample() { return picEmoji('🐳', true); },
  },
  initials: {
    title: 'А… — возьми первые буквы картинок',
    words: 'СЛОН, ОБЛАКО, КЛЮЧ → СОК',
    sample() {
      return stack(top(el('span', 'initials-mark', 'А…')), add(el('div', 'pic-row initials-row'), picEmoji('🐘'), picEmoji('☁️'), picEmoji('🔑')));
    },
  },
  number: {
    title: 'Цифру читай словом',
    words: '100 + ЛБ → СТОЛБ',
    sample() { return add(el('div', 'pic-row'), el('span', 'num-digits', '100'), bigLetters('ЛБ')); },
  },
  pick: {
    title: 'Цифры сверху — возьми буквы с этими номерами, по порядку цифр',
    words: 'ЛИСА, 1 2 3 → ЛИС',
    sample() { return stack(top(pickNumbers([1, 2, 3])), picEmoji('🦊')); },
  },
  replaceAt: {
    title: '2 = О — поменяй вторую букву',
    words: 'СЫР → СОР',
    sample() { return stack(top(el('span', 'swap swap-n', '2 = О')), picEmoji('🧀')); },
  },
  in: {
    title: 'Буквы внутри буквы — добавь «В», чтобы вышло слово',
    words: 'СО в А → СОВА, РОТА в О → ВОРОТА',
    sample() {
      return add(el('span', 'position in'), add(el('span', 'pos-stack'), el('span', 'pos-outer c1', 'А'), el('span', 'pos-inner c0', 'СО')));
    },
  },
  on: {
    title: 'Буквы над буквами — читай со словом «НА»',
    words: 'КА на ВА → КАНАВА',
    sample() {
      return add(el('span', 'position on'), add(el('span', 'pos-stack'), el('span', 'pos-inner c0', 'КА'), el('span', 'pos-outer c1', 'ВА')));
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
