// Экран одного ребуса: картинка, ввод ответа, сердечки, итог.
import { normalize, isCorrect } from '../rebus-core.js';
import { el, add, reduceMotion, finePointer } from './dom.js';
import { getState, setState, MAX_TRIES, hasSeen, markSeen } from '../store.js';
import { levelInfo, levelNext, levelProgress } from '../levels.js';
import { renderBoard, renderExplain, techniques, show } from './board.js';
import { openLegend, ALL_KINDS } from './legend.js';
import { celebrate } from './confetti.js';

const HINT_AFTER = 2;
const CLOSE_PHRASES = ['Почти! Попробуй ещё 🙂', 'Совсем близко! Ещё разок 💪'];
const FAR_PHRASES = ['Не то слово, попробуй ещё 🙂', 'Посмотри на картинку ещё раз 👀'];

// Расстояние Левенштейна: насколько ответ похож на правильный.
function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function isClose(rebus, input) {
  const n = normalize(input);
  return [rebus.answer].concat(rebus.accept || []).some((a) => distance(normalize(a), n) <= 2);
}

// «Дальше» — следующий ребус того же уровня; когда уровень пройден — на главную.
function nextButton(data, rebus) {
  const n = levelNext(data.list, rebus);
  const b = el('button', 'btn btn-next', n ? 'Дальше →' : 'Уровень пройден! 🏆');
  b.type = 'button';
  b.addEventListener('click', () => {
    location.hash = n ? '#/r/' + encodeURIComponent(n.id) : '#/';
  });
  return b;
}

function renderHearts(tries) {
  const h = el('div', 'hearts');
  h.setAttribute('role', 'img');
  for (let i = 0; i < MAX_TRIES; i++) add(h, el('span', 'heart' + (i < MAX_TRIES - tries ? '' : ' off'), '❤️'));
  updateHeartsLabel(h, tries);
  return h;
}
function updateHeartsLabel(h, tries) {
  h.setAttribute('aria-label', 'Осталось попыток: ' + (MAX_TRIES - tries));
}

// После двух ошибок появляется кнопка; сама подсказка — только по нажатию.
function renderHintButton(rebus) {
  const b = el('button', 'hint-btn', '💡 Подсказка');
  b.type = 'button';
  b.addEventListener('click', () => {
    const box = el('p', 'hint');
    box.setAttribute('role', 'status');
    add(box, el('span', 'hint-label', '💡 Подсказка'), el('span', 'hint-text', rebus.hint));
    b.replaceWith(box);
  });
  return b;
}

// Фокус на кнопку «Дальше»: экранную клавиатуру он не открывает, поэтому и на телефоне.
function focusSoon(node) {
  if (node) setTimeout(() => node.focus({ preventScroll: true }), 60);
}

function markDone(panel) {
  const app = panel.closest('.app');
  if (app) app.classList.add('done');
}

function showSolved(panel, rebus, data, fresh) {
  markDone(panel);
  const res = el('div', 'result ok');
  res.setAttribute('role', 'status');
  add(res, el('p', 'result-title', fresh ? 'Молодец! 🎉' : 'Отгадано! ⭐'), el('p', 'result-word', show(rebus.answer)));
  const actions = add(el('div', 'actions'), nextButton(data, rebus));
  panel.replaceChildren(res, actions);
  if (!fresh) add(panel, renderExplain(rebus));
  panel.scrollTop = 0;
  if (fresh) celebrate();
  focusSoon(actions.firstChild);
}

function showRevealed(panel, rebus, data) {
  markDone(panel);
  const res = el('div', 'result reveal');
  res.setAttribute('role', 'status');
  add(res, el('p', 'result-title', 'Вот какое слово было!'), el('p', 'result-word', show(rebus.answer)));
  const actions = add(el('div', 'actions'), nextButton(data, rebus));
  panel.replaceChildren(res, renderExplain(rebus), actions);
  panel.scrollTop = 0;
  focusSoon(actions.firstChild);
}

// Класс kb-open: открыта экранная клавиатура (видимая область заметно ниже обычной).
// Обычную высоту запоминаем для текущей ширины экрана.
function watchKeyboard(app, input, signal) {
  const vv = window.visualViewport;
  let width = window.innerWidth;
  let full = vv ? vv.height : window.innerHeight;
  const check = () => {
    const h = vv ? vv.height : window.innerHeight;
    if (window.innerWidth !== width) { width = window.innerWidth; full = h; }
    if (document.activeElement !== input) full = Math.max(full, h);
    const open = document.activeElement === input && h < full * 0.75;
    app.classList.toggle('kb-open', open);
  };
  (vv || window).addEventListener('resize', check, { signal });
  input.addEventListener('focus', check, { signal });
  input.addEventListener('blur', () => { app.classList.remove('kb-open'); }, { signal });
  return check;
}

export function renderRebus(app, data, id, signal, backTo = '#/') {
  const info = data.byId[id];
  if (!info) { location.replace('#/'); return; }
  const { rebus } = info;
  const st = getState(id);
  const L = levelInfo(rebus.level);
  document.title = 'Ребусы — ' + L.title;
  app.className = 'app play';

  const bar = el('div', 'topbar');
  const back = el('a', 'back', '←');
  back.href = backTo;
  back.setAttribute('aria-label', backTo === '#/' ? 'На главную' : 'Ко всем ребусам');
  const stars = el('span', 'mini-stars');
  const updateStars = () => {
    const p = levelProgress(data.list, rebus.level);
    stars.textContent = '⭐ ' + p.solved + '/' + p.total;
  };
  updateStars();
  const help = el('button', 'help-btn', '?');
  help.type = 'button';
  help.setAttribute('aria-label', 'Как читать ребус');
  add(bar, back, el('h1', 'rebus-num', L.emoji + ' ' + L.title), stars, help);

  const card = el('section', 'card');
  const panel = el('div', 'panel');
  add(card, renderBoard(rebus, signal), panel);
  app.replaceChildren(bar, card);

  let closeLegend = null;
  if (signal) signal.addEventListener('abort', () => { if (closeLegend) closeLegend(); }, { once: true });
  const showLegend = (kinds, fresh, after) => {
    if (closeLegend) return;
    closeLegend = openLegend(kinds, { fresh, onClose: () => { closeLegend = null; if (after) after(); } });
  };
  help.addEventListener('click', () => {
    // Сначала приёмы из этого ребуса, запятые — в конце.
    const own = techniques(rebus).filter((k) => k !== 'comma');
    const kinds = own.concat(ALL_KINDS.filter((k) => !own.includes(k) && k !== 'comma'), ['comma']);
    showLegend(kinds, false, () => help.focus());
  });

  if (st.status === 'solved') return showSolved(panel, rebus, data, false);
  if (st.status === 'revealed') return showRevealed(panel, rebus, data);

  const form = el('form', 'answer');
  form.setAttribute('autocomplete', 'off');
  form.noValidate = true;
  const input = el('input', 'answer-input');
  Object.assign(input, { type: 'text', name: 'answer', placeholder: 'Что тут спрятано?', maxLength: 40 });
  for (const [k, v] of Object.entries({
    autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    inputmode: 'text', lang: 'ru', enterkeyhint: 'done', 'aria-label': 'Твой ответ',
  })) input.setAttribute(k, v);
  const btn = el('button', 'btn btn-check', 'Проверить');
  btn.type = 'submit';
  add(form, input, btn);

  const hearts = renderHearts(st.tries);
  const msg = el('p', 'msg');
  msg.setAttribute('role', 'status');
  const hintSlot = el('div', 'hint-slot');
  if (rebus.hint && st.tries >= HINT_AFTER) add(hintSlot, renderHintButton(rebus));
  add(panel, hearts, form, msg, hintSlot);

  const checkKeyboard = watchKeyboard(app, input, signal);
  // Экранная клавиатура не должна закрывать поле.
  const keepVisible = () => {
    checkKeyboard();
    // С открытой клавиатурой экран и так закреплён в видимой области.
    if (document.activeElement !== input || app.classList.contains('kb-open')) return;
    try { btn.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
    catch { btn.scrollIntoView(false); }
  };
  input.addEventListener('focus', () => setTimeout(keepVisible, 350), { signal });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', keepVisible, { signal });
  input.addEventListener('input', () => {
    input.classList.remove('shake');
    if (msg.classList.contains('empty-note')) { msg.textContent = ''; msg.className = 'msg'; }
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const val = input.value;
    if (!normalize(val)) {
      msg.textContent = 'Напиши слово 🙂';
      msg.className = 'msg empty-note';
      input.focus();
      return;
    }
    if (isCorrect(rebus, val)) {
      setState(id, { tries: st.tries, status: 'solved' });
      input.blur();
      updateStars();
      showSolved(panel, rebus, data, true);
      return;
    }
    st.tries += 1;
    if (st.tries >= MAX_TRIES) {
      setState(id, { tries: st.tries, status: 'revealed' });
      input.blur();
      showRevealed(panel, rebus, data);
      return;
    }
    setState(id, { tries: st.tries });
    const lost = hearts.children[MAX_TRIES - st.tries];
    if (lost) lost.classList.add('off', 'losing');
    updateHeartsLabel(hearts, st.tries);
    input.classList.remove('shake');
    void input.offsetWidth; // перезапуск анимации
    input.classList.add('shake');
    const phrases = isClose(rebus, val) ? CLOSE_PHRASES : FAR_PHRASES;
    msg.textContent = phrases[(st.tries - 1) % phrases.length];
    msg.className = 'msg try';
    if (rebus.hint && st.tries >= HINT_AFTER && !hintSlot.firstChild) add(hintSlot, renderHintButton(rebus));
    // Поле очищаем, а не выделяем: выделение вызывает на телефоне меню «Копировать».
    input.value = '';
    input.placeholder = 'Попробуй ещё';
  });

  const focusInput = () => { if (finePointer()) input.focus({ preventScroll: true }); };
  // Новый для ребёнка приём записи — один раз показываем легенду.
  // Запятые ребёнок знает — для них легенду сам не показываем.
  const fresh = techniques(rebus).filter((k) => k !== 'comma' && !hasSeen(k));
  if (fresh.length) {
    setTimeout(() => {
      if (signal && signal.aborted) return;
      markSeen(fresh);
      showLegend(fresh, true, focusInput);
    }, 250);
  } else {
    setTimeout(focusInput, 50);
  }
}
