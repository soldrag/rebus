// Разнообразие приёмов: ни один приём не занимает больше двух «честных долей» уровня.
// Честная доля = 100 % / число приёмов на уровне. Типов 5 → доля 20 % → предел 40 %.
// Ребус с несколькими приёмами (запятые + цифры) считается в каждом из них.
//
//   npm run diversity            — таблица по уровням для набора и замыслов
//   node tools/diversity.mjs --strict [--only=set|proposals]   — код выхода 1 при превышении (для хука)
import fs from 'node:fs';
import { techniques } from '../src/rebus-core.js';
import { specTechniques, solveSpec } from './rebus-spec.mjs';

export const SHARE_FACTOR = 2;
export const MIN_ITEMS = 10; // на меньших уровнях проценты ничего не значат

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('--strict');
  // --only=set | --only=proposals — что проверять (хук проверяет только то, что правили).
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  const out = [];
  let bad = 0;
  const data = JSON.parse(fs.readFileSync(new URL('../public/data/rebuses.json', import.meta.url), 'utf8')).rebuses;
  if (only !== 'proposals') for (const [l, items] of byLevel(data, techniques)) {
    const d = diversity(items); bad += d.over.length; out.push(report(`Набор, уровень ${l}`, d));
  }
  const dir = new URL('../data/proposals/', import.meta.url);
  const proposals = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .flatMap((f) => { try { return JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')).proposals || []; } catch { return []; } }) : [];
  if (proposals.length && only !== 'set') {
    for (const [l, items] of byLevel(proposals, specTechniques)) {
      if (!items.length) continue;
      const d = diversity(items); bad += d.over.length; out.push(report(`Замыслы, уровень ${l}`, d));
    }
  }
  console.log(out.join('\n'));
  if (bad) console.log(`\nПревышений: ${bad}. Ни один приём не должен занимать больше двух честных долей уровня — добавьте ребусы других приёмов или уберите лишние.`);
  process.exit(strict && bad ? 1 : 0);
}
