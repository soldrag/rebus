// Схема замысла ребуса — не зависит от того, как его потом нарисуют.
// Автор ребусов пишет замыслы в data/proposals/*.json по этой схеме (docs/REBUS-SPEC.md);
// картинки — это слова и описания, а не эмодзи. Как нарисовать — решают дизайнер и разработчик.
//
// Узел (часть ребуса) — ровно один из видов:
//   { "letters": "КА" }                                   буквы
//   { "pic": "РОТ", "look": "открытый рот с губами", ...операции }   картинка-заглушка
//   { "number": "100", "word": "СТО", ...операции }       число
//   { "initials": [ { "pic": "СЛОН", "look": "…" }, … ] } первые буквы картинок
//   { "rel": "В", "a": Узел, "b": Узел, "read": ["rel", "b", "a"] }   одно относительно другого
//   { "seq": [Узел, …] }                                  несколько узлов подряд (внутри rel)
// Операции у pic и number: cutStart, cutEnd (запятые), remove ["Т"], replace [["Р","Н"]],
// replaceAt [[2,"О"]], pick [1,2,3], flip (true). Порядок: flip → replace → replaceAt → remove → pick → cut.
import { normalize, keepYo } from '../src/rebus-core.js';

// Отношения: что где стоит. a — то, что ставим; b — относительно чего.
export const RELATIONS = {
  'В': 'a внутри b',
  'НА': 'a стоит на b (касается сверху)',
  'НАД': 'a над b, с зазором',
  'ПОД': 'a под b',
  'У': 'a маленькое, вплотную сбоку от b',
  'ЗА': 'a выглядывает из-за b',
  'ПЕРЕД': 'a стоит перед b, загораживая его',
  'ИЗ': 'a выходит (вылетает, высыпается) из b',
  'ПО': 'b целиком сложено из маленьких a',
  'К': 'a движется к b (стрелка к b)',
  'ОТ': 'a движется от b (стрелка от b)',
  'С': 'a вместе с b (держатся, соединены)',
  'ДО': 'a доходит до b (линия до b)',
  'ПРИ': 'a прикреплено к b',
  'ОБ': 'a ударяется об b',
  'О': 'a ударяется о b',
};
const OPS = ['cutStart', 'cutEnd', 'remove', 'replace', 'replaceAt', 'pick', 'flip'];
const KINDS = ['letters', 'pic', 'number', 'initials', 'rel', 'seq'];

function kindOf(node) {
  const k = KINDS.filter((x) => node && node[x] !== undefined);
  return k.length === 1 ? k[0] : null;
}

function applyOps(w, node, norm) {
  if (node.flip) w = [...w].reverse().join('');
  (node.replace || []).forEach(([from, to]) => { w = w.split(norm(from)).join(norm(to)); });
  (node.replaceAt || []).forEach(([i, ch]) => { if (i >= 1 && i <= w.length) w = w.slice(0, i - 1) + norm(ch) + w.slice(i); });
  (node.remove || []).forEach((ch) => { const i = w.indexOf(norm(ch)); if (i >= 0) w = w.slice(0, i) + w.slice(i + 1); });
  if (node.pick) w = node.pick.map((n) => w.charAt(n - 1)).join('');
  return w.slice(node.cutStart || 0, w.length - (node.cutEnd || 0));
}

export function letters(node, norm = normalize) {
  switch (kindOf(node)) {
    case 'letters': return norm(node.letters);
    case 'pic': return applyOps(norm(node.pic), node, norm);
    case 'number': return applyOps(norm(node.word), node, norm);
    case 'initials': return node.initials.map((it) => norm(it.pic).charAt(0)).join('');
    case 'seq': return node.seq.map((n) => letters(n, norm)).join('');
    case 'rel': return node.read.map((t) => (t === 'rel' ? norm(node.rel) : letters(node[t], norm))).join('');
    default: return '';
  }
}

export function solveSpec(r, norm = normalize) {
  return (r.parts || []).map((n) => letters(n, norm)).join('');
}

// Приёмы замысла: те же коды, что в приложении, плюс rel:<предлог> и pic-in-rel.
export function specTechniques(r) {
  const t = new Set();
  const walk = (n, inRel) => {
    const k = kindOf(n);
    if (k === 'initials') t.add('initials');
    if (k === 'number') t.add('number');
    if (k === 'pic' || k === 'number') {
      if (n.cutStart || n.cutEnd) t.add('comma');
      if (n.remove && n.remove.length) t.add('remove');
      if (n.replace && n.replace.length) t.add('replace');
      if (n.replaceAt && n.replaceAt.length) t.add('replaceAt');
      if (n.pick) t.add('pick');
      if (n.flip) t.add('flip');
      if (inRel && k === 'pic') t.add('pic-in-rel');
    }
    if (k === 'seq') n.seq.forEach((x) => walk(x, inRel));
    if (k === 'rel') { t.add('rel:' + normalize(n.rel)); walk(n.a, true); walk(n.b, true); }
  };
  (r.parts || []).forEach((n) => walk(n, false));
  if (!t.size) t.add('plain');
  return [...t].sort();
}

// Все картинки-заглушки замысла: что нарисовать дизайнеру.
export function specPictures(r) {
  const out = [];
  const walk = (n) => {
    const k = kindOf(n);
    if (k === 'pic') out.push({ word: keepYo(n.pic), look: n.look || '' });
    if (k === 'initials') n.initials.forEach((it) => out.push({ word: keepYo(it.pic), look: it.look || '' }));
    if (k === 'seq') n.seq.forEach(walk);
    if (k === 'rel') { walk(n.a); walk(n.b); }
  };
  (r.parts || []).forEach(walk);
  return out;
}

function nodeProblems(n, path, out) {
  const k = kindOf(n);
  if (!k) { out.push(`${path}: узел должен быть ровно одним из ${KINDS.join(', ')}`); return; }
  const hasOps = OPS.some((o) => n[o] !== undefined);
  if (hasOps && k !== 'pic' && k !== 'number') out.push(`${path}: операции бывают только у pic и number`);
  if (k === 'letters' && !normalize(n.letters)) out.push(`${path}: пустые letters`);
  if (k === 'pic') {
    if (!normalize(n.pic)) out.push(`${path}: пустое слово pic`);
    if (!n.look || !String(n.look).trim()) out.push(`${path}: нет look — как выглядит картинка`);
  }
  if (k === 'number' && (!/^\d+$/.test(String(n.number)) || !normalize(n.word))) out.push(`${path}: number — цифры, word — как число читается`);
  if (k === 'initials' && (!Array.isArray(n.initials) || n.initials.length < 2 || n.initials.some((it) => !normalize(it.pic) || !it.look))) out.push(`${path}: initials — хотя бы 2 картинки с pic и look`);
  if (k === 'seq') {
    if (!Array.isArray(n.seq) || n.seq.length < 2) out.push(`${path}: seq — хотя бы 2 узла`);
    else n.seq.forEach((x, i) => nodeProblems(x, `${path}.seq[${i}]`, out));
  }
  if (k === 'rel') {
    if (!RELATIONS[normalize(n.rel)]) out.push(`${path}: rel — один из ${Object.keys(RELATIONS).join(', ')}`);
    if (!n.a || !n.b) out.push(`${path}: у rel нужны a и b`);
    const read = Array.isArray(n.read) ? n.read : [];
    if (read.length !== 3 || ['rel', 'a', 'b'].some((x) => !read.includes(x))) out.push(`${path}: read — порядок чтения из "rel", "a", "b", каждый один раз`);
    if (n.a) nodeProblems(n.a, `${path}.a`, out);
    if (n.b) nodeProblems(n.b, `${path}.b`, out);
  }
  if (n.pick && (!Array.isArray(n.pick) || n.pick.some((x) => !Number.isInteger(x) || x < 1))) out.push(`${path}: pick — номера букв с 1`);
}

// Механические проверки замысла. Содержательные правила — docs/REBUSES.md (проверяет редактор).
export function specProblems(r, { answers = new Set(), legend = [] } = {}) {
  const p = [];
  if (!r || typeof r !== 'object') return ['не объект'];
  if (!r.id || typeof r.id !== 'string') p.push('нет id');
  if (!normalize(r.answer)) p.push('нет answer');
  if (![1, 2, 3].includes(r.level)) p.push('level 1, 2 или 3');
  if (!r.hint || !String(r.hint).trim()) p.push('нет hint');
  if (!r.idea || !String(r.idea).trim()) p.push('нет idea — как ребёнок рассуждает, разгадывая');
  if (!Array.isArray(r.parts) || !r.parts.length) return p.concat('нет parts');
  r.parts.forEach((n, i) => nodeProblems(n, `parts[${i}]`, p));
  if (p.length) return p;
  const a = normalize(r.answer);
  if (solveSpec(r) !== a) p.push(`ответ ${r.answer}, а по замыслу выходит ${solveSpec(r)}`);
  else if (solveSpec(r, keepYo) !== keepYo(r.answer)) p.push(`Ё/Е: ответ ${keepYo(r.answer)}, а выходит ${solveSpec(r, keepYo)}`);
  if (answers.has(a)) p.push(`ответ ${a} уже есть в наборе`);
  if (legend.includes(a)) p.push(`ответ ${a} есть в примерах легенды`);
  if (String(r.hint).split(/\s+/).map(normalize).some((w) => w.includes(a))) p.push('подсказка содержит ответ');
  const marked = Array.isArray(r.techniques) ? [...r.techniques].sort().join(', ') : '';
  if (marked !== specTechniques(r).join(', ')) p.push(`techniques: в разметке [${marked}], а по частям [${specTechniques(r).join(', ')}]`);
  return p;
}
