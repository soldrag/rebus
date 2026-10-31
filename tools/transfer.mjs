// Перенос одобренных замыслов (data/proposals/*.json) в набор public/data/rebuses.json.
//
//   node tools/transfer.mjs [id …]      — без id переносит все замыслы, которые решаются
//
// Картинки берутся из плана дизайнера data/pictures-plan.json (эмодзи или своя иллюстрация).
// Новые картинки добавляются в реестр data/pictures.json; свои иллюстрации — без одобрения
// (designApproved ставит дизайнер после проверки ребуса на экране, иначе сборка не пройдёт).
// Ребусы вставляются в свой уровень равномерно, между старыми; потом — npm run spelling,
// npm run validate и раскладка по предупреждениям.
import fs from 'node:fs';
import { normalize, techniques, formatProblems } from '../src/rebus-core.js';
import { solveSpec } from './rebus-spec.mjs';

const dir = new URL('../data/proposals/', import.meta.url);
const setFile = new URL('../public/data/rebuses.json', import.meta.url);
const regFile = new URL('../data/pictures.json', import.meta.url);
const plan = new Map(JSON.parse(fs.readFileSync(new URL('../data/pictures-plan.json', import.meta.url), 'utf8')).map((x) => [normalize(x.word), x]));
const only = process.argv.slice(2);

function picture(node) {
  const x = plan.get(normalize(node.pic));
  if (!x) throw new Error(`нет картинки ${node.pic} в data/pictures-plan.json`);
  return x.image ? { image: x.image } : { emoji: x.emoji };
}
const OPS = ['flip', 'replace', 'replaceAt', 'remove', 'pick', 'cutStart', 'cutEnd'];
function convert(n) {
  if (n.letters !== undefined) return { type: 'letters', text: n.letters };
  if (n.pic !== undefined) {
    const out = { type: 'pic', ...picture(n), word: n.pic };
    OPS.forEach((k) => { if (n[k] !== undefined) out[k] = n[k]; });
    return out;
  }
  if (n.number !== undefined) {
    const out = { type: 'number', value: String(n.number), word: n.word };
    OPS.forEach((k) => { if (n[k] !== undefined) out[k] = n[k]; });
    return out;
  }
  if (n.initials) return { type: 'initials', items: n.initials.map((it) => ({ ...picture(it), word: it.pic })) };
  if (n.rel) {
    if (n.b.letters === undefined) throw new Error('в наборе b у отношения — только буквы');
    const inner = n.a.letters !== undefined ? n.a.letters : convert(n.a);
    const out = { type: 'position', prep: n.rel, outer: n.b.letters, inner };
    if (n.read[0] === 'rel') out.prepFirst = true;
    return out;
  }
  throw new Error('вид узла не поддержан набором: ' + JSON.stringify(n).slice(0, 60));
}

const set = JSON.parse(fs.readFileSync(setFile, 'utf8'));
const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
const have = new Set(set.rebuses.map((r) => r.id));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const moved = [];
for (const f of files) {
  const json = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
  for (const p of json.proposals || []) {
    if (only.length && !only.includes(p.id)) continue;
    if (have.has(p.id) || solveSpec(p) === null) continue;
    const r = { id: p.id, answer: p.answer, accept: [], level: p.level, theme: p.theme, techniques: [], hint: p.hint, parts: p.parts.map(convert), source: `замысел ${f.replace('.json', '')}` };
    if (p.exceptions) r.exceptions = p.exceptions;
    r.techniques = techniques(r).sort();
    const bad = formatProblems(r);
    if (bad.length) { console.log(`✗ ${p.id}: ${bad.join('; ')}`); continue; }
    moved.push(r);
  }
}
// Реестр: новые картинки.
const regKeys = new Set(reg.pictures.map((x) => `${x.emoji || x.image} ${normalize(x.word)}`));
for (const x of plan.values()) {
  const key = `${x.emoji || x.image} ${normalize(x.word)}`;
  if (regKeys.has(key)) continue;
  const e = { word: x.word, minLevel: 1, flip: false, initials: true, note: x.note || '' };
  if (x.image) Object.assign(e, { image: x.image, designApproved: false }); else e.emoji = x.emoji;
  reg.pictures.push(e); regKeys.add(key);
  console.log('+ реестр:', key);
}
// Вставка: в свой уровень, равномерно между старыми ребусами.
for (const level of [1, 2, 3]) {
  const add = moved.filter((r) => r.level === level);
  if (!add.length) continue;
  const idx = set.rebuses.map((r, i) => [r, i]).filter(([r]) => r.level === level).map(([, i]) => i);
  const start = idx[0], len = idx.length;
  // позиции внутри уровня, с конца — чтобы индексы не съезжали
  const at = add.map((r, k) => start + Math.round(((k + 1) * len) / (add.length + 1)));
  for (let k = add.length - 1; k >= 0; k--) set.rebuses.splice(at[k], 0, add[k]);
  console.log(`уровень ${level}: +${add.length} (${add.map((r) => r.answer).join(', ')})`);
}
fs.writeFileSync(setFile, JSON.stringify(set, null, 2) + '\n');
fs.writeFileSync(regFile, JSON.stringify(reg, null, 2) + '\n');
console.log(`перенесено: ${moved.length}`);
