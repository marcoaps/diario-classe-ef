import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/',
    assetsInclude: ['**/*.jpeg', '**/*.jpg', '**/*.png'],
    plugins: [
      react(),
      tailwindcss(),
      // PWA: permite instalar o Diário no celular e abrir sem internet.
      // O service worker guarda o app (JS/CSS/HTML) no aparelho; os dados
      // da chamada ficam no IndexedDB (src/data/offlineChamada.ts).
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['pwa/apple-touch-icon.png', 'logo-iop.png'],
        manifest: {
          name: 'Diário de Classe EF — I.O.P.',
          short_name: 'Diário IOP',
          description: 'Chamada, notas e planejamento de Educação Física — E.E. Instituto Odilon Pratagi',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#EEF9F3',
          theme_color: '#0B7A3D',
          icons: [
            {src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png'},
            {src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png'},
            {src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          // Só o essencial do app vai para o cache; imagens grandes
          // (banco-imagens, cabeçalhos, brasão) continuam vindo da rede.
          globPatterns: ['**/*.{js,css,html}', 'pwa/*.png', 'logo-iop.png'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          // /api e páginas estáticas (ex.: upload-folha.html) nunca passam pelo fallback.
          navigateFallbackDenylist: [/^\/api\//, /\.html$/],
          runtimeCaching: [
            {
              // O visual do app depende do Tailwind via CDN (index.html).
              // Sem este cache, a tela abriria sem estilo quando offline.
              urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'tailwind-cdn',
                cacheableResponse: {statuses: [0, 200]},
                expiration: {maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30},
              },
            },
          ],
        },
      }),
    ],
    // A chave GEMINI_API_KEY fica só no servidor (api/imagem.ts): nunca é injetada no bundle do navegador.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

// cache-bust: 20260927
