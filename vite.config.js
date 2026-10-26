import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Относительные пути: работает и на <user>.github.io/<repo>/, и на своём домене.
  base: './',
  plugins: [
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
