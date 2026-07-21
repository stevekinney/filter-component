import { defineConfig, devices } from '@playwright/test';

// Playwright forces colored output for its workers. Remove an inherited,
// contradictory setting before it spawns child Node processes so they do not
// report that NO_COLOR was ignored.
delete process.env['NO_COLOR'];

const testServerPort = Number(process.env['PLAYWRIGHT_TEST_PORT'] ?? '4173');
if (!Number.isInteger(testServerPort) || testServerPort < 1 || testServerPort > 65_535) {
  throw new Error('PLAYWRIGHT_TEST_PORT must be an integer from 1 to 65535.');
}
const testServerUrl = `http://localhost:${testServerPort}`;

export default defineConfig({
  testDir: './end-to-end',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: testServerUrl,
    trace: 'retain-on-failure',
  },
  expect: {
    // Strict on purpose: no diff-pixel budget, and a per-pixel color
    // threshold well below the default 0.2 — the default silently absorbed
    // a real 54% → 60% alpha change to the secondary-text color. Rendering
    // is deterministic on one machine, so tight settings stay stable.
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      threshold: 0.05,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `bunx vite --port ${testServerPort} --strictPort`,
    url: testServerUrl,
    // Reusing a server can silently exercise a different checkout.
    reuseExistingServer: false,
  },
});
