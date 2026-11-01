// Замысел (data/proposals/*.json, docs/REBUS-SPEC.md) → ребус набора (public/data/rebuses.json).
// Чистые функции без побочных эффектов: их вызывают tools/transfer.mjs (перенос) и
// tools/check-proposals.mjs (проверка «Приложение это нарисует?»).
import fs from 'node:fs';
import { normalize, techniques, POSITIONS } from '../src/core/solve.js';
import { formatProblems } from '../src/core/format.js';
import { OPS as SPEC_OPS, RELATIONS, NOT_DRAWN } from './rebus-spec.mjs';

// План дизайнера и реестр картинок (читаются по запросу, а не при импорте).
export function loadPictureSources() {
  const plan = new Map(JSON.parse(fs.readFileSync(new URL('../data/pictures-plan.json', import.meta.url), 'utf8')).map((x) => [normalize(x.word), x]));
  const reg = JSON.parse(fs.readFileSync(new URL('../data/pictures.json', import.meta.url), 'utf8'));
  return { plan, reg };
}

// Картинка: сначала план дизайнера, иначе уже одобренная запись реестра с тем же словом.
// placeholder — что поставить, если картинки ещё нет (проверка рисуемости: картинку выбирает дизайнер,
// это не повод считать замысел нерисуемым); без него — ошибка.
export function pictureFor(node, { plan, reg, placeholder }, asInitial = false) {
  const x = plan.get(normalize(node.pic));
  if (x) return x.image ? { image: x.image } : { emoji: x.emoji };
  const r = reg.pictures.find((e) => normalize(e.word) === normalize(node.pic) && !e.banned
    && (asInitial ? e.initials !== false : e.picture !== false) && (!e.image || e.designApproved));
  if (r) return r.image ? { image: r.image } : { emoji: r.emoji };
  if (placeholder) return { emoji: placeholder };
  throw new Error(`нет картинки ${node.pic}: ни в data/pictures-plan.json, ни в реестре`);
}

const OPS = SPEC_OPS.map((op) => op.key);
const NODE_NAMES = { seq: 'несколько узлов подряд (seq) внутри отношения' };
// Один узел замысла → часть ребуса набора. Бросает ошибку, если такого набор (приложение) не знает.
export function convertNode(n, pics) {
  if (n.letters !== undefined) return { type: 'letters', text: n.letters };
  if (n.pic !== undefined) {
    const out = { type: 'pic', ...pictureFor(n, pics), word: n.pic };
    OPS.forEach((k) => { if (n[k] !== undefined) out[k] = n[k]; });
    return out;
  }
  if (n.number !== undefined) {
    const out = { type: 'number', value: String(n.number), word: n.word };
    OPS.forEach((k) => { if (n[k] !== undefined) out[k] = n[k]; });
    return out;
  }
  if (n.initials) return { type: 'initials', items: n.initials.map((it) => ({ ...pictureFor(it, pics, true), word: it.pic })) };
  if (n.rel) {
    const rel = normalize(n.rel);
    if (NOT_DRAWN[rel]) throw new Error(`«${rel}» не рисуем: ${NOT_DRAWN[rel]}`);
    if (!RELATIONS[rel]) throw new Error('неизвестное отношение ' + n.rel);
    // b — буквы или картинка/первые буквы (кроме «В» и «ИЗ»: там b — контур, только буквы).
    if (n.b.letters === undefined && POSITIONS[rel].container) throw new Error(`b у «${rel.toLowerCase()}» рисуется контуром — только буквы`);
    // Набор знает два порядка: «a предлог b» и «предлог b a» (prepFirst) — как и схема замыслов.
    const read = n.read.join(',');
    if (read !== 'a,rel,b' && read !== 'rel,b,a') throw new Error('read отношения — ["a","rel","b"] или ["rel","b","a"]');
    const inner = n.a.letters !== undefined ? n.a.letters : convertNode(n.a, pics);
    const outer = n.b.letters !== undefined ? n.b.letters : convertNode(n.b, pics);
    const out = { type: 'position', prep: rel, outer, inner };
    if (read === 'rel,b,a') out.prepFirst = true;
    return out;
  }
  const kind = n.kind || Object.keys(n).find((k) => !['look', 'exceptions'].includes(k)) || '?';
  throw new Error(`${NODE_NAMES[kind] || `узел «${kind}»`} — такой части в наборе нет`);
}

// Замысел → ребус набора (без проверок автора). source — имя файла замысла.
export function toRebus(p, source, pics) {
  const r = { id: p.id, answer: p.answer, accept: [], level: p.level, theme: p.theme, techniques: [], hint: p.hint, parts: p.parts.map((n) => convertNode(n, pics)), source: `замысел ${source}` };
  if (p.exceptions) r.exceptions = p.exceptions;
  r.techniques = techniques(r).sort();
  return r;
}

// «Приложение это нарисует?»: та же конвертация, что при переносе, и проверка формата приложения
// (src/core/format.js — её же приложение делает при загрузке и пропускает ребус с ошибкой).
// Пустой список — нарисует. Картинки, которых ещё нет у дизайнера, заменяются заглушкой.
export function drawProblems(p, pics) {
  let r;
  try { r = toRebus(p, '', { ...pics, placeholder: '❔' }); } catch (e) { return [e.message]; }
  return formatProblems(r);
}
