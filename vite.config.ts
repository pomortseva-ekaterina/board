import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

function canvasKitPlugin(): PluginOption {
  return {
    name: 'canvaskit-esm',
    transform(code, id) {
      if (id.includes('canvaskit.js')) {
        return code + '\nexport default CanvasKitInit;';
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      // include: [/\/src\//],
    }),
    canvasKitPlugin(), //skia для export default
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    //skia
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['canvaskit-wasm', 'skia_pdf'], //skia
  },
});
