// =============================================================================
// Horizon — Root Vitest Configuration
// =============================================================================
// Vitest runs from the monorepo root. For client tests that need jsdom,
// set environment based on file path glob.
// =============================================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['client/**', 'jsdom']],
    setupFiles: ['./client/src/test-setup.ts'],
    globals: true,
    restoreMocks: true,
  },
});
