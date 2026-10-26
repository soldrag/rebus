// Проверка данных ребусов: npm run validate
import fs from 'node:fs';
import { normalize, solve } from '../src/rebus-core.js';

const file = new URL('../public/data/rebuses.json', import.meta.url);
const { rebuses = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));

const problems = [];
const ids = new Set();
const answers = new Set();
for (const r of rebuses) {
  if (!r.id || !r.answer || !Array.isArray(r.parts) || !r.parts.length) {
    problems.push(`${r.id || '?'}: нет id, answer или parts`);
    continue;
  }
  if (ids.has(r.id)) problems.push(`${r.id}: повтор id`);
  if (answers.has(normalize(r.answer))) problems.push(`${r.id}: повтор ответа ${r.answer}`);
  ids.add(r.id);
  answers.add(normalize(r.answer));
  if (![1, 2, 3].includes(r.level)) problems.push(`${r.id}: level должен быть 1, 2 или 3`);
  const got = solve(r);
  if (got !== normalize(r.answer)) problems.push(`${r.id}: ответ ${r.answer}, а по картинке выходит ${got}`);
}

problems.forEach((p) => console.log('✗', p));
console.log(`${rebuses.length} ребусов, проблем: ${problems.length}`);
process.exit(problems.length ? 1 : 0);
