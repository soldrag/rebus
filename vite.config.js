import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// В сборке ребусы — без отступов и без полей, которые нужны только автору и проверкам
// (tools/validate.mjs): приложение их не читает. Раньше, чем vite-plugin-pwa считает офлайн-кеш
// (closeBundle), поэтому ревизия в sw.js — от того, что реально лежит в dist.
//   Приложение читает: id, answer, accept, level, hint, parts, notMisspelled (src/).
const AUTHOR_ONLY = ['theme', 'techniques', 'source', 'exceptions'];
const appRebus = (r) => Object.fromEntries(Object.entries(r).filter(([k, v]) =>
  !AUTHOR_ONLY.includes(k) && !(Array.isArray(v) && !v.length))); // пустые accept, notMisspelled
const compactData = {
  name: 'compact-data',
  apply: 'build',
  writeBundle({ dir }) {
    const file = path.join(dir, 'data/rebuses.json');
    const { rebuses } = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ rebuses: rebuses.map(appRebus) }));
  },
};

export default defineConfig({
  // Относительные пути: работает и на <user>.github.io/<repo>/, и на своём домене.
  base: './',
  // Один модуль без <link rel="modulepreload">: полифил предзагрузки модулей не нужен.
  build: { modulePreload: { polyfill: false } },
  plugins: [
    compactData,
    VitePWA({
      // Новую версию ставим сами, когда это не мешает ребёнку (см. src/main.js).
      registerType: 'prompt',
      // Иконки нужны только при установке — в офлайн-кеш их не кладём (это ~70 % трафика).
      includeManifestIcons: false,
      manifest: {
        name: 'Ребусы для детей',
        short_name: 'Ребусы',
        description: 'Весёлые ребусы на русском для детей 5–8 лет',
        lang: 'ru',
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFF8EC',
        theme_color: '#FFF8EC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json,txt}'],
        // Без внешних запросов и без сторонних сервисов: всё кешируется локально.
        navigateFallback: 'index.html',
      },
    }),
  ],
});
