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
