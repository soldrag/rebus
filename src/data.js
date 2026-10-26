// Загрузка ребусов из public/data/rebuses.json.
import { formatProblems, rebusList } from './rebus-core.js';

const URL_ = `${import.meta.env.BASE_URL}data/rebuses.json`;

// Возвращает { list, byId }: list отсортирован по уровню (внутри — как в файле).
// Ребусы с ошибками формата пропускаются (при сборке их ловит tools/validate.mjs).
export async function loadRebuses() {
  const res = await fetch(URL_, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const seen = new Set();
  const list = rebusList(await res.json())
    .filter((r) => {
      if (formatProblems(r).length || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.level - b.r.level) || (a.i - b.i))
    .map((x) => x.r);
  const byId = {};
  list.forEach((rebus, index) => { byId[rebus.id] = { rebus, index, num: index + 1 }; });
  return { list, byId };
}
