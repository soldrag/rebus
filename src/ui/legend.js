// Мини-легенда ребусной записи: по карточке на каждый приём.
// Примеры не должны совпадать с ответами набора, а картинки должны быть разрешены реестром:
// слова и картинки перечислены в LEGEND_WORDS и LEGEND_PICTURES (rebus-core.js), валидатор это проверяет.
import { el, add } from './dom.js';
import { renderPart, fitRelations } from './board.js';

// Карточка легенды собирается из тех же заготовок, что и доска ребуса (board.js → renderPart):
// пример — это узлы ребуса, поэтому значок в легенде выглядит ровно как в ребусе.
const pic = (emoji, word, ops = {}) => ({ type: 'pic', emoji, word, ...ops });
const letters = (text) => ({ type: 'letters', text });
const rel = (prep, inner, outer) => ({ type: 'position', prep, inner, outer });

const CARDS = {
  plain: {
    title: 'Назови картинки и прочитай всё подряд, слева направо',
    words: 'КИТ + Ы → КИТЫ',
    parts: [pic('🐳', 'КИТ'), letters('Ы')],
  },
  comma: {
    title: 'Запятая — убери букву с этого края',
    words: 'КЛЮЧ → КЛЮ',
    parts: [pic('🔑', 'КЛЮЧ', { cutEnd: 1 })],
  },
  remove: {
    title: 'Зачёркнутая буква — убери её',
    words: 'ТОРТ → ТОТ',
    parts: [pic('🎂', 'ТОРТ', { remove: ['Р'] })],
  },
  replace: {
    title: 'Р = Н — замени букву',
    words: 'СЫР → СЫН',
    parts: [pic('🧀', 'СЫР', { replace: [['Р', 'Н']] })],
  },
  flip: {
    title: 'Вверх ногами — читай задом наперёд',
    words: 'ТОРТ → ТРОТ',
    parts: [pic('🎂', 'ТОРТ', { flip: true })],
  },
  initials: {
    title: 'А… — возьми первые буквы картинок',
    words: 'КЕНГУРУ, УТКА, БЕГЕМОТ → КУБ',
    parts: [{ type: 'initials', items: [pic('🦘', 'КЕНГУРУ'), pic('🦆', 'УТКА'), pic('🦛', 'БЕГЕМОТ')] }],
  },
  number: {
    title: 'Цифру читай словом',
    words: '100 + ЛБ → СТОЛБ',
    parts: [{ type: 'number', value: 100, word: 'СТО' }, letters('ЛБ')],
  },
  pick: {
    title: 'Цифры сверху — возьми буквы с этими номерами, по порядку цифр',
    words: 'ЛИСА, 1 2 3 → ЛИС',
    parts: [pic('🦊', 'ЛИСА', { pick: [1, 2, 3] })],
  },
  replaceAt: {
    title: '2 = О — поменяй вторую букву',
    words: 'СЫР → СОР',
    parts: [pic('🧀', 'СЫР', { replaceAt: [[2, 'О']] })],
  },
  // Отношения: рисунок показывает только, ГДЕ части стоят (docs/VISUAL-LANGUAGE.md);
  // подпись — фраза с предлогом, как ребёнок называет увиденное, и ответ.
  in: {
    title: 'Внутри: маленькое лежит в большой букве-контуре',
    words: 'СО в А → СОВА',
    parts: [rel('В', 'СО', 'А')],
  },
  on: {
    title: 'Сверху: стоит на другом вплотную',
    words: 'КА на ВА → КАНАВА',
    parts: [rel('НА', 'КА', 'ВА')],
  },
  under: {
    title: 'Снизу: стоит под другим вплотную',
    words: 'под К — ОВА → ПОДКОВА',
    parts: [rel('ПОД', 'ОВА', 'К')],
  },
  near: {
    title: 'Рядом: маленькое вплотную слева от большого',
    words: 'К у Б → КУБ',
    parts: [rel('У', 'К', 'Б')],
  },
  behind: {
    title: 'Сзади: заднее — контуром, переднее закрывает его угол',
    words: 'за К — АТ → ЗАКАТ',
    parts: [rel('ЗА', 'АТ', 'К')],
  },
};

const sample = (parts) => {
  const seed = { n: 0 };
  return add(el('div', 'legend-sample'), ...parts.map((p) => renderPart(p, seed)));
};
// Отношения (предлоги) — для общего правила чтения над карточками.
const RELATION_KINDS = ['in', 'on', 'under', 'near', 'behind'];
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
    ? el('p', 'legend-rule', 'Назови, что видишь, со словом-предлогом. Читай как книгу: сверху вниз, слева направо. Контур — то, что вмещает или стоит сзади.')
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
