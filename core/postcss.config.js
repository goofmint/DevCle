/**
 * PostCSS configuration for Tailwind CSS v4
 *
 * This configuration enables:
 * - Tailwind CSS v4 processing via @tailwindcss/postcss
 * - Autoprefixer for browser compatibility
 *
 * Note: In Tailwind CSS v4, the PostCSS plugin has moved to a separate package
 * (@tailwindcss/postcss) instead of being part of the main tailwindcss package.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
