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
  },
});
