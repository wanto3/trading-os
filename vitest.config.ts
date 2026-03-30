import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['api/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text'],
    },
  },
});
