import { describe, expect, it } from 'vitest';
import { findConditionalBraceViolations } from './check-conditional-braces.ts';

describe('findConditionalBraceViolations', () => {
  it('allows a one-line conditional without an else branch', () => {
    expect(findConditionalBraceViolations('if (ready) run();', 'example.ts')).toEqual([]);
  });

  it('requires blocks when a conditional has an else branch', () => {
    expect(
      findConditionalBraceViolations(
        "if (query !== '') onQueryChange('');\nelse onCloseMenu();",
        'example.ts',
      ),
    ).toEqual([{ filePath: 'example.ts', line: 1 }]);
  });

  it('allows fully braced if, else-if, and else branches', () => {
    const source = `
if (first) {
  runFirst();
} else if (second) {
  runSecond();
} else {
  runFallback();
}
`;

    expect(findConditionalBraceViolations(source, 'example.ts')).toEqual([]);
  });

  it('requires a block for an else-if branch', () => {
    const source = `
if (first) {
  runFirst();
} else if (second) runSecond();
`;

    expect(findConditionalBraceViolations(source, 'example.ts')).toEqual([
      { filePath: 'example.ts', line: 4 },
    ]);
  });
});
