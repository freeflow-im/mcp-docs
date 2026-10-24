/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    // Keep the browser's Host header so OAuth redirect URIs built by the server point at this dev server.
    proxy: Object.fromEntries(['/api', '/privacy', '/terms', '/support', '/llms.txt'].map((p) => [p, { target: 'http://localhost:3001', changeOrigin: false }])),
  },
  build: { outDir: '../dist/client', emptyOutDir: true },
  test: {
    root: '.',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/src/**/*.test.ts', 'plugin/**/*.test.ts', 'desktop/**/*.test.ts'],
    // Repositories created by the git tests start on "main" whatever the machine's git config says.
    // Tests expect the default assistant model, whatever AGENT_MODEL the machine running them sets.
    env: { AGENT_MODEL: '', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'init.defaultBranch', GIT_CONFIG_VALUE_0: 'main' },
  },
});
