import { vitePlugin as remix } from '@remix-run/dev';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeHighlight from 'rehype-highlight';

/**
 * Vite configuration for DRM core application
 *
 * This configuration sets up:
 * - Remix plugin for SSR and routing (production/dev)
 * - MDX plugin for Markdown content with React components
 * - React plugin for testing
 * - TypeScript path aliases
 * - Testing configuration with Vitest
 */
export default defineConfig(({ command, mode }): UserConfig => {
  const isVitest = command === 'test';

  return {
    plugins: isVitest
      ? [react()]
      : [
          // IMPORTANT: MDX plugin must be placed BEFORE Remix plugin
          mdx({
            // MDX configuration for Terms of Service and other legal pages
            // Allows using React components inside Markdown files
            remarkPlugins: [
              remarkFrontmatter, // Parse YAML frontmatter (prevents it from rendering as content)
              remarkMdxFrontmatter, // Convert frontmatter to exports (e.g., export const meta)
              remarkGfm, // GitHub Flavored Markdown support
            ],
            rehypePlugins: [rehypeHighlight], // Syntax highlighting for code blocks
          }),
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

    // Dependency optimization for ESM modules
    optimizeDeps: {
      include: ['gridstack'],
    },

    // SSR configuration for external dependencies
    ssr: {
      noExternal: ['gridstack'],
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
      // Note: Environment variable loading is handled in vitest.setup.ts
      // (vitest 2.0+ removed test.envDir option)
      // Run tests sequentially to avoid database conflicts
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
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
