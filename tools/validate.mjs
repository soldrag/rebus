// Проверка данных ребусов: npm run validate
// Правила составления — в docs/REBUSES.md. Ошибки валят сборку, предупреждения — нет.
import fs from 'node:fs';
import { chunkStages, formatProblems, LEGEND_PICTURES, LEGEND_WORDS, normalize, pictures, rebusList, techniques } from '../src/rebus-core.js';


const file = new URL('../public/data/rebuses.json', import.meta.url);
const registryFile = new URL('../data/pictures.json', import.meta.url);
const rebuses = rebusList(JSON.parse(fs.readFileSync(file, 'utf8')));
// Одна и та же картинка — не чаще чем в ~2,5% ребусов (но до 4 раз можно всегда).
const MAX_PIC_USES = Math.max(4, Math.ceil(rebuses.length / 40));

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
  // В коротком слове (3–5 букв) — одна написанная буква, на уровне 1 можно две.
  if (a && a.length <= 5 && written > (r.level === 1 ? 2 : 1)) problems.push(`${name}: в слове из ${a.length} букв написано ${written} — для уровня ${r.level} много`);

  for (const p of pictures(r)) {
    const key = `${p.emoji} ${normalize(p.word)}`;
    pics.set(key, (pics.get(key) || 0) + 1);
  }
  if (a && LEGEND_WORDS.includes(a)) problems.push(`${name}: ответ ${r.answer} есть в примерах легенды — легенда его подскажет`);
}
// Реестр картинок (data/pictures.json): какие эмодзи и слова можно, с какого уровня,
// можно ли переворачивать и брать в «первые буквы». picture: false — только для первых букв.
const registry = new Map(
  JSON.parse(fs.readFileSync(registryFile, 'utf8')).pictures.map((p) => [`${p.emoji} ${normalize(p.word)}`, p]),
);
for (const r of rebuses) {
  for (const part of (r && r.parts) || []) {
    if (!part) continue;
    const uses = part.type === 'pic' ? [{ ...part, asInitial: false }]
      : part.type === 'initials' ? (part.items || []).map((it) => ({ ...it, asInitial: true })) : [];
    for (const u of uses) {
      const key = `${u.emoji} ${normalize(u.word)}`;
      const reg = registry.get(key);
      if (!reg) { problems.push(`${r.id}: картинки ${key} нет в реестре data/pictures.json`); continue; }
      if (reg.banned) { problems.push(`${r.id}: картинка ${key} запрещена — ${reg.note || 'см. реестр'}`); continue; }
      if (r.level < (reg.minLevel || 1)) problems.push(`${r.id}: картинка ${key} — только с уровня ${reg.minLevel}`);
      if (u.asInitial && reg.initials === false) problems.push(`${r.id}: картинку ${key} нельзя в первые буквы — ${reg.note || ''}`);
      if (!u.asInitial && reg.picture === false) problems.push(`${r.id}: картинку ${key} можно только в первые буквы — ${reg.note || ''}`);
      if (!u.asInitial && u.flip && !reg.flip) problems.push(`${r.id}: картинку ${key} нельзя переворачивать — ${reg.note || ''}`);
      // Цифры над картинкой в обратном порядке (4 3 2 1) — это тот же переворот.
      const pk = u.pick || [];
      if (!u.asInitial && pk.length > 1 && pk.every((n, i) => i === 0 || n < pk[i - 1]) && !reg.flip) {
        problems.push(`${r.id}: цифры над ${key} в обратном порядке — это переворот, а её переворачивать нельзя`);
      }
    }
  }
}

// Картинки легенды подчиняются тому же реестру.
for (const p of LEGEND_PICTURES) {
  const key = `${p.emoji} ${normalize(p.word)}`;
  const reg = registry.get(key);
  if (!reg || reg.banned) problems.push(`легенда: картинки ${key} нет в реестре или она запрещена`);
  else if (p.flip && !reg.flip) problems.push(`легенда: картинку ${key} нельзя переворачивать`);
  else if (p.initials && reg.initials === false) problems.push(`легенда: картинку ${key} нельзя в первые буквы`);
  else if (!p.initials && reg.picture === false) problems.push(`легенда: картинку ${key} можно только в первые буквы`);
}

// Уровень 1: число только целиком — без запятых (иначе это две операции для пятилетки).
for (const r of rebuses) {
  if (r && r.level === 1 && (r.parts || []).some((p) => p && p.type === 'number' && (p.cutStart || p.cutEnd))) {
    problems.push(`${r.id}: на уровне 1 число берём целиком, без запятых`);
  }
}

// Одна операция на картинку (переворот с запятыми — только на уровне 3).
for (const r of rebuses) {
  for (const p of (r && r.parts) || []) {
    if (!p || p.type !== 'pic') continue;
    const ops = ['flip', 'replace', 'replaceAt', 'remove', 'pick'].filter((k) => p[k] && (p[k] === true || p[k].length));
    if (p.cutStart || p.cutEnd) ops.push('cut');
    const flipCut = ops.length === 2 && ops.includes('flip') && ops.includes('cut') && r.level === 3;
    if (ops.length > 1 && !flipCut) warnings.push(`${r.id}: на картинке ${p.emoji} несколько операций (${ops.join(', ')})`);
  }
}

// Чередование: не больше двух ребусов подряд с одним набором приёмов,
// и один набор приёмов — не больше 40 % уровня.
const MAX_IN_ROW = 2;
// Уровню 1 чуть больше допуска: подходящих пятилеткам приёмов меньше.
const MAX_SHARE = { 1: 0.45, 2: 0.4, 3: 0.4 };
const kindOf = (r) => techniques(r).sort().join('+');
const shares = {};
// Темы: не больше трёх ребусов одной темы подряд внутри уровня.
for (const level of [1, 2, 3]) {
  let run = 0;
  rebuses.filter((r) => r && r.level === level).forEach((r, i, items) => {
    run = i && items[i - 1].theme === r.theme ? run + 1 : 1;
    if (run === 4) warnings.push(`${r.id}: уже 4 ребуса подряд на тему «${r.theme}» на уровне ${level}`);
  });
}
for (const level of [1, 2, 3]) {
  const items = rebuses.filter((r) => r && r.level === level && Array.isArray(r.parts));
  let run = 0;
  items.forEach((r, i) => {
    run = i && kindOf(items[i - 1]) === kindOf(r) ? run + 1 : 1;
    if (run === MAX_IN_ROW + 1) warnings.push(`${r.id}: уже ${run} ребуса подряд «${kindOf(r)}» на уровне ${level}`);
  });
  const count = {};
  items.forEach((r) => { count[kindOf(r)] = (count[kindOf(r)] || 0) + 1; });
  shares[level] = count;
  for (const [k, n] of Object.entries(count)) {
    if (items.length >= 10 && n / items.length > MAX_SHARE[level]) warnings.push(`уровень ${level}: «${k}» — ${n} из ${items.length} (больше ${MAX_SHARE[level] * 100} %)`);
  }
}

// Зеркальные пары: ответ одного ребуса — картинка другого. «Узел» (картинкой в 2+ ребусах)
// и пара внутри одного этапа мешают ребёнку.
const stageOfId = new Map();
for (const level of [1, 2, 3]) {
  chunkStages(rebuses.filter((r) => r && r.level === level)).forEach((items, i) => items.forEach((r) => stageOfId.set(r.id, `${level}-${i + 1}`)));
}
for (const r of rebuses) {
  const a = normalize(r && r.answer);
  if (!a) continue;
  const others = rebuses.filter((o) => o !== r && pictures(o).some((p) => normalize(p.word) === a));
  if (others.length >= 2) warnings.push(`${r.id}: ответ ${r.answer} стоит картинкой в ${others.length} ребусах (${others.map((o) => o.id).join(', ')}) — «узел»`);
  else if (others.length === 1 && stageOfId.get(others[0].id) === stageOfId.get(r.id)) warnings.push(`${r.id}: зеркальная пара с ${others[0].id} в одном этапе`);
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
  const themes = {};
  rebuses.forEach((r) => { themes[r.theme] = (themes[r.theme] || 0) + 1; });
  console.log('темы:', Object.entries(themes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', '));
  for (const level of [1, 2, 3]) {
    const c = Object.entries(shares[level]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ');
    console.log(`приёмы, уровень ${level}:`, c);
  }
  console.log('картинки:', [...pics].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ×${n}`).join(', '));
}
process.exit(problems.length ? 1 : 0);
