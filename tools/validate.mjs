// Проверка данных ребусов: npm run validate
import fs from 'node:fs';
import { formatProblems, normalize, rebusList } from '../src/rebus-core.js';

const file = new URL('../public/data/rebuses.json', import.meta.url);
const rebuses = rebusList(JSON.parse(fs.readFileSync(file, 'utf8')));

const problems = [];
if (!rebuses.length) problems.push('в файле нет ни одного ребуса');
const ids = new Set();
const answers = new Set();
for (const r of rebuses) {
  const name = (r && r.id) || '?';
  formatProblems(r).forEach((p) => problems.push(`${name}: ${p}`));
  if (ids.has(name)) problems.push(`${name}: повтор id`);
  ids.add(name);
  const a = normalize(r && r.answer);
  if (a && answers.has(a)) problems.push(`${name}: повтор ответа ${r.answer}`);
  answers.add(a);
}

problems.forEach((p) => console.log('✗', p));
console.log(`${rebuses.length} ребусов, проблем: ${problems.length}`);
process.exit(problems.length ? 1 : 0);
