import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    assetsInclude: ['**/*.jpeg', '**/*.jpg', '**/*.png'],
    plugins: [react(), tailwindcss()],
    // A chave GEMINI_API_KEY fica só no servidor (api/imagem.ts): nunca é injetada no bundle do navegador.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

// cache-bust: 20260616-192249
