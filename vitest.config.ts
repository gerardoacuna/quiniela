import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests share a single Supabase DB and mutate stage state; run files serially.
    // Unit tests are unaffected because they don't touch shared external state.
    fileParallelism: process.env.SUPABASE_INTEGRATION !== '1',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test'),
      // server-only throws in non-Next.js environments; no-op in tests.
      'server-only': path.resolve(__dirname, './src/test/mocks/server-only.ts'),
    },
  },
});
