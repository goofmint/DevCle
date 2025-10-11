import { vitePlugin as remix } from '@remix-run/dev';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';

/**
 * Vite configuration for DRM core application
 *
 * This configuration sets up:
 * - Remix plugin for SSR and routing (production/dev)
 * - React plugin for testing
 * - TypeScript path aliases
 * - Testing configuration with Vitest
 */
export default defineConfig(({ mode }): UserConfig => {
  const isTest = mode === 'test';

  return {
    plugins: isTest
      ? [react()]
      : [
          remix({
            // Remix configuration
            ignoredRouteFiles: ['**/*.test.{ts,tsx}'],
          }),
        ],

    // Development server configuration
    server: {
      port: 3000,
      host: '0.0.0.0', // Listen on all interfaces for Docker
      allowedHosts: [
        'devcle.test', // Development domain
        'devcle.com', // Production domain
        'localhost', // Local access
      ],
    },

    // Path resolution for imports
    resolve: {
      alias: {
        '~': '/app',
      },
    },

    // Test configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'build/',
          '**/*.config.{js,ts}',
          '**/*.test.{ts,tsx}',
        ],
      },
    },
  };
});
