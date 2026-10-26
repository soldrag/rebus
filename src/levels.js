// Уровни сложности, этапы внутри уровня (по ~20 ребусов, за каждый — кубок)
// и порядок ребусов.
import { getState } from './store.js';

export const LEVELS = [
  { level: 1, title: 'Лёгкие', emoji: '🐣', cls: 'lvl-1' },
  { level: 2, title: 'Средние', emoji: '🦊', cls: 'lvl-2' },
  { level: 3, title: 'Трудные', emoji: '🦁', cls: 'lvl-3' },
];
const STAGE_SIZE = 20;
const MIN_LAST_STAGE = 10; // короткий хвост присоединяем к предыдущему этапу

export const levelInfo = (level) => LEVELS.find((L) => L.level === level) || LEVELS[0];

export const levelItems = (list, level) => list.filter((r) => r.level === level);

const finished = (r) => !!getState(r.id).status;

// Этапы уровня: массивы ребусов по ~20.
export function stages(list, level) {
  const items = levelItems(list, level);
  const out = [];
  for (let i = 0; i < items.length; i += STAGE_SIZE) out.push(items.slice(i, i + STAGE_SIZE));
  if (out.length > 1 && out[out.length - 1].length < MIN_LAST_STAGE) out[out.length - 2].push(...out.pop());
  return out;
}

// Где ребус: номер этапа (с 1), все этапы уровня и сам этап.
export function stageOf(list, rebus) {
  const all = stages(list, rebus.level);
  const i = all.findIndex((s) => s.includes(rebus));
  return { index: i + 1, count: all.length, items: all[i] || [] };
}

export function stageProgress(items) {
  const solved = items.filter((r) => getState(r.id).status === 'solved').length;
  const done = items.filter(finished).length;
  return { total: items.length, solved, finished: done, done: done === items.length };
}

export function levelProgress(list, level) {
  const all = stages(list, level);
  const p = stageProgress(all.flat());
  const cups = all.filter((s) => stageProgress(s).done).length;
  const current = all.findIndex((s) => !stageProgress(s).done) + 1 || all.length;
  return { ...p, cups, stages: all.length, current };
}

// С какого ребуса начать уровень: первый нерешённый в первом незаконченном этапе,
// а если всё пройдено — первый ребус уровня.
export function levelStart(list, level) {
  const items = levelItems(list, level);
  return items.find((r) => !finished(r)) || items[0] || null;
}

// Следующий ребус после текущего — в пределах этапа: нерешённый (по кругу),
// а если этап пройден — просто следующий по порядку. null — этап закончился.
export function stageNext(list, rebus) {
  const { items } = stageOf(list, rebus);
  const i = items.indexOf(rebus);
  for (let k = 1; k < items.length; k++) {
    const r = items[(i + k) % items.length];
    if (!finished(r)) return r;
  }
  return items[i + 1] || null;
}
