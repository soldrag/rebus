// Сценарии ребёнка на телефоне 390×844: главная → ребус → ответ → «Дальше», орфография и письмо
// по образцу, подсказка и разбор, легенда, кубок, «Все ребусы», Enter на физической клавиатуре,
// доски всех ребусов. Проверяет, что на каждом шаге на экране то, что должно, и нет ошибок консоли.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run check:scenarios          (или: node tools/check-scenarios.cjs http://localhost:4173 [--shots папка] [--no-boards])
//
// Анимации выключены (prefers-reduced-motion), service worker заблокирован — шаги детерминированы.
// --shots папка — ещё и снимки экранов (для попиксельного сравнения двух сборок).
// Нужен Playwright с Chromium (npx playwright install chromium).

const fs = require('fs');
const path = require('path');

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:4173').replace(/\/$/, '');
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const BOARDS = !process.argv.includes('--no-boards');
const SEEN = ['initials', 'number', 'pick', 'replaceAt', 'in', 'on', 'flip', 'replace', 'remove', 'near', 'under', 'behind'];

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Нужен Playwright: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const failures = [];
let checks = 0;
const expect = (ok, what) => { checks++; if (!ok) failures.push(what); return ok; };

(async () => {
  const browser = await chromium.launch();
  const mk = async ({ seen = true } = {}) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    // Прогресс — чистый только при первом открытии вкладки: перезагрузка его сохраняет.
    await ctx.addInitScript(([s, seen]) => {
      if (!sessionStorage.getItem('init')) {
        sessionStorage.setItem('init', '1');
        localStorage.clear();
        if (seen) localStorage.setItem('rebus-seen-v1', s);
      }
    }, [JSON.stringify(SEEN), seen]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => failures.push('ошибка JS: ' + e.message));
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !/blocked by Playwright/.test(m.text())) failures.push(`console.${m.type()}: ${m.text()}`);
    });
    return { ctx, page };
  };
  const shot = async (page, name, wait = 500) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(wait);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), animations: 'disabled', caret: 'hide' });
  };
  const go = async (page, hash) => { await page.goto(BASE + '/' + hash); await page.waitForSelector('#app > *:not(.status)'); };
  const type = async (page, word) => { for (const ch of word) await page.click(`.key-letter[aria-label="${ch}"]`); };
  const check = async (page) => { await page.click('.key-check'); await page.waitForTimeout(150); };
  const has = async (page, sel) => !!(await page.$(sel));
  const text = async (page, sel) => ((await page.$(sel)) ? (await page.textContent(sel)).trim() : null);
  const hashId = (page) => decodeURIComponent((page.url().split('#/r/')[1] || ''));
  const heartsOff = (page) => page.$$eval('.hearts .heart.off', (h) => h.length);

  if (SHOTS) fs.mkdirSync(path.join(SHOTS, 'boards'), { recursive: true });
  // Данные — через браузер, как их видит приложение (в сборке — без полей автора).
  const { page: dataPage, ctx: dataCtx } = await mk();
  await dataPage.goto(BASE + '/');
  const data = (await dataPage.evaluate(async () => (await fetch('data/rebuses.json')).json())).rebuses;
  await dataCtx.close();
  const byId = Object.fromEntries(data.map((r) => [r.id, r]));
  const typable = (w) => w.toLowerCase().replace(/ё/g, 'е');

  // 1. Главная → уровень 1 → неверный ответ → верный → «Дальше» → прогресс на главной.
  {
    const { ctx, page } = await mk();
    await go(page, '#/'); await shot(page, '01-home');
    expect((await page.$$('.level-card')).length === 3, 'главная: три уровня');
    await page.click('.level-card[data-level="1"]');
    await page.waitForSelector('.board');
    const id = hashId(page);
    const r = byId[id];
    expect(r && r.id === data.find((x) => x.level === 1).id, `уровень 1 начинается с первого ребуса, а открыт ${id}`);
    await shot(page, '02-level1-first-rebus');
    await type(page, 'ааб'); await shot(page, '03-typed');
    expect(await text(page, '.answer-input .typed') === 'ААБ', 'набранные буквы видны в поле');
    await check(page); await shot(page, '04-wrong', 700);
    expect(await heartsOff(page) === 1, 'неверный ответ: гаснет одно сердечко');
    expect(await has(page, '.msg.try'), 'неверный ответ: «попробуй ещё»');
    expect(await text(page, '.answer-input .typed') === '', 'после неверного ответа поле очищено');
    await type(page, typable(r.answer));
    await check(page); await shot(page, '05-correct', 1200);
    expect(/Молодец/.test(await text(page, '.result-inline.ok') || ''), 'верный ответ: «Молодец!»');
    expect(await has(page, '.dock-done.shown .btn-next'), 'после ответа — кнопка «Дальше»');
    expect(await text(page, '.mini-stars') === `⭐ 1/${Math.min(20, data.filter((x) => x.level === 1).length)}`, 'звезда этапа засчитана');
    await page.click('.btn-next'); await page.waitForSelector('.board'); await shot(page, '06-next-rebus');
    expect(hashId(page) !== id && byId[hashId(page)].level === 1, '«Дальше» открывает следующий ребус уровня');
    await page.click('.back'); await page.waitForSelector('.level-card'); await shot(page, '07-home-progress');
    expect(/1/.test(await text(page, '.level-card[data-level="1"]') || ''), 'на главной виден прогресс уровня 1');
    await ctx.close();
  }
  // 2. vorona: «варона» → «Пишется так» → письмо по образцу → готово; повторное открытие.
  if (byId.vorona) {
    const { ctx, page } = await mk();
    await go(page, '#/r/vorona'); await page.waitForSelector('.kbd'); await shot(page, '10-vorona');
    await type(page, 'варона'); await check(page); await shot(page, '11-vorona-fix', 400);
    expect(/Пишется так/.test(await text(page, '.result-inline.fix') || ''), 'ошибка в слове: «Пишется так»');
    expect(await has(page, '.result-inline.fix .fix-letter'), 'ошибочная буква отмечена');
    expect(await heartsOff(page) === 1, 'ошибка в слове тратит сердечко');
    await page.waitForTimeout(1700); await shot(page, '12-vorona-copy');
    expect(await has(page, '.input-wrap.copy .ghost'), 'слово по образцу — бледными буквами');
    await type(page, 'вар'); await shot(page, '13-vorona-copy-miss');
    expect(await has(page, '.ghost .g.miss') && await has(page, '.input-wrap.off-track'), 'не та буква в образце отмечена');
    for (let i = 0; i < 2; i++) await page.click('.key-erase');
    await type(page, 'орона'); await shot(page, '14-vorona-done', 1200);
    expect(await has(page, '.result-inline.ok') && await has(page, '.dock-done.shown .btn-next'), 'по образцу написано — ребус отгадан');
    await page.reload(); await page.waitForSelector('.board'); await shot(page, '15-vorona-reopen');
    expect(/Отгадано/.test(await text(page, '.answer-done .result-inline.ok') || ''), 'повторно: «Отгадано!»');
    expect(await has(page, '.answer-done .fix-mark'), 'повторно: ошибочная буква подчёркнута');
    expect(!(await has(page, '.kbd:not(.gone)')), 'повторно: клавиатуры нет');
    await ctx.close();
  }
  // 3. Подсказка после двух ошибок, разбор после третьей.
  if (byId.podarok) {
    const { ctx, page } = await mk();
    await go(page, '#/r/podarok'); await page.waitForSelector('.kbd');
    await type(page, 'ааа'); await check(page);
    expect(!(await has(page, '.hint-btn')), 'после одной ошибки подсказки нет');
    await type(page, 'ббб'); await check(page); await shot(page, '20-two-errors', 700);
    expect(await has(page, '.hint-btn'), 'после двух ошибок — кнопка подсказки');
    await page.click('.hint-btn'); await shot(page, '21-hint-open', 600);
    expect(await text(page, '.hint .hint-text') === byId.podarok.hint, 'подсказка открывается по нажатию');
    await type(page, 'ввв'); await check(page); await shot(page, '22-reveal', 1300);
    expect(await has(page, '.result-inline.reveal'), 'после трёх ошибок слово показано');
    expect((await page.$$('.explain .step')).length === byId.podarok.parts.length, 'разбор: по шагу на каждую часть');
    expect(await heartsOff(page) === 3, 'после трёх ошибок все сердечки погасли');
    await ctx.close();
  }
  // 4. Легенда «?» на ребусах с разными приёмами; «Новый значок» сам один раз.
  {
    const { ctx, page } = await mk();
    for (const id of ['sup', 'shar', 'schuka', 'groza', 'stol', 'dvor', 'dym', 'leyka', 'ruka', 'penal', 'zayac', 'podarok', 'banan', 'son'].filter((x) => byId[x])) {
      await go(page, '#/r/' + id); await page.waitForSelector('.help-btn');
      expect(!(await has(page, 'dialog[open]')), `${id}: знакомый приём — легенда сама не открывается`);
      await page.click('.help-btn'); await page.waitForSelector('dialog.legend[open]');
      await shot(page, '30-legend-' + id, 400);
      expect((await page.$$('dialog.legend .legend-card')).length >= 1, `${id}: в легенде есть карточки`);
      await page.click('.legend-ok');
      await page.waitForTimeout(100);
      expect(!(await has(page, 'dialog[open]')), `${id}: легенда закрывается по «Понятно!»`);
    }
    await ctx.close();
  }
  if (byId.dvor) {
    const { ctx, page } = await mk({ seen: false });
    await go(page, '#/r/dvor'); await page.waitForSelector('dialog.legend[open]'); await shot(page, '31-legend-fresh', 600);
    expect(/Новый значок/.test(await text(page, 'dialog.legend .legend-title') || ''), 'новый приём: «Новый значок!»');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    expect(!(await has(page, 'dialog[open]')), 'свежая легенда закрывается по Escape');
    await page.reload(); await page.waitForSelector('.board'); await page.waitForTimeout(500);
    expect(!(await has(page, 'dialog[open]')), 'легенда нового приёма показывается один раз');
    await ctx.close();
  }
  // 5. Кубок, «Все ребусы», «О приложении».
  {
    const { ctx, page } = await mk();
    const lvl1 = data.filter((r) => r.level === 1);
    await go(page, '#/');
    await page.evaluate((ids) => localStorage.setItem('rebus-progress-v1', JSON.stringify(Object.fromEntries(ids.map((id, i) => [id, i % 3 ? { tries: 0, status: 'solved' } : { tries: 3, status: 'revealed' }])))), lvl1.slice(0, 20).map((r) => r.id));
    await page.reload(); await go(page, '#/cup/1/1'); await page.waitForSelector('.cup-card'); await shot(page, '40-cup');
    await go(page, '#/all'); await shot(page, '41-all');
    expect((await page.$$('.tile')).length === data.length, `«Все ребусы»: ${data.length} плиток`);
    await page.evaluate(() => window.scrollTo(0, 99999)); await shot(page, '42-all-bottom');
    await go(page, '#/about'); await shot(page, '43-about');
    expect(await has(page, '.about-card'), '«О приложении» открывается');
    await go(page, '#/'); await shot(page, '44-home-after-cup');
    await page.click('.all-link'); await page.waitForSelector('.grid'); await page.click('.tile'); await page.waitForSelector('.board');
    await shot(page, '45-from-all-tile');
    expect(hashId(page) === data[0].id, 'плитка открывает свой ребус');
    await page.click('.back'); await page.waitForSelector('.grid');
    await page.click('.back'); await page.waitForSelector('.level-card');
    await page.click('.lic-link'); await page.waitForSelector('.about-card');
    await ctx.close();
  }
  // 6. Физическая клавиатура: Enter проверяет, а на отгаданном ребусе нажимает «Дальше» —
  // и сразу после ответа, и при повторном открытии. Пока открыта легенда — не нажимает.
  if (byId.vorona) {
    const { ctx, page } = await mk();
    await go(page, '#/r/vorona'); await page.waitForSelector('.kbd');
    await type(page, 'ворона'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
    expect(await has(page, '.result-inline.ok'), 'Enter проверяет ответ');
    const next = await page.$eval('.btn-next', (b) => b.textContent);
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const after = hashId(page);
    expect(after && after !== 'vorona', `Enter после ответа нажимает «${next}»`);
    await go(page, '#/r/vorona'); await page.reload(); await page.waitForSelector('.answer-done');
    await page.click('.help-btn'); await page.waitForSelector('dialog.legend[open]');
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    expect(hashId(page) === 'vorona', 'Enter в легенде закрывает её, а не листает ребусы');
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    expect(hashId(page) === 'vorona', 'Enter на кнопке «?» нажимает «?», а не «Дальше»');
    if (await has(page, 'dialog[open]')) { await page.click('.legend-ok'); await page.waitForTimeout(100); }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    expect(hashId(page) === after, 'Enter на отгаданном ребусе (повторно) нажимает «Дальше»');
    await ctx.close();
  }
  // 7. Доски всех ребусов: рисуются, по узлу на каждую часть.
  if (BOARDS) {
    const { ctx, page } = await mk();
    for (const r of data) {
      await go(page, '#/r/' + r.id); await page.waitForSelector('.board');
      const n = await page.$$eval('.board-row > .part', (p) => p.length).catch(() => -1);
      expect(n === r.parts.length, `${r.id}: на доске ${n} частей из ${r.parts.length}`);
      if (SHOTS) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(SHOTS, 'boards', r.id + '.png'), animations: 'disabled', caret: 'hide' });
      }
    }
    await ctx.close();
  }
  await browser.close();
  if (failures.length) {
    console.log(failures.map((f) => '✗ ' + f).join('\n'));
    console.log(`\nПроверок: ${checks}, не прошло: ${failures.length}`);
    process.exit(1);
  }
  console.log(`Сценарии в порядке: ${checks} проверок, ошибок консоли нет`);
})().catch((e) => { console.error(e); process.exit(1); });
