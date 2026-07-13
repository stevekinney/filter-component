import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfiguration from './vite.config';

export default defineConfig((configurationEnvironment) => {
  const isCompilerTest = configurationEnvironment.mode === 'compiler-test';

  return mergeConfig(
    viteConfiguration(configurationEnvironment),
    defineConfig({
      test: {
        environment: 'jsdom',
        execArgv: ['--no-experimental-webstorage'],
        setupFiles: ['./src/test-setup.ts'],
        ...(isCompilerTest ? { include: ['src/**/*.compiler.test.tsx'] } : {}),
        // Playwright owns end-to-end/*.spec.ts. Compiler-specific render tests
        // run only through `test:compiler`, never through coverage.
        exclude: [
          ...configDefaults.exclude,
          'end-to-end/**',
          ...(isCompilerTest ? [] : ['src/**/*.compiler.test.tsx']),
        ],
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
    }),
  );
});
