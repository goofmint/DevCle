/**
 * Vitest setup file
 *
 * This file runs before all tests and sets up the testing environment.
 * Currently empty but can be extended with:
 * - Global test utilities
 * - Mock configurations
 * - Test environment setup
 */

// Import testing library cleanup
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Cleanup after each test
 * Removes any rendered components from the DOM
 */
afterEach(() => {
  cleanup();
});

/**
 * Polyfill for window.matchMedia
 * JSDOM doesn't support window.matchMedia, so we provide a minimal implementation
 * This is a standard browser API polyfill, not a mock of our component logic
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated but included for compatibility
    removeListener: () => {}, // deprecated but included for compatibility
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
