// Загрузка ребусов из public/data/rebuses.json.
const URL_ = `${import.meta.env.BASE_URL}data/rebuses.json`;

function valid(r) {
  return r && typeof r.id === 'string' && r.answer && Array.isArray(r.parts) && r.parts.length > 0;
}

// Возвращает { list, byId }: list отсортирован по уровню (внутри — как в файле).
export async function loadRebuses() {
  const res = await fetch(URL_, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const raw = Array.isArray(json) ? json : (json && json.rebuses) || [];
  const list = raw
    .filter(valid)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ((a.r.level || 1) - (b.r.level || 1)) || (a.i - b.i))
    .map((x) => x.r);
  const byId = {};
  list.forEach((rebus, index) => { byId[rebus.id] = { rebus, index, num: index + 1 }; });
  return { list, byId };
}
