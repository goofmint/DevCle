import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS configuration for DRM core application
 *
 * This configuration:
 * - Scans app directory for Tailwind classes
 * - Uses default theme with minimal customization
 * - Prepares for future design system extension
 */
export default {
  content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Future: Add custom colors, fonts, spacing, etc.
    },
  },
  plugins: [],
} satisfies Config;
