// Прогресс: { [id]: { tries: число ошибок, status?: "solved" | "revealed" } }.
// localStorage может быть недоступен — тогда всё живёт в памяти.
const KEY = 'rebus-progress-v1';
let progress = load();

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return {};
}

function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

export function getState(id) {
  const s = progress[id];
  return { tries: (s && Number(s.tries)) || 0, status: s && s.status };
}

export function setState(id, { tries, status }) {
  progress[id] = status ? { tries, status } : { tries };
  save();
}

export function resetAll() {
  progress = {};
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function reload() { progress = load(); }

export const STORE_KEY = KEY;

export const MAX_TRIES = 3;

export function solvedCount(list) {
  return list.filter((r) => getState(r.id).status === 'solved').length;
}
