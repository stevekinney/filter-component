import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, traverse } from '@babel/core';
import type { NodePath, types } from '@babel/core';

export type ConditionalBraceViolation = {
  filePath: string;
  line: number;
};

function isElseIf(path: NodePath<types.IfStatement>): boolean {
  const { parentPath } = path;

  if (!parentPath?.isIfStatement()) return false;
  return parentPath.node.alternate === path.node;
}

function hasExplicitBranchBlocks(node: types.IfStatement): boolean {
  if (node.consequent.type !== 'BlockStatement') return false;
  if (node.alternate === null) return true;
  return node.alternate.type === 'BlockStatement' || node.alternate.type === 'IfStatement';
}

/** Finds if/else chains whose branches are not explicit blocks. */
export function findConditionalBraceViolations(
  source: string,
  filePath: string,
): ConditionalBraceViolation[] {
  const syntaxTree = parseSync(source, {
    filename: filePath,
    parserOpts: {
      sourceType: 'module',
      plugins: filePath.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    },
  });

  if (!syntaxTree) return [];

  const violations: ConditionalBraceViolation[] = [];

  traverse(syntaxTree, {
    IfStatement(path) {
      const { node } = path;

      if (node.alternate === null && !isElseIf(path)) return;
      if (hasExplicitBranchBlocks(node)) return;

      violations.push({
        filePath,
        line: node.loc?.start.line ?? 1,
      });
    },
  });

  return violations;
}

async function checkRepository(): Promise<void> {
  const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
  const sourceDirectories = ['src', 'end-to-end', 'scripts'];
  const sourceFileGlob = new Bun.Glob('**/*.{ts,tsx}');
  const rootSourceFileGlob = new Bun.Glob('*.ts');
  const sourceFilePaths: string[] = [];

  for (const sourceDirectory of sourceDirectories) {
    for await (const relativePath of sourceFileGlob.scan({
      cwd: join(repositoryRoot, sourceDirectory),
      onlyFiles: true,
    })) {
      sourceFilePaths.push(join(sourceDirectory, relativePath));
    }
  }

  for await (const relativePath of rootSourceFileGlob.scan({
    cwd: repositoryRoot,
    onlyFiles: true,
  })) {
    sourceFilePaths.push(relativePath);
  }

  const violations: ConditionalBraceViolation[] = [];

  for (const filePath of sourceFilePaths.sort()) {
    const source = await Bun.file(join(repositoryRoot, filePath)).text();
    violations.push(...findConditionalBraceViolations(source, filePath));
  }

  if (violations.length === 0) {
    console.log('OK: all if/else branches use braces.');
    return;
  }

  console.error('Every branch in an if/else chain must use braces:');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line}`);
  }
  process.exitCode = 1;
}

if (import.meta.main) {
  await checkRepository();
}
