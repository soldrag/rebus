// Проверка данных ребусов: npm run validate
// Правила составления — в docs/REBUSES.md. Ошибки валят сборку, предупреждения — нет.
import fs from 'node:fs';
import { formatProblems, normalize, rebusList } from '../src/rebus-core.js';

const MAX_PIC_USES = 4; // одна и та же картинка — не чаще (цель — не больше 3)

const file = new URL('../public/data/rebuses.json', import.meta.url);
const rebuses = rebusList(JSON.parse(fs.readFileSync(file, 'utf8')));

const problems = [];
const warnings = [];
if (!rebuses.length) problems.push('в файле нет ни одного ребуса');
const ids = new Set();
const answers = new Set();
const pics = new Map();
let prevLevel = 0;
for (const r of rebuses) {
  const name = (r && r.id) || '?';
  formatProblems(r).forEach((p) => problems.push(`${name}: ${p}`));
  if (ids.has(name)) problems.push(`${name}: повтор id`);
  ids.add(name);
  const a = normalize(r && r.answer);
  if (a && answers.has(a)) problems.push(`${name}: повтор ответа ${r.answer}`);
  answers.add(a);
  if (!Array.isArray(r.parts)) continue;

  if (r.level < prevLevel) warnings.push(`${name}: стоит после ребусов уровня ${prevLevel} — держите файл от лёгких к трудным`);
  prevLevel = Math.max(prevLevel, r.level);

  // Подсказка не должна называть ответ.
  const hintWords = String(r.hint || '').split(/\s+/).map(normalize);
  if (a && hintWords.some((w) => w.includes(a))) problems.push(`${name}: подсказка содержит ответ`);

  // Написанных букв — не больше половины ответа (цель — не больше трети).
  const written = r.parts.filter((p) => p && p.type === 'letters').reduce((n, p) => n + normalize(p.text).length, 0);
  if (a && written / a.length > 0.5) warnings.push(`${name}: буквами написано ${written} из ${a.length}`);

  for (const p of r.parts) {
    if (p && p.type === 'pic') {
      const key = `${p.emoji} ${normalize(p.word)}`;
      pics.set(key, (pics.get(key) || 0) + 1);
    }
  }
}
for (const [key, n] of pics) {
  if (n > MAX_PIC_USES) problems.push(`картинка ${key} используется ${n} раз (максимум ${MAX_PIC_USES})`);
}

warnings.forEach((w) => console.log('!', w));
problems.forEach((p) => console.log('✗', p));
console.log(`${rebuses.length} ребусов, проблем: ${problems.length}, предупреждений: ${warnings.length}`);
if (process.argv.includes('--stats')) {
  const byLevel = [1, 2, 3].map((l) => rebuses.filter((r) => r.level === l).length);
  console.log('по уровням (1/2/3):', byLevel.join(' / '));
  console.log('ответы:', rebuses.map((r) => r.answer).join(', '));
  console.log('картинки:', [...pics].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ×${n}`).join(', '));
}
process.exit(problems.length ? 1 : 0);
