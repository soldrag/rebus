// Разнообразие приёмов: ни один приём не занимает больше двух «честных долей» уровня.
// Честная доля = 100 % / число приёмов на уровне. Типов 5 → доля 20 % → предел 40 %.
// Ребус с несколькими приёмами (запятые + цифры) считается в каждом из них.
//
//   npm run diversity            — таблица по уровням: текущий набор + замыслы, какие приёмы на паузе
//   node tools/diversity.mjs --strict [--only=set|proposals]   — код выхода 1 при превышении (для хука)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { techniques } from '../src/rebus-core.js';
import { specTechniques, solveSpec } from './rebus-spec.mjs';

export const SHARE_FACTOR = 2;
export const MIN_ITEMS = 10;
// Частотность: сколько раз встречается каждое значение (слово-ответ и т.п.).
// Пик — больше двух средних (SHARE_FACTOR × среднее), провал — меньше половины среднего.
// Жёстких лимитов нет: всё считается от текущей статистики.
export function spread(values) {
  const count = new Map();
  values.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
  const mean = count.size ? values.length / count.size : 0;
  const peaks = [...count].filter(([, n]) => n > 1 && n > SHARE_FACTOR * mean);
  const troughs = [...count].filter(([, n]) => n < mean / SHARE_FACTOR);
  return { count, mean, peaks, troughs };
}
// Новое значение не должно создать пик: n + 1 не больше двух средних после добавления.
export function wouldPeak(values, v) {
  const after = spread(values.concat(v));
  return after.peaks.some(([x]) => x === v);
} // на меньших уровнях проценты ничего не значат

// items — список списков приёмов (по одному на ребус).
export function diversity(items) {
  const count = {};
  items.forEach((t) => [...new Set(t)].forEach((k) => { count[k] = (count[k] || 0) + 1; }));
  const n = Object.keys(count).length;
  const limit = n ? SHARE_FACTOR / n : 1;
  const rows = Object.entries(count).sort((a, b) => b[1] - a[1])
    .map(([type, c]) => ({ type, count: c, share: c / items.length, over: items.length >= MIN_ITEMS && n > 1 && c / items.length > limit }));
  return { total: items.length, n, limit, rows, over: rows.filter((r) => r.over) };
}

export function report(title, d) {
  const pct = (x) => (x * 100).toFixed(0) + ' %';
  const lines = [`${title}: ${d.total} ребусов, приёмов ${d.n}, предел ${pct(d.limit)} (2 × 100 % / ${d.n})`];
  d.rows.forEach((r) => lines.push(`  ${r.over ? '✗' : ' '} ${r.type.padEnd(12)} ${String(r.count).padStart(3)}  ${pct(r.share)}`));
  return lines.join('\n');
}

const byLevel = (list, tech) => [1, 2, 3].map((l) => [l, list.filter((r) => r && r.level === l).map(tech)]);

// Набор сейчас не трогаем, а расширяем. Поэтому правило применяется к будущему набору
// (текущий + замыслы): приём, который в нём выше предела, «на паузе» — новые ребусы
// с ним не добавляем, пока перекос не выровняется. Пауза снимается сама.
// Коды замыслов (rel:В) и набора (in) — один и тот же приём: считаем вместе.
const SAME = { 'rel:В': 'in', 'rel:НА': 'on', 'rel:У': 'near', 'rel:ПОД': 'under', 'rel:ЗА': 'behind' };
export const canon = (list) => list.map((t) => SAME[t] || t);

export function paused(setItems, proposalItems) {
  const d = diversity(setItems.concat(proposalItems.map(canon)));
  return { d, types: new Set(d.over.map((o) => o.type)) };
}

function readSet(ref) {
  const file = new URL('../public/data/rebuses.json', import.meta.url);
  if (!ref) return JSON.parse(fs.readFileSync(file, 'utf8')).rebuses;
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:public/data/rebuses.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).rebuses;
  } catch { return null; }
}

function readProposals() {
  const dir = new URL('../data/proposals/', import.meta.url);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .flatMap((f) => { try { return JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')).proposals || []; } catch { return []; } })
    .filter((r) => r && solveSpec(r) !== null); // ждущие обработчика не считаем
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('--strict');
  // --only=set | --only=proposals — что проверять (хук проверяет только то, что правили).
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  const set = readSet();
  const proposals = readProposals();
  const out = [];
  let bad = 0;
  for (const l of [1, 2, 3]) {
    const s = set.filter((r) => r.level === l).map(techniques);
    const pr = proposals.filter((r) => r.level === l);
    const { d, types } = paused(s, pr.map(specTechniques));
    out.push(report(`Уровень ${l}: набор ${s.length} + замыслы ${pr.length}`, d));
    if (types.size) out.push(`  на паузе (новых ребусов с ними не добавлять): ${[...types].join(', ')}`);
    // Замыслы: ни один не должен опираться на приём «на паузе».
    if (only !== 'set') {
      for (const r of pr) {
        const hit = canon(specTechniques(r)).filter((t) => types.has(t));
        if (hit.length) { bad++; out.push(`  ✗ замысел ${r.id}: приём ${hit.join(', ')} на паузе — придумайте другой`); }
      }
    }
    // Набор: правка не должна увеличивать долю приёмов на паузе (сравнение с последним коммитом).
    if (only !== 'proposals') {
      const before = readSet('HEAD');
      if (before) {
        const b = diversity(before.filter((r) => r.level === l).map(techniques));
        const now = diversity(s);
        for (const t of types) {
          const was = (b.rows.find((r) => r.type === t) || { share: 0 }).share;
          const is = (now.rows.find((r) => r.type === t) || { share: 0 }).share;
          if (is > was + 1e-9) { bad++; out.push(`  ✗ набор: доля «${t}» выросла ${Math.round(was * 100)} % → ${Math.round(is * 100)} %, а приём на паузе`); }
        }
      }
    }
  }
  console.log(out.join('\n'));
  if (bad) console.log(`\nНарушений: ${bad}. Ни один приём не должен занимать больше двух честных долей уровня (2 × 100 % / число приёмов). Перекошенные приёмы на паузе — добавляйте ребусы на другие приёмы.`);
  process.exit(strict && bad ? 1 : 0);
}
