import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component and unit tests (Vitest + React Testing Library + MSW). Kept separate from
// vite.config.ts so the app build is unchanged, and limited to src/ so the Playwright
// specs in e2e/ are never picked up.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['src/features/processing/**'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'test-results/coverage',
    },
  },
});
