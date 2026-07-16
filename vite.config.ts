import { fileURLToPath, URL } from 'node:url';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const compilerPreset = reactCompilerPreset({
    // Production follows React's fail-open recommendation. The dedicated
    // compiler check is deliberately strict so an optimization bailout cannot
    // silently return after a dependency or source change.
    panicThreshold: mode === 'compiler-check' ? 'all_errors' : 'none',
  });
  if (mode === 'compiler-test') {
    // Vitest transforms modules in a server environment. Opt that one explicit
    // mode into the client compiler preset so render regressions exercise the
    // same memoization that development and production builds receive.
    compilerPreset.rolldown.applyToEnvironmentHook = () => true;
  }

  return {
    // V8 coverage must measure authored branches, not the React Compiler's
    // generated memo-cache sentinels and dependency comparisons. The compiler
    // remains part of development, production, and the focused compiler tests.
    plugins: [react(), ...(mode === 'test' ? [] : [babel({ presets: [compilerPreset] })])],
    resolve: {
      alias: {
        '@filter': fileURLToPath(new URL('./src/components/filter', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Chrome-extension runtime: Chrome 133 is the floor (Popover API,
      // CSS anchor positioning, showPopover({ source }), native nesting).
      target: 'chrome133',
      cssTarget: 'chrome133',
    },
  };
});
