# Ребусы для детей

Ребусы на русском для детей 5–8 лет. Работает в браузере, ставится на телефон как приложение и открывается без интернета. Прогресс хранится только в браузере (localStorage). Трекеров и внешних запросов нет.

## Разработка

```sh
npm ci
npm run dev        # локальный сервер
npm run validate   # проверка ребусов
npm run stats      # какие ответы и картинки уже есть
npm run build      # проверка + сборка в dist/
npm run check:screens  # вёрстка на 15 размерах телефонов и планшетов (нужен запущенный `npx vite preview` и Playwright)
```

## Устройство

- `public/data/rebuses.json` — все ребусы (данные отдельно от кода); как их составлять — [docs/REBUSES.md](docs/REBUSES.md)
- `src/rebus-core.js` — правила ребуса: запятые, зачёркнутые буквы, замены, перевёрнутые картинки
- `src/ui/` — экраны, `src/store.js` — прогресс, `src/install.js` — установка на главный экран
- `tools/validate.mjs` — проверяет, что каждый ребус складывается в свой ответ
- PWA (манифест, service worker) генерирует `vite-plugin-pwa`

### Формат ребуса

```json
{
  "id": "vorona", "answer": "ВОРОНА", "level": 3, "theme": "птицы", "techniques": ["replace"],
  "hint": "Каркает на заборе",
  "parts": [
    { "type": "pic", "emoji": "👑", "word": "КОРОНА", "replace": [["К", "В"]] }
  ]
}
```

Часть `pic`: `cutStart` / `cutEnd` — запятые до/после картинки, `flip` — картинка вверх ногами, `remove` — зачёркнутые буквы, `replace` — замены вида `[["К","Р"]]`.

## Публикация

GitHub Actions (`.github/workflows/deploy.yml`) собирает и публикует сайт на GitHub Pages. В настройках репозитория: Settings → Pages → Source: **GitHub Actions**.

## Лицензия

MIT. Сторонние компоненты (шрифт Nunito, Workbox, иконка из Noto Emoji) — в [public/licenses.txt](public/licenses.txt).
