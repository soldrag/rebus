// Экран одного ребуса: картинка, ввод ответа, сердечки, итог.
import { normalize, isCorrect } from '../rebus-core.js';
import { el, add, reduceMotion, finePointer } from './dom.js';
import { getState, setState, solvedCount, MAX_TRIES } from '../store.js';
import { renderBoard, renderExplain } from './board.js';
import { celebrate } from './confetti.js';

const HINT_AFTER = 2;
const TRY_PHRASES = ['Почти! Попробуй ещё 🙂', 'Подумай ещё чуть-чуть! 💭'];

function nextUnsolved(list, fromIndex) {
  for (let k = 1; k <= list.length; k++) {
    const r = list[(fromIndex + k) % list.length];
    if (!getState(r.id).status) return r;
  }
  return null;
}

function nextButton(data, index) {
  const b = el('button', 'btn btn-next', 'Дальше →');
  b.type = 'button';
  b.addEventListener('click', () => {
    const n = nextUnsolved(data.list, index);
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

function renderHint(rebus) {
  const box = el('p', 'hint');
  add(box, el('span', 'hint-label', '💡 Подсказка'), el('span', 'hint-text', rebus.hint));
  return box;
}

// Фокус на кнопку «Дальше»: экранную клавиатуру он не открывает, поэтому и на телефоне.
function focusSoon(node) {
  if (node) setTimeout(() => node.focus({ preventScroll: true }), 60);
}

function markDone(panel) {
  const app = panel.closest('.app');
  if (app) app.classList.add('done');
}

function showSolved(panel, rebus, data, index, fresh) {
  markDone(panel);
  const res = el('div', 'result ok');
  res.setAttribute('role', 'status');
  add(res, el('p', 'result-title', fresh ? 'Молодец! 🎉' : 'Отгадано! ⭐'), el('p', 'result-word', normalize(rebus.answer)));
  const actions = add(el('div', 'actions'), nextButton(data, index));
  panel.replaceChildren(res, actions);
  if (!fresh) add(panel, renderExplain(rebus));
  if (fresh) celebrate();
  focusSoon(actions.firstChild);
}

function showRevealed(panel, rebus, data, index) {
  markDone(panel);
  const res = el('div', 'result reveal');
  res.setAttribute('role', 'status');
  add(res, el('p', 'result-title', 'Вот какое слово было!'), el('p', 'result-word', normalize(rebus.answer)));
  const actions = add(el('div', 'actions'), nextButton(data, index));
  panel.replaceChildren(res, renderExplain(rebus), actions);
  focusSoon(actions.firstChild);
}

export function renderRebus(app, data, id, signal) {
  const info = data.byId[id];
  if (!info) { location.replace('#/'); return; }
  const { rebus, num, index } = info;
  const st = getState(id);
  document.title = 'Ребус ' + num;
  app.className = 'app play';

  const bar = el('div', 'topbar');
  const back = el('a', 'back', '←');
  back.href = '#/';
  back.setAttribute('aria-label', 'Назад ко всем ребусам');
  const stars = el('span', 'mini-stars');
  const updateStars = () => { stars.textContent = '⭐ ' + solvedCount(data.list) + '/' + data.list.length; };
  updateStars();
  add(bar, back, el('h1', 'rebus-num', '№ ' + num), stars);

  const card = el('section', 'card');
  const panel = el('div', 'panel');
  add(card, renderBoard(rebus), panel);
  app.replaceChildren(bar, card);

  if (st.status === 'solved') return showSolved(panel, rebus, data, index, false);
  if (st.status === 'revealed') return showRevealed(panel, rebus, data, index);

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
  if (rebus.hint && st.tries >= HINT_AFTER) add(hintSlot, renderHint(rebus));
  add(panel, hearts, form, msg, hintSlot);

  // Экранная клавиатура не должна закрывать поле.
  const keepVisible = () => {
    if (document.activeElement !== input) return;
    try { btn.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
    catch { btn.scrollIntoView(false); }
  };
  input.addEventListener('focus', () => setTimeout(keepVisible, 350));
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
      showSolved(panel, rebus, data, index, true);
      return;
    }
    st.tries += 1;
    if (st.tries >= MAX_TRIES) {
      setState(id, { tries: st.tries, status: 'revealed' });
      input.blur();
      showRevealed(panel, rebus, data, index);
      return;
    }
    setState(id, { tries: st.tries });
    const lost = hearts.children[MAX_TRIES - st.tries];
    if (lost) lost.classList.add('off', 'losing');
    updateHeartsLabel(hearts, st.tries);
    input.classList.remove('shake');
    void input.offsetWidth; // перезапуск анимации
    input.classList.add('shake');
    msg.textContent = TRY_PHRASES[(st.tries - 1) % TRY_PHRASES.length];
    msg.className = 'msg try';
    if (rebus.hint && st.tries >= HINT_AFTER && !hintSlot.firstChild) add(hintSlot, renderHint(rebus));
    input.select();
  });

  if (finePointer()) setTimeout(() => input.focus({ preventScroll: true }), 50);
}
