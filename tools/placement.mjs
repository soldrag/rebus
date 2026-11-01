// Правила раскладки набора по уровням и этапам (docs/REBUSES.md, «Разнообразие», «Этапы»)
// и раскладчик, который им следует. Одна реализация на всех: предупреждения считает
// tools/validate.mjs, раскладывает tools/transfer.mjs — по тем же функциям.
import { chunkStages } from '../src/core/stages.js';
import { normalize, pictures, techniques } from '../src/core/solve.js';
import { isMirror } from './rules.mjs';

export const MAX_IN_ROW = 2; // не больше двух ребусов подряд с одним набором приёмов
export const MAX_THEME_RUN = 3; // не больше трёх подряд одной темы
// Буквы в позиции: не больше трёх на этап (15 % длинного этапа).
export const positionLimit = (stageLength) => Math.max(3, Math.ceil(stageLength * 0.15));

// Признаки ребуса считаются один раз (раскладчик перебирает тысячи порядков).
const cache = new WeakMap();
function feats(r) {
  let f = cache.get(r);
  if (!f) {
    const pics = Array.isArray(r.parts) ? pictures(r) : [];
    f = {
      kind: Array.isArray(r.parts) ? techniques(r).sort().join('+') : null,
      // Ребус «из одних букв в позиции»: картинка внутри позиции (🧀 в Е) делает его обычным ребусом с картинкой.
      position: Array.isArray(r.parts) && r.parts.some((p) => p && p.type === 'position') && pics.length === 0,
    };
    cache.set(r, f);
  }
  return f;
}
export const kindOf = (r) => feats(r).kind;
export const isPosition = (r) => feats(r).position;

// Зеркальные пары: ответ одного ребуса — картинка другого. mirrors(rebuses) → Map(id → [ребусы,
// где ответ id стоит картинкой]). От порядка не зависит — раскладчик считает её один раз.
export function mirrors(rebuses) {
  const out = new Map();
  for (const r of rebuses) {
    const a = normalize(r && r.answer);
    if (!a) continue;
    out.set(r.id, rebuses.filter((o) => o !== r && pictures(o).some((p) => isMirror(p, [a]))));
  }
  return out;
}

// «Узел»: ответ стоит картинкой в двух ребусах и больше. От раскладки не зависит.
export function knotWarnings(rebuses, mir = mirrors(rebuses)) {
  const out = [];
  for (const r of rebuses) {
    const others = mir.get(r.id) || [];
    if (others.length >= 2) out.push(`${r.id}: ответ ${r.answer} стоит картинкой в ${others.length} ребусах (${others.map((o) => o.id).join(', ')}) — «узел»`);
  }
  return out;
}

// Порядок файла: от лёгких уровней к трудным.
export function orderWarnings(rebuses) {
  const out = [];
  let prev = 0;
  for (const r of rebuses) {
    if (!r || !Array.isArray(r.parts)) continue;
    if (r.level < prev) out.push(`${r.id}: стоит после ребусов уровня ${prev} — держите файл от лёгких к трудным`);
    prev = Math.max(prev, r.level);
  }
  return out;
}

// Правила раскладки одного уровня. items — ребусы уровня в порядке файла.
// Каждое правило — отдельная функция: { rule, check(items, level, ctx) → [текст] }.
export const LEVEL_RULES = [
  { rule: 'theme', check(items, level) {
    const out = [];
    let run = 0;
    items.forEach((r, i) => {
      run = i && items[i - 1].theme === r.theme ? run + 1 : 1;
      if (run === MAX_THEME_RUN + 1) out.push(`${r.id}: уже ${run} ребуса подряд на тему «${r.theme}» на уровне ${level}`);
    });
    return out;
  } },
  { rule: 'kind', check(items, level) {
    const out = [];
    let run = 0;
    items.forEach((r, i) => {
      run = i && kindOf(items[i - 1]) === kindOf(r) ? run + 1 : 1;
      if (run === MAX_IN_ROW + 1) out.push(`${r.id}: уже ${run} ребуса подряд «${kindOf(r)}» на уровне ${level}`);
    });
    return out;
  } },
  { rule: 'positionStage', check(items, level, ctx) {
    const out = [];
    ctx.stages.forEach((stage, i) => {
      const n = stage.filter(isPosition).length;
      const max = positionLimit(stage.length);
      if (n > max) out.push(`уровень ${level}, этап ${i + 1}: ${n} ребусов с буквами в позиции из ${stage.length} — не больше ${max}`);
    });
    return out;
  } },
  { rule: 'positionRow', check(items) {
    const out = [];
    items.forEach((r, i) => { if (isPosition(r) && i && isPosition(items[i - 1])) out.push(`${r.id}: два ребуса с буквами в позиции подряд`); });
    return out;
  } },
  { rule: 'mirrorStage', check(items, level, ctx) {
    const out = [];
    for (const r of items) {
      const others = ctx.mirrors.get(r.id) || [];
      if (others.length === 1 && ctx.stageOf.has(others[0].id) && ctx.stageOf.get(others[0].id) === ctx.stageOf.get(r.id)) out.push(`${r.id}: зеркальная пара с ${others[0].id} в одном этапе`);
    }
    return out;
  } },
];

// Предупреждения раскладки одного уровня (mir — mirrors() всего набора).
export function levelWarnings(items, level, mir) {
  const stages = chunkStages(items);
  const stageOf = new Map();
  stages.forEach((s, i) => s.forEach((r) => stageOf.set(r.id, i)));
  const ctx = { stages, stageOf, mirrors: mir };
  return LEVEL_RULES.flatMap((x) => x.check(items, level, ctx));
}

// Все предупреждения, которые зависят от раскладки (порядок файла, соседи, этапы).
export function placementWarnings(rebuses, mir = mirrors(rebuses)) {
  const out = orderWarnings(rebuses);
  for (const level of [1, 2, 3]) out.push(...levelWarnings(rebuses.filter((r) => r && r.level === level && Array.isArray(r.parts)), level, mir));
  return out;
}

// --- Раскладчик.

// Сколько ребусов с буквами в позиции помещается в уровень из n ребусов.
export const positionCapacity = (n) => chunkStages(Array.from({ length: n }, (_, i) => i)).reduce((s, st) => s + positionLimit(st.length), 0);

// Почему без предупреждений не разложить (необходимые условия) и что поможет.
// Возвращает { min, why: [текст] } — min: сколько предупреждений останется при любой раскладке (оценка снизу).
export function impossibility(items, level, mir) {
  const why = [];
  let min = 0;
  const n = items.length;
  const P = items.filter(isPosition).length;
  const cap = positionCapacity(n);
  if (P > cap) {
    min += 1;
    let grow = n;
    while (positionCapacity(grow) < P) grow++;
    why.push(`уровень ${level}: ребусов с буквами в позиции ${P}, а в ${chunkStages(items).length} этапах (${n} ребусов) помещается ${cap} — хотя бы один этап превысит предел. `
      + `Поможет: убрать ${P - cap} из них с уровня ${level} (пересобрать с картинкой или перенести на другой уровень) или добавить на уровень ещё ${grow - n} ребусов с картинками (до ${grow}).`);
  }
  if (P > Math.ceil(n / 2)) {
    min += P - Math.ceil(n / 2);
    why.push(`уровень ${level}: ${P} ребусов с буквами в позиции на ${n} — подряд не ставить не получится. Поможет: убрать ${P - Math.ceil(n / 2)} таких.`);
  }
  const count = (key) => { const c = new Map(); items.forEach((r) => c.set(key(r), (c.get(key(r)) || 0) + 1)); return c; };
  for (const [t, k] of count((r) => r.theme)) {
    const need = Math.ceil(k / MAX_THEME_RUN) - 1; // разделителей нужно
    if (need > n - k) { min += 1; why.push(`уровень ${level}: тема «${t}» — ${k} из ${n}, не разбить на серии по ${MAX_THEME_RUN}. Поможет: ребусы других тем.`); }
  }
  for (const [t, k] of count(kindOf)) {
    const need = Math.ceil(k / MAX_IN_ROW) - 1;
    if (need > n - k) { min += 1; why.push(`уровень ${level}: приёмы «${t}» — ${k} из ${n}, не разбить на серии по ${MAX_IN_ROW}. Поможет: ребусы с другими приёмами.`); }
  }
  if (chunkStages(items).length === 1) {
    for (const r of items) {
      const o = mir.get(r.id) || [];
      if (o.length === 1 && o[0].level === level) { min += 1; why.push(`${r.id} и ${o[0].id}: зеркальная пара, а этап на уровне один. Поможет: пересобрать один из ребусов.`); }
    }
  }
  return { min, why };
}

// Раскладка уровня. items — ребусы уровня в нынешнем порядке, fresh — Set id новых ребусов
// (они уже стоят в items на исходных местах). Сначала двигаем только новые; если без
// предупреждений не выходит — по одному переставляем старые, каждый раз выбирая перестановку,
// которая убирает больше всего предупреждений при наименьшем сдвиге. Детерминировано.
// Возвращает { items, warnings, moved: [{ id, from, to }], min, why }.
export function arrangeLevel(items, level, mir, fresh = new Set()) {
  const cost = (list) => levelWarnings(list, level, mir).length;
  const { min, why } = impossibility(items, level, mir);
  const orig = new Map(items.map((r, i) => [r.id, i]));
  let list = items.slice();
  let best = cost(list);
  const done = () => best <= min;

  // Новые: вынуть и вставить заново — равномерно по уровню, на место с наименьшим числом предупреждений.
  const news = list.filter((r) => fresh.has(r.id));
  if (news.length) {
    const target = new Map(news.map((r, k) => [r.id, Math.round(((k + 1) * list.length) / (news.length + 1))]));
    const place = (base, r) => {
      let pick = null;
      for (let at = 0; at <= base.length; at++) {
        const cand = [...base.slice(0, at), r, ...base.slice(at)];
        const c = cost(cand), d = Math.abs(at - target.get(r.id));
        if (!pick || c < pick.c || (c === pick.c && d < pick.d)) pick = { c, d, cand };
      }
      return pick;
    };
    let cur = list.filter((r) => !fresh.has(r.id));
    for (const r of news) cur = place(cur, r).cand;
    // Улучшаем: вынимаем одну новую (или сразу две — так выходят из «плато», где одна
    // перестановка ничего не даёт) и ставим на лучшие места, пока предупреждений становится меньше.
    const dist = (list) => news.reduce((s, r) => s + Math.abs(list.indexOf(r) - target.get(r.id)), 0);
    const pairs = news.flatMap((r, i) => news.slice(i + 1).map((q) => [r, q]));
    for (let round = 0, changed = true; changed && round < 20 && cost(cur) > min; round++) {
      changed = false;
      for (const r of news) {
        const pick = place(cur.filter((x) => x !== r), r);
        if (pick.c < cost(cur)) { cur = pick.cand; changed = true; }
      }
      if (changed) continue;
      let c0 = cost(cur), pick = null;
      for (const [r, q] of pairs) {
        const base = cur.filter((x) => x !== r && x !== q);
        for (let a = 0; a <= base.length; a++) {
          const l1 = [...base.slice(0, a), r, ...base.slice(a)];
          for (let b = 0; b <= l1.length; b++) {
            const cand = [...l1.slice(0, b), q, ...l1.slice(b)];
            const c = cost(cand);
            if (c >= c0 || (pick && c > pick.c)) continue;
            const d = dist(cand);
            if (!pick || c < pick.c || d < pick.d) pick = { c, d, cand };
          }
        }
      }
      if (pick) { cur = pick.cand; changed = true; }
    }
    if (cost(cur) <= best) { list = cur; best = cost(list); }
  }

  // Старые: по одной перестановке (вынуть и поставить в другое место), пока это убирает предупреждения.
  const moved = new Set();
  while (!done()) {
    let pick = null;
    for (let from = 0; from < list.length; from++) {
      if (fresh.has(list[from].id)) continue; // новые уже на лучших местах
      const rest = [...list.slice(0, from), ...list.slice(from + 1)];
      for (let to = 0; to <= rest.length; to++) {
        if (to === from) continue;
        const cand = [...rest.slice(0, to), list[from], ...rest.slice(to)];
        const c = cost(cand);
        if (c >= best) continue;
        const extra = moved.has(list[from].id) ? 0 : 1, d = Math.abs(to - from);
        if (!pick || c < pick.c || (c === pick.c && (extra < pick.extra || (extra === pick.extra && d < pick.d)))) pick = { c, extra, d, cand, id: list[from].id };
      }
    }
    if (!pick) break;
    list = pick.cand; best = pick.c; moved.add(pick.id);
  }
  const at = new Map(list.map((r, i) => [r.id, i]));
  return {
    items: list,
    warnings: levelWarnings(list, level, mir),
    moved: [...moved].map((id) => ({ id, from: orig.get(id) + 1, to: at.get(id) + 1 })),
    min, why,
  };
}

// Раскладка набора: уровни levels (по умолчанию все) раскладываются заново, остальное не трогается.
// Возвращает { rebuses, report: [{ level, … arrangeLevel }] }.
export function arrange(rebuses, { levels = [1, 2, 3], fresh = new Set() } = {}) {
  const mir = mirrors(rebuses);
  const byLevel = new Map([1, 2, 3].map((l) => [l, rebuses.filter((r) => r.level === l)]));
  const report = [];
  for (const level of levels) {
    const before = levelWarnings(byLevel.get(level), level, mir);
    const res = arrangeLevel(byLevel.get(level), level, mir, fresh);
    if (res.warnings.length > before.length) continue; // не хуже, чем было
    byLevel.set(level, res.items);
    report.push({ level, before, ...res });
  }
  // Файл — от лёгких уровней к трудным; ребусы без уровня (их ловит валидатор) — в конце, как стояли.
  const rest = rebuses.filter((r) => ![1, 2, 3].includes(r.level));
  return { rebuses: [...byLevel.get(1), ...byLevel.get(2), ...byLevel.get(3), ...rest], report };
}
