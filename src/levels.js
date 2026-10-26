// Уровни сложности и порядок ребусов внутри уровня.
import { getState } from './store.js';

export const LEVELS = [
  { level: 1, title: 'Лёгкие', emoji: '🐣', cls: 'lvl-1' },
  { level: 2, title: 'Средние', emoji: '🦊', cls: 'lvl-2' },
  { level: 3, title: 'Трудные', emoji: '🦁', cls: 'lvl-3' },
];

export const levelInfo = (level) => LEVELS.find((L) => L.level === level) || LEVELS[0];

export const levelItems = (list, level) => list.filter((r) => r.level === level);

export function levelProgress(list, level) {
  const items = levelItems(list, level);
  const solved = items.filter((r) => getState(r.id).status === 'solved').length;
  const finished = items.filter((r) => getState(r.id).status).length;
  return { total: items.length, solved, finished, done: finished === items.length };
}

// С какого ребуса начать уровень: первый нерешённый, а если всё пройдено — первый.
export function levelStart(list, level) {
  const items = levelItems(list, level);
  return items.find((r) => !getState(r.id).status) || items[0] || null;
}

// Следующий ребус уровня после текущего: нерешённый (по кругу),
// а если всё пройдено — просто следующий по порядку. null — уровень закончился.
export function levelNext(list, rebus) {
  const items = levelItems(list, rebus.level);
  const i = items.indexOf(rebus);
  for (let k = 1; k < items.length; k++) {
    const r = items[(i + k) % items.length];
    if (!getState(r.id).status) return r;
  }
  return items[i + 1] || null;
}
