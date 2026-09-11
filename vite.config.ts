/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  test: {
    // Domain tests run in node; component tests need a DOM. Vitest 4 dropped
    // environmentMatchGlobs, so the split is two projects sharing this config.
    projects: [
      { extends: true, test: { name: 'domain', environment: 'node', include: ['src/**/*.test.ts'] } },
      { extends: true, test: { name: 'components', environment: 'jsdom', include: ['src/**/*.test.tsx'] } },
    ],
  },
});
