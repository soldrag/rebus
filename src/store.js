// Прогресс: { [id]: { tries: число ошибок, status?: "solved" | "revealed", typo?: как ребёнок написал с ошибкой } }.
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
  return { tries: (s && Number(s.tries)) || 0, status: s && s.status, typo: s && typeof s.typo === 'string' ? s.typo : undefined };
}

export function setState(id, { tries, status, typo }) {
  progress[id] = status ? { tries, status } : { tries };
  if (status && typo) progress[id].typo = typo;
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

// Какие приёмы ребусной записи ребёнок уже видел (для легенды): отдельный ключ.
const SEEN_KEY = 'rebus-seen-v1';
let seen = loadSeen();

function loadSeen() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'));
  } catch { /* ignore */ }
  return new Set();
}

export function hasSeen(kind) { return seen.has(kind); }

export function markSeen(kinds) {
  for (const k of kinds) seen.add(k);
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* ignore */ }
}
