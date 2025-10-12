import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS configuration for DRM core application
 *
 * This configuration:
 * - Scans app directory for Tailwind classes
 * - Uses selector strategy for dark mode (class-based)
 * - Uses default theme with minimal customization
 * - Includes Typography plugin for prose classes (MDX content styling)
 * - Prepares for future design system extension
 */
export default {
  content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'selector', // Enable class-based dark mode (e.g., <html class="dark">)
  theme: {
    extend: {
      // Future: Add custom colors, fonts, spacing, etc.
    },
  },
  plugins: [
    // Typography plugin for prose classes (used in MDX content)
    // Provides prose, prose-invert, and other typography utilities
    require('@tailwindcss/typography'),
  ],
} satisfies Config;
