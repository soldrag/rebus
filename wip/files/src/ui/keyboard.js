// Своя экранная клавиатура для ответа — вместо системной. Системную не открываем вовсе:
// на iPhone над ней всегда висит полоска ↑↓✓ (убрать её страница не может), плашка адреса
// Safari наезжает на кнопки, а сам экран прыгает, когда клавиатура выезжает и уезжает.
// Своя клавиатура всегда на месте, её размер известен заранее — раскладка не меняется.
import { el, add } from './dom.js';

// ЙЦУКЕН по 11 клавиш в ряду: Ё и Ъ — в нижнем ряду (Ъ рядом с Ь), стереть и «Проверить» — отдельным рядом.
export const ROWS = ['ЙЦУКЕНГШЩЗХ', 'ФЫВАПРОЛДЖЭ', 'ЁЯЧСМИТЬЪБЮ'];

// Физические клавиши (KeyboardEvent.code) → буквы ЙЦУКЕН: на ПК можно печатать,
// не переключая раскладку с английской на русскую.
const CODES = {
  KeyQ: 'Й', KeyW: 'Ц', KeyE: 'У', KeyR: 'К', KeyT: 'Е', KeyY: 'Н', KeyU: 'Г', KeyI: 'Ш', KeyO: 'Щ', KeyP: 'З',
  BracketLeft: 'Х', BracketRight: 'Ъ', KeyA: 'Ф', KeyS: 'Ы', KeyD: 'В', KeyF: 'А', KeyG: 'П', KeyH: 'Р',
  KeyJ: 'О', KeyK: 'Л', KeyL: 'Д', Semicolon: 'Ж', Quote: 'Э', KeyZ: 'Я', KeyX: 'Ч', KeyC: 'С', KeyV: 'М',
  KeyB: 'И', KeyN: 'Т', KeyM: 'Ь', Comma: 'Б', Period: 'Ю', Backquote: 'Ё',
};

// Буква, которую означает нажатие физической клавиши, или null.
export function letterOf(e) {
  const k = e.key && e.key.length === 1 ? e.key.toUpperCase() : '';
  if (/^[А-ЯЁ]$/.test(k)) return k;
  return CODES[e.code] || null;
}

const REPEAT_AFTER = 450; // долгое нажатие «стереть»: через столько начинает стирать подряд
const REPEAT_EVERY = 90;

// Нажатие — сразу по pointerdown (без задержки и без ожидания отпускания пальца).
// Клавиатура (Tab + Enter) и экранный диктор нажимают кнопку «кликом» без pointerdown —
// его тоже принимаем, но не второй раз после касания.
function bindKey(btn, act, { repeat = false, onRelease = false } = {}) {
  let lastDown = 0;
  let holdT = null;
  let holdI = null;
  let upT = null;
  const stop = () => {
    clearTimeout(holdT);
    clearInterval(holdI);
    holdT = holdI = null;
    clearTimeout(upT);
    upT = setTimeout(() => btn.classList.remove('down'), 90);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault(); // не выделять текст и не открывать меню долгого нажатия
    lastDown = Date.now();
    clearTimeout(upT);
    btn.classList.add('down');
    if (onRelease) return;
    act();
    if (repeat) holdT = setTimeout(() => { holdI = setInterval(act, REPEAT_EVERY); }, REPEAT_AFTER);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', () => {
    if (onRelease || Date.now() - lastDown > 700) act();
  });
}

export function createKeyboard({ onLetter, onErase, onCheck }) {
  const kbd = el('div', 'kbd');
  kbd.setAttribute('role', 'group');
  kbd.setAttribute('aria-label', 'Клавиатура');
  // Мышью — не забирать фокус с экрана (иначе Enter нажмёт последнюю кнопку, а не «Проверить»).
  kbd.addEventListener('mousedown', (e) => e.preventDefault());
  kbd.addEventListener('contextmenu', (e) => e.preventDefault());
  const keys = new Map();
  const key = (cls, label, aria) => {
    const b = el('button', 'key ' + cls);
    b.type = 'button';
    const cap = add(el('span', 'key-cap'), typeof label === 'string' ? document.createTextNode(label) : label);
    add(b, cap);
    b.setAttribute('aria-label', aria);
    return b;
  };
  for (const row of ROWS) {
    const r = el('div', 'kbd-row');
    for (const ch of row) {
      const b = key('key-letter', ch, ch.toLowerCase());
      bindKey(b, () => onLetter(ch));
      keys.set(ch, b);
      add(r, b);
    }
    add(kbd, r);
  }
  // Значок «стереть» рисуем сами: в шрифте Nunito символа ⌫ нет, а запасной везде разный.
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 32 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<path d="M11 2h17a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H11L1.5 12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'
    + '<path d="M15 7.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>';
  const erase = key('key-erase', icon, 'Стереть букву');
  bindKey(erase, onErase, { repeat: true });
  // «Проверить» — по отпусканию: палец можно увести с кнопки, если нажал случайно.
  const check = key('key-check', 'Проверить', 'Проверить');
  bindKey(check, onCheck, { onRelease: true });
  keys.set('⌫', erase);
  keys.set('↵', check);
  add(kbd, add(el('div', 'kbd-row kbd-actions'), erase, check));

  return {
    node: kbd,
    // Подсветить клавишу, когда печатают на физической клавиатуре.
    flash(ch) {
      const b = keys.get(ch);
      if (!b) return;
      b.classList.add('down');
      setTimeout(() => b.classList.remove('down'), 120);
    },
    close() {
      kbd.inert = true;
      kbd.setAttribute('aria-hidden', 'true');
      kbd.classList.add('gone');
    },
  };
}
