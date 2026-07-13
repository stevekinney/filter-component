import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const maximumLines = 500;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const implementationFiles = new Bun.Glob('src/**/*.{ts,tsx}');

const isTestInfrastructure = (path: string): boolean =>
  path.endsWith('.test.ts') ||
  path.endsWith('.test.tsx') ||
  path.endsWith('.d.ts') ||
  path.endsWith('/test-setup.ts') ||
  path.endsWith('/filter-test-setup.tsx');

const countLines = (source: string): number => {
  if (source.length === 0) return 0;
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
};

const lineCounts: Array<{ path: string; lines: number }> = [];

for await (const path of implementationFiles.scan({
  cwd: repositoryRoot,
  onlyFiles: true,
})) {
  if (isTestInfrastructure(path)) continue;

  const source = await Bun.file(join(repositoryRoot, path)).text();
  lineCounts.push({ path, lines: countLines(source) });
}

const violations = lineCounts
  .filter(({ lines }) => lines > maximumLines)
  .sort((left, right) => right.lines - left.lines);

if (violations.length > 0) {
  console.error(`Implementation files must not exceed ${maximumLines} lines:`);
  for (const { path, lines } of violations) {
    console.error(`- ${path}: ${lines} lines`);
  }
  process.exitCode = 1;
} else {
  console.log(`OK: ${lineCounts.length} implementation files are ${maximumLines} lines or fewer.`);
}
