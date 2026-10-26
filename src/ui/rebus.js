// Экран одного ребуса: картинка, ввод ответа, сердечки, итог.
import { normalize, isCorrect } from '../rebus-core.js';
import { el, add, finePointer } from './dom.js';
import { getState, setState, MAX_TRIES, hasSeen, markSeen } from '../store.js';
import { levelInfo, stageNext, stageOf, stageProgress } from '../levels.js';
import { renderBoard, renderExplain, techniques, show } from './board.js';
import { openLegend, ALL_KINDS } from './legend.js';
import { celebrate } from './confetti.js';

const HINT_AFTER = 2;
const CLOSE_PHRASES = ['Почти! Попробуй ещё 🙂', 'Совсем близко! Ещё разок 💪'];
const FAR_PHRASES = ['Не то слово, попробуй ещё 🙂', 'Посмотри на картинку ещё раз 👀'];
// Короткие подсказки прямо в поле: их видно и при открытой клавиатуре.
const CLOSE_PLACEHOLDER = 'Почти! Ещё разок';
const FAR_PLACEHOLDER = 'Попробуй ещё';
const SETTLE_MS = 600; // столько «Молодец!» видно, прежде чем клавиатура плавно уедет

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

// «Дальше» — следующий ребус этапа; когда этап пройден — за кубком.
function nextButton(data, rebus) {
  const n = stageNext(data.list, rebus);
  const { index } = stageOf(data.list, rebus);
  const b = el('button', 'btn btn-next', n ? 'Дальше →' : 'Забрать кубок! 🏆');
  b.type = 'button';
  b.addEventListener('click', () => {
    location.hash = n ? '#/r/' + encodeURIComponent(n.id) : `#/cup/${rebus.level}/${index}`;
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

// Итог показывается на месте поля и кнопки, тех же размеров: картинка и всё
// остальное на экране остаются на своих местах.
function resultBox(kind, rebus, fresh) {
  const box = el('div', 'result-inline ' + kind);
  box.setAttribute('role', 'status');
  const title = kind === 'ok' ? (fresh ? 'Молодец! 🎉' : 'Отгадано! ⭐') : 'Вот какое слово было:';
  add(box, el('span', 'result-title', title), el('span', 'result-word', show(rebus.answer)));
  return box;
}

function explainBlock(rebus, animate) {
  const ex = renderExplain(rebus);
  if (animate) ex.classList.add('appear');
  return ex;
}

// Готовый ребус при повторном открытии.
function renderDone(panel, rebus, data, st) {
  const kind = st.status === 'solved' ? 'ok' : 'reveal';
  const box = resultBox(kind, rebus, false);
  box.classList.add('settled');
  const answer = add(el('div', 'answer answer-done'), add(el('div', 'input-wrap'), box), nextButton(data, rebus));
  panel.replaceChildren(renderHearts(st.tries), answer, el('p', 'msg'), explainBlock(rebus, false));
}

export function renderRebus(app, data, id, signal, backTo = '#/') {
  const info = data.byId[id];
  if (!info) { location.replace('#/'); return; }
  const { rebus } = info;
  const st = getState(id);
  const L = levelInfo(rebus.level);
  const stage = stageOf(data.list, rebus);
  document.title = 'Ребусы — ' + L.title;
  app.className = 'app play';

  const bar = el('div', 'topbar');
  const back = el('a', 'back', '←');
  back.href = backTo;
  back.setAttribute('aria-label', backTo === '#/' ? 'На главную' : 'Ко всем ребусам');
  const stars = el('span', 'mini-stars');
  const updateStars = () => {
    const p = stageProgress(stage.items);
    stars.textContent = '⭐ ' + p.solved + '/' + p.total;
  };
  updateStars();
  const help = el('button', 'help-btn', '?');
  help.type = 'button';
  help.setAttribute('aria-label', 'Как читать ребус');
  const title = el('h1', 'rebus-num', L.emoji + ' ' + L.title);
  if (stage.count > 1) add(title, el('span', 'stage-no', ' · ' + stage.index));
  add(bar, back, title, stars, help);

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
    // Только приёмы этого ребуса (запятые — последними); без особых значков — «просто прочитай».
    const own = techniques(rebus).filter((k) => ALL_KINDS.includes(k));
    const kinds = own.length ? own.filter((k) => k !== 'comma').concat(own.includes('comma') ? ['comma'] : []) : ['plain'];
    showLegend(kinds, false, () => help.focus());
  });

  if (st.status) { renderDone(panel, rebus, data, st); return; }

  const form = el('form', 'answer');
  form.setAttribute('autocomplete', 'off');
  form.noValidate = true;
  const input = el('input', 'answer-input');
  Object.assign(input, { type: 'text', name: 'answer', placeholder: 'Что тут спрятано?', maxLength: 40 });
  for (const [k, v] of Object.entries({
    autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    inputmode: 'text', lang: 'ru', enterkeyhint: 'go', 'aria-label': 'Твой ответ',
  })) input.setAttribute(k, v);
  const btn = el('button', 'btn btn-check', 'Проверить');
  btn.type = 'submit';
  const inputWrap = add(el('div', 'input-wrap'), input);
  add(form, inputWrap, btn);

  const hearts = renderHearts(st.tries);
  const msg = el('p', 'msg');
  msg.setAttribute('role', 'status');
  const hintSlot = el('div', 'hint-slot');
  if (rebus.hint && st.tries >= HINT_AFTER) add(hintSlot, renderHintButton(rebus));
  add(panel, hearts, form, msg, hintSlot);

  let done = false;
  input.addEventListener('input', () => {
    if (done) return;
    input.classList.remove('shake');
    if (msg.classList.contains('empty-note')) { msg.textContent = ''; msg.className = 'msg'; }
  });

  // Ребёнок набрал слово и закрыл клавиатуру (галочка над клавиатурой iOS):
  // проверяем сами, чтобы не нужно было ещё раз жать «Проверить».
  // Пауза — чтобы нажатие на «Проверить» сразу после blur не проверило дважды.
  let checking = false;
  input.addEventListener('blur', () => {
    const val = input.value;
    if (!normalize(val)) return;
    setTimeout(() => {
      if (done || checking || !input.isConnected || document.activeElement === input) return;
      if (input.value !== val || closeLegend) return;
      form.requestSubmit();
    }, 300);
  }, { signal });

  // Ответ готов: итог появляется поверх поля, «Дальше» — на месте «Проверить».
  // Клавиатуру (если открыта) убираем не сразу, а через SETTLE_MS: ребёнок успевает
  // увидеть «Молодец!», и ничего на экране не прыгает — размеры те же.
  const finish = (kind) => {
    done = true;
    const box = resultBox(kind, rebus, true);
    add(inputWrap, box);
    const next = nextButton(data, rebus);
    btn.replaceWith(next);
    form.classList.add('answer-done');
    msg.textContent = '';
    msg.className = 'msg';
    if (hintSlot.querySelector('.hint-btn')) hintSlot.replaceChildren();
    if (kind === 'ok') celebrate();
    const hadFocus = document.activeElement === input;
    setTimeout(() => {
      if (!input.isConnected) return;
      input.blur();
      input.remove();
      box.classList.add('settled');
      if (kind === 'reveal') add(panel, explainBlock(rebus, true));
      next.focus({ preventScroll: true });
    }, hadFocus ? SETTLE_MS : 0);
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (done) return;
    checking = true;
    setTimeout(() => { checking = false; }, 400);
    const val = input.value;
    if (!normalize(val)) {
      msg.textContent = 'Напиши слово 🙂';
      msg.className = 'msg empty-note';
      input.focus();
      return;
    }
    if (isCorrect(rebus, val)) {
      setState(id, { tries: st.tries, status: 'solved' });
      updateStars();
      finish('ok');
      return;
    }
    st.tries += 1;
    if (st.tries >= MAX_TRIES) {
      setState(id, { tries: st.tries, status: 'revealed' });
      const lastHeart = hearts.children[0];
      if (lastHeart) lastHeart.classList.add('off', 'losing');
      updateHeartsLabel(hearts, st.tries);
      finish('reveal');
      return;
    }
    setState(id, { tries: st.tries });
    const lost = hearts.children[MAX_TRIES - st.tries];
    if (lost) lost.classList.add('off', 'losing');
    updateHeartsLabel(hearts, st.tries);
    input.classList.remove('shake');
    void input.offsetWidth; // перезапуск анимации
    input.classList.add('shake');
    const close = isClose(rebus, val);
    const phrases = close ? CLOSE_PHRASES : FAR_PHRASES;
    msg.textContent = phrases[(st.tries - 1) % phrases.length];
    msg.className = 'msg try';
    if (rebus.hint && st.tries >= HINT_AFTER && !hintSlot.firstChild) add(hintSlot, renderHintButton(rebus));
    // Поле очищаем, а не выделяем: выделение вызывает на телефоне меню «Копировать».
    // Фокус не трогаем: если клавиатура была открыта, она так и остаётся.
    input.value = '';
    input.placeholder = close ? CLOSE_PLACEHOLDER : FAR_PLACEHOLDER;
  });

  const focusInput = () => { if (finePointer()) input.focus({ preventScroll: true }); };
  // Новый для ребёнка приём записи — один раз показываем легенду.
  // Запятые ребёнок знает — для них легенду сам не показываем.
  const fresh = techniques(rebus).filter((k) => ALL_KINDS.includes(k) && k !== 'comma' && !hasSeen(k));
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
