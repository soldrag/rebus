// Перенос одобренных замыслов (data/proposals/*.json) в набор public/data/rebuses.json.
//
//   node tools/transfer.mjs [id …]          — без id переносит все замыслы, которые решаются и рисуются
//   node tools/transfer.mjs --check [id …]  — пробный прогон: что будет перенесено и как разложено, без записи
//   node tools/transfer.mjs --arrange       — ничего не переносит, только раскладывает набор заново
//
// Шаг механический: конвертация (tools/convert.mjs), вставка и раскладка (tools/placement.mjs).
// Картинки берутся из плана дизайнера data/pictures-plan.json (эмодзи или своя иллюстрация).
// Новые картинки добавляются в реестр data/pictures.json; свои иллюстрации — без одобрения
// (designApproved ставит дизайнер после проверки ребуса на экране, иначе сборка не пройдёт).
// Раскладка: новые ребусы встают в свой уровень так, чтобы правила раскладки валидатора
// (те же функции) не дали ни одного предупреждения; двигаются только новые, а если так нельзя —
// как можно меньше старых. Если без предупреждений нельзя никак, перенос пишет почему и что поможет.
// После переноса — npm run spelling и npm run validate.
import fs from 'node:fs';
import { solveSpec } from './rebus-spec.mjs';
import { rebusProblems } from './rules.mjs';
import { drawProblems, loadPictureSources, toRebus } from './convert.mjs';
import { arrange } from './placement.mjs';
import { picKey } from '../src/core/solve.js';

const dir = new URL('../data/proposals/', import.meta.url);
const setFile = new URL('../public/data/rebuses.json', import.meta.url);
const regFile = new URL('../data/pictures.json', import.meta.url);
const args = process.argv.slice(2);
const dry = args.includes('--check') || args.includes('--dry-run');
const arrangeOnly = args.includes('--arrange');
const only = args.filter((a) => !a.startsWith('--'));

const pics = loadPictureSources();
const { plan, reg } = pics;
const set = JSON.parse(fs.readFileSync(setFile, 'utf8'));
const have = new Set(set.rebuses.map((r) => r.id));
const moved = [];
let refused = 0;
if (!arrangeOnly) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const json = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
    for (const p of json.proposals || []) {
      if (only.length && !only.includes(p.id)) continue;
      if (have.has(p.id) || solveSpec(p) === null) continue;
      // Замысел, который приложение пока не рисует (npm run proposals: «ждёт разработчика»), не переносим.
      const draw = drawProblems(p, pics);
      if (draw.length || p.awaitsDeveloper) { console.log(`✗ ${p.id}: приложение пока не рисует: ${draw.join('; ') || p.awaitsDeveloper}`); refused++; continue; }
      let r;
      try { r = toRebus(p, f.replace('.json', ''), pics); } catch (e) { console.log(`✗ ${p.id}: ${e.message}`); refused++; continue; }
      const bad = rebusProblems(r);
      if (bad.length) { console.log(`✗ ${p.id}: ${bad.join('; ')}`); refused++; continue; }
      moved.push(r);
    }
  }
  const missing = only.filter((id) => !have.has(id) && !moved.some((r) => r.id === id));
  if (missing.length && !refused) console.log(`? не найдены среди замыслов: ${missing.join(', ')}`);
}

// Реестр: новые картинки.
const regKeys = new Set(reg.pictures.map(picKey));
for (const x of plan.values()) {
  const key = picKey(x);
  if (regKeys.has(key)) continue;
  const e = { word: x.word, minLevel: 1, flip: false, initials: true, note: x.note || '' };
  if (x.image) Object.assign(e, { image: x.image, designApproved: false }); else e.emoji = x.emoji;
  reg.pictures.push(e); regKeys.add(key);
  console.log('+ реестр:', key);
}

// Вставка: в конец своего уровня (место выберет раскладка).
const rebuses = set.rebuses.slice();
for (const r of moved) {
  let at = rebuses.findIndex((x) => x.level > r.level);
  if (at < 0) at = rebuses.length;
  rebuses.splice(at, 0, r);
}
for (const level of [1, 2, 3]) {
  const add = moved.filter((r) => r.level === level);
  if (add.length) console.log(`уровень ${level}: +${add.length} (${add.map((r) => r.answer).join(', ')})`);
}

// Раскладка затронутых уровней (--arrange — всех).
const levels = arrangeOnly ? [1, 2, 3] : [...new Set(moved.map((r) => r.level))].sort();
const fresh = new Set(moved.map((r) => r.id));
const { rebuses: arranged, report } = arrange(rebuses, { levels, fresh });
for (const x of report) {
  const where = (id) => `${id} → ${x.items.findIndex((r) => r.id === id) + 1}`;
  const placed = x.items.filter((r) => fresh.has(r.id)).map((r) => where(r.id));
  console.log(`раскладка уровня ${x.level} (${x.items.length} ребусов): предупреждений раскладки было ${x.before.length}, стало ${x.warnings.length}`);
  if (placed.length) console.log(`  новые на местах: ${placed.join(', ')}`);
  console.log(x.moved.length ? `  передвинуты старые: ${x.moved.map((m) => `${m.id} ${m.from} → ${m.to}`).join(', ')}` : '  старые ребусы не двигались');
  x.warnings.forEach((w) => console.log('  !', w));
  if (x.warnings.length) {
    if (x.why.length) {
      console.log(`  без предупреждений не разложить${x.warnings.length <= x.min ? `, меньше ${x.min} не бывает` : ''}:`);
      x.why.forEach((w) => console.log('  —', w));
    } else console.log('  раскладка без предупреждений не нашлась — это лучшая найденная; поможет пересобрать или убрать ребус из предупреждения');
  }
}
if (dry) {
  console.log(`пробный прогон (--check): перенесено было бы ${moved.length}, файлы не изменены`);
} else {
  set.rebuses = arranged;
  fs.writeFileSync(setFile, JSON.stringify(set, null, 2) + '\n');
  fs.writeFileSync(regFile, JSON.stringify(reg, null, 2) + '\n');
  console.log(`перенесено: ${moved.length}`);
}
process.exit(refused ? 1 : 0);
