import { fileURLToPath, URL } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig(({ mode }) => ({
  // V8 coverage must measure authored branches, not the React Compiler's
  // generated memo-cache sentinels and dependency comparisons. The compiler
  // remains part of every development and production build.
  plugins: [
    react(),
    ...(mode === 'test' ? [] : [babel({ presets: [reactCompilerPreset()] })]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Chrome-extension runtime: Chrome 133 is the floor (Popover API,
    // CSS anchor positioning, showPopover({ source }), native nesting).
    target: 'chrome133',
    cssTarget: 'chrome133',
  },
  test: {
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./src/test-setup.ts'],
    // Playwright owns end-to-end/*.spec.ts; keep them out of the vitest run.
    exclude: [...configDefaults.exclude, 'end-to-end/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/example/records.ts',
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/components/filter/filter-test-setup.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
}));
