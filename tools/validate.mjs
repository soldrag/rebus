// Проверка данных ребусов: npm run validate
// Правила составления — в docs/REBUSES.md. Ошибки валят сборку, предупреждения — нет.
import fs from 'node:fs';
import { confusables } from './spelling.mjs';
import { diversity, spread } from './diversity.mjs';
import { chunkStages, formatProblems, LEGEND_PICTURES, LEGEND_WORDS, normalize, pictures, rebusList, techniques } from '../src/rebus-core.js';


const file = new URL('../public/data/rebuses.json', import.meta.url);
const registryFile = new URL('../data/pictures.json', import.meta.url);
const rebuses = rebusList(JSON.parse(fs.readFileSync(file, 'utf8')));
// Одна и та же картинка — не чаще чем в ~2,5% ребусов (но до 4 раз можно всегда).
const MAX_PIC_USES = Math.max(4, Math.ceil(rebuses.length / 40));

const problems = [];
const warnings = [];
// Правила трёх видов (docs/REBUSES.md, «Как устроены правила»):
//   «нельзя» — problems; «обычно» — should(): нарушение — ошибка, если в ребусе нет
//   exceptions: { <правило>: "почему здесь можно" }; статистика — warnings.
const accepted = [];
function should(r, rule, msg) {
  const why = r && r.exceptions && typeof r.exceptions[rule] === 'string' && r.exceptions[rule].trim();
  if (why) accepted.push(`${r.id}: ${rule} — ${why}`);
  else problems.push(`${(r && r.id) || '?'}: ${msg} [правило ${rule}; можно отступить через exceptions.${rule} с причиной]`);
}
if (!rebuses.length) problems.push('в файле нет ни одного ребуса');
const ids = new Set();
const answers = new Map(); // слово → сколько раз загадано
const pics = new Map();
let prevLevel = 0;
for (const r of rebuses) {
  const name = (r && r.id) || '?';
  formatProblems(r).forEach((p) => problems.push(`${name}: ${p}`));
  if (ids.has(name)) problems.push(`${name}: повтор id`);
  ids.add(name);
  const a = normalize(r && r.answer);
  answers.set(a, (answers.get(a) || 0) + 1);
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
  if (a && a.length <= 5 && written > (r.level === 1 ? 2 : 1)) should(r, 'shortLetters', `в слове из ${a.length} букв написано ${written} — для уровня ${r.level} много`);

  if (r.parts.some((p) => p && p.type === 'position' && normalize(p.inner).length > 3)) should(r, 'positionInner', 'внутренних букв в позиции обычно не больше трёх — мелкие не читаются');
  for (const p of pictures(r)) {
    const key = `${p.emoji} ${normalize(p.word)}`;
    pics.set(key, (pics.get(key) || 0) + 1);
  }
  // Другие слова, похожие на ответ на слух, не должны считаться ошибкой в ответе (tools/spelling.mjs).
  const miss = confusables(r, rebuses).filter((w) => !(r.notMisspelled || []).map(normalize).includes(w));
  if (miss.length) problems.push(`${name}: в notMisspelled не хватает ${miss.join(', ')} — запустите npm run spelling`);
  if (a && LEGEND_WORDS.includes(a)) problems.push(`${name}: ответ ${r.answer} есть в примерах легенды — легенда его подскажет`);
}
// Одно слово можно загадать разными ребусами — лишь бы частотность была ровной, без пиков.
spread(rebuses.map((r) => normalize(r.answer))).peaks.forEach(([w, n]) => warnings.push(`слово ${w} загадано ${n} раз — пик частотности`));
// Реестр картинок (data/pictures.json): какие эмодзи и слова можно, с какого уровня,
// можно ли переворачивать и брать в «первые буквы». picture: false — только для первых букв.
// Иллюстрации: в реестре — эмодзи или своя картинка (image). Своя картинка попадает в набор
// только после одобрения дизайнера (designApproved) и в стиле приложения (docs/ILLUSTRATIONS.md).
for (const p of JSON.parse(fs.readFileSync(registryFile, 'utf8')).pictures) {
  if (!p.emoji && !p.image) problems.push(`реестр: у ${p.word} нет ни emoji, ни image`);
  if (p.image) {
    if (p.designApproved !== true) problems.push(`реестр: картинка ${p.image} (${p.word}) не одобрена дизайнером — нужен designApproved: true`);
    if (!fs.existsSync(new URL('../public/' + p.image, import.meta.url))) problems.push(`реестр: нет файла public/${p.image}`);
  }
}
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
      if (r.level < (reg.minLevel || 1)) should(r, 'pictureLevel', `картинка ${key} — обычно с уровня ${reg.minLevel}`);
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
    should(r, 'level1NumberComma', 'на уровне 1 число обычно берём целиком, без запятых');
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
// и ни один приём не больше двух честных долей уровня.
const MAX_IN_ROW = 2;
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
  // Ни один приём не больше двух честных долей уровня (tools/diversity.mjs).
  // Пока набор не перебалансирован — предупреждение; станет ошибкой после переноса замыслов.
  const d = diversity(items.map(techniques));
  d.over.forEach((o) => warnings.push(`уровень ${level}: «${o.type}» — ${o.count} из ${d.total} (${Math.round(o.share * 100)} %), предел ${Math.round(d.limit * 100)} % при ${d.n} приёмах`));
}

// Буквы в позиции (в, на, у, под, за) — ребусы из одних букв: их не должно быть слишком много.
// Не больше трёх на этап (15 % длинного этапа), не больше двух подряд, на уровне 3 — только вместе с картинкой.
const isPosition = (r) => (r.parts || []).some((p) => p && p.type === 'position');
for (const level of [1, 2, 3]) {
  const items = rebuses.filter((r) => r && r.level === level && Array.isArray(r.parts));
  chunkStages(items).forEach((stage, i) => {
    const n = stage.filter(isPosition).length;
    const max = Math.max(3, Math.ceil(stage.length * 0.15));
    if (n > max) warnings.push(`уровень ${level}, этап ${i + 1}: ${n} ребусов с буквами в позиции из ${stage.length} — не больше ${max}`);
  });
  items.forEach((r, i) => {
    if (isPosition(r) && i && isPosition(items[i - 1])) warnings.push(`${r.id}: два ребуса с буквами в позиции подряд`);
    if (level === 3 && isPosition(r) && !r.parts.some((p) => p.type === 'pic')) warnings.push(`${r.id}: на уровне 3 буквы в позиции — только вместе с картинкой`);
  });
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

accepted.forEach((x) => console.log('~ исключение:', x));
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
