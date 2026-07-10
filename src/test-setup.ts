import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only registers its own cleanup when `globals: true` exposes
// `afterEach`; this project keeps globals off, so register it explicitly.
afterEach(cleanup);
