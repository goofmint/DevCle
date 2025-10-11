/**
 * Type declarations for Vite environment
 *
 * This file provides TypeScript type definitions for Vite-specific
 * module patterns and asset imports.
 */

/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

/**
 * CSS modules with ?url suffix
 *
 * When importing CSS files with the ?url suffix, Vite returns
 * the URL of the CSS file instead of injecting the styles.
 * This is useful for Remix's links function.
 *
 * @see https://vitejs.dev/guide/assets.html#explicit-url-imports
 */
declare module '*.css?url' {
  const url: string;
  export default url;
}
