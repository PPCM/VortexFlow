import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split the two heaviest third-party stacks (Three.js + the force-graph
        // helpers, and CodeMirror) into their own chunks so they can be
        // cached independently between sessions and aren't duplicated across
        // lazy-loaded routes. The rest is left to Vite/Rolldown's default
        // chunking, which keeps the initial bundle small.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](three|3d-force-graph|three-spritetext)[\\/]/.test(id)) {
            return 'three';
          }
          if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) {
            return 'codemirror';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    // Match CRA's behavior: collocated *.test.ts(x) files under src/.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    server: {
      deps: {
        // Pre-bundle some ESM-only packages so jest-dom matchers work
        // and CommonJS-style imports keep resolving in tests.
        inline: ['@testing-library/jest-dom'],
      },
    },
    // Editor libs (monaco, codemirror) ship with module-only entries that
    // vitest's resolver doesn't find. Tests mock them anyway, so alias to a
    // tiny stub module so the import statements resolve.
    alias: {
      'monaco-editor': new URL('./src/test-stubs/empty.ts', import.meta.url).pathname,
    },
    coverage: {
      // Baseline matching the current numbers. Raise these as new tests land
      // for the under-covered modules (AdminPanel, GraphList, api, websocket).
      // Per-module thresholds aren't worth the noise yet — track via reports.
      thresholds: {
        lines: 60,
        branches: 55,
        functions: 50,
        statements: 60,
      },
    },
  },
});
