// Проверка вёрстки на типичных телефонах и планшетах: нет ли горизонтальной прокрутки,
// элементов за краем экрана, переполнения легенды и картинки ребуса.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run check:screens            (или: node tools/check-screens.cjs http://localhost:4173 --shots)
//
// Нужен Playwright с Chromium (npx playwright install chromium).

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:4173').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots') ? 'screens-report' : null;

const DEVICES = [
  ['Android маленький', 360, 740], ['iPhone SE', 375, 667], ['iPhone 13/14', 390, 844],
  ['iPhone 15 Pro', 393, 852], ['Pixel', 412, 915], ['iPhone 11', 414, 896],
  ['iPhone Pro Max', 430, 932], ['Galaxy Fold', 344, 882],
  ['iPhone 13 ландшафт', 844, 390], ['iPhone Pro Max ландшафт', 932, 430], ['Android ландшафт', 740, 360],
  ['iPad mini', 768, 1024], ['iPad Air', 820, 1180], ['iPad ландшафт', 1024, 768], ['Ноутбук', 1280, 800],
];
const SEEN = '["initials","number","pick","replaceAt","in","on","flip","replace","remove"]';

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Нужен Playwright: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

// Что вылезает за экран или за свой контейнер.
function findOverflow() {
  const W = document.documentElement.clientWidth;
  const out = [];
  const name = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  if (document.documentElement.scrollWidth > W + 1) out.push(`страница шире экрана: ${document.documentElement.scrollWidth} > ${W}`);
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('#confetti')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.position === 'fixed' && e.id === 'confetti') continue;
    if (r.right > W + 1 || r.left < -1) out.push(`${name(e)} за краем: ${Math.round(r.left)}…${Math.round(r.right)} при ширине ${W}`);
  }
  for (const box of document.querySelectorAll('dialog[open], .legend, .board, .card, .panel')) {
    if (box.scrollWidth > box.clientWidth + 1) out.push(`${name(box)}: горизонтальная прокрутка ${box.scrollWidth} > ${box.clientWidth}`);
  }
  const help = document.querySelector('.help-btn');
  if (help) {
    const r = help.getBoundingClientRect();
    if (r.right > W || r.width < 40) out.push('кнопка «?» не видна целиком');
  }
  return [...new Set(out)].slice(0, 8);
}

(async () => {
  const browser = await chromium.launch();
  const data = await (await fetch(BASE + '/data/rebuses.json')).json();
  const list = data.rebuses;
  // По ребусу на каждый приём и уровень, плюс самый длинный.
  const pick = new Map();
  for (const r of list) {
    const key = r.level + ':' + r.parts.map((p) => p.type + (p.pick ? 'pick' : '') + (p.replaceAt ? 'rat' : '') + (p.flip ? 'flip' : '')).sort().join(',');
    if (!pick.has(key)) pick.set(key, r);
  }
  const longest = [...list].sort((a, b) => b.parts.length - a.parts.length || b.answer.length - a.answer.length)[0];
  const sample = [...new Set([...pick.values(), longest])];
  const lvl1 = list.filter((r) => r.level === 1);

  const problems = [];
  if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
  for (const [dev, w, h] of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 1000, hasTouch: w < 1100 });
    await ctx.addInitScript((seen) => localStorage.setItem('rebus-seen-v1', seen), SEEN);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${dev}: ошибка JS ${e.message}`));
    const check = async (screen) => {
      await page.waitForTimeout(450);
      for (const p of await page.evaluate(findOverflow)) problems.push(`${dev} ${w}×${h}, ${screen}: ${p}`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-${screen.replace(/[^\wа-я-]+/gi, '_')}.png` });
    };
    const go = async (hash) => { await page.goto(BASE + '/' + hash); await page.waitForSelector('#app > *'); };

    await go('#/'); await check('главная');
    await go('#/all'); await check('все ребусы');
    await go('#/about'); await check('о приложении');
    for (const r of sample) { await go('#/r/' + r.id); await page.waitForSelector('.board'); await check('ребус ' + r.id); }
    // Легенда, подсказка и разбор — на первом ребусе.
    await go('#/r/' + list[0].id); await page.waitForSelector('.help-btn');
    await page.click('.help-btn'); await check('легенда'); await page.keyboard.press('Escape');
    for (const v of ['ааа', 'ббб']) { await page.fill('input', v); await page.click('.btn-check'); await page.waitForTimeout(300); }
    if (await page.$('.hint-btn')) { await page.click('.hint-btn'); await check('подсказка'); }
    await page.fill('input', 'ввв'); await page.click('.btn-check'); await page.waitForTimeout(900); await check('разбор');
    // Слово угадано с ошибкой: «Пишется так», потом письмо по образцу.
    if (list.some((r) => r.id === 'vorona')) {
      await go('#/r/vorona'); await page.waitForSelector('input');
      await page.fill('input', 'варона'); await page.click('.btn-check'); await check('пишется так');
      await page.waitForTimeout(1600); await page.focus('input'); await page.keyboard.type('вар'); await check('по образцу');
    }
    // Кубок: весь первый этап уровня 1 отгадан.
    await page.evaluate((ids) => localStorage.setItem('rebus-progress-v1', JSON.stringify(Object.fromEntries(ids.map((id) => [id, { tries: 0, status: 'solved' }])))), lvl1.slice(0, 20).map((r) => r.id));
    await go('#/cup/1/1'); await check('кубок');
    await ctx.close();
  }
  await browser.close();
  if (problems.length) {
    console.log(problems.map((p) => '✗ ' + p).join('\n'));
    console.log(`\nПроблем: ${problems.length}`);
    process.exit(1);
  }
  console.log(`Экраны в порядке: ${DEVICES.length} устройств × ${sample.length + 10} экранов`);
})();
