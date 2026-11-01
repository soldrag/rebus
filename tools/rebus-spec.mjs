// Схема замысла ребуса — не зависит от того, как его потом нарисуют (docs/REBUS-SPEC.md).
//
// Схема открыта к расширению: виды узлов, операции и отношения — это реестры ниже.
// Новый вид = новая запись в реестре; существующие записи не меняются, поэтому старые
// замыслы решаются так же, как раньше. Это проверяет `npm run proposals` на образцах
// tools/spec-fixtures.json: каждый образец обязан давать свой ответ при любой версии схемы.
//
// Правила расширения:
//   1. Только добавлять: новые виды узлов, операции, отношения, необязательные поля.
//   2. Не менять смысл существующих полей и порядок операций; новое поле по умолчанию
//      (когда его нет) ведёт себя как раньше.
//   3. Каждый новый вид — с образцом в tools/spec-fixtures.json.
//   4. Неизвестный вид узла не роняет проверку: замысел помечается «нужен обработчик».
import { normalize, keepYo, partLetters, innerPart, outerPart, POSITIONS } from '../src/core/solve.js';
import { hintNamesAnswer, isLegendWord } from './rules.mjs';

export const SCHEMA_VERSION = 1;

// Отношения: a — что ставим, b — относительно чего. Только те, что приложение рисует
// (docs/VISUAL-LANGUAGE.md); смысл совпадает с листом дизайнера. Добавлять можно, менять смысл — нет.
export const RELATIONS = {
  'В': 'a внутри b',
  'НА': 'a стоит на b (касается сверху)',
  'ПОД': 'a под b (касается снизу)',
  'У': 'a маленькое, вплотную слева от b',
  'ЗА': 'a выглядывает из-за b (a сзади контуром, b спереди слева)',
  'ПЕРЕД': 'a стоит перед b и закрывает его угол (b сзади контуром слева, a спереди справа)',
  'ИЗ': 'a выходит из b (b — большой контур, a наполовину снаружи, стрелка от a)',
  'К': 'a движется к b (a слева, стрелка к b)',
  'ОТ': 'a уходит от b (b слева, a справа, стрелка от b)',
  'ДО': 'a доходит до b (линия от a упирается чертой в b)',
};
// Где читается предлог: 'first' — в начале («за К — АТ»), 'between' — между частями («ЧАЙ к А»);
// без записи — как удобнее («в О — ДА» и «ДИ в АН»). Части — как книга: сверху вниз, слева направо,
// поэтому read — только ["a","rel","b"] или ["rel","b","a"].
// Источник один с набором: POSITIONS[…].read в src/core/solve.js.
export const RELATION_READ = Object.fromEntries(Object.entries(POSITIONS).filter(([, x]) => x.read).map(([k, x]) => [k, x.read]));
// Предлоги, которые не рисуем: замысел с ними — ошибка с причиной (лист дизайнера «Остальные предлоги»).
export const NOT_DRAWN = {
  'НАД': 'слишком сложно и неочевидно для детей',
  'ПО': 'слишком сложно и неочевидно для детей',
  'С': '«вместе» на рисунке — это просто «рядом»; связку ребёнок назовёт «и» или «плюс»',
  'ПРИ': 'дети 5–8 не говорят «при» про место; прикреплённое читается как «на», «у» или «к»',
  'О': 'это ещё одно «движется к b»; «о» путается с буквой О в ребусе',
  'ОБ': 'это ещё одно «движется к b»; одна картинка дала бы два предлога (о или об)',
};
const READS = { between: 'a,rel,b', first: 'rel,b,a' };

// Операции над словом картинки или числа — в порядке применения. Новую операцию
// добавлять в конец (или туда, где она не меняет результат старых замыслов).
export const OPS = [
  { key: 'flip', tech: 'flip', ok: (v) => v === true, apply: (w) => [...w].reverse().join('') },
  { key: 'replace', tech: 'replace', ok: (v) => Array.isArray(v) && v.every((x) => Array.isArray(x) && x.length === 2),
    apply: (w, v, norm) => v.reduce((s, [from, to]) => s.split(norm(from)).join(norm(to)), w) },
  { key: 'replaceAt', tech: 'replaceAt', ok: (v) => Array.isArray(v) && v.every((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 1),
    apply: (w, v, norm) => v.reduce((s, [i, ch]) => (i <= s.length ? s.slice(0, i - 1) + norm(ch) + s.slice(i) : s), w) },
  { key: 'remove', tech: 'remove', ok: (v) => Array.isArray(v),
    apply: (w, v, norm) => v.reduce((s, ch) => { const i = s.indexOf(norm(ch)); return i >= 0 ? s.slice(0, i) + s.slice(i + 1) : s; }, w) },
  { key: 'pick', tech: 'pick', ok: (v) => Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 1),
    apply: (w, v) => v.map((n) => w.charAt(n - 1)).join('') },
  { key: 'cutStart', tech: 'comma', ok: (v) => Number.isInteger(v) && v >= 0, apply: (w, v) => w.slice(v) },
  { key: 'cutEnd', tech: 'comma', ok: (v) => Number.isInteger(v) && v >= 0, apply: (w, v) => w.slice(0, w.length - v) },
];
const applyOps = (w, node, norm) => OPS.reduce((s, op) => (node[op.key] !== undefined ? op.apply(s, node[op.key], norm) : s), w);
const opTechs = (node) => OPS.filter((op) => node[op.key] !== undefined && node[op.key] !== false && !(Array.isArray(node[op.key]) && !node[op.key].length) && node[op.key] !== 0).map((op) => op.tech);

// Виды узлов. У каждого: letters — буквы узла; problems — ошибки формы; techniques — коды приёмов;
// pictures — картинки-заглушки; children — вложенные узлы (для обхода).
// ctx = { norm, letters(узел), path }.
export const NODE_KINDS = {
  letters: {
    letters: (n, c) => c.norm(n.letters),
    problems: (n) => (normalize(n.letters) ? [] : ['пустые letters']),
  },
  pic: {
    ops: true,
    letters: (n, c) => applyOps(c.norm(n.pic), n, c.norm),
    problems: (n) => [!normalize(n.pic) && 'пустое слово pic', !String(n.look || '').trim() && 'нет look — как выглядит картинка'].filter(Boolean),
    techniques: (n) => opTechs(n),
    pictures: (n) => [{ word: keepYo(n.pic), look: n.look || '' }],
  },
  number: {
    ops: true,
    letters: (n, c) => applyOps(c.norm(n.word), n, c.norm),
    problems: (n) => (/^\d+$/.test(String(n.number)) && normalize(n.word) ? [] : ['number — цифры, word — как число читается']),
    techniques: (n) => ['number', ...opTechs(n)],
  },
  initials: {
    letters: (n, c) => n.initials.map((it) => c.norm(it.pic).charAt(0)).join(''),
    problems: (n) => (Array.isArray(n.initials) && n.initials.length >= 2 && n.initials.every((it) => it && normalize(it.pic) && it.look)
      ? [] : ['initials — хотя бы 2 картинки с pic и look']),
    techniques: () => ['initials'],
    pictures: (n) => n.initials.map((it) => ({ word: keepYo(it.pic), look: it.look || '' })),
  },
  seq: {
    letters: (n, c) => n.seq.map(c.letters).join(''),
    problems: (n) => (Array.isArray(n.seq) && n.seq.length >= 2 ? [] : ['seq — хотя бы 2 узла']),
    children: (n) => (Array.isArray(n.seq) ? n.seq.map((x, i) => [`seq[${i}]`, x]) : []),
  },
  rel: {
    letters: (n, c) => n.read.map((t) => (t === 'rel' ? c.norm(n.rel) : c.letters(n[t]))).join(''),
    problems: (n) => {
      const p = [];
      const rel = normalize(n.rel);
      if (NOT_DRAWN[rel]) p.push(`rel «${rel}» не рисуем: ${NOT_DRAWN[rel]}. Можно: ${Object.keys(RELATIONS).join(', ')}`);
      else if (!RELATIONS[rel]) p.push(`rel — один из ${Object.keys(RELATIONS).join(', ')}`);
      if (!n.a || !n.b) p.push('у rel нужны a и b');
      // b у «В» и «ИЗ» — контур, который вмещает a; картинку (и первые буквы) контуром не нарисовать.
      else if (POSITIONS[rel] && POSITIONS[rel].container && kindOf(n.b).kind !== 'letters') p.push(`b у «${rel.toLowerCase()}» рисуется контуром — только буквы`);
      if (POSITIONS[rel] && POSITIONS[rel].row && [n.a, n.b].some((x) => x && kindOf(x).kind === 'initials')) p.push(`первые буквы в «${rel.toLowerCase()}» не рисуем — рамка читается отдельным словом`);
      const read = Array.isArray(n.read) ? n.read.join(',') : '';
      if (!Object.values(READS).includes(read)) p.push('read — ["a","rel","b"] (предлог между частями) или ["rel","b","a"] (предлог в начале)');
      else if (RELATION_READ[rel] && read !== READS[RELATION_READ[rel]]) {
        p.push(`«${rel}» читается ${RELATION_READ[rel] === 'first' ? 'в начале: read ["rel","b","a"]' : 'между частями: read ["a","rel","b"]'}`);
      }
      return p;
    },
    techniques: (n) => ['rel:' + normalize(n.rel)],
    children: (n) => [['a', n.a], ['b', n.b]].filter(([, x]) => x),
  },
};

// Вид узла: единственный ключ узла, который есть в реестре. Незнакомый ключ — не ошибка схемы,
// а «нужен обработчик»: замысел не теряется, его можно будет решить, когда вид добавят.
export function kindOf(node) {
  if (!node || typeof node !== 'object') return { kind: null };
  if (typeof node.kind === 'string') return { kind: NODE_KINDS[node.kind] ? node.kind : null, unknown: NODE_KINDS[node.kind] ? null : node.kind };
  const known = Object.keys(NODE_KINDS).filter((k) => node[k] !== undefined);
  return known.length === 1 ? { kind: known[0] } : { kind: null, ambiguous: known };
}

function walk(node, fn, path = '', inRel = false) {
  const { kind } = kindOf(node);
  fn(node, kind, path, inRel);
  const def = kind && NODE_KINDS[kind];
  if (def && def.children) def.children(node).forEach(([k, x]) => walk(x, fn, `${path}.${k}`, inRel || kind === 'rel'));
}

export function letters(node, norm = normalize) {
  const { kind } = kindOf(node);
  if (!kind) return null;
  const ctx = { norm, letters: (x) => letters(x, norm) };
  try { return NODE_KINDS[kind].letters(node, ctx); } catch { return null; }
}

export function solveSpec(r, norm = normalize) {
  const parts = (r.parts || []).map((n) => letters(n, norm));
  return parts.some((x) => x === null) ? null : parts.join('');
}

// Приёмы: коды из реестров плюс pic-in-rel, если картинка стоит в отношении.
export function specTechniques(r) {
  const t = new Set();
  (r.parts || []).forEach((n) => walk(n, (node, kind, _path, inRel) => {
    const def = kind && NODE_KINDS[kind];
    if (def && def.techniques) def.techniques(node).forEach((x) => t.add(x));
    if (inRel && kind === 'pic') t.add('pic-in-rel');
  }));
  if (!t.size) t.add('plain');
  return [...t].sort();
}

// Узлы-картинки замысла (с операциями и look); картинка «первых букв» — с inInitials.
export function specPictureNodes(r) {
  const out = [];
  (r.parts || []).forEach((n) => walk(n, (node, kind) => {
    if (kind === 'pic') out.push(node);
    if (kind === 'initials') node.initials.forEach((it) => out.push({ ...it, inInitials: true }));
  }));
  return out;
}

export function specPictures(r) {
  const out = [];
  (r.parts || []).forEach((n) => walk(n, (node, kind) => {
    const def = kind && NODE_KINDS[kind];
    if (def && def.pictures) out.push(...def.pictures(node));
  }));
  return out;
}

function nodeProblems(r) {
  const p = [];
  (r.parts || []).forEach((n, i) => walk(n, (node, kind, path) => {
    const where = `parts[${i}]${path}`;
    const k = kindOf(node);
    if (!kind) {
      p.push(k.unknown ? `${where}: вид «${k.unknown}» пока не поддержан — нужен обработчик в tools/rebus-spec.mjs`
        : `${where}: узел должен быть ровно одним из ${Object.keys(NODE_KINDS).join(', ')}${k.ambiguous && k.ambiguous.length ? ` (а тут ${k.ambiguous.join(' и ')}; укажите "kind")` : ''}`);
      return;
    }
    const def = NODE_KINDS[kind];
    (def.problems ? def.problems(node) : []).forEach((x) => p.push(`${where}: ${x}`));
    for (const op of OPS) {
      if (node[op.key] === undefined) continue;
      if (!def.ops) p.push(`${where}: операция ${op.key} бывает только у ${Object.keys(NODE_KINDS).filter((x) => NODE_KINDS[x].ops).join(', ')}`);
      else if (!op.ok(node[op.key])) p.push(`${where}: неверное значение ${op.key}`);
    }
  }));
  return p;
}

// Механические проверки замысла. Содержательные правила — docs/REBUSES.md (проверяет редактор).
export function specProblems(r) {
  if (!r || typeof r !== 'object') return ['не объект'];
  const p = [];
  if (!r.id || typeof r.id !== 'string') p.push('нет id');
  if (!normalize(r.answer)) p.push('нет answer');
  if (![1, 2, 3].includes(r.level)) p.push('level 1, 2 или 3');
  if (!r.hint || !String(r.hint).trim()) p.push('нет hint');
  if (!r.idea || !String(r.idea).trim()) p.push('нет idea — как ребёнок рассуждает, разгадывая');
  if (r.schema !== undefined && !(Number.isInteger(r.schema) && r.schema <= SCHEMA_VERSION)) p.push(`schema ${r.schema} новее, чем знает проверка (${SCHEMA_VERSION})`);
  if (!Array.isArray(r.parts) || !r.parts.length) return p.concat('нет parts');
  p.push(...nodeProblems(r));
  if (p.length) return p;
  const a = normalize(r.answer);
  const got = solveSpec(r);
  if (got !== a) p.push(`ответ ${r.answer}, а по замыслу выходит ${got}`);
  else if (solveSpec(r, keepYo) !== keepYo(r.answer)) p.push(`Ё/Е: ответ ${keepYo(r.answer)}, а выходит ${solveSpec(r, keepYo)}`);
  if (isLegendWord(a)) p.push(`ответ ${a} есть в примерах легенды`);
  // Ребус — это превращение: ответ не может быть просто названием одной картинки.
  const pics = specPictures(r).map((x) => normalize(x.word));
  if (pics.includes(a)) p.push(`ответ ${a} — это просто картинка: тут нечего разгадывать`);
  if (hintNamesAnswer(r.hint, a)) p.push('подсказка содержит ответ');
  const marked = Array.isArray(r.techniques) ? [...r.techniques].sort().join(', ') : '';
  if (marked !== specTechniques(r).join(', ')) p.push(`techniques: в разметке [${marked}], а по частям [${specTechniques(r).join(', ')}]`);
  return p;
}

// --- Дубли. Схема детерминированная, поэтому дубли видно по устройству, а не по словам.
// «Ход» — один приём над конкретным материалом: «КОРОНА 1=В», «РОТ в О», «ДА в О».
// Одинаковый ход в двух ребусах — повтор идеи, даже если ответы разные.
const opsSig = (n) => OPS.filter((op) => n[op.key] !== undefined).map((op) => `${op.key}=${JSON.stringify(n[op.key])}`).join(';');

export function specTricks(r) {
  const out = [];
  (r.parts || []).forEach((n) => walk(n, (node, kind) => {
    if (kind === 'pic' || kind === 'number') {
      const sig = opsSig(node);
      if (sig) out.push(`${kind}:${normalize(node.pic || node.word)}[${sig}]`);
    }
    if (kind === 'initials') out.push('initials:' + node.initials.map((it) => normalize(it.pic)).join('+'));
    if (kind === 'rel') out.push(`rel:${normalize(node.rel)}(${letters(node.a)}|${letters(node.b)})`);
  }));
  return out;
}

// То же для ребусов набора (формат public/data/rebuses.json).
export function setTricks(r) {
  const out = [];
  for (const p of r.parts || []) {
    if (p.type === 'pic' || p.type === 'number') {
      const sig = opsSig(p);
      if (sig) out.push(`${p.type}:${normalize(p.word)}[${sig}]`);
    }
    if (p.type === 'initials') out.push('initials:' + (p.items || []).map((it) => normalize(it.word)).join('+'));
    if (p.type === 'position') out.push(`rel:${normalize(p.prep)}(${innerPart(p) ? partLetters(innerPart(p)) : normalize(p.inner)}|${outerPart(p) ? partLetters(outerPart(p)) : normalize(p.outer)})`);
  }
  return out;
}

// Полный «скелет» замысла без описаний картинок: совпал — это тот же ребус.
export function specSkeleton(r) {
  return JSON.stringify(r.parts, (k, v) => (k === 'look' ? undefined : v));
}
